"use client";

import * as React from "react";

import { useToolcraftDispatch, useToolcraftSelector } from "@/toolcraft/runtime/react";

import {
  STUDIO_LAYER_RECORD_TARGET,
  STUDIO_LAYER_TYPE_TARGET,
  collectStudioSelectedLayerEdit,
  projectStudioLayerEntry,
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

  /**
   * The record follows the controls; it is never an edit of its own.
   *
   * `history: "skip"`, and this is load-bearing rather than tidy. Every write
   * here is derived from a change that is *already* in history -- the runtime
   * records the control edit, and this is the consequence of it -- so recording
   * it again puts a second patch on the stack for one author action. That is
   * what made Undo inert across the whole app: the sync's patch sat on top, an
   * undo popped it, the sync immediately re-derived it from controls the undo
   * had not touched, and the stack treadmilled. The button was never disabled
   * and nothing ever moved.
   *
   * Skipping it is not a loss of undo coverage. Undo pops the control edit, the
   * controls revert, and this runs once more to fold the reverted values back
   * into the record -- so the render follows, one undo per edit, with no patch
   * of its own.
   *
   * `label` and `group` are kept in the signature because the callers read
   * better for naming what they are doing, and because a future write that
   * genuinely *is* an edit would need them.
   */
  const writeRecord = React.useCallback(
    (next: StudioLayerRecord, _label: string, _group: string): void => {
      dispatch({
        history: "skip",
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
        // Skipped for the same reason the record write is: loading a layer's
        // values into the controls is what selecting it *means*, not a second
        // edit beside it. Recorded, an undo would revert the controls to the
        // previous layer's values while that layer stayed selected -- which the
        // next pass would fold straight into it.
        dispatch({
          history: "skip",
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

  // A deleted layer's entry is deliberately *not* removed here.
  //
  // It was, until undo started working. Deleting a layer prunes nothing the
  // renderer reads -- `buildStudioSceneParameters` prunes against the live
  // layer list every frame, so an orphan draws nothing -- and pruning the
  // stored record turned an undone delete into a layer restored with its
  // settings wiped: the runtime brought the layer back and the values it had
  // were already gone. Between a record that remembers a layer the author
  // removed and an undo that silently resets one, the memory is the cheaper
  // mistake: an entry is a few dozen numbers, and applying a preset replaces
  // the record wholesale, which collects them.
}
