import * as React from "react";

/**
 * Whether the author is currently moving the viewport, and what to do about it.
 *
 * The renderer draws the composition, not the view of it: panning and zooming
 * are a CSS transform the runtime applies to a surface whose pixels have not
 * changed. So a gesture costs nothing on its own — and cost everything the
 * moment the composition started to animate, because a drifting stack rebuilds
 * its scene sixty times a second and redraws the whole program each time, while
 * the browser is also trying to composite a drag at the same rate.
 *
 * The fix is not to draw less carefully during a gesture but to draw the *same
 * frame*: the loop is held at the value the scene last used, so the parameters
 * are byte-identical, the memo holds, and the renderer sleeps until the gesture
 * ends. Nothing is skipped, dropped, or approximated — the picture is simply the
 * one that was already there, which is the picture the author is looking at
 * while they drag it.
 *
 * **Play state is never touched, and that is the requirement's real content.**
 * A pause dispatched on pointer-down and undone on pointer-up would look
 * identical for one gesture and be wrong in every way that matters: it would put
 * two entries in history, it would fight an author who paused deliberately, and
 * it would resume at the moment the gesture ended rather than at the moment the
 * clock reached. Freezing the value the *reader* passes leaves the timeline
 * running underneath, so the resumed frame is the one the clock says it is,
 * whatever the gesture cost.
 */

/**
 * How long after the last viewport write a gesture is still considered live.
 *
 * A pan arrives as a stream of pointer moves with no terminal event the product
 * can see -- the runtime owns the pointer handlers -- so the end of a gesture is
 * inferred from the writes stopping. Long enough to bridge the gap between two
 * frames of a slow drag at 60Hz (16ms) and the pause between a wheel's inertial
 * ticks; short enough that the composition is moving again before an author who
 * has stopped dragging notices it had stopped.
 */
export const STUDIO_GESTURE_IDLE_MS = 180;

/** The part of runtime state a viewport gesture shows up in. */
export type StudioViewportPose = Readonly<{
  offset?: Readonly<{ x?: number; y?: number }>;
  zoom?: number;
}>;

/**
 * A pose reduced to the one string that changes when the view moves.
 *
 * Compared as a value rather than by identity because the runtime rebuilds the
 * canvas slice on unrelated writes: an identity check would report a gesture on
 * every edit anywhere in the app, which would freeze the animation whenever an
 * author touched a slider.
 */
export function readStudioViewportPose(canvas: StudioViewportPose | undefined): string {
  if (!canvas) return "";

  const x = canvas.offset?.x ?? 0;
  const y = canvas.offset?.y ?? 0;

  return `${x}:${y}:${canvas.zoom ?? 1}`;
}

/**
 * True while the view is being moved, false once it has been still a moment.
 *
 * Returns a boolean rather than a ref, because the end of a gesture has to
 * re-render: that is the moment the composition starts moving again, and a ref
 * would leave it frozen until something else happened to redraw.
 */
export function useStudioViewportGesture(pose: string): boolean {
  const [moving, setMoving] = React.useState(false);
  const previous = React.useRef(pose);

  React.useEffect(() => {
    if (previous.current === pose) return;
    previous.current = pose;
    setMoving(true);

    const timer = window.setTimeout(
      () => setMoving(false),
      STUDIO_GESTURE_IDLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [pose]);

  return moving;
}
