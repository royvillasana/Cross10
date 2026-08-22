/**
 * Where the spatial mode's state lives, kept apart from the scene that draws it.
 *
 * Targets in their own module because three things read them and none of them
 * should import a Three scene to do it: the schema declares the controls, the
 * composition declares the readiness intent, and the canvas decides which
 * renderer to mount. A module that pulled in a renderer to answer "which view is
 * this" would put Three in the import graph of the flat product.
 */

/** Which renderer owns the canvas. */
export const STUDIO_RELIEF_VIEW_TARGET = "stack.view";

/** The shared orbit pose, written by the gizmo and by dragging the geometry. */
export const STUDIO_RELIEF_POSE_TARGET = "stack.pose";

/** Whether the spatial mode is the one drawing. */
export function isStudioReliefView(value: unknown): boolean {
  return value === "relief";
}

/** How far the fins stand off the support. */
export const STUDIO_RELIEF_DEPTH_TARGET = "stack.reliefDepth";

/**
 * The fins one composition stands up, read from the layers it already has.
 *
 * **The lamellae are not a second set of parameters.** A Physichromie's fins are
 * the bands of the work turned edge-on, so their count and spacing come from
 * the same band count and width the flat field reads — one number, two
 * readings. A relief with its own count would be a different work wearing the
 * same panel, and the first time an author changed one the two would disagree
 * about what they were looking at.
 *
 * That is also why nothing here declares a new workload dimension: the count is
 * `band-count`, which the pipeline already declares and bounds. What varies is
 * how the same number is drawn.
 */
export type StudioReliefFins = Readonly<{
  /** Ink either side of the split, in linear light. */
  colors: readonly [readonly [number, number, number], readonly [number, number, number]];
  count: number;
  /** How much of each pitch the fin occupies, from the layer's own band width. */
  coverage: number;
  /** The reading angle in degrees, so the fins stand along the layer's own axis. */
  angle: number;
}>;

/**
 * The first layer that draws a band field, which is the one a relief is of.
 *
 * A stack can hold several; the relief stands up the lowest visible band field
 * rather than compositing them, because fins occlude one another and a stack of
 * occluding reliefs is a different construction from a stack of composited
 * fields. Standing up one and saying so is honest where averaging several would
 * not be.
 */
export function readStudioReliefFins(
  layers: readonly {
    typeId: string;
    values: Readonly<Record<string, number | readonly [number, number, number]>>;
  }[],
): StudioReliefFins | null {
  const field = layers.find(
    (layer) => layer.typeId === "stripes" && layer.values.visible !== 0,
  );
  if (!field) return null;

  const number = (name: string, fallback: number): number => {
    const value = field.values[name];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };
  const colour = (
    name: string,
    fallback: readonly [number, number, number],
  ): readonly [number, number, number] => {
    const value = field.values[name];
    return Array.isArray(value) ? (value as readonly [number, number, number]) : fallback;
  };

  return {
    angle: number("angle", 0),
    colors: [colour("colorA", [1, 1, 1]), colour("colorB", [0, 0, 0])],
    // Clamped to the control's own ceiling rather than to a number chosen here,
    // so the geometry cannot be asked for more fins than a band count can name.
    count: Math.max(1, Math.min(200, Math.round(number("count", 24)))),
    coverage: Math.min(1, Math.max(0.05, number("widthRatio", 0.5))),
  };
}

/**
 * How far a viewer walks to either side of the work over one loop, in degrees.
 *
 * A relief is read by moving past it, and past is a limited arc: fifty-five
 * degrees is far enough that the fins' side faces come fully into view and the
 * far edges of the near faces go out of it, and near enough that the work never
 * turns away. A full rotation would be a different gesture -- an object being
 * spun rather than a viewer walking -- and would show the backs of the fins,
 * which a Physichromie hanging on a wall does not have.
 */
export const STUDIO_RELIEF_SWEEP_DEGREES = 55;

/**
 * Where the viewer is standing at this point in the loop.
 *
 * **The rate is the layer's own travel per loop**, which in the flat view moves
 * the viewer *along* the work by shifting which part of each lamella is
 * presented. Here it moves them for real. One control, two readings of the same
 * statement -- how many times a viewer passes this work in one loop -- which is
 * what keeps a composition one work in two views rather than two works.
 *
 * A sine rather than a ramp, and that is what makes the seam close *and* the
 * motion right. At a whole number of passes the sine returns to zero at the end
 * of the loop, so the last frame is the first by construction rather than by
 * an author choosing a rate that happens to divide. And a viewer walking past
 * arrives, passes, and leaves the other way; they do not teleport back to where
 * they started, which is what a ramp would draw.
 */
export function studioReliefSweep(travelPerLoop: number, loop: number): number {
  if (!Number.isFinite(travelPerLoop) || travelPerLoop === 0) return 0;
  if (!Number.isFinite(loop)) return 0;

  return (
    STUDIO_RELIEF_SWEEP_DEGREES *
    Math.sin(2 * Math.PI * travelPerLoop * loop)
  );
}

/** The travel the relief reads, taken from the field it stands up. */
export function readStudioReliefTravel(
  layers: readonly {
    typeId: string;
    values: Readonly<Record<string, number | readonly [number, number, number]>>;
  }[],
): number {
  const field = layers.find(
    (layer) => layer.typeId === "stripes" && layer.values.visible !== 0,
  );
  const value = field?.values.driftPhase;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
