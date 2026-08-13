import type { ToolcraftAppComposition } from "@/toolcraft/runtime/react";

import { appSchema } from "./app-schema";
import { StudioCanvas } from "./studio-canvas";
import { studioPipelineRegistration } from "./studio-pipeline";
import { buildStudioSceneParameters, studioSceneRect } from "./studio-scene";
import { studioAssembleDeliverableSource } from "./studio-source";
import {
  readStudioLayerEntry,
  readStudioLayerRecord,
  STUDIO_LAYER_RECORD_TARGET,
  studioDuplicateLayerId,
  studioDuplicateLayerName,
  writeStudioLayerEntry,
} from "./studio-stack-state";
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
    renderer.render(buildStudioSceneParameters(state, false), width, height);
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
 * Copies the selected layer, with everything that makes it that layer.
 *
 * Two dispatches rather than one, because the two halves of a layer live in two
 * places: the runtime owns identity, order, name and visibility, and the
 * product owns every value hung off the id (R56). A duplicate that only added a
 * runtime layer would arrive with the registry defaults and look like a plain
 * new layer; one that only copied the record would write values no layer has.
 *
 * The copy is inserted directly above its source rather than at the top of the
 * stack, so it composites where the author was already looking, and it is
 * selected afterwards because the thing you just made is the thing you want to
 * edit.
 *
 * The record is read before either dispatch: adding a layer does not touch it,
 * so the value written second is still the one the source had.
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
  const layers = state.layers ?? [];
  const sourceId = state.selectedLayerId ?? "";
  const sourceIndex = layers.findIndex((layer) => layer.id === sourceId);
  const source = layers[sourceIndex];
  // Nothing selected, or a group rather than a layer: a group's copy would have
  // to copy its members too, which is a different operation with a different
  // observable, so it is not silently half-done here.
  if (!source || source.kind === "group") return;

  const record = readStudioLayerRecord(state.values[STUDIO_LAYER_RECORD_TARGET]);
  const entry = readStudioLayerEntry(record, sourceId);
  const copyId = studioDuplicateLayerId(
    sourceId,
    layers.map((layer) => layer.id),
  );

  dispatch({
    insertIndex: sourceIndex + 1,
    layer: {
      id: copyId,
      name: studioDuplicateLayerName(source.displayName ?? source.name),
      // Inside whatever the source is inside, so a duplicate of a grouped layer
      // stays in its group instead of escaping to the root.
      ...(source.parentGroupId ? { parentGroupId: source.parentGroupId } : {}),
      visible: source.visible,
    },
    type: "layers.add",
  });
  dispatch({
    target: STUDIO_LAYER_RECORD_TARGET,
    type: "controls.setValue",
    value: writeStudioLayerEntry(record, copyId, entry),
  });
  dispatch({ layerId: copyId, type: "layers.select" });
}

export const appComposition: ToolcraftAppComposition = {
  canvasContent: <StudioCanvas />,
  onPanelAction: handleStudioPanelAction,
  exportRenderer: {
    baseFileName: "shader-studio",
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
