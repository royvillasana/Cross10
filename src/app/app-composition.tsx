import type { ToolcraftAppComposition } from "@/toolcraft/runtime/react";

import { appSchema } from "./app-schema";
import { StudioCanvas } from "./studio-canvas";
import { studioPipelineRegistration } from "./studio-pipeline";
import { buildStudioSceneParameters, studioSceneRect } from "./studio-scene";
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

export const appComposition: ToolcraftAppComposition = {
  canvasContent: <StudioCanvas />,
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
