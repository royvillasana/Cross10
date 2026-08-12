/**
 * GLSL chunk registry and variant assembly.
 *
 * The stripe field has exactly one implementation, shared by every engine and
 * later by line halftone. Boundaries are resolved analytically with `fwidth`
 * rather than by supersampling: that is what keeps high-frequency output stable,
 * and per-pixel cost stays constant with respect to band count, which is why the
 * renderer pipeline declares `relationship: "constant"` for the stripe
 * dimensions.
 */

import { CROIX10_CHUNK_RAMP } from "./croix10-shaders-ramp";
import {
  CROIX10_ENGINES,
  CROIX10_MAX_PLANES,
  CROIX10_MAX_RAMP_STOPS,
  CROIX10_STRIPE_COUNT,
} from "./croix10-parameters";

export const CROIX10_MAX_PALETTE_SLOTS = 8;

const VERTEX_SHADER = `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  // Full-screen triangle: three vertices, no attribute buffers.
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

const CHUNK_NOISE = `
// Cheap value noise. One evaluation per fragment regardless of band count.
float croix10Hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float croix10Noise(float x) {
  float i = floor(x);
  float f = fract(x);
  float smoothed = f * f * (3.0 - 2.0 * f);
  return mix(croix10Hash(i), croix10Hash(i + 1.0), smoothed);
}
`;

/**
 * Embedded shape distance functions.
 *
 * The shape has no fill of its own: it exists only as a perturbation of the band
 * field, either shifting bands sideways (phase) or narrowing them locally (width).
 * At zero strength the mask short-circuits, so the backing buffer is bit-identical
 * to the unperturbed field. That identity is what the strength proof reads, in
 * backing pixels rather than an element screenshot — an element screenshot resamples
 * whenever the panel reflows and shifts the canvas by a fraction of a pixel, which
 * is a measurement artefact, not a render change.
 */
const CHUNK_SHAPES = `
// Signed distance to the embedded shape, in normalised composition space.
// Negative inside, positive outside.
float croix10ShapeDistance(vec2 fragmentPosition, vec2 resolution) {
  vec2 uv = fragmentPosition / max(resolution.x, 1.0);
  vec2 centre = vec2(0.5, 0.5 * resolution.y / max(resolution.x, 1.0)) + uShapeCenter * 0.5;
  vec2 offset = uv - centre;
  float radius = uShapeSize * 0.5;

  if (uShapeKind == 2) {
    // Ellipse: squash the vertical axis before measuring.
    return length(vec2(offset.x, offset.y * 1.8)) - radius;
  }
  if (uShapeKind == 3) {
    // Rectangle: standard box distance.
    vec2 d = abs(offset) - vec2(radius, radius * 0.7);
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }
  if (uShapeKind == 4) {
    // Split blocks: two offset boxes, the pair reading as one displaced module.
    vec2 half1 = vec2(radius * 0.8, radius * 0.5);
    vec2 a = abs(offset - vec2(0.0, radius * 0.55)) - half1;
    vec2 b = abs(offset - vec2(radius * 0.35, -radius * 0.55)) - half1;
    float da = length(max(a, 0.0)) + min(max(a.x, a.y), 0.0);
    float db = length(max(b, 0.0)) + min(max(b.x, b.y), 0.0);
    return min(da, db);
  }
  // Circle.
  return length(offset) - radius;
}

// Coverage of the shape at this fragment, antialiased against the pixel footprint
// so the perturbation edge is as stable as the band boundaries.
float croix10ShapeMask(vec2 fragmentPosition, vec2 resolution) {
  // No outline selected, or no displacement asked for: both are exact no-ops, so
  // the field is bit-identical to having no shape at all.
  if (uShapeKind == 0 || uShapeStrength == 0.0) {
    return 0.0;
  }
  float distance = croix10ShapeDistance(fragmentPosition, resolution);
  float softness = max(fwidth(distance), 0.0001);
  return 1.0 - smoothstep(-softness, softness, distance);
}
`;

const CHUNK_STRIPE_FIELD = `
struct Croix10Field {
  int bandIndex;
  float distanceToBoundary;
  float periodInPixels;
};

// Resolves the shared stripe field in stripe space.
//
// Returns the band index within the repeating sequence plus the signed distance
// to the nearest band boundary, both of which every engine and the separator
// logic consume. Cost does not vary with uBandCount.

// Where the current band's centreline crosses the composition centre, published
// so the ramp can be sampled once per band without threading a coordinate through
// every engine's colour lookup. Written by the first layer resolved for this
// fragment and then held: with the interference layer on the resolver runs twice,
// and the ramp belongs to the composition's primary field rather than to whichever
// layer happened to resolve last.
vec2 gCroix10BandCenter = vec2(0.0);
bool gCroix10BandCenterSet = false;

Croix10Field croix10ResolveLayer(
  vec2 fragmentPosition,
  vec2 resolution,
  float bandCount,
  float angleDegrees,
  float phaseInBands,
  float widthRatio
) {
  vec2 centered = fragmentPosition - resolution * 0.5;

  float radians = angleDegrees * 0.017453292519943295;
  float c = cos(radians);
  float s = sin(radians);
  float across = centered.x * c + centered.y * s;

  if (uMirror > 0.5) {
    across = abs(across);
  }

  // One band spans the composition width divided by the band count, so pitch is
  // resolution independent: the same value renders the same composition at any
  // export size.
  float bandWidth = resolution.x / max(bandCount, 1.0);

  // Wobble displaces laterally. Exactly zero at zero amount.
  float along = -centered.x * s + centered.y * c;

  float wobble = uJitterAmount == 0.0
    ? 0.0
    : (croix10Noise(along / max(resolution.y, 1.0) * uJitterFrequency * 10.0) - 0.5)
      * uJitterAmount * bandWidth * 2.0;

  // The embedded shape perturbs the field rather than drawing over it. At zero
  // strength the mask is exactly zero, so both branches below are exact
  // no-ops and the output is bit-identical to having no shape at all.
  float shapeMask = croix10ShapeMask(fragmentPosition, resolution);
  float phaseShift = uShapeMode == 0
    ? shapeMask * uShapeStrength * bandWidth * 0.5
    : 0.0;

  float coordinate = across + wobble + phaseInBands * bandWidth + phaseShift;

  float bandPosition = coordinate / bandWidth;
  float wrapped = fract(bandPosition);
  float index = floor(bandPosition);

  // Width ratio narrows alternate bands; at 1.0 every band is equal.
  float ratio = mod(index, 2.0) < 1.0 ? 1.0 : widthRatio;
  float widthScale = uShapeMode == 1
    ? 1.0 - shapeMask * uShapeStrength * 0.7
    : 1.0;
  float occupied = clamp(ratio * widthScale, 0.05, 1.0);

  if (!gCroix10BandCenterSet) {
    // Back out wobble, phase, and the shape's displacement so the centre is where
    // this band sits in the composition rather than where the field sampled it,
    // and place it on the composition's centre line (along = 0).
    float centerAcross =
      (index + 0.5) * bandWidth - wobble - phaseInBands * bandWidth - phaseShift;
    gCroix10BandCenter = resolution * 0.5 + vec2(c, s) * centerAcross;
    gCroix10BandCenterSet = true;
  }

  Croix10Field field;
  field.bandIndex = int(mod(index, float(max(uSlotCount, 1))));
  field.periodInPixels = bandWidth;
  // Distance in pixels to the nearer of the two boundaries of this band.
  float inBand = min(wrapped, occupied - wrapped);
  field.distanceToBoundary = inBand * bandWidth;
  return field;
}

// The primary layer: the shared field every engine reads.
Croix10Field croix10ResolveField(vec2 fragmentPosition, vec2 resolution) {
  return croix10ResolveLayer(
    fragmentPosition,
    resolution,
    uBandCount,
    uAngle,
    uPhase,
    uWidthRatio
  );
}
`;

const CHUNK_PALETTE = `
vec3 croix10PaletteSlotColor(int index) {
  int count = max(uSlotCount, 1);
  int offsetIndex = index + int(floor(uCyclingOffset * float(count) + 0.5));
  int wrapped = offsetIndex - count * int(floor(float(offsetIndex) / float(count)));
  for (int i = 0; i < ${CROIX10_MAX_PALETTE_SLOTS}; i++) {
    if (i == wrapped) {
      return uPalette[i];
    }
  }
  return uPalette[0];
}

`;

const CHUNK_COLOR_SPACE = `
// Mixing happens in linear light so additive colour at stripe boundaries reads
// correctly; conversion to sRGB happens once, here, in the present step.
vec3 croix10LinearToSrgb(vec3 linear) {
  vec3 clamped = clamp(linear, 0.0, 1.0);
  return mix(
    clamped * 12.92,
    1.055 * pow(clamped, vec3(1.0 / 2.4)) - 0.055,
    step(vec3(0.0031308), clamped)
  );
}

// The inverse, used only where a control asks for mixing to happen in sRGB. It is
// not part of the present step and never runs on the way to the framebuffer.
vec3 croix10SrgbToLinear(vec3 encoded) {
  vec3 clamped = clamp(encoded, 0.0, 1.0);
  return mix(
    clamped / 12.92,
    pow((clamped + 0.055) / 1.055, vec3(2.4)),
    step(vec3(0.04045), clamped)
  );
}
`;

const CHUNK_ENGINE_COULEUR_ADDITIVE = `
// Couleur Additive: parallel colour bands divided by thin lines that are windows
// onto the support rather than painted marks. The separator therefore carries the
// background colour and its alpha, so excluding the background leaves those lines
// transparent and the exported artifact transparent with them. The induced third
// colour still appears at each boundary because the separator is resolved from the
// same signed distance the field already produced.
vec4 croix10RenderEngine(Croix10Field field, vec2 resolution) {
  vec3 bandColor = croix10SlotColor(field.bandIndex);

  float separatorPixels = uSeparatorWidth * field.periodInPixels * 0.5;
  float softness = max(fwidth(field.distanceToBoundary), 0.0001);
  float separatorMask = separatorPixels <= 0.0
    ? 0.0
    : 1.0 - smoothstep(separatorPixels - softness, separatorPixels + softness, field.distanceToBoundary);

  vec3 color = mix(bandColor, uBackgroundColor, separatorMask);
  float alpha = mix(1.0, uIncludeBackground, separatorMask);
  return vec4(color, alpha);
}
`;

const CHUNK_ENGINE_PHYSICHROMIE = `
// Physichromie: dense strip modules whose apparent colour depends on where the
// viewer stands. The simulated angle shears which slot a strip presents and how
// much its neighbour is occluded, so sweeping the angle moves the whole
// composition through colour states rather than recolouring one band at a time.
vec4 croix10RenderPhysichromie(Croix10Field field, vec2 resolution) {
  float radians = uViewerAngle * 0.017453292519943295;
  float shear = tan(radians) * uViewerParallax;

  // The shear selects between this strip's colour and its neighbour's, which is
  // what produces a continuous sweep instead of discrete jumps.
  float blend = clamp(shear * 0.5 + 0.5, 0.0, 1.0);
  vec3 near = croix10SlotColor(field.bandIndex);
  vec3 far = croix10SlotColor(field.bandIndex + 1);
  vec3 color = mix(near, far, blend);

  // Side faces occlude as the angle grows, darkening the field the way a real
  // lamella relief does when seen obliquely.
  float occlusion = 1.0 - min(abs(shear) * 0.35, 0.55);
  return vec4(color * occlusion, 1.0);
}
`;

const CHUNK_ENGINE_INDUCTION = `
// Induction Chromatique: high-frequency line pairs tuned to induce afterimage
// colour, with a complementary fringe along each pair boundary. The fringe is the
// induced colour made explicit rather than left to the eye alone.
vec4 croix10RenderInduction(vec2 fragmentPosition, vec2 resolution) {
  float radians = uAngle * 0.017453292519943295;
  vec2 centered = fragmentPosition - resolution * 0.5;
  float across = centered.x * cos(radians) + centered.y * sin(radians);

  float cycles = across / resolution.x * uInductionFrequency;
  float wrapped = fract(cycles);

  vec3 first = croix10SlotColor(0);
  vec3 second = croix10SlotColor(1);

  // Analytic antialiasing keeps the pair stable at the top of the frequency
  // range, which is exactly where supersampling would be most expensive.
  float softness = max(fwidth(wrapped), 0.0001);
  float pair = smoothstep(0.5 - softness, 0.5 + softness, wrapped);
  vec3 color = mix(first, second, pair);

  // Complementary fringe: the inverse of the local colour, strongest at the
  // boundary and falling off across the declared fringe width.
  float edge = min(wrapped, 1.0 - wrapped);
  float fringeSpan = max(uFringeWidth * 0.5, 0.0001);
  float fringe = (1.0 - smoothstep(0.0, fringeSpan, edge)) * uFringeIntensity;
  vec3 complement = vec3(1.0) - color;
  return vec4(mix(color, complement, fringe), 1.0);
}
`;

const CHUNK_ENGINE_CHROMOSATURATION = `
// Chromosaturation: full-field colour immersion. No stripe structure at all, so
// the field is a wide gradient across the whole canvas with no banding steps.
vec4 croix10RenderChromosaturation(vec2 fragmentPosition, vec2 resolution) {
  float position = fragmentPosition.x / max(resolution.x, 1.0);
  float centred = (position - uImmersionBalance) / max(uImmersionSpread, 0.05);
  float ramp = clamp(centred * 0.5 + 0.5, 0.0, 1.0);

  // Three slots span the field so the wash reads as one immersive transition
  // rather than two hard halves.
  vec3 low = croix10SlotColor(0);
  vec3 mid = croix10SlotColor(1);
  vec3 high = croix10SlotColor(2);
  vec3 color = ramp < 0.5
    ? mix(low, mid, ramp * 2.0)
    : mix(mid, high, (ramp - 0.5) * 2.0);
  return vec4(color, 1.0);
}
`;

const CHUNK_ENGINE_INTERFERENCE = `
// Chromointerférence: two printed stripe structures, one over the other, whose
// slightly different pitches beat against each other. The moiré is not drawn —
// it is the product of the two layers, so it appears at the beat period their
// pitch ratio implies and nowhere is it a mark of its own.
//
// This chunk is only assembled into the two-layer variant. With the layer off the
// program does not contain it, so the second layer costs nothing per frame rather
// than costing a branch that always fails.

// Colour and coverage of one layer. Coverage is band occupancy: a separator is a
// window through the print, which is what lets the layer beneath show through.
vec3 croix10LayerColor(Croix10Field field, out float coverage) {
  float separatorPixels = uSeparatorWidth * field.periodInPixels * 0.5;
  float softness = max(fwidth(field.distanceToBoundary), 0.0001);
  coverage = separatorPixels <= 0.0
    ? 1.0
    : smoothstep(separatorPixels - softness, separatorPixels + softness, field.distanceToBoundary);
  // The same palette as the primary layer, read at this layer's own band index.
  // Not offset by a slot: the two prints must be comparable, so that where their
  // indices coincide the layers genuinely agree — which is what makes difference
  // blending black there and what makes the beat, rather than an ink change, the
  // thing the viewer sees.
  return croix10SlotColor(field.bandIndex);
}

// Blending is in linear light, so additive red over green really is yellow and
// difference is black exactly where the two layers agree.
vec3 croix10BlendLayers(vec3 base, vec3 layer, int mode) {
  if (mode == 1) return base * layer;
  if (mode == 2) return vec3(1.0) - (vec3(1.0) - base) * (vec3(1.0) - layer);
  if (mode == 3) return abs(base - layer);
  if (mode == 4) return base + layer;
  return layer;
}

vec4 croix10RenderInterference(vec2 fragmentPosition, vec2 resolution) {
  Croix10Field primary = croix10ResolveField(fragmentPosition, resolution);
  vec4 base = croix10RenderEngine(primary, resolution);

  // The second layer's density is clamped to the same Nyquist derived maximum as
  // the primary, so a pitch ratio above one cannot alias past the bound the
  // schema enforces on band count.
  float secondCount = clamp(
    uBandCount * uInterferencePitchRatio,
    1.0,
    ${CROIX10_STRIPE_COUNT.max}.0
  );
  Croix10Field second = croix10ResolveLayer(
    fragmentPosition,
    resolution,
    secondCount,
    uAngle + uInterferenceAngleOffset,
    uPhase + uInterferencePhaseOffset,
    uInterferenceWidthRatio
  );

  float coverage;
  vec3 layer = croix10LayerColor(second, coverage);
  vec3 blended = croix10BlendLayers(base.rgb, layer, uInterferenceBlendMode);

  // Where the second layer prints, it is paint: it is opaque even over one of the
  // primary layer's separator windows.
  return vec4(mix(base.rgb, blended, coverage), max(base.a, coverage));
}
`;

const CHUNK_ENGINE_TRANSCHROMIE = `
// Transchromie: sheets of transparent colour laid over one another. Nothing here
// is a drawn mark — every colour in the output is what is left of the light after
// it has passed through the sheets covering that point, which is why the overlaps
// carry colours no single sheet contains.
//
// Subtractive is the physical case: each sheet is a filter, so transmittances
// multiply and the ground is white. Additive is the projected-light case, where
// the ground is dark and each sheet adds light of its own. Both composite in
// linear light, so cyan over yellow really is green.
vec4 croix10RenderTranschromie(vec2 fragmentPosition, vec2 resolution) {
  // Normalised by width, so a plane's offset means the same fraction of the
  // composition at any export size.
  vec2 uv = (fragmentPosition - resolution * 0.5) / max(resolution.x, 1.0);

  bool subtractive = uPlaneBlendMode == 0;
  vec3 color = subtractive ? vec3(1.0) : vec3(0.0);

  // Edge softness is analytic rather than a screen space derivative. The gradient
  // is known exactly — the coordinate below is a unit rotation of a coordinate
  // normalised by composition width, so one backing pixel is 1/width of it — and
  // computing it here also keeps derivatives out of a loop that breaks, where the
  // rules about which control flow permits them are easy to violate by accident.
  float softness = 1.0 / max(resolution.x, 1.0);

  for (int index = 0; index < ${CROIX10_MAX_PLANES}; index++) {
    if (index >= uPlaneCount) {
      break;
    }

    float radians = uPlaneRotation[index] * 0.017453292519943295;
    vec2 local = uv - uPlaneOffset[index];
    float across = local.x * cos(radians) + local.y * sin(radians);

    // The sheet covers the half plane on one side of its edge, antialiased over
    // one pixel so the edge stays clean at any rotation without supersampling.
    float coverage = smoothstep(-softness, softness, across);
    float alpha = uPlaneOpacity[index] * coverage;

    vec3 ink = uPlaneColor[index];
    color = subtractive
      ? color * mix(vec3(1.0), ink, alpha)
      : color + ink * alpha;
  }

  return vec4(color, 1.0);
}
`;

const FRAGMENT_PREAMBLE = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uBandCount;
uniform float uWidthRatio;
uniform float uAngle;
uniform float uPhase;
uniform float uJitterAmount;
uniform float uJitterFrequency;
uniform float uMirror;
uniform float uSeparatorWidth;
uniform vec3 uPalette[${CROIX10_MAX_PALETTE_SLOTS}];
uniform int uSlotCount;
uniform float uCyclingOffset;
uniform vec3 uRampColors[${CROIX10_MAX_RAMP_STOPS}];
uniform float uRampPositions[${CROIX10_MAX_RAMP_STOPS}];
uniform int uRampStopCount;
uniform int uRampSource;
uniform int uRampInterpolation;
uniform float uRampPhase;
uniform float uRampOpacities[${CROIX10_MAX_RAMP_STOPS}];
uniform float uRampAngle;
uniform int uRampType;
uniform vec2 uProximityCenter;
uniform float uProximityRadius;
uniform float uProximityStrength;
uniform int uProximityFalloff;
uniform vec3 uBackgroundColor;
uniform float uIncludeBackground;
uniform int uEngine;
uniform float uViewerAngle;
uniform float uViewerParallax;
uniform float uInductionFrequency;
uniform float uFringeWidth;
uniform float uFringeIntensity;
uniform float uImmersionSpread;
uniform float uImmersionBalance;
uniform int uShapeKind;
uniform int uShapeMode;
uniform float uShapeStrength;
uniform float uShapeSize;
uniform vec2 uShapeCenter;
uniform float uInterferencePitchRatio;
uniform float uInterferenceAngleOffset;
uniform float uInterferencePhaseOffset;
uniform float uInterferenceWidthRatio;
uniform int uInterferenceBlendMode;
uniform vec3 uPlaneColor[${CROIX10_MAX_PLANES}];
uniform float uPlaneOpacity[${CROIX10_MAX_PLANES}];
uniform vec2 uPlaneOffset[${CROIX10_MAX_PLANES}];
uniform float uPlaneRotation[${CROIX10_MAX_PLANES}];
uniform int uPlaneCount;
uniform int uPlaneBlendMode;

in vec2 vUv;
out vec4 fragColor;
`;

function fragmentMain(twoLayer: boolean): string {
  const interferenceBranch = twoLayer
    ? `  } else if (uEngine == ${CROIX10_ENGINES.chromointerference}) {
    engine = croix10RenderInterference(fragmentPosition, uResolution);
`
    : "";

  return `
void main() {
  vec2 fragmentPosition = vUv * uResolution;
  Croix10Field field = croix10ResolveField(fragmentPosition, uResolution);

  vec4 engine;
  if (uEngine == 1) {
    engine = croix10RenderPhysichromie(field, uResolution);
  } else if (uEngine == 2) {
    engine = croix10RenderInduction(fragmentPosition, uResolution);
  } else if (uEngine == 3) {
    engine = croix10RenderChromosaturation(fragmentPosition, uResolution);
  } else if (uEngine == ${CROIX10_ENGINES.transchromie}) {
    engine = croix10RenderTranschromie(fragmentPosition, uResolution);
${interferenceBranch}  } else {
    engine = croix10RenderEngine(field, uResolution);
  }

  // Alpha is carried through rather than flattened: the separator lines are the
  // product's only transparent region and the runtime owns what shows behind them.
  fragColor = vec4(croix10LinearToSrgb(engine.rgb), engine.a);
}
`;
}

/**
 * Shader variants.
 *
 * The second layer is a compiled-in feature rather than a runtime branch: the
 * single-layer variant does not contain the interference code at all, so a
 * disabled layer costs nothing per frame. Programs are cached per variant, so
 * toggling the layer off and on again reuses the compiled program.
 */
export type Croix10VariantKey = "couleur-additive" | "interference";

/**
 * Assembles the fragment shader for one variant. Variants are cached by this key
 * so toggling a feature off and on again reuses the compiled program.
 */
export function croix10AssembleFragmentShader(
  variant: Croix10VariantKey,
): string {
  if (variant !== "couleur-additive" && variant !== "interference") {
    throw new Error(`Unknown Croix10 shader variant: ${variant as string}`);
  }

  const twoLayer = variant === "interference";

  return [
    FRAGMENT_PREAMBLE,
    CHUNK_NOISE,
    CHUNK_COLOR_SPACE,
    CHUNK_SHAPES,
    CHUNK_STRIPE_FIELD,
    CHUNK_PALETTE,
    CROIX10_CHUNK_RAMP,
    CHUNK_ENGINE_COULEUR_ADDITIVE,
    CHUNK_ENGINE_PHYSICHROMIE,
    CHUNK_ENGINE_INDUCTION,
    CHUNK_ENGINE_CHROMOSATURATION,
    CHUNK_ENGINE_TRANSCHROMIE,
    ...(twoLayer ? [CHUNK_ENGINE_INTERFERENCE] : []),
    fragmentMain(twoLayer),
  ].join("\n");
}

export function croix10VertexShader(): string {
  return VERTEX_SHADER;
}

/** Every uniform the assembled program declares, for upload and validation. */
export const CROIX10_UNIFORM_NAMES = [
  "uResolution",
  "uBandCount",
  "uWidthRatio",
  "uAngle",
  "uPhase",
  "uJitterAmount",
  "uJitterFrequency",
  "uMirror",
  "uSeparatorWidth",
  "uPalette",
  "uSlotCount",
  "uCyclingOffset",
  "uRampColors",
  "uRampPositions",
  "uRampStopCount",
  "uRampSource",
  "uRampInterpolation",
  "uRampPhase",
  "uRampOpacities",
  "uRampAngle",
  "uRampType",
  "uProximityCenter",
  "uProximityRadius",
  "uProximityStrength",
  "uProximityFalloff",
  "uBackgroundColor",
  "uIncludeBackground",
  "uEngine",
  "uViewerAngle",
  "uViewerParallax",
  "uInductionFrequency",
  "uFringeWidth",
  "uFringeIntensity",
  "uImmersionSpread",
  "uImmersionBalance",
  "uShapeKind",
  "uShapeMode",
  "uShapeStrength",
  "uShapeSize",
  "uShapeCenter",
  "uInterferencePitchRatio",
  "uInterferenceAngleOffset",
  "uInterferencePhaseOffset",
  "uInterferenceWidthRatio",
  "uInterferenceBlendMode",
  "uPlaneColor",
  "uPlaneOpacity",
  "uPlaneOffset",
  "uPlaneRotation",
  "uPlaneCount",
  "uPlaneBlendMode",
] as const;
