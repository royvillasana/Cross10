/**
 * Layer-type registry.
 *
 * This is the divergence from the engine model the chunk registry was built for.
 * There, one shader variant per engine had its components fixed at authoring
 * time and a single `uEngine` branch chose between them. Here the program is
 * assembled from an ordered stack the user builds, so a layer's uniforms cannot
 * be named ahead of time.
 *
 * Per-layer uniforms are name-mangled at assembly (`uLayer0_angle`), which is
 * R52. Indexed arrays would cap stack depth and pay for slots nobody filled; a
 * packed uniform block would decouple program identity from stack contents but
 * emit source no one can read, and readable source is the artifact this product
 * exists to produce. The cost of mangling is that every stack edit compiles a new
 * program — but the variant cache already keys on the stack signature (R54), so
 * a stack edit invalidates the cached program either way. The churn is inherent
 * to the feature rather than added by the choice.
 *
 * Bodies are shared and parameterised; only the thin per-layer wrapper is
 * emitted per instance. So a stack of six stripe layers compiles one
 * `studioStripesBody` and six calls to it, not six copies of the field code.
 *
 * The helpers this module emits are deliberately self-contained: the assembled
 * program declares its own colour-space conversion and compositing rather than
 * reaching into the engine chunk registry, which is what lets delivered source
 * compile without carrying the studio with it.
 */

/** A GLSL scalar or vector a per-layer uniform can hold. */
export type StudioLayerUniformType = "float" | "vec3";

export interface StudioLayerUniform {
  /** Default in the same units the control exposes. */
  readonly defaultValue: number | readonly [number, number, number];
  /** Suffix after the mangled layer prefix, e.g. `angle` in `uLayer0_angle`. */
  readonly name: string;
  /**
   * Option values, in the order the shader's branches read them, for a float
   * uniform whose control is a `select`.
   *
   * Without this the control's string value never becomes the uniform's number:
   * the collector sees a string where it wants a number, drops the edit, and the
   * control moves while the render stays put. The order is the contract — index
   * 0 is the first branch — so it must match the body's own ordering.
   */
  readonly optionValues?: readonly string[];
  /**
   * Whether this float uniform is driven by a `switch`.
   *
   * A switch's value is a boolean and the shader branches on a float, so
   * without this the edit is dropped for not already being a number -- the same
   * gap `optionValues` closes for selects, and with the same symptom: the
   * control moves and the render does not.
   */
  readonly booleanControl?: boolean;
  readonly type: StudioLayerUniformType;
}

export interface StudioLayerType {
  /**
   * Parameterised GLSL body, shared across every instance of this type. It must
   * declare exactly one function named by `entryPoint` and read nothing from
   * global uniform state, so the same compiled body serves every layer.
   */
  readonly chunk: string;
  /** Function the per-layer wrapper calls. */
  readonly entryPoint: string;
  readonly id: StudioLayerTypeId;
  readonly label: string;
  /** Ordered — the wrapper passes them positionally, so order is load-bearing. */
  readonly uniforms: readonly StudioLayerUniform[];
}

export type StudioLayerTypeId = "gradient" | "stripes";

/**
 * Carried by every layer regardless of type.
 *
 * Visibility is a float rather than a bool because it multiplies into the
 * composite weight, which keeps a hidden layer from needing a branch. The
 * runtime owns the value — `panels.layers` writes it — but the program still has
 * to receive it.
 */
export const STUDIO_LAYER_COMMON_UNIFORMS: readonly StudioLayerUniform[] = [
  { defaultValue: 1, name: "opacity", type: "float" },
  { defaultValue: 1, name: "visible", type: "float" },
];

const CHUNK_LAYER_SUPPORT = `
vec3 studioLinearToSrgb(vec3 linear) {
  vec3 clamped = clamp(linear, 0.0, 1.0);
  vec3 low = clamped * 12.92;
  vec3 high = 1.055 * pow(clamped, vec3(1.0 / 2.4)) - 0.055;
  return mix(high, low, step(clamped, vec3(0.0031308)));
}

// Source-over in linear light. Weight folds opacity and visibility together so a
// hidden layer contributes exactly nothing without costing a branch.
vec4 studioComposite(vec4 below, vec4 above, float weight) {
  float alpha = above.a * clamp(weight, 0.0, 1.0);
  return vec4(mix(below.rgb, above.rgb, alpha), max(below.a, alpha));
}
`;

const CHUNK_STRIPES_BODY = `
vec4 studioStripesBody(
  vec2 fragmentPosition,
  vec2 resolution,
  float angle,
  float count,
  float widthRatio,
  float phase,
  float mirror,
  float taper,
  float separator,
  float jitterAmount,
  float jitterFrequency,
  vec3 colorA,
  vec3 colorB
) {
  // Normalised against height so the field does not stretch with aspect ratio.
  vec2 centered = (fragmentPosition - resolution * 0.5) / max(resolution.y, 1.0);
  float radians = angle * 0.017453292519943295;
  float coordinate = centered.x * cos(radians) + centered.y * sin(radians);
  // Reflected about the field's own axis, so the two halves read as mirrored
  // rather than merely repeated. Folding the coordinate rather than branching
  // keeps the cost identical whether the switch is on or off.
  coordinate = mix(coordinate, abs(coordinate), step(0.5, mirror));
  // Each band is displaced by a value drawn from its own index, so the field
  // stays deterministic: the same stack renders the same frame here, in the
  // exported artifact, and in the delivered source. A displacement drawn from
  // the fragment instead would dissolve the bands into noise rather than move
  // them.
  //
  // The amount is bounded by the control's own domain rather than clamped here,
  // so a band cannot be displaced past its neighbour and swap identity with it.
  float scaled = coordinate * max(count, 1.0) + phase;
  float bandIndex = floor(scaled);
  float jitter =
    fract(sin(bandIndex * max(jitterFrequency, 1e-4)) * 43758.5453) - 0.5;
  float position = fract(scaled + jitterAmount * jitter);

  // Analytic edge from the screen-space derivative rather than supersampling:
  // per-pixel cost stays constant with respect to band count, which is what lets
  // the pipeline declare a constant relationship for the stripe dimensions.
  // Where one colour gives way to the other, drifting along the band rather
  // than sitting at a constant fraction of it. That drift is what turns a band
  // of even thickness into a wedge: the split reaches one edge at one end of the
  // band and the other edge at the other, so the darker colour reads as a
  // triangle rather than a line. It is the same construction the kinetic
  // painters used to make a shape emerge from a field that stays parallel.
  //
  // Measured along the band, which is the axis perpendicular to the one the
  // bands repeat along, so the drift follows the band's own length whatever
  // angle the field is set to.
  float along = centered.x * -sin(radians) + centered.y * cos(radians);
  float split = widthRatio + taper * along;

  float edge = max(fwidth(position) * 1.5, 1e-5);
  float band = smoothstep(split - edge, split + edge, position);

  // A separator is a gap the layer does not paint rather than a third colour:
  // in a stack, what shows through is whatever sits beneath, which is the only
  // reading that stays true when a layer is composited over another.
  //
  // Measured from the nearest cycle boundary, so the gap straddles the seam
  // evenly instead of eating one band from one side. At a separator of zero the
  // smoothstep saturates and the coverage is exactly one, so the default costs
  // nothing and changes nothing.
  float seamDistance = min(position, 1.0 - position);
  float coverage = smoothstep(separator - edge, separator + edge, seamDistance);

  return vec4(mix(colorA, colorB, band), coverage);
}
`;

const CHUNK_GRADIENT_BODY = `
vec4 studioGradientBody(
  vec2 fragmentPosition,
  vec2 resolution,
  float angle,
  float rampType,
  vec3 colorA,
  vec3 colorB
) {
  vec2 uv = fragmentPosition / max(resolution, vec2(1.0));
  vec2 centered = uv - 0.5;
  float radians = angle * 0.017453292519943295;

  float position;
  if (rampType < 0.5) {
    position = dot(centered, vec2(cos(radians), sin(radians))) + 0.5;
  } else if (rampType < 1.5) {
    position = length(centered) * 2.0;
  } else {
    position = fract((atan(centered.y, centered.x) - radians) * 0.15915494309189535 + 1.0);
  }

  return vec4(mix(colorA, colorB, clamp(position, 0.0, 1.0)), 1.0);
}
`;

export const STUDIO_LAYER_TYPES: Readonly<Record<StudioLayerTypeId, StudioLayerType>> =
  {
    gradient: {
      chunk: CHUNK_GRADIENT_BODY,
      entryPoint: "studioGradientBody",
      id: "gradient",
      label: "Gradient",
      uniforms: [
        { defaultValue: 0, name: "angle", type: "float" },
        {
          defaultValue: 0,
          name: "rampType",
          // Order matches the branch order in `CHUNK_GRADIENT_BODY`.
          optionValues: ["linear", "radial", "angular"],
          type: "float",
        },
        { defaultValue: [0, 0, 0], name: "colorA", type: "vec3" },
        { defaultValue: [1, 1, 1], name: "colorB", type: "vec3" },
      ],
    },
    stripes: {
      chunk: CHUNK_STRIPES_BODY,
      entryPoint: "studioStripesBody",
      id: "stripes",
      label: "Stripes",
      uniforms: [
        { defaultValue: 0, name: "angle", type: "float" },
        { defaultValue: 24, name: "count", type: "float" },
        { defaultValue: 0.5, name: "widthRatio", type: "float" },
        { defaultValue: 0, name: "phase", type: "float" },
        { booleanControl: true, defaultValue: 0, name: "mirror", type: "float" },
        { defaultValue: 0, name: "taper", type: "float" },
        { defaultValue: 0, name: "separator", type: "float" },
        { defaultValue: 0, name: "jitterAmount", type: "float" },
        // No control yet, deliberately. Varying this changes *which* bands
        // move rather than how irregular the field is, so every statistic a
        // proof could name -- run spread, run count, band frequency -- holds
        // steady across its whole domain. The only honest observable is the
        // arrangement itself, and asserting that would mean pinning a
        // fingerprint that depends on backing size and GPU. Carried as a fixed
        // characteristic of the field until it has an observable worth naming.
        { defaultValue: 12, name: "jitterFrequency", type: "float" },
        { defaultValue: [1, 1, 1], name: "colorA", type: "vec3" },
        { defaultValue: [0, 0, 0], name: "colorB", type: "vec3" },
      ],
    },
  };

export const STUDIO_LAYER_TYPE_IDS: readonly StudioLayerTypeId[] = [
  "stripes",
  "gradient",
];

/** One entry in the ordered stack. Index 0 composites first, so it sits lowest. */
export interface StudioStackEntry {
  readonly typeId: StudioLayerTypeId;
}

/** Mangled uniform name for a layer's parameter. R52. */
export function studioLayerUniformName(index: number, suffix: string): string {
  return `uLayer${index}_${suffix}`;
}

/** Every uniform the assembled program declares for one layer, in wrapper order. */
export function studioLayerUniforms(
  typeId: StudioLayerTypeId,
): readonly StudioLayerUniform[] {
  return [...STUDIO_LAYER_TYPES[typeId].uniforms, ...STUDIO_LAYER_COMMON_UNIFORMS];
}

/**
 * Cache key for the assembled program (R54).
 *
 * Two stacks with the same types in a different order are different programs, so
 * order is part of the key. An engine-shaped key would collide across both.
 */
export function studioStackSignature(stack: readonly StudioStackEntry[]): string {
  return stack.map((entry) => entry.typeId).join(">") || "empty";
}

const VERTEX_SHADER = `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  vec2 positions[3] = vec2[3](
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0),
    vec2(-1.0, 3.0)
  );
  vec2 position = positions[gl_VertexID];
  vUv = (position + 1.0) * 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export function studioStackVertexShader(): string {
  return VERTEX_SHADER;
}

function declareLayerUniforms(stack: readonly StudioStackEntry[]): string {
  return stack
    .flatMap((entry, index) =>
      studioLayerUniforms(entry.typeId).map(
        (uniform) =>
          `uniform ${uniform.type} ${studioLayerUniformName(index, uniform.name)};`,
      ),
    )
    .join("\n");
}

function compositeLayer(entry: StudioStackEntry, index: number): string {
  const type = STUDIO_LAYER_TYPES[entry.typeId];
  const args = type.uniforms
    .map((uniform) => studioLayerUniformName(index, uniform.name))
    .join(", ");
  const weight = `${studioLayerUniformName(index, "opacity")} * ${studioLayerUniformName(index, "visible")}`;

  return `  {
    vec4 layer = ${type.entryPoint}(fragmentPosition, uResolution${args ? `, ${args}` : ""});
    composite = studioComposite(composite, layer, ${weight});
  }`;
}

/**
 * Assembles one fragment shader for the whole stack.
 *
 * A type absent from the stack contributes no code at all, so an unused layer
 * type costs nothing per frame — the same property the engine variants had, held
 * across a dynamic stack rather than a fixed pair.
 */
export function studioAssembleStackFragmentShader(
  stack: readonly StudioStackEntry[],
): string {
  const usedTypes = STUDIO_LAYER_TYPE_IDS.filter((typeId) =>
    stack.some((entry) => entry.typeId === typeId),
  );

  const preamble = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec3 uBackgroundColor;
uniform float uIncludeBackground;

${declareLayerUniforms(stack)}

in vec2 vUv;
out vec4 fragColor;
`;

  const main = `
void main() {
  vec2 fragmentPosition = vUv * uResolution;
  vec4 composite = vec4(uBackgroundColor, uIncludeBackground);

${stack.map((entry, index) => compositeLayer(entry, index)).join("\n")}

  fragColor = vec4(studioLinearToSrgb(composite.rgb), composite.a);
}
`;

  return [
    preamble,
    CHUNK_LAYER_SUPPORT,
    ...usedTypes.map((typeId) => STUDIO_LAYER_TYPES[typeId].chunk),
    main,
  ].join("\n");
}
