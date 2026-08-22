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
