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

/** One layer's uniform values, keyed by the type's own uniform names. */
export type StudioLayerValues = Readonly<{
  typeId: StudioLayerTypeId;
  /** A drawn path, baked into the assembled program (R69). */
  vertices?: readonly (readonly [number, number])[];
  values: Readonly<Record<string, number | readonly [number, number, number]>>;
}>;

export type StudioStackSceneParameters = Readonly<{
  backgroundColor: readonly [number, number, number];
  /** Pointer position in field units, from the centre of the frame (R68). */
  cursor: readonly [number, number];
  includeBackground: boolean;
  layers: readonly StudioLayerValues[];
}>;

export interface StudioStackRenderer {
  dispose: () => void;
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
): CompiledStack {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, studioStackVertexShader());
  const fragment = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    studioAssembleStackFragmentShader(stack),
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

  function resolveStack(stack: readonly StudioStackEntry[]): CompiledStack {
    const signature = studioStackSignature(stack);
    const cached = compiled.get(signature);
    if (cached) return cached;
    const program = compileStack(gl, stack);
    compiled.set(signature, program);
    return program;
  }

  return {
    dispose() {
      for (const entry of compiled.values()) gl.deleteProgram(entry.program);
      compiled.clear();
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
      const { program, uniforms } = resolveStack(stack);

      gl.useProgram(program);
      gl.viewport(0, 0, width, height);

      const location = (name: string): WebGLUniformLocation | null =>
        uniforms.get(name) ?? null;

      const resolution = location("uResolution");
      if (resolution) gl.uniform2f(resolution, width, height);

      const cursor = location("uCursor");
      if (cursor) gl.uniform2f(cursor, parameters.cursor[0], parameters.cursor[1]);

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
