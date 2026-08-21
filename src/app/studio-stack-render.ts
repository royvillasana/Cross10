/**
 * WebGL2 renderer for the layer stack.
 *
 * Compiles one program per stack signature (R54). Croix10's engine renderer
 * selects one of two prebuilt variants by boolean instead, which is a different
 * notion of "which program" — sharing a cache between the two would be exactly
 * the collision R54 exists to prevent.
 *
 * Framework-free and kept out of the React component, so resources are created
 * outside render, retained across unrelated interactions, and released once. The
 * same renderer serves live preview and the runtime export frame, so the two
 * cannot drift.
 */

import {
  studioAssembleStackFragmentShader,
  studioLayerUniformName,
  studioLayerUniforms,
  studioStackSignature,
  studioStackVertexShader,
  type StudioLayerTypeId,
  type StudioStackEntry,
} from "./studio-layers";
import {
  rasterizeStudioPathAtlas,
  studioPathAtlasSignature,
  type StudioPathAtlas,
} from "./studio-path-mask";
import {
  correctStudioHookErrors,
  studioHookLineOffset,
} from "./studio-hook";
import { type StudioVertexPoint } from "./studio-stack-state";

/** One layer's uniform values, keyed by the type's own uniform names. */
export type StudioLayerValues = Readonly<{
  typeId: StudioLayerTypeId;
  /**
   * Decoded media for an image layer, already loaded by the canvas.
   *
   * A source rather than a texture: the renderer owns GL objects, and handing
   * it a texture made elsewhere would put their lifetime in two places.
   */
  image?: TexImageSource | null;
  /** A drawn path, baked into the assembled program (R69). */
  vertices?: readonly StudioVertexPoint[];
  values: Readonly<Record<string, number | readonly [number, number, number]>>;
}>;

export type StudioStackSceneParameters = Readonly<{
  backgroundColor: readonly [number, number, number];
  /** Pointer position in field units, from the centre of the frame (R68). */
  cursor: readonly [number, number];
  /** Where the loop has got to, 0 at its start and 1 at its end. */
  loop: number;
  includeBackground: boolean;
  layers: readonly StudioLayerValues[];
  /**
   * The author's own chunk, if they have written one.
   *
   * Part of the scene rather than of the renderer, because it is part of the
   * *composition*: the export frame and the delivered source have to assemble
   * the same program the preview does, and a hook the renderer held privately
   * would be in one of the three and not the others.
   */
  hookSource?: string;
}>;

export interface StudioStackRenderer {
  dispose: () => void;
  /** Why the current hook did not compile, or null while it does. */
  hookError: () => string | null;
  readonly gl: WebGL2RenderingContext;
  render: (
    parameters: StudioStackSceneParameters,
    width: number,
    height: number,
  ) => void;
}

type UniformLocations = Map<string, WebGLUniformLocation | null>;

interface CompiledStack {
  readonly program: WebGLProgram;
  readonly uniforms: UniformLocations;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Studio could not create a WebGL2 shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "unknown compile error";
    gl.deleteShader(shader);
    throw new Error(`Studio stack shader compile failed: ${log}`);
  }
  return shader;
}

function compileStack(
  gl: WebGL2RenderingContext,
  stack: readonly StudioStackEntry[],
  hookSource = "",
): CompiledStack {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, studioStackVertexShader());
  const fragment = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    studioAssembleStackFragmentShader(stack, hookSource),
  );
  const program = gl.createProgram();
  if (!program) throw new Error("Studio could not create a WebGL2 program.");

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "unknown link error";
    gl.deleteProgram(program);
    throw new Error(`Studio stack shader link failed: ${log}`);
  }

  const uniforms: UniformLocations = new Map();
  const total = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let index = 0; index < total; index += 1) {
    const info = gl.getActiveUniform(program, index);
    if (!info) continue;
    uniforms.set(info.name.replace(/\[0\]$/, ""), gl.getUniformLocation(program, info.name));
  }

  return { program, uniforms };
}

/**
 * Creates the stack renderer for one WebGL2 context.
 *
 * Programs compile lazily and are cached by stack signature, so reordering back
 * to a stack the user already had reuses its program rather than recompiling.
 */
export function createStudioStackRenderer(
  gl: WebGL2RenderingContext,
): StudioStackRenderer {
  const compiled = new Map<string, CompiledStack>();

  /**
   * The last program that compiled, and why the current one did not.
   *
   * A hand-written hook is the first thing in this product that can be *wrong*
   * -- every other input is a control whose domain the schema guarantees. So
   * the renderer holds onto the last good program and keeps drawing it, which
   * is the difference between an editor and a trapdoor: an author who types a
   * missing semicolon should see their work and a message, not a blank canvas.
   */
  let lastGood: CompiledStack | null = null;
  let hookError: string | null = null;

  function resolveStack(
    stack: readonly StudioStackEntry[],
    hookSource: string,
  ): CompiledStack | null {
    const signature = studioStackSignature(stack, hookSource);
    const cached = compiled.get(signature);
    if (cached) {
      hookError = null;
      lastGood = cached;
      return cached;
    }

    try {
      const program = compileStack(gl, stack, hookSource);
      compiled.set(signature, program);
      hookError = null;
      lastGood = program;
      return program;
    } catch (failure) {
      // Reported against the source the author is looking at rather than the
      // assembled program: a message pointing at line 412 of something nobody
      // wrote tells them the error is somewhere they cannot look.
      hookError = correctStudioHookErrors(
        failure instanceof Error ? failure.message : String(failure),
        studioHookLineOffset(
          studioAssembleStackFragmentShader(stack, hookSource),
          hookSource,
        ),
      );
      // Not cached under this signature: the next keystroke should try again
      // rather than be told the same failure from memory.
      return lastGood;
    }
  }

  /**
   * The texture for one layer, created once and re-uploaded when its source
   * changes.
   *
   * Keyed by layer index rather than by asset, which is the same key the
   * texture unit uses: a layer that changes its picture keeps its texture and
   * its unit, and only the pixels change. Textures are freed with the renderer,
   * so a stack edit does not leak one per frame.
   *
   * A layer with no media yet binds a one-pixel transparent texture rather than
   * nothing: an unbound sampler reads as undefined, which on some drivers is
   * whatever was last in that unit -- another layer's picture.
   */
  const textures = new Map<number, WebGLTexture>();
  let blankTexture: WebGLTexture | null = null;

  /**
   * The rasterized regions, rebuilt only when a drawing changes.
   *
   * Held with the renderer rather than rebuilt per frame, because rasterizing
   * thousands of nodes sixty times a second would cost more than the per-pixel
   * test this replaced. The signature is the cheap question -- is this the same
   * drawing -- asked before the expensive answer.
   */
  let pathAtlas: StudioPathAtlas | null = null;
  let pathAtlasSignature = "";
  let pathTexture: WebGLTexture | null = null;

  const resolvePathAtlas = (
    paths: ReadonlyMap<number, readonly StudioVertexPoint[]>,
  ): StudioPathAtlas | null => {
    const signature = studioPathAtlasSignature(paths);
    if (signature === pathAtlasSignature) return pathAtlas;

    pathAtlasSignature = signature;
    pathAtlas = rasterizeStudioPathAtlas(paths);

    if (!pathAtlas) return null;
    if (!pathTexture) pathTexture = gl.createTexture();
    if (!pathTexture) return pathAtlas;

    gl.bindTexture(gl.TEXTURE_2D, pathTexture);
    // Clamped, so a region cannot repeat across the frame, and linear, which is
    // what carries the rasterizer's antialiased edge through to the composite
    // instead of re-quantising it at the sampler.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pathAtlas.image,
    );

    return pathAtlas;
  };

  const resolveTexture = (
    index: number,
    source: TexImageSource | null | undefined,
  ): WebGLTexture | null => {
    if (!source) {
      if (!blankTexture) {
        blankTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, blankTexture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          1,
          1,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          new Uint8Array([0, 0, 0, 0]),
        );
      }
      return blankTexture;
    }

    let texture = textures.get(index);
    if (!texture) {
      const created = gl.createTexture();
      if (!created) return null;
      texture = created;
      textures.set(index, texture);
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Clamped and linear: a picture placed on the frame is not a tile, and the
    // body already returns nothing outside the picture's own bounds.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return texture;
  };

  return {
    /** Why the current hook did not compile, or null while it does. */
    hookError(): string | null {
      return hookError;
    },
    dispose() {
      for (const entry of compiled.values()) gl.deleteProgram(entry.program);
      compiled.clear();
      // Textures are the renderer's, so they go with it. Left behind they
      // would outlive the context that can free them.
      for (const texture of textures.values()) gl.deleteTexture(texture);
      textures.clear();
      if (blankTexture) gl.deleteTexture(blankTexture);
      blankTexture = null;
      if (pathTexture) gl.deleteTexture(pathTexture);
      pathTexture = null;
      pathAtlas = null;
      pathAtlasSignature = "";
    },
    gl,
    render(parameters, width, height) {
      if (width <= 0 || height <= 0) return;

      const stack: readonly StudioStackEntry[] = parameters.layers.map((layer) => ({
        typeId: layer.typeId,
        // Carried into the assembly, not just the upload: a drawn path is
        // compiled into the program (R69), so dropping it here left the shape
        // unfilled while every value around it arrived intact. It is also part
        // of the signature, so the cache re-keys when the path changes.
        ...(layer.vertices ? { vertices: layer.vertices } : {}),
      }));
      const resolved = resolveStack(stack, parameters.hookSource ?? "");
      // Nothing has ever compiled, so there is nothing to draw. A first hook
      // that does not compile leaves the canvas as the runtime cleared it
      // rather than throwing through the pipeline pass.
      if (!resolved) return;
      const { program, uniforms } = resolved;

      gl.useProgram(program);
      gl.viewport(0, 0, width, height);

      const location = (name: string): WebGLUniformLocation | null =>
        uniforms.get(name) ?? null;

      const resolution = location("uResolution");
      if (resolution) gl.uniform2f(resolution, width, height);

      const cursor = location("uCursor");
      if (cursor) gl.uniform2f(cursor, parameters.cursor[0], parameters.cursor[1]);
      const loop = location("uLoop");
      if (loop) gl.uniform1f(loop, parameters.loop);

      const background = location("uBackgroundColor");
      if (background) gl.uniform3fv(background, [...parameters.backgroundColor]);

      const includeBackground = location("uIncludeBackground");
      if (includeBackground) {
        gl.uniform1f(includeBackground, parameters.includeBackground ? 1 : 0);
      }

      parameters.layers.forEach((layer, index) => {
        for (const uniform of studioLayerUniforms(layer.typeId)) {
          const target = location(studioLayerUniformName(index, uniform.name));
          if (!target) continue;

          if (uniform.type === "sampler2D") {
            // One texture unit per layer index, so two image layers cannot
            // collide on unit zero and show each other's picture.
            gl.activeTexture(gl.TEXTURE0 + index);
            gl.bindTexture(gl.TEXTURE_2D, resolveTexture(index, layer.image));
            gl.uniform1i(target, index);
            continue;
          }

          // A value the layer omits falls back to the registry default rather
          // than to zero: an unset colour reading as black would look like a
          // deliberate edit instead of an absent one.
          const value = layer.values[uniform.name] ?? uniform.defaultValue;

          if (uniform.type === "vec3") {
            gl.uniform3fv(target, [...(value as readonly [number, number, number])]);
          } else {
            gl.uniform1f(target, value as number);
          }
        }
      });

      /**
       * The drawn regions, bound once for the whole stack.
       *
       * On the unit above the last layer's, because each layer's picture holds
       * the unit at its own index. One unit for every region in the stack is
       * what keeps this inside WebGL2's sixteen-unit guarantee rather than
       * asking for one per layer and failing on conforming hardware.
       */
      const paths = new Map<number, readonly StudioVertexPoint[]>();
      parameters.layers.forEach((layer, index) => {
        if ((layer.vertices?.length ?? 0) >= 2) {
          paths.set(index, layer.vertices ?? []);
        }
      });

      const atlas = resolvePathAtlas(paths);
      const maskLocation = location("uStudioPathMask");
      if (atlas && pathTexture && maskLocation) {
        const unit = parameters.layers.length;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, pathTexture);
        gl.uniform1i(maskLocation, unit);

        for (const [index, tile] of atlas.tiles) {
          const origin = location(studioLayerUniformName(index, "pathOrigin"));
          if (origin) gl.uniform2f(origin, tile.origin[0], tile.origin[1]);
          const extent = location(studioLayerUniformName(index, "pathExtent"));
          if (extent) gl.uniform2f(extent, tile.extent[0], tile.extent[1]);
          const rect = location(studioLayerUniformName(index, "pathTile"));
          if (rect) gl.uniform4f(rect, tile.rect[0], tile.rect[1], tile.rect[2], tile.rect[3]);
        }
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

/** Registry defaults for one layer type, as the scene reader's starting values. */
export function studioLayerDefaults(
  typeId: StudioLayerTypeId,
): Record<string, number | readonly [number, number, number]> {
  const values: Record<string, number | readonly [number, number, number]> = {};
  for (const uniform of studioLayerUniforms(typeId)) {
    values[uniform.name] = uniform.defaultValue;
  }
  return values;
}
