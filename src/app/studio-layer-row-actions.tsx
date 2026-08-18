import * as React from "react";

import { useToolcraftDispatch, useToolcraftSelector } from "@/toolcraft/runtime/react";

import { STUDIO_ONBOARDING_APPLY } from "./studio-onboarding";
import {
  planStudioLayerDuplication,
  readStudioLayerEntry,
  readStudioLayerRecord,
  writeStudioLayerEntry,
  STUDIO_LAYER_RECORD_TARGET,
} from "./studio-stack-state";

/**
 * Duplicate and apply, on the layer row itself.
 *
 * **Why this is added to the DOM rather than declared.** `layers-panel-row.tsx`
 * renders exactly two actions — visibility and delete — hardcoded, with no
 * product hook, and it is signed runtime source (upstream issue 16). The
 * commands behind these two icons already existed and already worked; what they
 * lacked was the only place they mean anything. "Duplicate *this*" and "apply a
 * composition to *this*" are questions about a specific row, and a control that
 * lives elsewhere has to be told which row first — which is the problem it was
 * supposed to solve.
 *
 * Same technique as the Media item in the add menu, and the same honesty about
 * it: nothing signed is edited, the buttons are cloned from the row's own so
 * they inherit its styling and hover behaviour, and if the runtime renames its
 * action cluster these stop appearing rather than appearing broken.
 *
 * The panel's own `Duplicate` press stays where it is. It is the same command
 * through a different door, and removing it would take the operation away from
 * anyone whose runtime version drops the cluster this attaches to.
 */

/** The runtime's per-row action cluster. */
const ROW_ACTIONS = "[data-layer-actions]";

/** Marks a button as ours, so each row is fitted once rather than per mutation. */
const ADDED = "data-studio-row-action";

const DUPLICATE_ICON =
  '<rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
  '<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';

const APPLY_ICON =
  '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
  '<path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';

export function StudioLayerRowActions(): null {
  const dispatch = useToolcraftDispatch();
  const state = useToolcraftSelector((current) => current);

  // Held in a ref so the observer callback always reads current state without
  // being torn down and rebuilt on every edit the author makes.
  const latest = React.useRef(state);
  latest.current = state;

  React.useEffect(() => {
    const duplicate = (layerId: string): void => {
      const current = latest.current;
      const steps = planStudioLayerDuplication(current.layers ?? [], layerId);
      if (steps.length === 0) return;

      let record = readStudioLayerRecord(
        (current.values as Record<string, unknown>)[STUDIO_LAYER_RECORD_TARGET],
      );

      for (const step of steps) {
        dispatch({
          insertIndex: step.insertIndex,
          layer: {
            id: step.copyId,
            ...(step.isGroup ? { kind: "group" as const } : {}),
            name: step.name,
            ...(step.parentGroupId ? { parentGroupId: step.parentGroupId } : {}),
            visible: step.visible,
          },
          type: "layers.add",
        } as Parameters<typeof dispatch>[0]);

        if (!step.isGroup) {
          record = writeStudioLayerEntry(
            record,
            step.copyId,
            readStudioLayerEntry(record, step.sourceId),
          );
        }
      }

      dispatch({
        target: STUDIO_LAYER_RECORD_TARGET,
        type: "controls.setValue",
        value: record,
      } as Parameters<typeof dispatch>[0]);
      dispatch({
        layerId: steps[0]?.copyId ?? layerId,
        type: "layers.select",
      } as Parameters<typeof dispatch>[0]);
    };

    const openApplyFor = (layerId: string): void => {
      // Selected first, because the application reads its subject from the
      // selection. Pressing a gear on a row the author has not selected and
      // applying to whatever *was* selected is the exact confusion these icons
      // exist to remove.
      dispatch({ layerId, type: "layers.select" } as Parameters<typeof dispatch>[0]);
      dispatch({
        history: "skip",
        target: "stack.onboardingStep",
        type: "controls.setValue",
        value: STUDIO_ONBOARDING_APPLY,
      } as Parameters<typeof dispatch>[0]);
    };

    const fitRow = (row: HTMLElement): void => {
      const layerId = row.getAttribute("data-layer-id");
      const cluster = row.querySelector<HTMLElement>(ROW_ACTIONS);
      if (!layerId || !cluster || cluster.querySelector(`[${ADDED}]`)) return;

      const template = cluster.querySelector("button");
      if (!template) return;

      for (const [name, icon, run] of [
        ["Duplicate", DUPLICATE_ICON, duplicate],
        ["Apply a composition", APPLY_ICON, openApplyFor],
      ] as const) {
        const button = template.cloneNode(true) as HTMLButtonElement;
        button.setAttribute(ADDED, "");
        button.setAttribute("aria-label", `${name} ${layerId}`);
        button.type = "button";

        const svg = button.querySelector("svg");
        if (svg) {
          svg.innerHTML = icon;
          svg.setAttribute("viewBox", "0 0 24 24");
        }

        button.addEventListener("click", (event) => {
          // The row is a selection target, so a press that reached it would
          // select the layer as a side effect of asking to copy it.
          event.preventDefault();
          event.stopPropagation();
          run(layerId);
        });
        button.addEventListener("pointerdown", (event) => event.stopPropagation());

        // Before the runtime's own buttons, so delete stays last: the
        // destructive one should not sit between two safe ones.
        cluster.prepend(button);
      }
    };

    const fitAll = (): void => {
      for (const row of document.querySelectorAll<HTMLElement>("[data-layer-id]")) {
        fitRow(row);
      }
    };

    fitAll();
    const observer = new MutationObserver(fitAll);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [dispatch]);

  return null;
}
