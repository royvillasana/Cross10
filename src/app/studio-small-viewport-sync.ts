"use client";

import * as React from "react";

import { useToolcraftDispatch, useToolcraftSelector } from "@/toolcraft/runtime/react";

import { appSchema } from "./app-schema";
import {
  isStudioSmallViewport,
  planStudioSmallViewportArrangement,
  STUDIO_SMALL_VIEWPORT_TARGET,
  type StudioPanelBox,
} from "./studio-small-viewport";

/**
 * The two panels this arranges, named by the attribute the runtime itself uses
 * to find them (`timeline-panel-responsive-layout.ts:55`).
 *
 * Read, never rendered and never imported. A `getBoundingClientRect` is not a
 * runtime surface being recreated; it is the same read the region handles and
 * the reference overlay already take against the canvas element. The
 * alternative — re-deriving each panel's anchored position from the runtime's
 * shell width, panel width and margin — would be code that is correct today and
 * silently wrong the first time one of those changes, with no test able to say
 * so.
 */
const STUDIO_PANEL_IDS = ["controls", "layers"] as const;

function readPanelBox(panelId: string): StudioPanelBox | null {
  const node = document.querySelector(`[data-panel-type="${panelId}"]`);
  if (!node) return null;

  const rect = node.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}

/** Every product section the controls panel renders, in schema order. */
const STUDIO_SECTION_IDS = (appSchema.panels.controls?.sections ?? [])
  .map((section) => section.id)
  .filter((id): id is string => typeof id === "string" && id.length > 0);

/**
 * Brings the product back within reach on a screen narrower than its shell.
 *
 * Runs after layout rather than during it, because the whole input is where the
 * panels actually ended up — a measurement taken before the shell has laid out
 * is a measurement of nothing.
 *
 * Re-runs on resize, which is what makes rotating a phone work and what makes
 * the desktop case cost nothing: above the threshold the plan is empty and no
 * command is dispatched at all.
 *
 * The dispatch loop cannot run away. A rescue is only planned for a panel that
 * is unreachable, and carrying one out makes it reachable, so the next pass
 * plans nothing. The collapse half is guarded by a persisted marker and happens
 * once ever.
 */
export function useStudioSmallViewportArrangement(): void {
  const dispatch = useToolcraftDispatch();
  const panels = useToolcraftSelector((current) => current.panels);
  const alreadyArranged =
    useToolcraftSelector(
      (current) =>
        (current.values as Readonly<Record<string, unknown>>)[
          STUDIO_SMALL_VIEWPORT_TARGET
        ],
    ) === true;

  /**
   * The latest state, read at call time rather than closed over.
   *
   * This is the whole reason the arrangement does not run on every state change,
   * and it is worth stating because getting it wrong produced a panel that
   * oscillated across the screen. A rescue is a delta computed from *both* the
   * measured box and the current offset, and those two only agree once the DOM
   * has caught up with the last dispatch. Re-running on the state change meant
   * pairing a fresh offset with a stale box, doubling the delta, and throwing
   * the panel off the other edge — after which the next pass threw it back.
   *
   * So the arrangement runs when the *viewport* changes, which is the thing it
   * is actually a function of, and reads state through a ref.
   */
  const latest = React.useRef({ alreadyArranged, panels });
  latest.current = { alreadyArranged, panels };

  const arrange = React.useCallback((): void => {
    if (typeof window === "undefined") return;

    const viewport = { height: window.innerHeight, width: window.innerWidth };
    if (!isStudioSmallViewport(viewport)) return;

    const current = latest.current;
    const commands = planStudioSmallViewportArrangement({
      alreadyArranged: current.alreadyArranged,
      panels: STUDIO_PANEL_IDS.map((panelId) => ({
        box: readPanelBox(panelId),
        currentOffset:
          (current.panels as Record<string, { offset?: { x: number; y: number } }>)[
            panelId
          ]?.offset ?? { x: 0, y: 0 },
        panelId,
      })),
      sectionIds: STUDIO_SECTION_IDS,
      viewport,
    });

    for (const command of commands) {
      dispatch(command as Parameters<typeof dispatch>[0]);
    }
  }, [dispatch]);

  React.useEffect(() => {
    // Twice on arrival: once when the shell has first laid out, and again once
    // the panel's own snap animation has finished. The second pass is what
    // corrects a measurement taken while a panel was still moving, and it is
    // safe because by then the box and the offset describe the same moment.
    const frame = requestAnimationFrame(arrange);
    const settled = window.setTimeout(arrange, 500);
    window.addEventListener("resize", arrange);
    window.addEventListener("orientationchange", arrange);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settled);
      window.removeEventListener("resize", arrange);
      window.removeEventListener("orientationchange", arrange);
    };
  }, [arrange]);
}
