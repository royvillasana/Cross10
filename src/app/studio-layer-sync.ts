"use client";

import * as React from "react";

import { useToolcraftDispatch, useToolcraftSelector } from "@/toolcraft/runtime/react";

import {
  STUDIO_LAYER_RECORD_TARGET,
  STUDIO_LAYER_TYPE_TARGET,
  collectStudioSelectedLayerEdit,
  projectStudioLayerEntry,
  pruneStudioLayerRecord,
  readStudioLayerEntry,
  readStudioLayerRecord,
  retypeStudioLayerEntry,
  writeStudioLayerEntry,
  type StudioLayerRecord,
} from "./studio-stack-state";
import { type StudioLayerTypeId } from "./studio-layers";

/**
 * Keeps the per-layer record and the `selectedLayer.*` controls in step (R56).
 *
 * The runtime has no per-layer value store, so the controls are one editing
 * surface pointed at whichever layer is selected. Two flows, never both on one
 * event:
 *
 * - **Selection changed** → project the newly selected layer's stored values
 *   into the controls.
 * - **Controls edited, selection unchanged** → fold the edit back into the
 *   record under the selected id.
 *
 * The `lastSyncedLayerId` ref is what separates them. Without it a selection
 * change looks identical to an edit — the control values differ from the record
 * either way — and the newly selected layer would immediately be overwritten
 * with the values of the layer just left.
 */
export function useStudioLayerSync(): void {
  const dispatch = useToolcraftDispatch();
  const state = useToolcraftSelector((current) => current);
  const lastSyncedLayerId = React.useRef<string | null>(null);

  const layers = state.layers ?? [];
  const selectedLayerId = state.selectedLayerId ?? null;
  const values = state.values as Readonly<Record<string, unknown>>;
  const record = readStudioLayerRecord(values[STUDIO_LAYER_RECORD_TARGET]);

  const writeRecord = React.useCallback(
    (next: StudioLayerRecord, label: string, group: string): void => {
      dispatch({
        history: "merge",
        historyGroup: group,
        label,
        target: STUDIO_LAYER_RECORD_TARGET,
        type: "controls.setValue",
        value: next,
      });
    },
    [dispatch],
  );

  React.useEffect(() => {
    if (selectedLayerId === null) {
      lastSyncedLayerId.current = null;
      return;
    }

    // Flow one: a different layer is selected, so the controls are stale. Push
    // the record into them and record which layer they now describe.
    if (lastSyncedLayerId.current !== selectedLayerId) {
      const entry = readStudioLayerEntry(record, selectedLayerId);
      for (const assignment of projectStudioLayerEntry(entry)) {
        dispatch({
          history: "merge",
          historyGroup: `studio-layer-select:${selectedLayerId}`,
          label: "Select layer",
          target: assignment.target,
          type: "controls.setValue",
          value: assignment.value,
        });
      }
      lastSyncedLayerId.current = selectedLayerId;
      return;
    }

    // Flow two: same layer, so any difference is an edit the user made.
    const stored = readStudioLayerEntry(record, selectedLayerId);
    const declaredType = values[STUDIO_LAYER_TYPE_TARGET];
    const retyped =
      typeof declaredType === "string" && declaredType !== stored.typeId
        ? retypeStudioLayerEntry(stored, declaredType as StudioLayerTypeId)
        : stored;

    // A type change replaces the values wholesale, so an edit collected in the
    // same pass would be an edit to the type the user just left.
    const next =
      retyped === stored ? collectStudioSelectedLayerEdit(stored, values) : retyped;

    if (JSON.stringify(next) !== JSON.stringify(stored)) {
      writeRecord(
        writeStudioLayerEntry(record, selectedLayerId, next),
        "Edit layer",
        `studio-layer-edit:${selectedLayerId}`,
      );
    }
  }, [dispatch, record, selectedLayerId, values, writeRecord]);

  React.useEffect(() => {
    // Orphans are pruned on read rather than on delete, so a delete the product
    // never observed cannot leak an entry forever.
    const liveIds = layers.map((layer) => layer.id);
    const pruned = pruneStudioLayerRecord(record, liveIds);
    if (Object.keys(pruned).length !== Object.keys(record).length) {
      writeRecord(pruned, "Remove layer", "studio-layer-prune");
    }
  }, [layers, record, writeRecord]);
}
