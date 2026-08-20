"use client";

import * as React from "react";

import { useToolcraftDispatch, useToolcraftSelector } from "@/toolcraft/runtime/react";

import styles from "./studio-region-handles.module.css";
import {
  appendStudioVertex,
  studioNodeIncoming,
  studioNodeOutgoing,
  studioNodePosition,
  withStudioNodeHandle,
  type StudioVertexPoint,
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
  studioRegionHandlePoint,
  studioRegionOutlinePoints,
  studioPointerRotation,
  studioPointToShapeFrame,
  studioRegionScreenRect,
  studioRotateRegion,
  studioRotationHandlePoint,
  studioShapeFrameToPoint,
  studioVertexToScreen,
  studioNearestPathNode,
  STUDIO_PATH_NODES_SHOWN,
  STUDIO_STROKE_SPACING,
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
 * The nodes drive the extent -- size, aspect and placement -- and the grip
 * drives the turn. What the form does not have is a gesture: which named form
 * a layer takes is a choice among a vocabulary, not a spatial judgement, so it
 * stays a control and is read here only to draw the right outline over it.
 */
const OUTLINE_TARGETS = {
  shape: "selectedLayer.maskShape",
  sides: "selectedLayer.maskSides",
} as const;

/**
 * The turn, written by the rotation grip (15.2).
 *
 * Its own constant rather than a fifth entry in `REGION_TARGETS` because the
 * extent four are written together on every drag -- a resize moves the centre
 * as well as the size -- and the turn is written on its own. Folding it in
 * would make every move drag rewrite a rotation it did not change.
 */
const ROTATION_TARGET = "selectedLayer.maskRotation";

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
  | { readonly grabRotation: number; readonly kind: "rotate" }
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
    rotation: readNumber(values, ROTATION_TARGET),
    shape:
      typeof values[OUTLINE_TARGETS.shape] === "string"
        ? (values[OUTLINE_TARGETS.shape] as string)
        : undefined,
    sides: readNumber(values, OUTLINE_TARGETS.sides),
    size: readNumber(values, REGION_TARGETS.size),
  };

  /**
   * The stroke in progress, held in a ref rather than in state.
   *
   * Re-rendering on every pointer move would make the drawing depend on React
   * catching up with the hand, and at a few thousand points a drawing that
   * waits for a render is a drawing that drops points.
   */
  const strokeRef = React.useRef<{
    last: { x: number; y: number };
    pointerId: number;
    stroke: number;
  } | null>(null);
  /**
   * Which stroke this is, so each press gets its own history entry.
   *
   * One group for the whole drawing would merge every press *and* every stroke
   * into a single entry, so one Undo would erase the drawing rather than the
   * last thing done to it -- three clicks and a stroke would be four decisions
   * with one way back. Per press: a click is one entry, and a stroke is one
   * entry however many nodes it laid down.
   */
  const strokeCountRef = React.useRef(0);

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
          studioShapeFrameToPoint(studioNodePosition(first), current),
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

      /**
       * A press begins a stroke *and* places a point, which is what lets one
       * gesture serve both ways of drawing.
       *
       * Press and release without moving and exactly one node is placed, which
       * is the click-per-node pen this always had. Press and drag and the moves
       * below keep appending, which is the only realistic way to lay down a
       * path of any length -- a few thousand nodes is a few seconds of drawing
       * and would be a few thousand clicks.
       */
      strokeCountRef.current += 1;
      strokeRef.current = {
        last: { x: event.clientX, y: event.clientY },
        pointerId: event.pointerId,
        stroke: strokeCountRef.current,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);

      dispatch({
        // One stroke is one undo. Without the group every point of a drag is
        // its own history entry, so taking back a line drawn in a second would
        // be a few thousand presses of Undo.
        history: "merge",
        historyGroup: `studio-pen-${penLayerId}-${strokeCountRef.current}`,
        label: "Draw",
        target: STUDIO_VERTEX_PATH_TARGET,
        type: "controls.setValue",
        // Stored in the shape's own frame, which is the frame the mask tests
        // against. Absolute units would put the path wherever the centre is.
        value: appendStudioVertex(
          paths,
          penLayerId,
          studioPointToShapeFrame(point, current),
        ),
      } as Parameters<typeof dispatch>[0]);
    },
    [canvasRect, current, dispatch, penLayerId, values],
  );

  /**
   * Points laid down while the pointer is held, spaced rather than sampled.
   *
   * A pointer reports moves as fast as the display refreshes and faster on a
   * trackpad, so appending one node per event gives a path whose density
   * depends on how quickly someone moved their hand -- hundreds of nodes in a
   * slow curve and a dozen in a fast one. A minimum spacing makes the path a
   * description of the line instead of a recording of the gesture, and bounds
   * what a long drawing can cost.
   *
   * Measured in screen pixels rather than field units on purpose: what an
   * author is drawing is a line they can see, and at a zoomed-out canvas a
   * field-unit spacing would put nodes closer together than the pixels that
   * could show them.
   */
  const extendStroke = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      const stroke = strokeRef.current;
      if (!stroke || !canvasRect || stroke.pointerId !== event.pointerId) return;

      const travelled = Math.hypot(
        event.clientX - stroke.last.x,
        event.clientY - stroke.last.y,
      );
      if (travelled < STUDIO_STROKE_SPACING) return;

      event.preventDefault();
      stroke.last = { x: event.clientX, y: event.clientY };

      const paths = readStudioVertexPaths(values[STUDIO_VERTEX_PATH_TARGET]);
      const point = studioPointerToRegionUnits(
        { x: event.clientX, y: event.clientY },
        canvasRect,
      );

      dispatch({
        history: "merge",
        historyGroup: `studio-pen-${penLayerId}-${stroke.stroke}`,
        label: "Draw",
        target: STUDIO_VERTEX_PATH_TARGET,
        type: "controls.setValue",
        value: appendStudioVertex(
          paths,
          penLayerId,
          studioPointToShapeFrame(point, current),
        ),
      } as Parameters<typeof dispatch>[0]);
    },
    [canvasRect, current, dispatch, penLayerId, values],
  );

  const endStroke = React.useCallback((): void => {
    strokeRef.current = null;
  }, []);

  /**
   * Which node is being edited, and what is being dragged on it.
   *
   * A selection rather than everything at once, which is how every pen tool
   * behaves and here is also what makes a long path editable at all: a path may
   * hold thousands of nodes, and thousands of pairs of tangent knobs on screen
   * would be unreadable before it was slow.
   */
  const [selectedNode, setSelectedNode] = React.useState<number | null>(null);
  const nodeDragRef = React.useRef<
    | {
        index: number;
        kind: "node" | "incoming" | "outgoing";
        pointerId: number;
      }
    | null
  >(null);

  const writeNode = React.useCallback(
    (index: number, node: StudioVertexPoint): void => {
      const paths = readStudioVertexPaths(values[STUDIO_VERTEX_PATH_TARGET]);
      const path = readStudioVertexPath(paths, selectedLayerId ?? "");
      if (index < 0 || index >= path.length) return;

      const next = [...path];
      next[index] = node;
      dispatch({
        // One drag is one undo, the same rule a stroke follows: a bend arrived
        // at over fifty pointer moves is one decision.
        history: "merge",
        historyGroup: `studio-node-${selectedLayerId}-${index}`,
        label: "Shape the path",
        target: STUDIO_VERTEX_PATH_TARGET,
        type: "controls.setValue",
        value: { ...paths, [selectedLayerId ?? ""]: next },
      } as Parameters<typeof dispatch>[0]);
    },
    [dispatch, selectedLayerId, values],
  );

  const beginNodeDrag = React.useCallback(
    (index: number, kind: "node" | "incoming" | "outgoing") =>
      (event: React.PointerEvent<HTMLElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedNode(index);
        nodeDragRef.current = { index, kind, pointerId: event.pointerId };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
    [],
  );

  const moveNodeDrag = React.useCallback(
    (event: React.PointerEvent<HTMLElement>): void => {
      const drag = nodeDragRef.current;
      if (!drag || !canvasRect || drag.pointerId !== event.pointerId) return;
      event.preventDefault();

      const paths = readStudioVertexPaths(values[STUDIO_VERTEX_PATH_TARGET]);
      const path = readStudioVertexPath(paths, selectedLayerId ?? "");
      const node = path[drag.index];
      if (!node) return;

      const pointer = studioPointToShapeFrame(
        studioPointerToRegionUnits(
          { x: event.clientX, y: event.clientY },
          canvasRect,
        ),
        current,
      );

      if (drag.kind === "node") {
        // The handles are stored relative to the node, so moving it carries its
        // curvature along -- which is what makes this feel like moving a piece
        // of the curve rather than re-aiming two unrelated points.
        const incoming = studioNodeIncoming(node);
        const outgoing = studioNodeOutgoing(node);
        writeNode(
          drag.index,
          incoming[0] === 0 && incoming[1] === 0 && outgoing[0] === 0 && outgoing[1] === 0
            ? [pointer[0], pointer[1]]
            : [
                pointer[0],
                pointer[1],
                incoming[0],
                incoming[1],
                outgoing[0],
                outgoing[1],
              ],
        );
        return;
      }

      const position = studioNodePosition(node);
      writeNode(
        drag.index,
        withStudioNodeHandle(node, drag.kind, [
          pointer[0] - position[0],
          pointer[1] - position[1],
        ]),
      );
    },
    [canvasRect, current, selectedLayerId, values, writeNode],
  );

  const endNodeDrag = React.useCallback((): void => {
    nodeDragRef.current = null;
  }, []);

  const write = React.useCallback(
    (target: string, value: number, label: string): void => {
      dispatch({
        history: "merge",
        historyGroup: `studio-region-${gestureRef.current}`,
        label,
        target,
        type: "controls.setValue",
        value,
      });
    },
    [dispatch],
  );

  const commit = React.useCallback(
    (next: StudioRegionValues, label: string): void => {
      write(REGION_TARGETS.size, next.size, label);
      write(REGION_TARGETS.aspect, next.aspect, label);
      write(REGION_TARGETS.centerX, next.centerX, label);
      write(REGION_TARGETS.centerY, next.centerY, label);
    },
    [write],
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
      if (drag.kind === "rotate") {
        write(
          ROTATION_TARGET,
          studioRotateRegion({
            canvas: drag.canvas,
            grabRotation: drag.grabRotation,
            pointer,
            values: drag.origin,
          }).rotation ?? 0,
          "Turn shape",
        );
        return;
      }

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
    [commit, write],
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
  /**
   * Whether the finished path is editable on canvas, and how much of it shows.
   *
   * Every node is a target once the drawing is closed, but a path may hold
   * thousands of them and thousands of DOM nodes is unusable before it is slow.
   * Past the limit only the selected node and its neighbours are drawn, and a
   * click anywhere near the path selects the nearest node instead -- so a long
   * path stays fully editable while only the part being worked on is on screen.
   */
  const editingPath =
    !drawing && current.shape === "free" && vertexPath.length >= 2;
  // A plain function rather than a memo: it is defined after the early return
  // above, and a hook after a conditional return is a hook that sometimes does
  // not run.
  const nodeScreen = (point: readonly [number, number]): { x: number; y: number } =>
    toLocal(studioVertexToScreen(studioShapeFrameToPoint(point, shown), canvasRect));
  const visibleNodes = editingPath
    ? vertexPath.length <= STUDIO_PATH_NODES_SHOWN
      ? vertexPath.map((_node, index) => index)
      : [selectedNode ?? 0, (selectedNode ?? 0) - 1, (selectedNode ?? 0) + 1]
          .filter((index) => index >= 0 && index < vertexPath.length)
    : [];

  const penPoints = vertexPath.map((point) =>
    toLocal(
      studioVertexToScreen(
        studioShapeFrameToPoint(studioNodePosition(point), shown),
        canvasRect,
      ),
    ),
  );
  const outline = studioRegionOutlinePoints(shown, canvasRect)
    .map(
      (point) =>
        `${(point.x - overlayFrame.left) / scale},${(point.y - overlayFrame.top) / scale}`,
    )
    .join(" ");
  const grip = toLocal(studioRotationHandlePoint(shown, canvasRect));
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

  const beginRotate = (event: React.PointerEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    // As with the other two: the gesture belongs to the layer, not to the view
    // the shell pans behind it.
    event.stopPropagation();
    const canvas = canvasRef.current;
    const live = canvas?.getBoundingClientRect();
    const rectNow = live
      ? { height: live.height, left: live.left, top: live.top, width: live.width }
      : canvasRect;
    if (!rectNow) return;

    gestureRef.current += 1;
    const origin = studioRegionDisplayValues(current, rectNow);
    dragRef.current = {
      canvas: rectNow,
      // What the shape's angle is over the pointer's, held for the drag. The
      // grip sits off the edge rather than under the cursor, so without this
      // the shape would snap its north edge to the pointer on grab.
      grabRotation:
        (origin.rotation ?? 0) -
        studioPointerRotation({
          canvas: rectNow,
          pointer: { x: event.clientX, y: event.clientY },
          values: origin,
        }),
      kind: "rotate",
      origin,
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

    /**
     * A press inside a drawn region also picks the node nearest to it.
     *
     * This is what keeps a long path editable. Past the display limit only the
     * node being worked on and its neighbours are drawn, so without a way to
     * reach the others the rest of a thousand-node path would be visible and
     * untouchable. Pressing near the part you want selects it, and the handles
     * appear there.
     *
     * A linear scan, which is the right algorithm: it runs once per press, and
     * an index that made it faster would have to be kept in step with an array
     * that changes on every point of a stroke.
     */
    if (editingPath) {
      const nearest = studioNearestPathNode(
        vertexPath,
        studioPointToShapeFrame(
          studioPointerToRegionUnits(
            { x: event.clientX, y: event.clientY },
            rectNow,
          ),
          current,
        ),
      );
      if (nearest !== null) setSelectedNode(nearest);
    }
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
      onPointerMove={drawing ? extendStroke : undefined}
      onPointerUp={drawing ? endStroke : undefined}
      onPointerCancel={drawing ? endStroke : undefined}
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
      {/*
       * The trail of what has been placed so far, as dots -- but only while a
       * path is short enough for dots to mean anything.
       *
       * One absolutely positioned element per node is fine at a dozen and is
       * the single most expensive thing in this component at a few thousand: it
       * was costing about a third of a millisecond per node on *every* render,
       * so a long path made every unrelated control edit slow. The line between
       * the nodes is drawn by the polyline above and does not depend on this,
       * and the first node keeps its dot at any length because it is the target
       * that closes the path -- an affordance, not a mark.
       */}
      {(penPoints.length <= STUDIO_PATH_NODES_SHOWN
        ? penPoints
        : penPoints.slice(0, 1)
      ).map((point, index) => (
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
      {visibleNodes.map((index) => {
        const node = vertexPath[index];
        if (!node) return null;
        const position = studioNodePosition(node);
        const at = nodeScreen(position);
        const selected = index === selectedNode;

        /**
         * A tangent knob for a node that has no curvature yet.
         *
         * Offered rather than hidden, because a handle that only exists once
         * the curve exists is a handle nobody finds -- there is no gesture that
         * would create it. Placed a fixed distance along the line to the
         * neighbour it belongs to, and drawn hollow, so it reads as "grab me to
         * bend this" rather than as a curvature the path does not have.
         */
        const fallback = (towards: readonly [number, number]): readonly [number, number] => {
          const dx = towards[0] - position[0];
          const dy = towards[1] - position[1];
          const length = Math.hypot(dx, dy) || 1;
          const reach = Math.min(length * 0.3, 0.18);
          return [(dx / length) * reach, (dy / length) * reach];
        };

        const previous = vertexPath[(index - 1 + vertexPath.length) % vertexPath.length];
        const next = vertexPath[(index + 1) % vertexPath.length];
        const incoming = studioNodeIncoming(node);
        const outgoing = studioNodeOutgoing(node);
        const incomingSet = incoming[0] !== 0 || incoming[1] !== 0;
        const outgoingSet = outgoing[0] !== 0 || outgoing[1] !== 0;
        const incomingOffset = incomingSet
          ? incoming
          : fallback(studioNodePosition(previous ?? node));
        const outgoingOffset = outgoingSet
          ? outgoing
          : fallback(studioNodePosition(next ?? node));

        return (
          <React.Fragment key={`node-${index}`}>
            <button
              aria-label={`Path node ${index + 1}`}
              className={
                selected
                  ? `${styles.pathNode} ${styles.pathNodeSelected}`
                  : styles.pathNode
              }
              data-testid={`studio-path-node-${index}`}
              data-toolcraft-canvas-handle=""
              onPointerDown={beginNodeDrag(index, "node")}
              onPointerMove={moveNodeDrag}
              onPointerUp={endNodeDrag}
              onPointerCancel={endNodeDrag}
              style={{ left: `${at.x}px`, top: `${at.y}px` }}
              type="button"
            />
            {selected
              ? (
                  [
                    { kind: "incoming" as const, offset: incomingOffset, set: incomingSet },
                    { kind: "outgoing" as const, offset: outgoingOffset, set: outgoingSet },
                  ]
                ).map((handle) => {
                  const knob = nodeScreen([
                    position[0] + handle.offset[0],
                    position[1] + handle.offset[1],
                  ]);
                  return (
                    <button
                      aria-label={`Path node ${index + 1} ${handle.kind} handle`}
                      className={
                        handle.set
                          ? styles.pathHandle
                          : `${styles.pathHandle} ${styles.pathHandleUnset}`
                      }
                      data-testid={`studio-path-handle-${index}-${handle.kind}`}
                      data-toolcraft-canvas-handle=""
                      key={handle.kind}
                      onPointerDown={beginNodeDrag(index, handle.kind)}
                      onPointerMove={moveNodeDrag}
                      onPointerUp={endNodeDrag}
                      onPointerCancel={endNodeDrag}
                      style={{ left: `${knob.x}px`, top: `${knob.y}px` }}
                      type="button"
                    />
                  );
                })
              : null}
          </React.Fragment>
        );
      })}
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
          // The hit area turns with the shape it grabs. CSS turns clockwise and
          // the shader's rotation counts the other way, so the sign is flipped
          // here exactly as the outline flips its y.
          transform: `rotate(${-(shown.rotation ?? 0)}deg)`,
          width: `${local.width}px`,
        }}
        type="button"
      />
      )}
      {(drawing ? [] : STUDIO_REGION_HANDLES).map((handle) => {
        // Placed on the shape rather than on a box around it, so a node on a
        // turned shape sits where that node actually is.
        const point = toLocal(studioRegionHandlePoint(handle, shown, canvasRect));
        return (
          <button
            aria-label={`Resize region ${handle}`}
            className={styles.node}
            data-testid={`studio-region-node-${handle}`}
            data-toolcraft-canvas-handle=""
            key={handle}
            onPointerDown={beginResize(handle)}
            style={{
              left: `${point.x}px`,
              top: `${point.y}px`,
            }}
            type="button"
          />
        );
      })}
      {drawing ? null : (
        <button
          aria-label="Turn shape"
          className={styles.grip}
          data-testid="studio-region-rotate"
          data-toolcraft-canvas-handle=""
          onPointerDown={beginRotate}
          style={{ left: `${grip.x}px`, top: `${grip.y}px` }}
          type="button"
        />
      )}
    </div>
  );
}
