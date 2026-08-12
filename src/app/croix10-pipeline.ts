import {
  registerToolcraftRendererPipeline,
  type ToolcraftRendererPipelinePassContract,
} from "@/toolcraft/runtime";

/**
 * The one canonical executable pipeline registration.
 *
 * The same object is supplied to `ToolcraftAppComposition.rendererPipelineRegistration`
 * and reused as `rendererPipeline` in the performance configuration, so runtime
 * execution, browser evidence, and render-plan assessment all describe the same
 * pipeline rather than three prose copies of it.
 *
 * **One pass, deliberately.** The engine shader resolves the stripe field and
 * composites the presented frame in a single fragment program, so declaring two
 * passes would describe work the renderer does not actually do separately. When
 * the interference layer and post-FX chain arrive they become real additional
 * passes, and the relationship stays `constant` because per-pixel cost does not
 * vary with band count.
 */
type Croix10PipelineContracts = {
  "chromatic-field": ToolcraftRendererPipelinePassContract<void>;
};

/**
 * Every schema target the field reads. Exported so the performance scenarios
 * derive their `coversTargets` from the same list the pipeline declares: the
 * validator requires them to match exactly, and two hand-maintained copies drift.
 */
export const CROIX10_SCENE_TARGETS = [
  "appearance.background",
  "engine.active",
  "immersion.balance",
  "immersion.spread",
  "induction.frequency",
  "induction.fringeIntensity",
  "induction.fringeWidth",
  "viewer.angle",
  "viewer.parallax",
  "bands.separatorWidth",
  "export.includeBackground",
  "palette.cyclingOffset",
  "palette.slots",
  "ramp.driftCycles",
  "ramp.gradient",
  "ramp.interpolationSpace",
  "ramp.phase",
  "ramp.source",
  "interference.angleOffset",
  "interference.blendMode",
  "interference.enabled",
  "interference.phaseOffset",
  "interference.driftCycles",
  "interference.pitchRatio",
  "interference.widthRatio",
  "immersion.driftCycles",
  "shape.kind",
  "shape.mode",
  "shape.size",
  "shape.strength",
  "transchromie.blendMode",
  "transchromie.planes",
  "stripe.angle",
  "stripe.count",
  "stripe.jitterAmount",
  "stripe.jitterFrequency",
  "stripe.mirror",
  "stripe.phase",
  "stripe.widthRatio",
] as const;

export const CROIX10_DRAGGABLE_TARGETS = [
  "bands.separatorWidth",
  "interference.angleOffset",
  "interference.phaseOffset",
  "interference.pitchRatio",
  "interference.widthRatio",
  "shape.size",
  "shape.strength",
  "immersion.balance",
  "immersion.spread",
  "induction.frequency",
  "induction.fringeIntensity",
  "induction.fringeWidth",
  "viewer.angle",
  "viewer.parallax",
  "palette.cyclingOffset",
  "stripe.angle",
  "stripe.count",
  "stripe.jitterAmount",
  "stripe.jitterFrequency",
  "stripe.phase",
  "stripe.widthRatio",
] as const;

export const croix10PipelineRegistration =
  registerToolcraftRendererPipeline<Croix10PipelineContracts>()({
    interactionInvalidation: [
      {
        interaction: "initial-render",
        invalidates: ["chromatic-field"],
        targets: [...CROIX10_SCENE_TARGETS],
      },
      {
        // A selected render-scale change alters the backing pixel pitch, so the
        // field genuinely re-resolves. That is a control change, not viewport
        // zoom: magnifying the view is a transform and re-resolves nothing.
        interaction: "control-change",
        invalidates: ["chromatic-field"],
        targets: [...CROIX10_SCENE_TARGETS, "canvas.renderScale"],
      },
      {
        interaction: "control-drag",
        invalidates: ["chromatic-field"],
        targets: [...CROIX10_DRAGGABLE_TARGETS],
      },
      {
        // Panning is a viewport transform. The field is resolution independent
        // and its backing does not change, so nothing is re-resolved.
        interaction: "viewport-drag",
        invalidates: [],
        mustNotInvalidate: ["chromatic-field"],
        targets: ["canvas.offset"],
      },
      {
        // Zoom magnifies the presented frame. The field is resolution
        // independent, so no pass is re-resolved and the expensive
        // pixel-transform must stay resident.
        interaction: "viewport-zoom",
        invalidates: [],
        mustNotInvalidate: ["chromatic-field"],
        targets: ["canvas.zoom"],
      },
      {
        interaction: "export",
        invalidates: ["chromatic-field"],
        targets: ["export.image.format", "export.image.resolution"],
      },
    ],
    passes: [
      {
        // Memoized on the scene inputs: the field is redrawn when any of them
        // changes and skipped when none has. That is exactly the renderer's real
        // behaviour, and it is what lets the pass re-execute on a control edit
        // rather than only once at mount.
        cacheKey: ["sceneParameters", "backing"],
        // Still constant with the ramp in the pass. The ramp lookup walks at most
        // eight stops for a bracketing pair, which is fixed by the uniform array
        // size and does not vary with band count or line-pair frequency — the two
        // dimensions this cost is declared against. A ramp sampled per band rather
        // than per fragment does not change that either: the work is the same
        // bounded lookup, it simply runs against the band's centre.
        cost: {
          dimensions: ["band-count", "line-pair-frequency"],
          frequency: "frame",
          relationship: "constant",
        },
        id: "chromatic-field",
        inputs: ["scene-parameters"],
        invalidatedBy: [...CROIX10_SCENE_TARGETS],
        kind: "pixel-transform",
        lifecycle: { cache: "memoized", resourceScope: "renderer" },
        output: "preview",
        quality: "full",
        runsOn: "gpu",
      },
    ],
    runtimeId: "croix10-chromatic-field",
  });

export const croix10ChromaticFieldPass =
  croix10PipelineRegistration.getPass("chromatic-field");
