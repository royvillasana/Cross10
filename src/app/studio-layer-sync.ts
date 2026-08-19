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
import { isStudioVideoAsset } from "./studio-video";

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
  /**
   * How deep history was last time this ran.
   *
   * The signal that separates "the author moved a control" from "the runtime
   * moved history underneath them". Both look identical to the fold below --
   * the control values differ from the record -- and telling them apart is the
   * whole of the fix for the layer an undo used to corrupt.
   */
  const lastHistoryDepth = React.useRef<{ redo: number; undo: number } | null>(null);
  /**
   * The layer the last folded edit belonged to.
   *
   * Half the answer history depth cannot give. Knowing that history moved says
   * the values did not come from the author; knowing *whose* edit is on top of
   * the stack says whether the reverted values describe the layer now selected.
   * Undoing your own last edit is the common case and has to keep working.
   */
  const lastEditedLayerId = React.useRef<string | null>(null);

  const layers = state.layers ?? [];
  /**
   * Which layers are drawn as pictures, which the record does not know.
   *
   * A layer created as stripes and then given an imported asset still records
   * `typeId: "stripes"`; the asset is what makes it a picture. Both directions
   * of this sync have to ask the runtime rather than the record, or the controls
   * the image body reads are projected from nothing and collected into nothing.
   *
   * A clip counts, and that is the whole of what makes video a layer kind here
   * rather than a second renderer: a frame of a clip is a picture, so the body
   * that draws a picture draws it, and every treatment, engine and source
   * mapping that already reaches a still reaches a moving one unchanged. What
   * differs is only which frame the texture holds, which is the canvas's
   * business and not this file's.
   */
  const pictureLayerIds = new Set(
    (state.mediaAssets ?? [])
      .filter((asset) => asset.assetKind === "image" || isStudioVideoAsset(asset))
      .map((asset) => asset.layerId)
      .filter((id): id is string => typeof id === "string"),
  );
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
      for (const assignment of projectStudioLayerEntry(
        entry,
        pictureLayerIds.has(selectedLayerId) ? "image" : entry.typeId,
      )) {
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

    // Flow two: same layer. Any difference is *either* an edit the author made
    // or an undo of an edit made somewhere else, and the two are indistinguishable
    // from the values alone.
    //
    // **The failure this guards.** The controls are one editing surface pointed
    // at whichever layer is selected (R56), so an undo restores control values,
    // not a layer's values. Edit A, select B, undo: the reverted values arrive
    // while B is selected, and folding them writes A's old settings into B. The
    // author undid something on A and B changed, silently, while they were
    // looking at neither.
    //
    // History depth is the signal the values do not carry. An author's edit
    // pushes onto the undo stack; an undo pops from it and pushes onto redo. So
    // a values change that arrives with a *shrinking* undo stack, or a growing
    // redo stack, did not come from the author's hands.
    //
    // What happens then is deliberately modest: the fold is skipped and the
    // selected layer's stored values are pushed back into the controls, so the
    // surface returns to describing the layer it is pointed at. The undone edit
    // is not visibly undone -- the runtime reverted controls that no longer
    // describe the layer the patch belonged to, and this product cannot tell it
    // which layer that was. Inert is not correct, but it is not destructive,
    // and the difference matters: one is an undo that appears not to work, the
    // other is a layer the author never touched quietly taking another's
    // settings.
    //
    // The full fix is the record becoming the single store rather than a
    // follower of the controls, which is an amendment to R56 rather than a
    // patch to this sync. It is recorded as outstanding task 1.2.
    const depth = {
      redo: state.history?.redo?.length ?? 0,
      undo: state.history?.undo?.length ?? 0,
    };
    const previousDepth = lastHistoryDepth.current;
    lastHistoryDepth.current = depth;
    const historyMoved =
      previousDepth !== null &&
      (depth.undo < previousDepth.undo || depth.redo > previousDepth.redo);

    // Only when the reverted values describe some *other* layer. An author
    // undoing the edit they just made, on the layer they are still looking at,
    // is the ordinary case -- the controls revert, this folds them back, and one
    // undo means one undo. Guarding that too made Undo inert across the app,
    // which is how this fix first went wrong.
    if (historyMoved && lastEditedLayerId.current !== selectedLayerId) {
      const entry = readStudioLayerEntry(record, selectedLayerId);
      for (const assignment of projectStudioLayerEntry(
        entry,
        pictureLayerIds.has(selectedLayerId) ? "image" : entry.typeId,
      )) {
        dispatch({
          history: "skip",
          target: assignment.target,
          type: "controls.setValue",
          value: assignment.value,
        });
      }
      return;
    }

    const stored = readStudioLayerEntry(record, selectedLayerId);
    const declaredType = values[STUDIO_LAYER_TYPE_TARGET];
    const retyped =
      typeof declaredType === "string" && declaredType !== stored.typeId
        ? retypeStudioLayerEntry(stored, declaredType as StudioLayerTypeId)
        : stored;

    // A type change replaces the values wholesale, so an edit collected in the
    // same pass would be an edit to the type the user just left.
    const next =
      retyped === stored
        ? collectStudioSelectedLayerEdit(
            stored,
            values,
            pictureLayerIds.has(selectedLayerId) ? "image" : stored.typeId,
          )
        : retyped;

    if (JSON.stringify(next) !== JSON.stringify(stored)) {
      lastEditedLayerId.current = selectedLayerId;
      writeRecord(
        writeStudioLayerEntry(record, selectedLayerId, next),
        "Edit layer",
        `studio-layer-edit:${selectedLayerId}`,
      );
    }
  }, [dispatch, record, selectedLayerId, state.history, values, writeRecord]);

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
