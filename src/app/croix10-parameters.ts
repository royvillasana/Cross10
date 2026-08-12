/**
 * Croix10 parameter domains and defaults.
 *
 * Kept out of `app-schema.ts` deliberately: later-delivery verification derives
 * proof scope per product module, so frequently edited defaults and domain
 * limits live in a narrow owner rather than in the broad schema assembly.
 *
 * The density maxima are a *fidelity* bound, not a performance bound. Per-pixel
 * fragment cost does not vary with stripe count, so density is limited by what
 * the pixel grid can represent. Derivation, from the design document:
 *
 *   composition width 1920 CSS px, render scale 1, devicePixelRatio 1
 *   -> 1920 backing px across the width
 *   analytic antialiasing needs ~4 backing px per cycle at arbitrary angles
 *   -> 480 representable cycles, 960 bands for an alternating field
 *   less ~20% headroom for jitter locally compressing bands
 *   -> 800 bands
 *
 * The invariant to preserve when any of those assumptions change is the minimum
 * band width in backing pixels, not the band count itself.
 */

/** Minimum representable band width in backing pixels at render scale 1. */
export const CROIX10_MIN_BAND_BACKING_PX = 2;

/** Reference composition width the density bound is derived against. */
export const CROIX10_REFERENCE_WIDTH_PX = 1920;

export const CROIX10_STRIPE_COUNT = {
  defaultValue: 48,
  max: 800,
  min: 2,
  step: 1,
} as const;

export const CROIX10_WIDTH_RATIO = {
  defaultValue: 1,
  max: 1,
  min: 0.1,
  step: 0.01,
} as const;

export const CROIX10_ANGLE = {
  defaultValue: 0,
  max: 180,
  min: 0,
  step: 1,
} as const;

export const CROIX10_PHASE = {
  defaultValue: 0,
  max: 1,
  min: 0,
  step: 0.001,
} as const;

/** Lateral jitter as a fraction of the sequence period. */
export const CROIX10_JITTER_AMOUNT = {
  defaultValue: 0,
  max: 0.2,
  min: 0,
  step: 0.001,
} as const;

export const CROIX10_JITTER_FREQUENCY = {
  defaultValue: 4,
  max: 20,
  min: 0.5,
  step: 0.1,
} as const;

/** Separator width as a fraction of one band. */
export const CROIX10_SEPARATOR_WIDTH = {
  defaultValue: 0.18,
  max: 0.5,
  min: 0,
  step: 0.005,
} as const;

/**
 * Cycling offset wraps the palette across the bands, so one percent is already
 * finer than the eye can distinguish between adjacent slot assignments; a
 * thousand positions only made the control hard to drive.
 */
export const CROIX10_CYCLING_OFFSET = {
  defaultValue: 0,
  max: 1,
  min: 0,
  step: 0.01,
} as const;

/**
 * Couleur Additive default module. Cruz-Diez's canonical sequence reads
 * green / black / red / black / blue, where the black is the thin line dividing
 * the colour bands rather than a band of its own. Croix10 treats that line as a
 * window onto the support, so the palette carries the three colours and the
 * background colour shows through the separators.
 *
 * These values are working candidates drawn from description and are not yet
 * verified against primary sources; that verification is a later task and the
 * confirmed values belong in the worklog.
 */
export const CROIX10_DEFAULT_PALETTE = [
  "#0B7A3B",
  "#C8102E",
  "#0B3C8A",
] as const;

export const CROIX10_BACKGROUND_COLOR = "#000000";

/** Maximum palette slots the collection accepts. */
export const CROIX10_MAX_PALETTE_SLOTS = 8;

/** Minimum palette slots the collection accepts. */
export const CROIX10_MIN_PALETTE_SLOTS = 2;

/** Engine identifiers shared by the schema, the scene reader, and the shader. */
export const CROIX10_ENGINES = {
  chromointerference: 4,
  transchromie: 5,
  chromosaturation: 3,
  couleurAdditive: 0,
  induction: 2,
  physichromie: 1,
} as const;

export type Croix10EngineKey = keyof typeof CROIX10_ENGINES;

/** Engines that resolve the shared stripe field; Chromosaturation does not. */
export const CROIX10_STRIPE_ENGINES: readonly Croix10EngineKey[] = [
  "couleurAdditive",
  "physichromie",
  "induction",
  "chromointerference",
];

/**
 * Simulated viewing angle for Physichromie. Sweeping it walks the composition
 * through its colour states the way moving past the physical relief does.
 */
export const CROIX10_VIEWER_ANGLE = {
  defaultValue: 0,
  max: 80,
  min: -80,
  step: 1,
} as const;

export const CROIX10_VIEWER_PARALLAX = {
  defaultValue: 0.35,
  max: 1,
  min: 0,
  step: 0.01,
} as const;

/**
 * Induction Chromatique line-pair frequency, in cycles across the composition.
 * The maximum is the Nyquist-derived fidelity bound: 480 representable cycles at
 * the reference width less roughly twenty percent headroom.
 */
export const CROIX10_INDUCTION_FREQUENCY = {
  defaultValue: 120,
  max: 400,
  min: 20,
  step: 1,
} as const;

export const CROIX10_FRINGE_WIDTH = {
  defaultValue: 0.3,
  max: 1,
  min: 0,
  step: 0.01,
} as const;

export const CROIX10_FRINGE_INTENSITY = {
  defaultValue: 0.6,
  max: 1,
  min: 0,
  step: 0.01,
} as const;

export const CROIX10_IMMERSION_SPREAD = {
  defaultValue: 0.5,
  max: 1,
  min: 0.05,
  step: 0.01,
} as const;

export const CROIX10_IMMERSION_BALANCE = {
  defaultValue: 0.5,
  max: 1,
  min: 0,
  step: 0.01,
} as const;

/**
 * Embedded shape kinds. The shape is never drawn as a fill: it exists only as a
 * local perturbation of the stripe field, which is how the originals let a sphere
 * or a square emerge from the lines.
 */
export const CROIX10_SHAPE_KINDS = {
  circle: 1,
  none: 0,
  ellipse: 2,
  rectangle: 3,
  splitBlocks: 4,
} as const;

export type Croix10ShapeKey = keyof typeof CROIX10_SHAPE_KINDS;

/** How the shape perturbs the field. */
export const CROIX10_SHAPE_MODES = {
  phase: 0,
  width: 1,
} as const;

/**
 * Perturbation strength. Zero is the default and must render pixel-identically to
 * having no shape at all, which is what makes the shape a perturbation rather than
 * an object.
 */
export const CROIX10_SHAPE_STRENGTH = {
  defaultValue: 0,
  max: 1,
  min: 0,
  step: 0.01,
} as const;

export const CROIX10_SHAPE_SIZE = {
  defaultValue: 0.3,
  max: 0.9,
  min: 0.05,
  step: 0.01,
} as const;

/**
 * Second stripe layer for Chromointerférence.
 *
 * Interference is a relationship, not a thing: what the viewer sees is the beat
 * between two printed structures whose pitches differ slightly. The pitch ratio is
 * therefore the defining control, and it is deliberately narrow around 1 — a ratio
 * far from unity reads as two unrelated gratings rather than as moiré. The beat
 * period in bands is `1 / |ratio - 1|`, so 1.08 puts roughly twelve primary bands
 * in one beat: visible at a glance without dissolving into noise.
 */
export const CROIX10_INTERFERENCE_PITCH_RATIO = {
  defaultValue: 1.08,
  max: 1.5,
  min: 0.5,
  step: 0.005,
} as const;

/** Angle difference between the layers, in degrees. Small offsets rotate the beat. */
export const CROIX10_INTERFERENCE_ANGLE_OFFSET = {
  defaultValue: 4,
  max: 45,
  min: -45,
  step: 0.5,
} as const;

/** Phase offset of the second layer, in bands. Sliding it translates the beat. */
export const CROIX10_INTERFERENCE_PHASE_OFFSET = {
  defaultValue: 0,
  max: 1,
  min: 0,
  step: 0.005,
} as const;

/** Band occupancy of the second layer: how much of each period it prints. */
export const CROIX10_INTERFERENCE_WIDTH_RATIO = {
  defaultValue: 0.5,
  max: 1,
  min: 0.1,
  step: 0.01,
} as const;

/**
 * Blend modes for compositing the second layer over the primary, in linear light.
 *
 * Additive and difference are the two that carry chromatic meaning: additive
 * reproduces the additive mixing the originals exploit, and difference renders
 * black wherever the layers agree, which makes the beat itself the subject.
 */
export const CROIX10_INTERFERENCE_BLEND_MODES = {
  additive: 4,
  difference: 3,
  multiply: 1,
  normal: 0,
  screen: 2,
} as const;

export type Croix10InterferenceBlendMode =
  keyof typeof CROIX10_INTERFERENCE_BLEND_MODES;

/**
 * Translucent planes for Transchromie.
 *
 * A plane is a sheet of transparent colour laid over the composition, not a shape
 * drawn on it: the colour a viewer sees in any region is the product of the sheets
 * that region passes through. That is why the default plane colours are subtractive
 * primaries and the default opacities are partial — an opaque sheet would hide what
 * is under it, and the overlaps are the whole subject.
 *
 * Each plane covers a half of the composition, bounded by an edge the plane's own
 * rotation and offset place, so two planes at different angles produce the wedge
 * of mixed colour these works are made of.
 */
export const CROIX10_MAX_PLANES = 6;
export const CROIX10_MIN_PLANES = 2;

export const CROIX10_PLANE_OPACITY = {
  defaultValue: 0.6,
  max: 1,
  min: 0,
  step: 0.01,
} as const;

export const CROIX10_PLANE_ROTATION = {
  defaultValue: 0,
  max: 90,
  min: -90,
  step: 1,
} as const;

/** Plane edge offset from the centre, in composition widths. */
export const CROIX10_PLANE_OFFSET = {
  defaultValue: 0,
  max: 0.5,
  min: -0.5,
  step: 0.005,
} as const;

export type Croix10Plane = Readonly<{
  color: string;
  offset: Readonly<{ x: number; y: number }>;
  opacity: number;
  rotation: number;
}>;

/**
 * Cyan, magenta, and yellow sheets, deliberately facing different ways.
 *
 * Each sheet covers the half of the composition on one side of its own edge, so
 * three sheets all facing the same way would nest and leave the rest of the field
 * bare. These face left, right, and down, which covers the whole composition and
 * still leaves distinct regions where one, two, or three sheets overlap — the
 * overlaps being the only place the mixed colours exist.
 */
export const CROIX10_DEFAULT_PLANES: readonly Croix10Plane[] = [
  {
    color: "#00A0C6",
    offset: { x: 0.15, y: 0 },
    opacity: CROIX10_PLANE_OPACITY.defaultValue,
    rotation: 165,
  },
  {
    color: "#E4007F",
    offset: { x: -0.15, y: 0 },
    opacity: CROIX10_PLANE_OPACITY.defaultValue,
    rotation: 15,
  },
  {
    color: "#FFE800",
    offset: { x: 0, y: 0.1 },
    opacity: CROIX10_PLANE_OPACITY.defaultValue,
    rotation: -90,
  },
];

/**
 * How stacked sheets combine.
 *
 * Subtractive is the physical default: each sheet is a filter, so transmitted
 * colour is the product of the transmittances and the ground is white light.
 * Additive is the projected-light case, where the ground is dark and each sheet
 * contributes light of its own.
 */
export const CROIX10_PLANE_BLEND_MODES = {
  additive: 1,
  subtractive: 0,
} as const;

export type Croix10PlaneBlendMode = keyof typeof CROIX10_PLANE_BLEND_MODES;

/**
 * Product loop period.
 *
 * The slowest intended modulation is a full sweep through the Physichromie
 * colour states, which has to read as a deliberate walk past the work rather
 * than a flicker: roughly two seconds per perceptible state across four states.
 * That is a product-derived period which happens to coincide with the runtime's
 * fallback; the coincidence is recorded here so the value is not mistaken for an
 * unset default, and it must be re-derived if the sweep reads wrong.
 */
export const CROIX10_LOOP_DURATION_SECONDS = 8;

/**
 * Whole cycles of drift per loop.
 *
 * The domain is integers on purpose. Motion that advances a non-integer number
 * of cycles across the loop cannot stitch at the seam, so rather than quantizing
 * a continuous rate at evaluation time and then having to surface the corrected
 * value, the only reachable rates are the ones that already loop. Zero is static,
 * which is what every scene renders as before a rate is chosen.
 */
export const CROIX10_DRIFT_CYCLES = {
  defaultValue: 0,
  max: 8,
  min: 0,
  step: 1,
} as const;

/**
 * The most ramp stops the shader will read.
 *
 * A fixed ceiling because the stop arrays are uniform arrays, which cannot be
 * sized at draw time. Eight matches the palette slot ceiling, so neither colour
 * source can express something the other cannot hold.
 */
export const CROIX10_MAX_RAMP_STOPS = 8;

/**
 * How far the cursor's influence reaches, as a fraction of the composition width.
 *
 * Zero would be a dead control rather than a disabled effect, so the floor is a
 * radius that still reads; absence is expressed by the enable switch instead.
 */
export const CROIX10_PROXIMITY_RADIUS = {
  defaultValue: 0.35,
  max: 1,
  min: 0.05,
  step: 0.01,
} as const;

/**
 * How far the cursor pushes the ramp where its influence is strongest.
 *
 * In ramp traversals: at 1 the field under the cursor is a full traversal ahead
 * of the field outside its reach. Zero is exactly no displacement, so a strength
 * of zero renders byte-identically to the effect being off.
 */
export const CROIX10_PROXIMITY_STRENGTH = {
  defaultValue: 0.4,
  max: 1,
  min: 0,
  step: 0.01,
} as const;

/** Falloff shapes, in the order the shader branches on them. */
export const CROIX10_PROXIMITY_FALLOFFS = {
  linear: 0,
  smooth: 1,
  tight: 2,
} as const;

/**
 * The gradient control's own types, in the order the ramp chunk branches on.
 *
 * The control owns this field, so the product maps it rather than redeclaring it:
 * a sibling control offering the same choice is what R23 forbids.
 */
export const CROIX10_RAMP_TYPES: Readonly<Record<string, number>> = {
  angular: 2,
  diamond: 3,
  linear: 0,
  radial: 1,
};

/**
 * The ramp's starting position along its mapping, as a fraction of one traversal.
 *
 * Continuous rather than discrete: unlike the drift rate, a phase offset does not
 * have to land on a whole cycle to loop — it is a fixed rotation of a periodic
 * function, so every value stitches.
 */
export const CROIX10_RAMP_PHASE = {
  defaultValue: 0,
  max: 1,
  min: 0,
  step: 0.01,
} as const;

/**
 * The default ramp: the chromatic sweep the reference plates turn on.
 *
 * Six stops rather than a two-colour fade, because the subject is a traversal
 * through hue rather than a blend between two inks. Positions are strings because
 * that is the gradient control's own stop format.
 */
export const CROIX10_DEFAULT_RAMP = [
  { color: "#1B2C86", position: "0%" },
  { color: "#2E7FC0", position: "20%" },
  { color: "#41B694", position: "40%" },
  { color: "#D9C84B", position: "60%" },
  { color: "#DC7A3F", position: "80%" },
  { color: "#B2325C", position: "100%" },
] as const;

/**
 * How far the immersion balance sweeps at full amplitude, in balance units.
 *
 * Half the declared balance domain, so a default-centred field sweeps its whole
 * width and back within the loop without the sweep clipping against the range.
 */
export const CROIX10_IMMERSION_DRIFT_AMPLITUDE = 0.5;
