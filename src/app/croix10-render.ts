import {
  CROIX10_MAX_PLANES,
  CROIX10_MAX_RAMP_STOPS,
  type Croix10Plane,
} from "./croix10-parameters";
import {
  CROIX10_MAX_PALETTE_SLOTS,
  croix10AssembleFragmentShader,
  croix10VertexShader,
  type Croix10VariantKey,
} from "./croix10-shaders";

/**
 * Framework-free WebGL2 renderer.
 *
 * Kept out of the React component so resources are created outside render,
 * retained across unrelated interactions, and released once on cleanup. The same
 * renderer serves live preview and the runtime export frame, so preview and
 * export cannot drift.
 */

/** One ramp stop, with its position already normalised out of the control's percent string. */
export type Croix10RampStop = Readonly<{
  color: string;
  opacity: number;
  position: number;
}>;

export type Croix10SceneParameters = Readonly<{
  angle: number;
  proximityCenter: readonly [number, number];
  proximityFalloff: number;
  proximityRadius: number;
  proximityStrength: number;
  rampAngle: number;
  rampInterpolation: number;
  rampPhase: number;
  rampSource: number;
  rampStops: readonly Croix10RampStop[];
  rampType: number;
  engine: number;
  fringeIntensity: number;
  fringeWidth: number;
  immersionBalance: number;
  interferenceActive: boolean;
  interferenceAngleOffset: number;
  interferenceBlendMode: number;
  interferencePhaseOffset: number;
  interferencePitchRatio: number;
  interferenceWidthRatio: number;
  immersionSpread: number;
  inductionFrequency: number;
  viewerAngle: number;
  viewerParallax: number;
  backgroundColor: string;
  bandCount: number;
  cyclingOffset: number;
  includeBackground: boolean;
  jitterAmount: number;
  jitterFrequency: number;
  mirror: boolean;
  palette: readonly string[];
  planeBlendMode: number;
  planes: readonly Croix10Plane[];
  phase: number;
  separatorWidth: number;
  shapeCenter: readonly [number, number];
  shapeKind: number;
  shapeMode: number;
  shapeSize: number;
  shapeStrength: number;
  widthRatio: number;
}>;

type UniformLocations = Map<string, WebGLUniformLocation | null>;

type CompiledVariant = Readonly<{
  program: WebGLProgram;
  uniforms: UniformLocations;
}>;

export type Croix10Renderer = Readonly<{
  dispose: () => void;
  gl: WebGL2RenderingContext;
  render: (parameters: Croix10SceneParameters, width: number, height: number) => void;
}>;

/** sRGB hex to linear-light RGB. Mixing happens in linear light. */
export function croix10HexToLinear(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "").trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : normalized;
  const value = Number.parseInt(expanded.slice(0, 6), 16);
  if (!Number.isFinite(value)) {
    return [0, 0, 0];
  }
  const channels: [number, number, number] = [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
  return channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4),
  ) as [number, number, number];
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Croix10 could not create a WebGL2 shader.");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "unknown compile error";
    gl.deleteShader(shader);
    throw new Error(`Croix10 shader compile failed: ${log}`);
  }
  return shader;
}

function compileVariant(
  gl: WebGL2RenderingContext,
  variant: Croix10VariantKey,
): CompiledVariant {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, croix10VertexShader());
  const fragment = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    croix10AssembleFragmentShader(variant),
  );
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Croix10 could not create a WebGL2 program.");
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "unknown link error";
    gl.deleteProgram(program);
    throw new Error(`Croix10 shader link failed: ${log}`);
  }

  const uniforms: UniformLocations = new Map();
  const total = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let index = 0; index < total; index += 1) {
    const info = gl.getActiveUniform(program, index);
    if (!info) continue;
    const name = info.name.replace(/\[0\]$/, "");
    uniforms.set(name, gl.getUniformLocation(program, info.name));
  }

  return { program, uniforms };
}

/**
 * Creates the renderer for one WebGL2 context. Variants compile lazily and are
 * cached, so a feature toggled off and on again reuses its program.
 */
export function createCroix10Renderer(
  gl: WebGL2RenderingContext,
): Croix10Renderer {
  const variants = new Map<Croix10VariantKey, CompiledVariant>();

  function resolveVariant(variant: Croix10VariantKey): CompiledVariant {
    const cached = variants.get(variant);
    if (cached) return cached;
    const compiled = compileVariant(gl, variant);
    variants.set(variant, compiled);
    return compiled;
  }

  return {
    dispose() {
      for (const compiled of variants.values()) {
        gl.deleteProgram(compiled.program);
      }
      variants.clear();
    },
    gl,
    render(parameters, width, height) {
      if (width <= 0 || height <= 0) return;

      // The two-layer program is a different compiled variant, not a uniform: a
      // disabled layer must not cost a per-pixel branch.
      const { program, uniforms } = resolveVariant(
        parameters.interferenceActive ? "interference" : "couleur-additive",
      );
      gl.useProgram(program);
      gl.viewport(0, 0, width, height);

      const set1f = (name: string, value: number): void => {
        const location = uniforms.get(name);
        if (location) gl.uniform1f(location, value);
      };
      const set3f = (name: string, value: [number, number, number]): void => {
        const location = uniforms.get(name);
        if (location) gl.uniform3f(location, value[0], value[1], value[2]);
      };

      const resolution = uniforms.get("uResolution");
      if (resolution) gl.uniform2f(resolution, width, height);

      set1f("uBandCount", parameters.bandCount);
      set1f("uWidthRatio", parameters.widthRatio);
      set1f("uAngle", parameters.angle);
      set1f("uPhase", parameters.phase);
      set1f("uJitterAmount", parameters.jitterAmount);
      set1f("uJitterFrequency", parameters.jitterFrequency);
      set1f("uMirror", parameters.mirror ? 1 : 0);
      set1f("uSeparatorWidth", parameters.separatorWidth);
      set1f("uCyclingOffset", parameters.cyclingOffset);
      set1f("uIncludeBackground", parameters.includeBackground ? 1 : 0);
      set3f("uBackgroundColor", croix10HexToLinear(parameters.backgroundColor));
      set1f("uViewerAngle", parameters.viewerAngle);
      set1f("uViewerParallax", parameters.viewerParallax);
      set1f("uInductionFrequency", parameters.inductionFrequency);
      set1f("uFringeWidth", parameters.fringeWidth);
      set1f("uFringeIntensity", parameters.fringeIntensity);
      set1f("uImmersionSpread", parameters.immersionSpread);
      set1f("uImmersionBalance", parameters.immersionBalance);
      set1f("uInterferencePitchRatio", parameters.interferencePitchRatio);
      set1f("uInterferenceAngleOffset", parameters.interferenceAngleOffset);
      set1f("uInterferencePhaseOffset", parameters.interferencePhaseOffset);
      set1f("uInterferenceWidthRatio", parameters.interferenceWidthRatio);
      set1f("uShapeStrength", parameters.shapeStrength);
      set1f("uShapeSize", parameters.shapeSize);
      const shapeCentre = uniforms.get("uShapeCenter");
      if (shapeCentre) {
        gl.uniform2f(
          shapeCentre,
          parameters.shapeCenter[0],
          parameters.shapeCenter[1],
        );
      }
      const engine = uniforms.get("uEngine");
      if (engine) gl.uniform1i(engine, parameters.engine);
      const shapeKind = uniforms.get("uShapeKind");
      if (shapeKind) gl.uniform1i(shapeKind, parameters.shapeKind);
      const shapeMode = uniforms.get("uShapeMode");
      if (shapeMode) gl.uniform1i(shapeMode, parameters.shapeMode);
      const blendMode = uniforms.get("uInterferenceBlendMode");
      if (blendMode) gl.uniform1i(blendMode, parameters.interferenceBlendMode);

      const slots = parameters.palette.slice(0, CROIX10_MAX_PALETTE_SLOTS);
      const flattened = new Float32Array(CROIX10_MAX_PALETTE_SLOTS * 3);
      slots.forEach((hex, index) => {
        const linear = croix10HexToLinear(hex);
        flattened[index * 3] = linear[0];
        flattened[index * 3 + 1] = linear[1];
        flattened[index * 3 + 2] = linear[2];
      });
      const paletteLocation = uniforms.get("uPalette");
      if (paletteLocation) gl.uniform3fv(paletteLocation, flattened);
      const slotCount = uniforms.get("uSlotCount");
      if (slotCount) gl.uniform1i(slotCount, Math.max(slots.length, 1));

      // Ramp stops upload as parallel arrays, the same shape the planes use. The
      // colours convert to linear light on the way in, so the shader mixes in the
      // working space by default and only leaves it when the interpolation control
      // asks it to.
      const rampStops = parameters.rampStops.slice(0, CROIX10_MAX_RAMP_STOPS);
      const rampColors = new Float32Array(CROIX10_MAX_RAMP_STOPS * 3);
      const rampPositions = new Float32Array(CROIX10_MAX_RAMP_STOPS);
      const rampOpacities = new Float32Array(CROIX10_MAX_RAMP_STOPS);
      rampStops.forEach((stop, index) => {
        const linear = croix10HexToLinear(stop.color);
        rampColors[index * 3] = linear[0];
        rampColors[index * 3 + 1] = linear[1];
        rampColors[index * 3 + 2] = linear[2];
        rampPositions[index] = stop.position;
        rampOpacities[index] = stop.opacity;
      });
      const rampColorsLocation = uniforms.get("uRampColors");
      if (rampColorsLocation) gl.uniform3fv(rampColorsLocation, rampColors);
      const rampPositionsLocation = uniforms.get("uRampPositions");
      if (rampPositionsLocation) gl.uniform1fv(rampPositionsLocation, rampPositions);
      const rampStopCount = uniforms.get("uRampStopCount");
      if (rampStopCount) gl.uniform1i(rampStopCount, Math.max(rampStops.length, 1));
      const rampOpacitiesLocation = uniforms.get("uRampOpacities");
      if (rampOpacitiesLocation) gl.uniform1fv(rampOpacitiesLocation, rampOpacities);
      const rampAngle = uniforms.get("uRampAngle");
      if (rampAngle) gl.uniform1f(rampAngle, parameters.rampAngle);
      const rampType = uniforms.get("uRampType");
      if (rampType) gl.uniform1i(rampType, parameters.rampType);
      const rampSource = uniforms.get("uRampSource");
      if (rampSource) gl.uniform1i(rampSource, parameters.rampSource);
      const rampInterpolation = uniforms.get("uRampInterpolation");
      if (rampInterpolation) {
        gl.uniform1i(rampInterpolation, parameters.rampInterpolation);
      }
      const rampPhase = uniforms.get("uRampPhase");
      if (rampPhase) gl.uniform1f(rampPhase, parameters.rampPhase);
      const proximityCenter = uniforms.get("uProximityCenter");
      if (proximityCenter) {
        gl.uniform2f(
          proximityCenter,
          parameters.proximityCenter[0],
          parameters.proximityCenter[1],
        );
      }
      set1f("uProximityRadius", parameters.proximityRadius);
      set1f("uProximityStrength", parameters.proximityStrength);
      const proximityFalloff = uniforms.get("uProximityFalloff");
      if (proximityFalloff) {
        gl.uniform1i(proximityFalloff, parameters.proximityFalloff);
      }

      // Translucent planes upload as parallel arrays: one record per plane in the
      // schema becomes one index in each array here.
      const planes = parameters.planes.slice(0, CROIX10_MAX_PLANES);
      const planeColors = new Float32Array(CROIX10_MAX_PLANES * 3);
      const planeOpacities = new Float32Array(CROIX10_MAX_PLANES);
      const planeOffsets = new Float32Array(CROIX10_MAX_PLANES * 2);
      const planeRotations = new Float32Array(CROIX10_MAX_PLANES);
      planes.forEach((plane, index) => {
        const linear = croix10HexToLinear(plane.color);
        planeColors[index * 3] = linear[0];
        planeColors[index * 3 + 1] = linear[1];
        planeColors[index * 3 + 2] = linear[2];
        planeOpacities[index] = plane.opacity;
        planeOffsets[index * 2] = plane.offset.x;
        planeOffsets[index * 2 + 1] = plane.offset.y;
        planeRotations[index] = plane.rotation;
      });
      const planeColorLocation = uniforms.get("uPlaneColor");
      if (planeColorLocation) gl.uniform3fv(planeColorLocation, planeColors);
      const planeOpacityLocation = uniforms.get("uPlaneOpacity");
      if (planeOpacityLocation) gl.uniform1fv(planeOpacityLocation, planeOpacities);
      const planeOffsetLocation = uniforms.get("uPlaneOffset");
      if (planeOffsetLocation) gl.uniform2fv(planeOffsetLocation, planeOffsets);
      const planeRotationLocation = uniforms.get("uPlaneRotation");
      if (planeRotationLocation) {
        gl.uniform1fv(planeRotationLocation, planeRotations);
      }
      const planeCount = uniforms.get("uPlaneCount");
      if (planeCount) gl.uniform1i(planeCount, planes.length);
      const planeBlendMode = uniforms.get("uPlaneBlendMode");
      if (planeBlendMode) {
        gl.uniform1i(planeBlendMode, parameters.planeBlendMode);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
