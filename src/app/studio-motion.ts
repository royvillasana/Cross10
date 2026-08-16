/**
 * What moves in a Croix10 loop, and what deliberately does not.
 *
 * **The loop is the viewer, not the work.** These constructions are static; the
 * colour is what moves, and it moves because a body walks past them. So what
 * drifts here are the parameters that stand for that movement — the phase of a
 * band field, the angle it is read at, the position of the pointer — and what
 * holds still are the properties that constitute the work: its inks, its band
 * count, its separators, its region. A field whose colours change over six
 * seconds is a different field every frame rather than the same one seen from
 * somewhere else, which is a screensaver rather than a chromointerference.
 *
 * **Whole cycles per loop, always.** A rate that is not a whole number leaves
 * the last frame somewhere the first is not, and a loop with a visible jump is
 * the one thing a loop must not have. The rate control therefore counts cycles
 * rather than speed.
 *
 * At rate zero every one of these is the identity, so a composition that
 * declares no drift renders exactly as it did before this existed — which is
 * asserted rather than assumed, because a still that quietly changed would be
 * the worst outcome of adding motion.
 */

/**
 * How long one loop is, and why that number.
 *
 * One pass of a viewer along a static work. Under about four seconds a phase
 * drift across a dense band field reads as flicker rather than travel, because
 * the induced colour never holds long enough for the eye to make it — and that
 * making is the phenomenon. Over about eight it stops reading as a single pass.
 *
 * Held here rather than beside the intent that declares it, because the schema
 * needs it too and the intent module already imports the schema; a constant that
 * both need belongs below both.
 */
export const STUDIO_LOOP_SECONDS = 6;

/** The uniforms a loop is allowed to move, and the value each one drifts. */
export const STUDIO_DRIFT_TARGETS = {
  /** Which way the field is read from, in degrees across the loop. */
  angle: { degrees: 360, uniform: "angle" },
  /** How far the band sequence has travelled, in whole field widths. */
  phase: { degrees: 0, uniform: "phase" },
} as const;

export type StudioDriftId = keyof typeof STUDIO_DRIFT_TARGETS;

/** Cycles per loop for one layer's phase, as the control holds it. */
export const STUDIO_DRIFT_PHASE_TARGET = "selectedLayer.driftPhase";

/** Cycles per loop for one layer's angle. */
export const STUDIO_DRIFT_ANGLE_TARGET = "selectedLayer.driftAngle";

/**
 * The properties a loop may never move on its own.
 *
 * Asserted rather than merely documented: the next person to add a drift control
 * meets this list, and a test fails if a rate is offered over any of them.
 */
export const STUDIO_STATIC_PROPERTIES = [
  "colorA",
  "colorB",
  "colorC",
  "colorD",
  "count",
  "maskCenterX",
  "maskCenterY",
  "maskShape",
  "maskSize",
  "paletteSlots",
  "separator",
] as const;

/**
 * Where a whole-cycle drift has reached at a given moment in the loop.
 *
 * Returns a fraction of a full cycle, so the caller decides what a cycle means
 * for the value it is moving — one field width for a phase, a full turn for an
 * angle. Exactly zero at both ends of the loop whatever the rate, which is what
 * makes the seam invisible.
 *
 * A rate of zero returns zero at every moment, so an undeclared drift costs the
 * renderer a multiply and changes nothing.
 */
export function studioDriftAt({
  cycles,
  loopSeconds = STUDIO_LOOP_SECONDS,
  timeSeconds,
}: {
  readonly cycles: number;
  readonly loopSeconds?: number;
  readonly timeSeconds: number;
}): number {
  if (!Number.isFinite(cycles) || cycles === 0) return 0;
  if (!Number.isFinite(timeSeconds) || loopSeconds <= 0) return 0;

  // Wrapped into the loop before it is scaled, so a time past the end of one
  // loop lands where the same moment of the next one does rather than running
  // away. `((x % n) + n) % n` because a negative time must wrap forwards.
  const withinLoop = ((timeSeconds % loopSeconds) + loopSeconds) % loopSeconds;
  return (withinLoop / loopSeconds) * Math.round(cycles);
}

/**
 * The values a layer renders at a moment in the loop.
 *
 * Additive over what the author set, so the composition at time zero is exactly
 * the composition they built. The drift moves it and never replaces it.
 */
export function studioDriftedValues({
  timeSeconds,
  values,
}: {
  readonly timeSeconds: number;
  readonly values: Readonly<Record<string, number | readonly [number, number, number]>>;
}): Readonly<Record<string, number | readonly [number, number, number]>> {
  const phaseCycles = typeof values.driftPhase === "number" ? values.driftPhase : 0;
  const angleCycles = typeof values.driftAngle === "number" ? values.driftAngle : 0;
  if (phaseCycles === 0 && angleCycles === 0) return values;

  const next = { ...values };

  if (phaseCycles !== 0 && typeof values.phase === "number") {
    next.phase = values.phase + studioDriftAt({ cycles: phaseCycles, timeSeconds });
  }
  if (angleCycles !== 0 && typeof values.angle === "number") {
    next.angle =
      values.angle +
      studioDriftAt({ cycles: angleCycles, timeSeconds }) * STUDIO_DRIFT_TARGETS.angle.degrees;
  }

  return next;
}
