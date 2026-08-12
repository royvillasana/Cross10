import {
  registerToolcraftRendererPipeline,
  type ToolcraftRendererPipelinePassContract,
} from "@/toolcraft/runtime";

/**
 * The one canonical executable pipeline registration.
 *
 * The same object is supplied to `ToolcraftAppComposition.rendererPipelineRegistration`
 * and reused as `rendererPipeline` in the performance configuration, so runtime
 * execution, browser evidence, and render-plan assessment describe one pipeline
 * rather than three prose copies of it.
 *
 * **One pass, and it is a `composite` rather than a `pixel-transform`.** That is
 * the difference from Croix10, and it is the product's whole subject: the
 * assembled program calls each visible layer's body in stack order and folds the
 * results together with per-layer opacity. Croix10 resolves a single field, so
 * its pass transforms pixels; this one combines several, so it composites. The
 * stack is still assembled into a single fragment program (R52), so it is one
 * pass and not one pass per layer — declaring per-layer passes would describe
 * work the renderer does not do separately.
 *
 * This module exists again after being removed as orphaned earlier (R57: engine
 * modules migrate when something needs them, not ahead). It is imported by
 * `app-performance.ts` now and by `app-composition.tsx` at 2.8e, so it is
 * reachable rather than speculative.
 */
type StudioPipelineContracts = {
  "layer-stack": ToolcraftRendererPipelinePassContract<void>;
};

/**
 * Every schema target the composite reads. Exported so the performance scenarios
 * at 2.9 derive their `coversTargets` from the same list the pipeline declares —
 * the validator requires them to match exactly, and two hand-maintained copies
 * drift.
 *
 * These are the `selectedLayer.*` controls rather than per-layer state because
 * of R56: the runtime owns no per-layer value store, so one editing surface
 * points at whichever layer is selected and product code folds the edit into
 * `stack.layerRecord`. The controls are what a user actually changes, so they
 * are what invalidates the pass.
 */
export const STUDIO_SCENE_TARGETS = [
  "appearance.background",
  "export.includeBackground",
  "selectedLayer.angle",
  "selectedLayer.colorA",
  "selectedLayer.colorB",
  "selectedLayer.count",
  "selectedLayer.opacity",
  "selectedLayer.phase",
  "selectedLayer.rampType",
  "selectedLayer.type",
  "selectedLayer.widthRatio",
] as const;

/**
 * The subset a user can drag, which is exactly the sliders. A drag is a
 * continuous interaction and gets its own path and budget, so it is listed
 * separately rather than inferred from the scene list.
 */
export const STUDIO_DRAGGABLE_TARGETS = [
  "selectedLayer.angle",
  "selectedLayer.count",
  "selectedLayer.opacity",
  "selectedLayer.phase",
  "selectedLayer.widthRatio",
] as const;

export const studioPipelineRegistration =
  registerToolcraftRendererPipeline<StudioPipelineContracts>()({
    interactionInvalidation: [
      {
        interaction: "initial-render",
        invalidates: ["layer-stack"],
        targets: [...STUDIO_SCENE_TARGETS],
      },
      {
        // A selected render-scale change alters the backing pixel pitch, so the
        // stack genuinely re-resolves. That is a control change, not viewport
        // zoom: magnifying the presented frame re-resolves nothing.
        interaction: "control-change",
        invalidates: ["layer-stack"],
        targets: [...STUDIO_SCENE_TARGETS, "canvas.renderScale"],
      },
      {
        interaction: "control-drag",
        invalidates: ["layer-stack"],
        targets: [...STUDIO_DRAGGABLE_TARGETS],
      },
      {
        // Panning is a viewport transform. The stack is resolution independent
        // and its backing does not change, so nothing is re-resolved.
        interaction: "viewport-drag",
        invalidates: [],
        mustNotInvalidate: ["layer-stack"],
        targets: ["canvas.offset"],
      },
      {
        // Zoom magnifies the presented frame. Same reasoning as the pan, and the
        // composite must stay resident across the gesture.
        interaction: "viewport-zoom",
        invalidates: [],
        mustNotInvalidate: ["layer-stack"],
        targets: ["canvas.zoom"],
      },
      {
        interaction: "export",
        invalidates: ["layer-stack"],
        targets: ["export.image.format", "export.image.resolution"],
      },
    ],
    passes: [
      {
        // Memoized on the scene inputs: the stack is redrawn when any of them
        // changes and skipped when none has. That is what lets the pass
        // re-execute on a control edit rather than only once at mount.
        cacheKey: ["sceneParameters", "backing"],
        cost: {
          // `linear`, and the dimension that makes it linear is `stack-depth`:
          // every visible layer adds a body call and a composite step to every
          // pixel, so cost grows with the length of the stack. This is the
          // honest declaration and it is what separates this product's cost
          // model from Croix10's constant one.
          //
          // `band-count` is declared because the pass reads it and its path
          // coverage derives from this list, but it contributes constant
          // per-pixel cost: the count sets the field's frequency and boundaries
          // resolve analytically from screen-space derivatives, so a band is not
          // a loop iteration. The pass's growth class is therefore set by stack
          // depth alone.
          //
          // A non-constant `composite` pass at frame frequency raises a kernel
          // benchmark requirement. That requirement is correct rather than
          // unfortunate, and functional delivery leaves it pending: resolving it
          // needs an authorized performance run, not an authored timing value.
          dimensions: ["stack-depth", "band-count"],
          frequency: "frame",
          relationship: "linear",
        },
        id: "layer-stack",
        inputs: ["scene-parameters"],
        invalidatedBy: [...STUDIO_SCENE_TARGETS],
        kind: "composite",
        lifecycle: { cache: "memoized", resourceScope: "renderer" },
        output: "preview",
        quality: "full",
        runsOn: "gpu",
      },
    ],
    runtimeId: "shader-studio-layer-stack",
  });

export const studioLayerStackPass =
  studioPipelineRegistration.getPass("layer-stack");
