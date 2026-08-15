import type { ToolcraftAppComposition } from "@/toolcraft/runtime/react";

import { appSchema } from "./app-schema";
import { StudioCanvas } from "./studio-canvas";
import { studioPipelineRegistration } from "./studio-pipeline";
import { buildStudioSceneParameters, studioSceneRect } from "./studio-scene";
import { studioAssembleDeliverableSource } from "./studio-source";
import {
  planStudioLayerDuplication,
  planStudioPenDrawing,
  planStudioStackRestoration,
  studioApplicationLayerIds,
  STUDIO_APPLY_TARGET_TARGET,
  STUDIO_CURSOR_AWAY,
  STUDIO_PENDING_TECHNIQUE_TARGET,
  STUDIO_SNAPSHOT_TARGET,
  STUDIO_VERTEX_PATH_TARGET,
  readStudioApplyTarget,
  readStudioLayerEntry,
  readStudioLayerRecord,
  readStudioPendingTechnique,
  readStudioStackSnapshot,
  STUDIO_LAYER_RECORD_TARGET,
  writeStudioLayerEntry,
} from "./studio-stack-state";
import {
  findStudioPreset,
  planStudioPresetApplication,
  planStudioTechniqueChange,
  planStudioTechniqueDecline,
} from "./studio-presets";
import { createStudioStackRenderer } from "./studio-stack-render";

/**
 * The export frame draws the same stack through the same renderer as preview,
 * into a product-owned offscreen surface, then composites into the 2D context
 * the runtime supplies.
 *
 * Same renderer, deliberately: preview and export both call
 * `createStudioStackRenderer` over `buildStudioSceneParameters`, so the assembled
 * program, the uniform order, and the linear-light compositing cannot drift
 * between what an author sees and what they get. A second export path would be a
 * second chance to disagree.
 *
 * The runtime still owns backing allocation for the artifact, background,
 * encoding, download, and progress; this only contributes pixels.
 */
function renderStudioExportFrame({
  context,
  frame,
  pixelRatio,
  state,
}: Parameters<
  NonNullable<ToolcraftAppComposition["exportRenderer"]>["renderFrame"]
>[0]): void {
  const sceneWidth = Math.max(1, Math.round(frame.width));
  const sceneHeight = Math.max(1, Math.round(frame.height));
  const scale = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const width = Math.max(1, Math.round(sceneWidth * scale));
  const height = Math.max(1, Math.round(sceneHeight * scale));

  const surface = document.createElement("canvas");
  surface.width = width;
  surface.height = height;

  const gl = surface.getContext("webgl2", {
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) return;

  const renderer = createStudioStackRenderer(gl);
  try {
    // Background is composited by the runtime for artifacts, so the product
    // frame draws the stack alone and lets the runtime own artifact background
    // rules — which is what keeps the transparent-image coverage claim true.
    //
    // The pointer is at rest, rather than wherever it was left. An artifact that
    // carried the live cursor would differ between two exports of one
    // composition, and neither of them would be the composition -- a pointer
    // effect is something the viewer drives, not a property of the still.
    renderer.render(
      buildStudioSceneParameters(state, false, new Map(), STUDIO_CURSOR_AWAY),
      width,
      height,
    );
    // Drawn in scene coordinates; the runtime context already carries the
    // artifact transform, so the offscreen surface only supplies resolution.
    context.drawImage(surface, 0, 0, sceneWidth, sceneHeight);
  } finally {
    renderer.dispose();
  }
}

/**
 * Copies the assembled shader source to the clipboard.
 *
 * Built from the same scene the renderer draws, so what is copied is the frame
 * on screen rather than a re-derivation of it.
 *
 * The real Promise is returned rather than awaited and discarded: the runtime
 * owns the sticky footer indicator, and handing it an already-resolved Promise
 * would report the copy finished before the clipboard write had.
 *
 * Deliberately not an export action. It writes no artifact and downloads
 * nothing, so the recorded image-and-video artifact intent is untouched.
 */
function handleStudioPanelAction({
  action,
  dispatch,
  state,
}: Parameters<NonNullable<ToolcraftAppComposition["onPanelAction"]>>[0]):
  | Promise<void>
  | void {
  if (action.value === "draw-shape") {
    // The same plan the P shortcut carries out (15.4), so the button and the
    // key are one operation rather than two implementations of it.
    for (const command of planStudioPenDrawing(
      state.selectedLayerId ?? "",
      state.values[STUDIO_VERTEX_PATH_TARGET],
    )) {
      dispatch(command);
    }
    return;
  }

  if (action.value === "apply-preset" || action.value === "confirm-preset") {
    // The gallery is an applicator, not a mode (R58): this replaces the stack
    // and stores nothing about having done so. The entry the picker names is
    // read at the moment of the press rather than followed, which is what makes
    // the select a picker rather than a switch.
    const preset = findStudioPreset(state.values["gallery.entry"]);
    if (!preset) return;

    // Whether this press offers or carries out is the plan's decision, not
    // this dispatcher's: the snapshot that makes the change reversible is
    // emitted by the same plan, so a caller cannot apply without capturing
    // first and cannot apply without having asked first either.
    for (const command of planStudioTechniqueChange({
      confirmed: action.value === "confirm-preset",
      layers: state.layers ?? [],
      pendingTechnique: readStudioPendingTechnique(
        state.values[STUDIO_PENDING_TECHNIQUE_TARGET],
      ),
      preset,
      record: readStudioLayerRecord(state.values[STUDIO_LAYER_RECORD_TARGET]),
      selectedLayerId: state.selectedLayerId ?? null,
    })) {
      dispatch(command as Parameters<typeof dispatch>[0]);
    }
    return;
  }

  if (action.value === "cancel-preset") {
    for (const command of planStudioTechniqueDecline()) {
      dispatch(command as Parameters<typeof dispatch>[0]);
    }
    return;
  }

  if (action.value === "apply-engine") {
    // The narrow half: the entry is laid onto layers that already exist and no
    // layer is created, removed, or reordered. Nothing is armed and nothing is
    // asked, because there is nothing here to lose.
    const preset = findStudioPreset(state.values["gallery.entry"]);
    if (!preset) return;

    const layers = state.layers ?? [];
    const target = readStudioApplyTarget(state.values[STUDIO_APPLY_TARGET_TARGET]);

    for (const command of planStudioPresetApplication({
      layers,
      preset,
      record: readStudioLayerRecord(state.values[STUDIO_LAYER_RECORD_TARGET]),
      selectedLayerId: state.selectedLayerId ?? null,
      target,
      targetLayerIds: studioApplicationLayerIds({
        layers,
        // Which layers carry a picture is the runtime's answer, not the
        // record's: an imported layer's entry still says whatever kind it was
        // created as, and the asset is what makes it a picture.
        mediaLayerIds: (state.mediaAssets ?? [])
          .filter((asset) => asset.assetKind === "image")
          .map((asset) => asset.layerId)
          .filter((id): id is string => typeof id === "string"),
        selectedLayerId: state.selectedLayerId ?? null,
        target,
      }),
    })) {
      dispatch(command as Parameters<typeof dispatch>[0]);
    }
    return;
  }

  if (action.value === "restore-stack") {
    // The other half of the framework gap in issue 7: the runtime cannot fuse
    // an application's layer commands into one undo entry, so taking one back
    // is a product action rather than a press of Undo.
    const snapshot = readStudioStackSnapshot(state.values[STUDIO_SNAPSHOT_TARGET]);
    if (!snapshot) return;

    for (const command of planStudioStackRestoration({
      currentLayerIds: (state.layers ?? []).map((layer) => layer.id),
      snapshot,
    })) {
      dispatch(command as Parameters<typeof dispatch>[0]);
    }
    return;
  }

  if (action.value === "duplicate-layer") {
    duplicateStudioSelectedLayer({ dispatch, state });
    return;
  }

  if (action.value !== "copy-source") return;

  return navigator.clipboard.writeText(
    studioAssembleDeliverableSource(buildStudioSceneParameters(state, true)),
  );
}

/**
 * Copies the selection, with everything that makes it what it is.
 *
 * A layer and a group are the same operation over a different block: a layer is
 * a block of one, a group is itself plus everything under it. The plan works
 * that out — including rewiring each member's parent onto the copied group —
 * and this only carries it out, which is what keeps the interesting part
 * testable without a runtime.
 *
 * Two kinds of write, because a layer lives in two places (R56). The runtime
 * owns identity, order, name, visibility and parentage, so each copy is created
 * through `layers.add` with an explicit draft id. The product owns every value
 * hung off an id, so the record entries are written together in one edit at the
 * end. Either half alone is a bug that looks like a feature: only the first
 * gives plain new layers wearing copies' names, only the second writes values
 * no layer has.
 *
 * The record is read once, before any dispatch: adding layers does not touch
 * it, so the values written are still the ones the sources had. Groups get no
 * entry — a group organises, it does not render.
 *
 * The copy is inserted directly after the block it came from, so it composites
 * where the author was already looking, and the copied source is selected
 * afterwards because the thing you just made is the thing you want to edit.
 */
function duplicateStudioSelectedLayer({
  dispatch,
  state,
}: {
  dispatch: Parameters<
    NonNullable<ToolcraftAppComposition["onPanelAction"]>
  >[0]["dispatch"];
  state: Parameters<NonNullable<ToolcraftAppComposition["onPanelAction"]>>[0]["state"];
}): void {
  const sourceId = state.selectedLayerId ?? "";
  const steps = planStudioLayerDuplication(state.layers ?? [], sourceId);
  if (steps.length === 0) return;

  let record = readStudioLayerRecord(state.values[STUDIO_LAYER_RECORD_TARGET]);

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
    });

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
  });
  dispatch({ layerId: steps[0]?.copyId ?? sourceId, type: "layers.select" });
}

export const appComposition: ToolcraftAppComposition = {
  canvasContent: <StudioCanvas />,
  onPanelAction: handleStudioPanelAction,
  exportRenderer: {
    baseFileName: "croix10",
    renderFrame: renderStudioExportFrame,
  },
  modelPresentation: { mode: "runtime" },
  // A product renderer replaces generic image/file preview. It does not suppress
  // runtime model layers, which this product has none of anyway.
  renderDefaultCanvasMedia: false,
  rendererPipelineRegistration: studioPipelineRegistration,
  schema: appSchema,
  sceneBoundsProvider: ({ state }) => [studioSceneRect(state)],
};
