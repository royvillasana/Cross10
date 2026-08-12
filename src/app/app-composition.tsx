import type { ToolcraftAppComposition } from "@/toolcraft/runtime/react";

import { appSchema } from "./app-schema";
import { Croix10Canvas } from "./croix10-canvas";
import { croix10PipelineRegistration } from "./croix10-pipeline";
import { findCroix10Preset } from "./croix10-presets";
import { buildCroix10RandomizeAssignments } from "./croix10-randomize";
import { createCroix10Renderer } from "./croix10-render";
import { CROIX10_SCENE_RECT, readCroix10SceneParameters } from "./croix10-scene";

/**
 * The export frame renders the same field through the same renderer as preview,
 * into a product-owned offscreen surface, then composites into the 2D context the
 * runtime supplies. The runtime still owns backing allocation for the artifact,
 * background, encoding, download, and progress; this only contributes pixels.
 */
function renderCroix10ExportFrame({
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

  const renderer = createCroix10Renderer(gl);
  try {
    // Background is composited by the runtime for artifacts, so the product frame
    // draws the field alone and lets the runtime own artifact background rules.
    renderer.render(readCroix10SceneParameters(state, false), width, height);
    // Drawn in scene coordinates; the runtime context already carries the
    // artifact transform, so the offscreen surface only supplies resolution.
    context.drawImage(surface, 0, 0, sceneWidth, sceneHeight);
  } finally {
    renderer.dispose();
  }
}

/**
 * Preset load and Randomize, both as ordinary control edits.
 *
 * Each writes its targets through `controls.setValue` under one shared history
 * group, so the whole batch is a single undo step and nothing about persistence,
 * reset, or Settings Transfer needs to know these commands exist. Neither writes any
 * product-owned scene format: a preset is a map of schema targets, and randomize
 * derives its values from the schema's own declared domains.
 */
function handleCroix10PanelAction({
  action,
  dispatch,
  state,
}: Parameters<NonNullable<ToolcraftAppComposition["onPanelAction"]>>[0]): void {
  if (action.value === "load-preset") {
    const preset = findCroix10Preset(state.values["presets.active"]);
    if (!preset) return;
    for (const [target, value] of Object.entries(preset.values)) {
      dispatch({
        history: "merge",
        historyGroup: `croix10-preset:${preset.id}`,
        label: `Load ${preset.label}`,
        target,
        type: "controls.setValue",
        value,
      });
    }
    return;
  }

  if (action.value === "randomize") {
    const assignments = buildCroix10RandomizeAssignments(state);
    for (const assignment of assignments) {
      dispatch({
        history: "merge",
        historyGroup: "croix10-randomize",
        label: "Randomize",
        target: assignment.target,
        type: "controls.setValue",
        value: assignment.value,
      });
    }
  }
}

export const appComposition: ToolcraftAppComposition = {
  canvasContent: <Croix10Canvas />,
  onPanelAction: handleCroix10PanelAction,
  exportRenderer: {
    baseFileName: "croix10",
    renderFrame: renderCroix10ExportFrame,
  },
  modelPresentation: { mode: "runtime" },
  renderDefaultCanvasMedia: false,
  rendererPipelineRegistration: croix10PipelineRegistration,
  schema: appSchema,
  sceneBoundsProvider: () => [CROIX10_SCENE_RECT],
};
