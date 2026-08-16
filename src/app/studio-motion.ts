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

/**
 * Degrees in a whole turn of the reading angle.
 *
 * Here rather than only in the shader because the seam claim is checked against
 * both: the GLSL is what renders, and this is what the check knows the GLSL
 * should say. A drift constant that lived in one place would be a constant no
 * test could disagree with.
 */
export const STUDIO_DRIFT_TURN_DEGREES = 360;

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
 * **The shader is what renders; this is the reference it is checked against.**
 * The drift happens per fragment, so the arithmetic lives in GLSL and a
 * JavaScript twin that nothing draws through would be a second implementation
 * free to disagree with the first while both stayed green. What this function
 * is for is stating the intended shape once, in a form a test can exercise
 * directly, next to a test that reads the GLSL and checks it says the same.
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
  // `+ 0` collapses the -0 a negative rate produces at the ends of the loop.
  // Nothing renders differently either way, but "the drift at both ends is
  // exactly zero" is the claim this function exists to make, and a reader who
  // finds -0 in a test failure spends the next ten minutes on the wrong thing.
  return (withinLoop / loopSeconds) * Math.round(cycles) + 0;
}
