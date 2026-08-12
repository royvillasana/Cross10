"use client";

import * as React from "react";

import { useToolcraftDispatch, useToolcraftSelector } from "@/toolcraft/runtime/react";

import styles from "./studio-region-handles.module.css";
import {
  STUDIO_REGION_HANDLES,
  studioMoveRegion,
  studioPointerToRegionUnits,
  studioRegionDisplayValues,
  studioRegionHandleAnchor,
  studioRegionScreenRect,
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

  const [canvasRect, setCanvasRect] = React.useState<StudioCanvasRect | null>(null);
  const measureRef = React.useRef<(() => void) | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  // Only to toggle the overlay's pointer-events. The gesture itself lives in a
  // ref, because re-rendering on every pointer move would make the drag depend
  // on React having caught up with the pointer.
  const [dragging, setDragging] = React.useState(false);
  // One group per gesture, so a drag collapses into a single undo step instead
  // of one per pointer event.
  const gestureRef = React.useRef(0);

  // The canvas moves with the panel and the window, and the overlay has to
  // follow it. Observed rather than measured once, because a resize that left
  // the handles behind would put them over the wrong pixels while still
  // reporting the right values.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return undefined;

    const measure = (): void => {
      const rect = canvas.getBoundingClientRect();
      // Only when it actually moved. Setting state unconditionally from a
      // layout effect that runs after every render is a loop, not a
      // measurement.
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
    };

    measure();
    measureRef.current = measure;
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [canvasRef]);

  React.useLayoutEffect(() => {
    measureRef.current?.();
  });

  const current: StudioRegionValues = {
    aspect: readNumber(values, REGION_TARGETS.aspect),
    centerX: readNumber(values, REGION_TARGETS.centerX),
    centerY: readNumber(values, REGION_TARGETS.centerY),
    size: readNumber(values, REGION_TARGETS.size),
  };

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
    (drag: DragState, event: React.PointerEvent<HTMLDivElement>): void => {
      const pointer = { x: event.clientX, y: event.clientY };

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

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (drag) applyDrag(drag, event);
  };

  const onPointerUp = (): void => {
    dragRef.current = null;
    setDragging(false);
  };

  if (!selectedLayerId || !canvasRect || canvasRect.width === 0) return null;

  const shown = studioRegionDisplayValues(current, canvasRect);
  const rect = studioRegionScreenRect(shown, canvasRect);

  const beginResize =
    (handle: StudioRegionHandleId) =>
    (event: React.PointerEvent<HTMLButtonElement>): void => {
      event.preventDefault();
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
      className={dragging ? `${styles.overlay} ${styles.dragging}` : styles.overlay}
      data-studio-region-handles=""
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <button
        aria-label="Move region"
        className={styles.body}
        data-testid="studio-region-move"
        data-toolcraft-canvas-handle=""
        onPointerDown={beginMove}
        style={{
          height: `${rect.height}px`,
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
        }}
        type="button"
      />
      {STUDIO_REGION_HANDLES.map((handle) => {
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
              left: `${rect.left + ((anchor.x + 1) / 2) * rect.width}px`,
              top: `${rect.top + ((anchor.y + 1) / 2) * rect.height}px`,
            }}
            type="button"
          />
        );
      })}
    </div>
  );
}
