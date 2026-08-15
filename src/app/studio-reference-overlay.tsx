"use client";

import * as React from "react";

import { useToolcraftSelector } from "@/toolcraft/runtime/react";

import styles from "./studio-reference-overlay.module.css";
import {
  readStudioReferenceView,
  STUDIO_REFERENCE_DIFFERENCE,
} from "./studio-reference";

/**
 * The reference, drawn beside the composition and never into it.
 *
 * A DOM element rather than a layer of the shader, and that is the load-bearing
 * decision rather than a convenience. The renderer draws from
 * `StudioStackSceneParameters`, which has no field for a reference — so the
 * export frame, which builds the same scene through the same function, cannot
 * receive one, and the source assembler, which reads the same scene, cannot
 * emit one. "The artifact never carries the reference" is therefore a property
 * of the types rather than a promise about a code path somebody has to keep.
 *
 * Positioned from the canvas's bounding rectangle, the same way the region
 * handles are: a wrapper would put an element between the runtime's scene
 * surface and the product's output canvas, and the box already carries whatever
 * pan and zoom the shell applied — which is what registers the two pictures
 * against each other.
 *
 * **And placed inside its own frame rather than at viewport coordinates**, for
 * the reason the handles already record. `position: fixed` resolves against the
 * viewport only while no ancestor is transformed, and one of the shell's
 * wrappers is: under it the container becomes the containing block, so the
 * canvas offset is applied twice, and a length written into a style is drawn at
 * length × zoom. Writing the measured rect straight in put the reference a few
 * hundred pixels from the picture it was supposed to sit on and a third of its
 * size — which is exactly what the region handles were once doing, and exactly
 * what the proof below now measures rather than assumes.
 *
 * Absent from the DOM entirely when there is nothing to show, rather than
 * rendered transparent. An element that is present but invisible is the shape a
 * leak takes: it survives a screenshot, a compositing change, and any future
 * path that walks the tree looking for what the product drew.
 */
export function StudioReferenceOverlay({
  canvasRef,
}: Readonly<{
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}>): React.JSX.Element | null {
  const values = useToolcraftSelector(
    (current) => current.values as Readonly<Record<string, unknown>>,
  );
  const view = readStudioReferenceView(values);

  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState<{
    height: number;
    left: number;
    top: number;
    width: number;
  } | null>(null);

  /**
   * The canvas's box on screen, kept current.
   *
   * A ResizeObserver alone is not enough, for the reason the handles already
   * record: it reports size, and this box moves without resizing whenever the
   * shell scrolls or a panel opens. Measuring after every render covers that,
   * and the equality check is what stops a layout effect that sets state from
   * looping on itself.
   */
  const measure = React.useCallback((): void => {
    const canvas = canvasRef.current;
    const frameElement = frameRef.current;
    if (!canvas || !frameElement) return;

    const canvasRect = canvas.getBoundingClientRect();
    const frameRect = frameElement.getBoundingClientRect();
    // What the frame measures on screen against what it measures in its own
    // layout. That ratio is the shell's zoom, derived rather than known, so
    // this does not depend on how the shell implements it.
    const scale =
      frameElement.offsetWidth > 0 ? frameRect.width / frameElement.offsetWidth : 1;
    const safeScale = scale > 0 ? scale : 1;

    const rect = {
      height: canvasRect.height / safeScale,
      left: (canvasRect.left - frameRect.left) / safeScale,
      top: (canvasRect.top - frameRect.top) / safeScale,
      width: canvasRect.width / safeScale,
    };

    setBox((previous) =>
      previous &&
      previous.height === rect.height &&
      previous.left === rect.left &&
      previous.top === rect.top &&
      previous.width === rect.width
        ? previous
        : {
            height: rect.height,
            left: rect.left,
            top: rect.top,
            width: rect.width,
          },
    );
  }, [canvasRef]);

  React.useLayoutEffect(measure);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [canvasRef, measure]);

  // The frame is always mounted, because it is what the measurement is taken
  // against: a frame that appeared only once there was something to show would
  // have nothing to measure on the render that decides where to show it.
  return (
    <div className={styles.frame} ref={frameRef}>
      {view.src === "" || box === null ? null : (
        <div
          className={styles.overlay}
          // Read by the browser proofs to tell "no reference" from "a reference
          // at zero", which are the two states the leak proofs distinguish.
          data-studio-reference={view.compare}
          style={{
            height: `${box.height}px`,
            left: `${box.left}px`,
            opacity: view.opacity,
            top: `${box.top}px`,
            width: `${box.width}px`,
          }}
        >
          <img
            alt=""
            className={`${styles.image}${
              view.compare === STUDIO_REFERENCE_DIFFERENCE ? ` ${styles.difference}` : ""
            }`}
            src={view.src}
          />
        </div>
      )}
    </div>
  );
}
