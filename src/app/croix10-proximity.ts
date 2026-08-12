"use client";

import * as React from "react";

import { useToolcraftDispatch } from "@/toolcraft/runtime/react";

/**
 * The committed cursor hotspot.
 *
 * The canvas is the only writer (R44). While the pointer is over the product
 * surface the preview follows it live, because a proximity effect that appeared
 * only on release would not read as proximity at all; on pointer-up or
 * pointer-leave the last position is written to state in one history group, so
 * undo takes the hotspot back in a single step and export renders the value the
 * user actually placed.
 *
 * Live positions are deliberately not dispatched. A write per pointer-move would
 * put sixty entries a second into history and make undo useless, and it is the
 * "live pointer position in state" shape that R44 rejected.
 */

export const CROIX10_PROXIMITY_CENTER_TARGET = "proximity.center";

/** Centred composition units, matching what the shader's uniform expects. */
function toCompositionPoint(
  event: React.PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(bounds.width, 1);
  return {
    x: (event.clientX - bounds.left - bounds.width / 2) / width,
    y: (event.clientY - bounds.top - bounds.height / 2) / width,
  };
}

export type Croix10ProximityHandlers = Readonly<{
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLCanvasElement>) => void;
}>;

export type Croix10ProximityTracking = Readonly<{
  /** The live hotspot to render, or null to use whatever state holds. */
  hover: readonly [number, number] | null;
  handlers: Croix10ProximityHandlers;
}>;

export function useCroix10ProximityTracking(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  enabled: boolean,
): Croix10ProximityTracking {
  const dispatch = useToolcraftDispatch();
  const [hover, setHover] = React.useState<readonly [number, number] | null>(null);
  const pending = React.useRef<{ x: number; y: number } | null>(null);

  const commit = React.useCallback(() => {
    const point = pending.current;
    pending.current = null;
    setHover(null);
    if (!point) return;
    dispatch({
      history: "merge",
      historyGroup: "croix10-proximity-center",
      label: "Move cursor field",
      target: CROIX10_PROXIMITY_CENTER_TARGET,
      type: "controls.setValue",
      value: point,
    });
  }, [dispatch]);

  const handlers = React.useMemo<Croix10ProximityHandlers>(
    () => ({
      onPointerCancel: () => {
        // A cancelled gesture is not a placement: drop it rather than committing
        // a position the user did not finish choosing.
        pending.current = null;
        setHover(null);
      },
      onPointerLeave: commit,
      onPointerMove: (event) => {
        const canvas = canvasRef.current;
        if (!enabled || !canvas) return;
        const point = toCompositionPoint(event, canvas);
        pending.current = point;
        setHover([point.x, point.y]);
      },
      onPointerUp: (event) => {
        const canvas = canvasRef.current;
        if (enabled && canvas) pending.current = toCompositionPoint(event, canvas);
        commit();
      },
    }),
    [canvasRef, commit, enabled],
  );

  return { handlers, hover: enabled ? hover : null };
}
