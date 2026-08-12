import {
  evaluateToolcraftTimelineValues,
  getToolcraftTimelineLoopProgress,
  type ToolcraftState,
} from "@/toolcraft/runtime";

import {
  CROIX10_ANGLE,
  CROIX10_DEFAULT_RAMP,
  CROIX10_MAX_RAMP_STOPS,
  CROIX10_RAMP_PHASE,
  CROIX10_RAMP_TYPES,
  CROIX10_PROXIMITY_FALLOFFS,
  CROIX10_PROXIMITY_RADIUS,
  CROIX10_PROXIMITY_STRENGTH,
  CROIX10_BACKGROUND_COLOR,
  CROIX10_CYCLING_OFFSET,
  CROIX10_DEFAULT_PALETTE,
  CROIX10_DRIFT_CYCLES,
  CROIX10_IMMERSION_DRIFT_AMPLITUDE,
  CROIX10_JITTER_AMOUNT,
  CROIX10_JITTER_FREQUENCY,
  CROIX10_PHASE,
  CROIX10_REFERENCE_WIDTH_PX,
  CROIX10_SEPARATOR_WIDTH,
  CROIX10_ENGINES,
  CROIX10_DEFAULT_PLANES,
  CROIX10_INTERFERENCE_ANGLE_OFFSET,
  CROIX10_INTERFERENCE_BLEND_MODES,
  CROIX10_INTERFERENCE_PHASE_OFFSET,
  CROIX10_INTERFERENCE_PITCH_RATIO,
  CROIX10_INTERFERENCE_WIDTH_RATIO,
  CROIX10_PLANE_BLEND_MODES,
  type Croix10Plane,
  CROIX10_FRINGE_INTENSITY,
  CROIX10_FRINGE_WIDTH,
  CROIX10_IMMERSION_BALANCE,
  CROIX10_IMMERSION_SPREAD,
  CROIX10_INDUCTION_FREQUENCY,
  CROIX10_SHAPE_KINDS,
  CROIX10_SHAPE_MODES,
  CROIX10_SHAPE_SIZE,
  CROIX10_SHAPE_STRENGTH,
  CROIX10_STRIPE_COUNT,
  CROIX10_VIEWER_ANGLE,
  CROIX10_VIEWER_PARALLAX,
  CROIX10_WIDTH_RATIO,
} from "./croix10-parameters";
import type {
  Croix10RampStop,
  Croix10SceneParameters,
} from "./croix10-render";

/**
 * Reads scene parameters out of runtime state.
 *
 * One reader serves live preview and the runtime export frame, so a value can
 * never apply to one and not the other. Time enters here too, through the
 * runtime timeline rather than a wall clock, which is what makes the two paths
 * agree: the export frame state carries the scheduled time on the same field
 * preview reads, so an exported frame is the frame preview would have shown.
 */

/**
 * Evaluated control values.
 *
 * Read through the timeline evaluator rather than off `state.values` directly.
 * With no keyframe groups the evaluator returns the raw values, so this costs
 * nothing today; it is the shape the contract requires the moment any target is
 * keyframed, and adopting it now means the render path does not have to change
 * to become correct later.
 */
type Croix10Values = Record<string, unknown>;

/**
 * Bands after which the whole sequence repeats.
 *
 * A phase shift of one band moves every band's colour along by one slot and
 * flips which side of the width alternation it falls on, so the field only
 * returns to itself after a whole number of both: the least common multiple of
 * the palette length and the two-band width alternation. This is the unit any
 * drift has to advance in whole steps for the loop to stitch.
 */
export function croix10SequencePeriodBands(slotCount: number): number {
  const slots = Math.max(1, Math.round(slotCount));
  let a = slots;
  let b = 2;
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return (slots * 2) / a;
}

/**
 * Where the loop stands, as a fraction of the runtime timeline duration.
 *
 * Derived from the runtime timeline rather than from a local clock or a fixed
 * product duration, so editing the duration changes the loop length and nothing
 * else about the scene, and an export samples the same function the preview does.
 */
export function readCroix10LoopProgress(state: ToolcraftState): number {
  return getToolcraftTimelineLoopProgress(state.timeline);
}

/**
 * How long one rendered cycle lasts, in seconds.
 *
 * The same `state.timeline` that `readCroix10LoopProgress` normalises against, so
 * the cycle the renderer walks and the range the runtime scrubber exposes cannot
 * disagree. Published on the canvas so a browser proof can read the renderer's
 * own cycle rather than inferring it from the scrubber it is supposed to match.
 */
export function readCroix10LoopDurationSeconds(state: ToolcraftState): number {
  return state.timeline.durationSeconds;
}

function readNumber(
  values: Croix10Values,
  target: string,
  fallback: number,
): number {
  const value = values[target];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(
  values: Croix10Values,
  target: string,
  fallback: boolean,
): boolean {
  const value = values[target];
  return typeof value === "boolean" ? value : fallback;
}

function readColor(
  values: Croix10Values,
  target: string,
  fallback: string,
): string {
  const value = values[target];
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

/**
 * Reads one palette slot.
 *
 * The collection stores an unedited slot as its plain default string and an
 * edited slot as the colour control's `{ hex }` value object, so both shapes
 * appear in the same array. Accepting only strings silently dropped every edit.
 */
function readPaletteSlot(entry: unknown): string | null {
  if (typeof entry === "string") {
    return entry.trim() === "" ? null : entry;
  }
  if (entry !== null && typeof entry === "object" && "hex" in entry) {
    const hex = (entry as { hex?: unknown }).hex;
    return typeof hex === "string" && hex.trim() !== "" ? hex : null;
  }
  return null;
}

function readPalette(values: Croix10Values): readonly string[] {
  const value = values["palette.slots"];
  if (!Array.isArray(value)) {
    return CROIX10_DEFAULT_PALETTE;
  }
  const colors = value
    .map(readPaletteSlot)
    .filter((entry): entry is string => entry !== null);
  return colors.length > 0 ? colors : CROIX10_DEFAULT_PALETTE;
}

/** Reads one field out of the gradient control's compound value. */
function readRampField(values: Croix10Values, field: string): unknown {
  const value = values["ramp.gradient"];
  return value !== null && typeof value === "object" && field in value
    ? (value as Record<string, unknown>)[field]
    : null;
}

/**
 * Reads the ramp's stops from the gradient control's own value shape.
 *
 * The control owns `{ angle, gradientType, stops }` atomically; only the stop list
 * reaches the shader, because the stripe field supplies its own geometry — the
 * ramp's angle is the stripe angle, and its type is the mapping control. Positions
 * arrive as strings like `"40%"`, which is the control's format, not ours.
 */
function readRampStops(values: Croix10Values): readonly Croix10RampStop[] {
  const raw = readRampField(values, "stops");
  const source = Array.isArray(raw) ? raw : CROIX10_DEFAULT_RAMP;

  const stops = source.flatMap((entry) => {
    if (entry === null || typeof entry !== "object") return [];
    const { color, opacity, position } = entry as {
      color?: unknown;
      opacity?: unknown;
      position?: unknown;
    };
    if (typeof color !== "string" || color.trim() === "") return [];
    const parsed =
      typeof position === "number"
        ? position
        : typeof position === "string"
          ? Number.parseFloat(position) / 100
          : Number.NaN;
    if (!Number.isFinite(parsed)) return [];
    // Opacity is optional on a stop; absent means fully covering, which is what a
    // stop the user has never opened should do.
    const coverage =
      typeof opacity === "number" && Number.isFinite(opacity) ? opacity : 1;
    return [
      {
        color,
        opacity: Math.min(Math.max(coverage, 0), 1),
        position: Math.min(Math.max(parsed, 0), 1),
      },
    ];
  });

  // Sorted because the shader walks the stops in order to find the bracketing
  // pair, and the control does not guarantee the array is ordered by position.
  const ordered = [...stops].sort((left, right) => left.position - right.position);
  return ordered.length > 0
    ? ordered.slice(0, CROIX10_MAX_RAMP_STOPS)
    : [{ color: CROIX10_DEFAULT_RAMP[0].color, opacity: 1, position: 0 }];
}

/**
 * Reads one translucent plane record.
 *
 * Each plane is one compound collection record, so a field the user has never
 * touched holds the schema default while an edited colour arrives in the colour
 * control's `{ hex }` shape — the same two shapes the palette taught us to accept.
 * Anything unreadable falls back to the plane defaults rather than dropping the
 * plane, because a missing plane would silently change the composite.
 */
function readPlane(entry: unknown, index: number): Croix10Plane {
  const fallback =
    CROIX10_DEFAULT_PLANES[index % CROIX10_DEFAULT_PLANES.length];
  if (entry === null || typeof entry !== "object") {
    return fallback;
  }
  const record = entry as Record<string, unknown>;
  const color = readPaletteSlot(record.color) ?? fallback.color;
  const opacity =
    typeof record.opacity === "number" && Number.isFinite(record.opacity)
      ? record.opacity
      : fallback.opacity;
  const rotation =
    typeof record.rotation === "number" && Number.isFinite(record.rotation)
      ? record.rotation
      : fallback.rotation;
  const offsetValue = record.offset;
  const offset =
    offsetValue !== null &&
    typeof offsetValue === "object" &&
    typeof (offsetValue as { x?: unknown }).x === "number" &&
    typeof (offsetValue as { y?: unknown }).y === "number"
      ? {
          x: (offsetValue as { x: number }).x,
          y: (offsetValue as { y: number }).y,
        }
      : fallback.offset;
  return { color, offset, opacity, rotation };
}

function readPlanes(values: Croix10Values): readonly Croix10Plane[] {
  const value = values["transchromie.planes"];
  if (!Array.isArray(value) || value.length === 0) {
    return CROIX10_DEFAULT_PLANES;
  }
  return value.map(readPlane);
}

/**
 * Selected resolution scale. Runtime resolves the enabled control to a default and
 * maximum of 2, and the backing must be CSS size times devicePixelRatio times
 * this value: ignoring it silently renders at half the selected quality.
 */
export function readCroix10RenderScale(state: ToolcraftState): number {
  const value = state.values["canvas.renderScale"];
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 1;
}

/** Maps the selected engine key to the shader's engine index. */
/**
 * Where the committed cursor hotspot sits, in centred composition units.
 *
 * Written by the canvas on gesture end and by nothing else (R44): there is no
 * panel control for it, because a pad for pointer position is both a mirrored
 * capability and a named wrong substitution. Absent means the composition centre,
 * which is where a scene that has never been pointed at should read from.
 */
export function readCroix10ProximityCenter(
  values: Croix10Values,
): readonly [number, number] {
  const value = values["proximity.center"];
  if (value !== null && typeof value === "object") {
    const point = value as { x?: unknown; y?: unknown };
    const x = typeof point.x === "number" && Number.isFinite(point.x) ? point.x : 0;
    const y = typeof point.y === "number" && Number.isFinite(point.y) ? point.y : 0;
    return [x, y];
  }
  return [0, 0];
}

/** Reads a select's chosen value, for the ramp's three mode controls. */
function readOption(values: Croix10Values, target: string): string | null {
  const value = values[target];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function readEngine(values: Croix10Values): number {
  const value = values["engine.active"];
  if (typeof value === "string" && value in CROIX10_ENGINES) {
    return CROIX10_ENGINES[value as keyof typeof CROIX10_ENGINES];
  }
  return CROIX10_ENGINES.couleurAdditive;
}

/** Reads the two-axis shape centre, which the vector control stores as x and y. */
function readShapeCenter(values: Croix10Values): readonly [number, number] {
  const value = values["shape.center"];
  if (value !== null && typeof value === "object") {
    const point = value as { x?: unknown; y?: unknown };
    const x = typeof point.x === "number" && Number.isFinite(point.x) ? point.x : 0;
    const y = typeof point.y === "number" && Number.isFinite(point.y) ? point.y : 0;
    return [x, y];
  }
  return [0, 0];
}

export function readCroix10SceneParameters(
  state: ToolcraftState,
  includeBackground: boolean,
): Croix10SceneParameters {
  const values = evaluateToolcraftTimelineValues(state);
  const loopProgress = readCroix10LoopProgress(state);
  const palette = readPalette(values);

  // The second layer travels a whole number of sequence periods across the loop,
  // so at the seam it has advanced by an exact multiple of the period and the
  // field is the one the loop started from. The beat translates; its period,
  // which the pitch ratio sets, does not move.
  const interferenceDrift =
    readNumber(values, "interference.driftCycles", CROIX10_DRIFT_CYCLES.defaultValue) *
    loopProgress *
    croix10SequencePeriodBands(palette.length);

  // The immersion field has no spatial period to travel through, so its drift is
  // a sweep of the transition centre rather than a translation. A sine closes on
  // itself at every whole cycle, which is the same seam guarantee by a different
  // route, and it reads as the walk across a saturation chamber and back.
  const immersionDriftCycles = readNumber(
    values,
    "immersion.driftCycles",
    CROIX10_DRIFT_CYCLES.defaultValue,
  );
  const immersionSweep =
    immersionDriftCycles === 0
      ? 0
      : Math.sin(2 * Math.PI * immersionDriftCycles * loopProgress) *
        CROIX10_IMMERSION_DRIFT_AMPLITUDE;

  // The ramp's period is one full traversal of its mapping, so a whole number of
  // cycles across the loop returns it to where it started and the seam closes
  // without a quantization step (R41, R43). Zero adds exactly nothing, which is
  // what makes a static ramp byte-identical to one with no rate chosen.
  const rampPhase =
    readNumber(values, "ramp.phase", CROIX10_RAMP_PHASE.defaultValue) +
    readNumber(values, "ramp.driftCycles", CROIX10_DRIFT_CYCLES.defaultValue) *
      loopProgress;

  return {
    angle: readNumber(values, "stripe.angle", CROIX10_ANGLE.defaultValue),
    engine: readEngine(values),
    rampAngle: (() => {
      const angle = readRampField(values, "angle");
      return typeof angle === "number" && Number.isFinite(angle) ? angle : 0;
    })(),
    rampInterpolation:
      readOption(values, "ramp.interpolationSpace") === "srgb" ? 1 : 0,
    rampPhase,
    rampSource: readOption(values, "ramp.source") === "continuous" ? 1 : 0,
    proximityCenter: readCroix10ProximityCenter(values),
    proximityFalloff:
      CROIX10_PROXIMITY_FALLOFFS[
        String(readOption(values, "proximity.falloff")) as keyof typeof CROIX10_PROXIMITY_FALLOFFS
      ] ?? CROIX10_PROXIMITY_FALLOFFS.smooth,
    proximityRadius: readNumber(
      values,
      "proximity.radius",
      CROIX10_PROXIMITY_RADIUS.defaultValue,
    ),
    // Strength collapses to zero when the effect is off, so a disabled cursor
    // field is the same render as one with nothing to push — no second variant,
    // and the identity is exact rather than approximate.
    proximityStrength: readBoolean(values, "proximity.enabled", false)
      ? readNumber(
          values,
          "proximity.strength",
          CROIX10_PROXIMITY_STRENGTH.defaultValue,
        )
      : 0,
    rampStops: readRampStops(values),
    rampType: CROIX10_RAMP_TYPES[String(readRampField(values, "gradientType"))] ?? 0,
    fringeIntensity: readNumber(
      values,
      "induction.fringeIntensity",
      CROIX10_FRINGE_INTENSITY.defaultValue,
    ),
    fringeWidth: readNumber(
      values,
      "induction.fringeWidth",
      CROIX10_FRINGE_WIDTH.defaultValue,
    ),
    // Swept, then clamped back into the control's own declared range: a drifting
    // value must still be a value the user could have set by hand.
    immersionBalance: Math.min(
      CROIX10_IMMERSION_BALANCE.max,
      Math.max(
        CROIX10_IMMERSION_BALANCE.min,
        readNumber(
          values,
          "immersion.balance",
          CROIX10_IMMERSION_BALANCE.defaultValue,
        ) + immersionSweep,
      ),
    ),
    immersionSpread: readNumber(
      values,
      "immersion.spread",
      CROIX10_IMMERSION_SPREAD.defaultValue,
    ),
    inductionFrequency: readNumber(
      values,
      "induction.frequency",
      CROIX10_INDUCTION_FREQUENCY.defaultValue,
    ),
    viewerAngle: readNumber(
      values,
      "viewer.angle",
      CROIX10_VIEWER_ANGLE.defaultValue,
    ),
    viewerParallax: readNumber(
      values,
      "viewer.parallax",
      CROIX10_VIEWER_PARALLAX.defaultValue,
    ),
    backgroundColor: readColor(
      values,
      "appearance.background",
      CROIX10_BACKGROUND_COLOR,
    ),
    bandCount: readNumber(
      values,
      "stripe.count",
      CROIX10_STRIPE_COUNT.defaultValue,
    ),
    cyclingOffset: readNumber(
      values,
      "palette.cyclingOffset",
      CROIX10_CYCLING_OFFSET.defaultValue,
    ),
    includeBackground,
    jitterAmount: readNumber(
      values,
      "stripe.jitterAmount",
      CROIX10_JITTER_AMOUNT.defaultValue,
    ),
    jitterFrequency: readNumber(
      values,
      "stripe.jitterFrequency",
      CROIX10_JITTER_FREQUENCY.defaultValue,
    ),
    interferenceActive:
      readEngine(values) === CROIX10_ENGINES.chromointerference &&
      readBoolean(values, "interference.enabled", true),
    interferenceAngleOffset: readNumber(
      values,
      "interference.angleOffset",
      CROIX10_INTERFERENCE_ANGLE_OFFSET.defaultValue,
    ),
    interferenceBlendMode: (() => {
      const value = values["interference.blendMode"];
      return typeof value === "string" &&
        value in CROIX10_INTERFERENCE_BLEND_MODES
        ? CROIX10_INTERFERENCE_BLEND_MODES[
            value as keyof typeof CROIX10_INTERFERENCE_BLEND_MODES
          ]
        : CROIX10_INTERFERENCE_BLEND_MODES.normal;
    })(),
    interferencePhaseOffset:
      readNumber(
        values,
        "interference.phaseOffset",
        CROIX10_INTERFERENCE_PHASE_OFFSET.defaultValue,
      ) + interferenceDrift,
    interferencePitchRatio: readNumber(
      values,
      "interference.pitchRatio",
      CROIX10_INTERFERENCE_PITCH_RATIO.defaultValue,
    ),
    interferenceWidthRatio: readNumber(
      values,
      "interference.widthRatio",
      CROIX10_INTERFERENCE_WIDTH_RATIO.defaultValue,
    ),
    mirror: readBoolean(values, "stripe.mirror", false),
    palette,
    planeBlendMode: (() => {
      const value = values["transchromie.blendMode"];
      return typeof value === "string" && value in CROIX10_PLANE_BLEND_MODES
        ? CROIX10_PLANE_BLEND_MODES[
            value as keyof typeof CROIX10_PLANE_BLEND_MODES
          ]
        : CROIX10_PLANE_BLEND_MODES.subtractive;
    })(),
    planes: readPlanes(values),
    phase: readNumber(values, "stripe.phase", CROIX10_PHASE.defaultValue),
    shapeCenter: readShapeCenter(values),
    shapeKind: (() => {
      const value = values["shape.kind"];
      return typeof value === "string" && value in CROIX10_SHAPE_KINDS
        ? CROIX10_SHAPE_KINDS[value as keyof typeof CROIX10_SHAPE_KINDS]
        : CROIX10_SHAPE_KINDS.none;
    })(),
    shapeMode: (() => {
      const value = values["shape.mode"];
      return typeof value === "string" && value in CROIX10_SHAPE_MODES
        ? CROIX10_SHAPE_MODES[value as keyof typeof CROIX10_SHAPE_MODES]
        : CROIX10_SHAPE_MODES.phase;
    })(),
    shapeSize: readNumber(values, "shape.size", CROIX10_SHAPE_SIZE.defaultValue),
    shapeStrength: readNumber(
      values,
      "shape.strength",
      CROIX10_SHAPE_STRENGTH.defaultValue,
    ),
    separatorWidth: readNumber(
      values,
      "bands.separatorWidth",
      CROIX10_SEPARATOR_WIDTH.defaultValue,
    ),
    widthRatio: readNumber(
      values,
      "stripe.widthRatio",
      CROIX10_WIDTH_RATIO.defaultValue,
    ),
  };
}

/**
 * The product composition occupies a fixed world rectangle anchored at the
 * origin, declared as a product constant.
 *
 * A full-field shader has no intrinsic extent, `canvas.size` is dormant and
 * forbidden as a source while infinite, and infinite video export unions the
 * provider across every scheduled frame — so the extent must be constant over
 * time, parameters, and canvas mode. This is that constant.
 *
 * It is wider than the default artboard on purpose. These are architectural works:
 * the field runs across a wall and the artboard is a window onto it, so the world is
 * a 21:9 frame while the default artboard is 16:9. Entering Infinity canvas therefore
 * presents the composition at its own full width instead of reproducing the artboard,
 * and an infinite export is that wider frame.
 *
 * One honest limitation: the composition is normalised by frame width, so the wider
 * frame shows the same bands at a wider aspect rather than additional bands. Making
 * the band pitch world-space — so that a wider frame reveals more of the field —
 * needs the world-to-frame mapping in the renderer, which is a change to the
 * coordinate model rather than to this constant.
 */
export const CROIX10_SCENE_WIDTH_PX = 2560;

export const CROIX10_SCENE_RECT = Object.freeze({
  height: Math.round((CROIX10_REFERENCE_WIDTH_PX * 9) / 16),
  width: CROIX10_SCENE_WIDTH_PX,
  x: -CROIX10_SCENE_WIDTH_PX / 2,
  y: -Math.round((CROIX10_REFERENCE_WIDTH_PX * 9) / 16) / 2,
});
