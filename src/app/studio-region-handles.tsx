"use client";

import * as React from "react";

import { useToolcraftDispatch, useToolcraftSelector } from "@/toolcraft/runtime/react";

import styles from "./studio-region-handles.module.css";
import {
  appendStudioVertex,
  readStudioVertexPath,
  readStudioVertexPaths,
  STUDIO_PEN_TARGET,
  STUDIO_VERTEX_PATH_TARGET,
} from "./studio-stack-state";
import {
  STUDIO_REGION_HANDLES,
  studioMoveRegion,
  studioPointerToRegionUnits,
  studioRegionDisplayValues,
  studioRegionHandleAnchor,
  studioRegionOutlinePoints,
  studioPointToShapeFrame,
  studioRegionScreenRect,
  studioShapeFrameToPoint,
  studioVertexToScreen,
  studioResizeRegion,
  type StudioCanvasRect,
  type StudioRegionHandleId,
  type StudioRegionValues,
} from "./studio-region-geometry";

/**
 * Direct manipulation of the selected layer's region: drag the body to move it,
 * drag a node to resize it.
 *
 * Every gesture ends in `controls.setValue` against the same targets the Layer
 * Region sliders write (R44). The handles are a second way to drive the region,
 * never a second copy of it — which is what keeps the sliders, the exported
 * script, and the canvas all describing one region.
 *
 * The overlay is DOM, positioned over the canvas rather than drawn into it, so
 * it cannot reach the exported artifact: export reads the canvas pixels and
 * these elements are not among them. That is asserted rather than assumed, by
 * the export-clean proof each handle's acceptance row points at.
 */

const REGION_TARGETS = {
  aspect: "selectedLayer.maskAspect",
  centerX: "selectedLayer.maskCenterX",
  centerY: "selectedLayer.maskCenterY",
  size: "selectedLayer.maskSize",
} as const;

/**
 * Read for the outline only, never written by a gesture.
 *
 * The nodes still drive the extent -- size, aspect and placement -- because
 * that is the geometry a drag has always written. What the form and the
 * rotation change is what is *drawn* over it, which until 14.3 was an
 * axis-aligned rectangle whatever the layer actually was.
 */
const OUTLINE_TARGETS = {
  rotation: "selectedLayer.maskRotation",
  shape: "selectedLayer.maskShape",
  sides: "selectedLayer.maskSides",
} as const;

/**
 * What a gesture knows when it starts.
 *
 * The region it was applied against is captured here rather than read fresh on
 * every pointer event. A resize is defined against the edge that stays put, and
 * re-deriving that edge from the values the drag itself is writing makes the
 * gesture chase its own output: the committed state lags a frame behind the
 * pointer, so each step measures from a slightly different origin and the
 * region falls short of where it was dragged.
 */
type DragState = {
  readonly canvas: StudioCanvasRect;
  readonly origin: StudioRegionValues;
} & (
  | {
      readonly grabOffset: { readonly x: number; readonly y: number };
      readonly kind: "move";
    }
  | { readonly handle: StudioRegionHandleId; readonly kind: "resize" }
);

function readNumber(values: Readonly<Record<string, unknown>>, target: string): number {
  const value = values[target];
  return typeof value === "number" ? value : 0;
}

export function StudioRegionHandles({
  canvasRef,
}: Readonly<{
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}>): React.JSX.Element | null {
  const dispatch = useToolcraftDispatch();
  const state = useToolcraftSelector((current) => current);
  const values = state.values as Readonly<Record<string, unknown>>;
  const selectedLayerId = state.selectedLayerId ?? null;

  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const [canvasRect, setCanvasRect] = React.useState<StudioCanvasRect | null>(null);
  /**
   * Where the overlay itself sits, so the handles can be placed inside it.
   *
   * `position: fixed` resolves against the viewport only while no ancestor is
   * transformed, and one of the shell's wrappers is. Under a transformed
   * ancestor the overlay becomes the containing block and the canvas offset is
   * applied twice, which put every handle three hundred pixels from the pixels
   * it claimed to control. Placing the handles relative to the overlay's own
   * box is correct either way, and does not depend on knowing what the shell
   * does above this component.
   */
  const [overlayFrame, setOverlayFrame] = React.useState({
    left: 0,
    scale: 1,
    top: 0,
  });
  const dragRef = React.useRef<DragState | null>(null);
  // Only to toggle the overlay's pointer-events. The gesture itself lives in a
  // ref, because re-rendering on every pointer move would make the drag depend
  // on React having caught up with the pointer.
  const [dragging, setDragging] = React.useState(false);
  // One group per gesture, so a drag collapses into a single undo step instead
  // of one per pointer event.
  const gestureRef = React.useRef(0);

  /**
   * The canvas's box on screen, kept current.
   *
   * One measurement, used by both the drawing and the dragging. They were
   * briefly allowed to differ -- the gesture measured fresh at pointer-down
   * while the handles were drawn from an older rect -- and the result was a
   * drag whose arithmetic was right and whose starting point was three hundred
   * pixels from where the user had grabbed. The canvas is laid out larger than
   * the viewport and offset into it, so an early measurement is not merely
   * imprecise, it is somewhere else entirely.
   *
   * A ResizeObserver alone is not enough: it reports size, and this box moves
   * without resizing whenever the shell scrolls or a panel opens. Measuring
   * after every render covers that, and the equality check is what stops a
   * layout effect that sets state from looping on itself.
   */
  const measure = React.useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const overlayElement = overlayRef.current;
    const overlay = overlayElement?.getBoundingClientRect();
    if (overlayElement && overlay) {
      // The app zooms the canvas with a transform on an ancestor, so a length
      // written into a style here is drawn at length x zoom. Reading the
      // overlay's own scale -- what it measures on screen against what it
      // measures in its own layout -- is what lets the two be told apart
      // without knowing how the shell implements its zoom.
      const scale =
        overlayElement.offsetWidth > 0 ? overlay.width / overlayElement.offsetWidth : 1;
      setOverlayFrame((previous) =>
        previous.left === overlay.left &&
        previous.top === overlay.top &&
        previous.scale === scale
          ? previous
          : { left: overlay.left, scale, top: overlay.top },
      );
    }
    setCanvasRect((previous) =>
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


  const current: StudioRegionValues = {
    aspect: readNumber(values, REGION_TARGETS.aspect),
    centerX: readNumber(values, REGION_TARGETS.centerX),
    centerY: readNumber(values, REGION_TARGETS.centerY),
    rotation: readNumber(values, OUTLINE_TARGETS.rotation),
    shape:
      typeof values[OUTLINE_TARGETS.shape] === "string"
        ? (values[OUTLINE_TARGETS.shape] as string)
        : undefined,
    sides: readNumber(values, OUTLINE_TARGETS.sides),
    size: readNumber(values, REGION_TARGETS.size),
  };

  const penLayerId =
    typeof values[STUDIO_PEN_TARGET] === "string"
      ? (values[STUDIO_PEN_TARGET] as string)
      : "";
  const drawing = penLayerId !== "" && penLayerId === selectedLayerId;
  const vertexPath = readStudioVertexPath(
    readStudioVertexPaths(values[STUDIO_VERTEX_PATH_TARGET]),
    selectedLayerId ?? "",
  );

  /**
   * A click while the pen is drawing: place a vertex, or close the path.
   *
   * Closing is clicking the first vertex again rather than a separate control,
   * which is how every pen behaves and which keeps the whole operation on the
   * canvas -- the point of making it a mode rather than a sidebar field.
   *
   * The closing test is in screen pixels, not field units: what the author is
   * aiming at is a dot of a fixed size on screen, and at a zoomed-out canvas a
   * field-unit radius would be an unhittable fraction of it.
   */
  const placeVertex = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (!canvasRect) return;
      event.preventDefault();
      event.stopPropagation();

      const point = studioPointerToRegionUnits(
        { x: event.clientX, y: event.clientY },
        canvasRect,
      );
      const paths = readStudioVertexPaths(values[STUDIO_VERTEX_PATH_TARGET]);
      const existing = readStudioVertexPath(paths, penLayerId);
      const first = existing[0];

      if (first && existing.length >= 3) {
        const screen = studioVertexToScreen(
          studioShapeFrameToPoint(first, current),
          canvasRect,
        );
        const near =
          Math.hypot(screen.x - event.clientX, screen.y - event.clientY) <= 12;
        if (near) {
          // Closing commits the drawing: the layer becomes the free form, which
          // is the only way the shape it just drew can be the shape it renders.
          dispatch({
            target: "selectedLayer.maskShape",
            type: "controls.setValue",
            value: "free",
          });
          dispatch({
            target: STUDIO_PEN_TARGET,
            type: "controls.setValue",
            value: "",
          });
          return;
        }
      }

      dispatch({
        target: STUDIO_VERTEX_PATH_TARGET,
        type: "controls.setValue",
        // Stored in the shape's own frame, which is the frame the mask tests
        // against. Absolute units would put the path wherever the centre is.
        value: appendStudioVertex(
          paths,
          penLayerId,
          studioPointToShapeFrame(point, current),
        ),
      });
    },
    [canvasRect, current, dispatch, penLayerId, values],
  );

  const commit = React.useCallback(
    (next: StudioRegionValues, label: string): void => {
      const group = `studio-region-${gestureRef.current}`;
      const write = (target: string, value: number): void => {
        dispatch({
          history: "merge",
          historyGroup: group,
          label,
          target,
          type: "controls.setValue",
          value,
        });
      };

      write(REGION_TARGETS.size, next.size);
      write(REGION_TARGETS.aspect, next.aspect);
      write(REGION_TARGETS.centerX, next.centerX);
      write(REGION_TARGETS.centerY, next.centerY);
    },
    [dispatch],
  );

  /**
   * The gesture runs on the handle itself, held by pointer capture, rather than
   * on window listeners.
   *
   * Capture is what guarantees the element keeps receiving moves once the
   * pointer leaves its twelve pixels — which it does immediately, since the
   * whole point of the drag is to go somewhere else. Window listeners looked
   * equivalent and were not: they are re-registered whenever the handler
   * identity changes, and a drag commits state on every move, so the listener
   * that should have caught the second move was being swapped out as the first
   * one was still settling.
   */
  const applyDrag = React.useCallback(
    (drag: DragState, pointer: { readonly x: number; readonly y: number }): void => {
      if (drag.kind === "move") {
        commit(
          studioMoveRegion({
            canvas: drag.canvas,
            grabOffset: drag.grabOffset,
            pointer,
            values: drag.origin,
          }),
          "Move region",
        );
        return;
      }

      commit(
        studioResizeRegion({
          canvas: drag.canvas,
          handle: drag.handle,
          pointer,
          values: drag.origin,
        }),
        "Resize region",
      );
    },
    [commit],
  );

  const applyDragRef = React.useRef(applyDrag);
  applyDragRef.current = applyDrag;

  React.useEffect(() => {
    const onMove = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (!drag) return;
      // The gesture is driven by where the pointer is, so a move outside the
      // canvas is still a move: clamping happens against the control's domain,
      // not against the window.
      event.preventDefault();
      applyDragRef.current(drag, { x: event.clientX, y: event.clientY });
    };

    const onUp = (): void => {
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  if (!selectedLayerId || !canvasRect || canvasRect.width === 0) return null;

  const shown = studioRegionDisplayValues(current, canvasRect);
  const rect = studioRegionScreenRect(shown, canvasRect);

  const scale = overlayFrame.scale === 0 ? 1 : overlayFrame.scale;
  // The outline the layer actually has, as a point list (14.3). Drawn as one
  // path rather than as a border on the body button, because a border can only
  // ever be a rectangle and most of these forms are not.
  const toLocal = (point: { x: number; y: number }) => ({
    x: (point.x - overlayFrame.left) / scale,
    y: (point.y - overlayFrame.top) / scale,
  });
  const penPoints = vertexPath.map((point) =>
    toLocal(studioVertexToScreen(studioShapeFrameToPoint(point, shown), canvasRect)),
  );
  const outline = studioRegionOutlinePoints(shown, canvasRect)
    .map(
      (point) =>
        `${(point.x - overlayFrame.left) / scale},${(point.y - overlayFrame.top) / scale}`,
    )
    .join(" ");
  const local = {
    height: rect.height / scale,
    left: (rect.left - overlayFrame.left) / scale,
    top: (rect.top - overlayFrame.top) / scale,
    width: rect.width / scale,
  };

  const beginResize =
    (handle: StudioRegionHandleId) =>
    (event: React.PointerEvent<HTMLButtonElement>): void => {
      event.preventDefault();
      // The canvas world pans on a drag of its own. Without this the shell sees
      // the same pointerdown the handle did and moves the whole view, so
      // grabbing a layer scrolled the picture instead of shaping the region --
      // which is the one thing a handle must never do.
      event.stopPropagation();
      const canvas = canvasRef.current;
      const live = canvas?.getBoundingClientRect();
      const rectNow = live
        ? { height: live.height, left: live.left, top: live.top, width: live.width }
        : canvasRect;
      if (!rectNow) return;
      gestureRef.current += 1;
      dragRef.current = {
        canvas: rectNow,
        handle,
        kind: "resize",
        origin: studioRegionDisplayValues(current, rectNow),
      };
      setDragging(true);
    };

  const beginMove = (event: React.PointerEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    // As above: the gesture belongs to the layer, not to the view behind it.
    event.stopPropagation();
    const canvas = canvasRef.current;
    const live = canvas?.getBoundingClientRect();
    const rectNow = live
      ? { height: live.height, left: live.left, top: live.top, width: live.width }
      : canvasRect;
    if (!rectNow) return;
    gestureRef.current += 1;
    const origin = studioRegionDisplayValues(current, rectNow);
    const here = studioPointerToRegionUnits(
      { x: event.clientX, y: event.clientY },
      rectNow,
    );
    dragRef.current = {
      canvas: rectNow,
      grabOffset: { x: origin.centerX - here.x, y: origin.centerY - here.y },
      kind: "move",
      origin,
    };
    setDragging(true);
  };

  return (
    <div
      className={
        dragging || drawing ? `${styles.overlay} ${styles.dragging}` : styles.overlay
      }
      data-studio-pen={drawing ? "" : undefined}
      data-studio-region-handles=""
      onPointerDown={drawing ? placeVertex : undefined}
      ref={overlayRef}
    >
      {/*
       * Sized by CSS to the overlay rather than to the shape: with no viewBox
       * the SVG's user units are its own CSS pixels, which is the same space
       * the nodes are placed in, and a rotated form whose points sit outside
       * the extent's box is not clipped by a box cropped to it.
       */}
      <svg
        aria-hidden="true"
        className={styles.outline}
      >
        <polygon className={styles.outlineShape} points={outline} />
        {penPoints.length > 1 ? (
          <polyline
            className={styles.penPath}
            points={penPoints.map((point) => `${point.x},${point.y}`).join(" ")}
          />
        ) : null}
      </svg>
      {penPoints.map((point, index) => (
        <span
          aria-hidden="true"
          // The first vertex is the one that closes the path, so it is the one
          // marked differently -- the affordance has to say where to click.
          className={index === 0 ? `${styles.vertex} ${styles.vertexFirst}` : styles.vertex}
          data-testid={`studio-pen-vertex-${index}`}
          key={`${point.x},${point.y},${index}`}
          style={{ left: `${point.x}px`, top: `${point.y}px` }}
        />
      ))}
      {drawing ? null : (
      <button
        aria-label="Move region"
        className={styles.body}
        data-testid="studio-region-move"
        data-toolcraft-canvas-handle=""
        onPointerDown={beginMove}
        style={{
          height: `${local.height}px`,
          left: `${local.left}px`,
          top: `${local.top}px`,
          width: `${local.width}px`,
        }}
        type="button"
      />
      )}
      {(drawing ? [] : STUDIO_REGION_HANDLES).map((handle) => {
        const anchor = studioRegionHandleAnchor(handle);
        return (
          <button
            aria-label={`Resize region ${handle}`}
            className={styles.node}
            data-testid={`studio-region-node-${handle}`}
            data-toolcraft-canvas-handle=""
            key={handle}
            onPointerDown={beginResize(handle)}
            style={{
              left: `${local.left + ((anchor.x + 1) / 2) * local.width}px`,
              top: `${local.top + ((anchor.y + 1) / 2) * local.height}px`,
            }}
            type="button"
          />
        );
      })}
    </div>
  );
}
