import {
  defineToolcraftPerformance,
  type ToolcraftEnvelopePerformanceConfig,
} from "@/toolcraft/runtime";

import {
  CROIX10_INDUCTION_FREQUENCY,
  CROIX10_STRIPE_COUNT,
} from "./croix10-parameters";
import {
  CROIX10_DRAGGABLE_TARGETS,
  CROIX10_SCENE_TARGETS,
  croix10PipelineRegistration,
} from "./croix10-pipeline";

/**
 * Croix10 performance model.
 *
 * The load-bearing decision here is that the fragment passes declare
 * `relationship: "constant"` with respect to the stripe dimensions. That is the
 * truthful declaration, not a convenience: a fragment shader evaluating the
 * stripe field costs the same per pixel whether it resolves 8 bands or 800,
 * because band count is a divisor in the field math rather than a loop bound.
 *
 * Consequences worth stating, because a future edit could quietly undo them:
 *
 * - The real cost drivers are pixel count (canvas size multiplied by render
 *   scale, both runtime-owned and therefore not product workload dimensions) and
 *   the number of enabled passes, which is discrete and feature-flagged.
 * - Because the relationship is constant, `assessToolcraftRenderPlan` raises no
 *   kernel benchmark requirement for these passes. Declaring them as `linear`
 *   "to be safe" would encode a false cost model and leave a permanent pending
 *   benchmark requirement.
 * - Density is bounded by the Nyquist derivation in `croix10-parameters.ts`,
 *   which is a fidelity limit. It is never enforced by degrading quality at
 *   runtime, which the contract classifies as a functional failure.
 */
export const appPerformance: ToolcraftEnvelopePerformanceConfig =
  defineToolcraftPerformance({
    fixtureAdapters: {
      dimensions: {
        // Band count is a numeric slider, so the applied value is the value.
        "band-count": {
          apply: (value: number) => value,
          dimensionId: "band-count",
          observe: (value: number) => value,
        },
        "line-pair-frequency": {
          apply: (value: number) => value,
          dimensionId: "line-pair-frequency",
          observe: (value: number) => value,
        },
      },
    },
    rendererPipeline: croix10PipelineRegistration,
    rendererStrategy: "webgl",
    rendererTechnique: {
      exportRenderer: "webgl",
      fidelityRisks: [
        "Aliasing at the maximum band count is the primary fidelity risk. It is bounded by a Nyquist derivation against effective pixel pitch and mitigated by analytic antialiasing from screen-space derivatives rather than by supersampling.",
        "Mixing happens in linear light so additive colour at stripe boundaries reads correctly; gradient authors may find linear-space interpolation unexpected, which a later explicit interpolation-space control addresses.",
      ],
      intentionalRasterizationReason:
        "The product is a continuous per-pixel colour field by nature. There is no vector original being rasterized; the geometry-only engine states are the exception and are offered as SVG clipboard output rather than as a renderer.",
      layers: [
        {
          content: ["shader"],
          exportMode: "included",
          id: "chromatic-field",
          kind: "product-foreground",
          primitiveCount: "low",
          renderer: "webgl",
          uiSelector: "[data-toolcraft-product-output]",
        },
      ],
      performanceRisks: [
        "Per-frame source texture upload through a multi-pass chain is the real cost concentration once imported media lands; stripe density is not a cost driver.",
        "No runtime quality clamping is available as a backstop, so frame cost must be addressed through pass cost, invalidation, cache lifetime, and scheduling.",
      ],
      previewRenderer: "webgl",
      productRepresentation: "pixel",
      rendererStrategy: "webgl",
      sourceRepresentation: "procedural-data",
      whyNotAlternativeStrategies: [
        "Canvas 2D: the output is per-pixel field math whose boundaries are antialiased analytically from screen-space derivatives. A 2D path would need per-pixel JavaScript or per-stripe geometry, and per-stripe geometry forfeits exactly the antialiasing the high-frequency engines depend on.",
        "SVG or DOM: cannot express interference, moire, or luminance-modulated fields at all. Only geometry-only engine states are vector expressible, which is why SVG is offered as a clipboard copy rather than as the renderer.",
        "WebGPU: no coverage advantage over WebGL2 for these passes, and the shader hook tool targets one GLSL dialect.",
      ],
    },
    scenarios: [
      {
        automated: true,
        automatedTestName:
          "declares the initial render path resolves the field once at mount",
        browser: true,
        browserTestName:
          "browser perf: croix10 initial render resolves the chromatic field once",
        coversTargets: [...CROIX10_SCENE_TARGETS],
        expectedObservable:
          "The chromatic field is visible on first paint with the default Couleur Additive module.",
        fixture: "default Couleur Additive module at the band-count default",
        id: "perf.initial-render",
        interaction: "initial-render",
        pathId:
          "performance-path:%5B%22initial-render%22%2C%22initial-render%22%2C%5B%22chromatic-field%22%5D%2C%5B%22gpu%22%5D%2C%5B%22band-count%22%2C%22line-pair-frequency%22%5D%5D",
        uiSelector: "[data-toolcraft-product-output]",
      },
      {
        automated: true,
        automatedTestName:
          "declares the control change path re-resolves the field for discrete edits",
        browser: true,
        browserTestName:
          "browser perf: croix10 control change re-resolves the chromatic field",
        coversTargets: [...CROIX10_SCENE_TARGETS, "canvas.renderScale"],
        expectedObservable:
          "Committing a control edit produces a changed chromatic field without recompiling the shader program.",
        fixture: "default Couleur Additive module at the band-count default",
        id: "perf.control-change",
        interaction: "control-change",
        pathId:
          "performance-path:%5B%22interactive-discrete%22%2C%22control-change%22%2C%5B%22chromatic-field%22%5D%2C%5B%22gpu%22%5D%2C%5B%22band-count%22%2C%22line-pair-frequency%22%5D%5D",
        uiSelector: "[data-toolcraft-product-output]",
      },
      {
        automated: true,
        automatedTestName:
          "declares the control drag path stays live through the gesture",
        browser: true,
        browserTestName:
          "browser perf: croix10 band count drag stays live through the gesture",
        controlLabel: "Bands",
        coversTargets: [...CROIX10_DRAGGABLE_TARGETS],
        expectedObservable:
          "The chromatic field updates continuously while the band count thumb is dragged, before pointer release.",
        fixture: "default Couleur Additive module at the band-count default",
        id: "perf.control-drag",
        interaction: "control-drag",
        pathId:
          "performance-path:%5B%22interactive-continuous%22%2C%22control-drag%22%2C%5B%22chromatic-field%22%5D%2C%5B%22gpu%22%5D%2C%5B%22band-count%22%2C%22line-pair-frequency%22%5D%5D",
        target: "stripe.count",
        uiSelector: "[data-toolcraft-product-output]",
      },
      {
        automated: true,
        automatedTestName:
          "declares the viewport drag path keeps the field resident",
        browser: true,
        browserTestName:
          "browser perf: croix10 viewport drag keeps the chromatic field resident",
        coversTargets: ["canvas.offset"],
        expectedObservable:
          "Panning moves the viewport without re-resolving the field, and canvas zoom and offset stay stable afterwards.",
        fixture: "default Couleur Additive module at the band-count default",
        id: "perf.viewport-drag",
        interaction: "viewport-drag",
        pathId:
          "performance-path:%5B%22interactive-continuous%22%2C%22viewport-drag%22%2C%5B%5D%2C%5B%5D%2C%5B%5D%5D",
        uiSelector: "[data-toolcraft-product-output]",
      },
      {
        automated: true,
        automatedTestName:
          "declares the viewport zoom path keeps the field resident",
        browser: true,
        browserTestName:
          "browser perf: croix10 viewport zoom keeps the chromatic field resident",
        coversTargets: ["canvas.zoom"],
        expectedObservable:
          "Zoom magnifies the presented frame without re-resolving the field.",
        fixture: "default Couleur Additive module at the band-count default",
        id: "perf.viewport-zoom",
        interaction: "viewport-zoom",
        pathId:
          "performance-path:%5B%22interactive-continuous%22%2C%22viewport-zoom%22%2C%5B%5D%2C%5B%5D%2C%5B%5D%5D",
        uiSelector: "[data-toolcraft-product-output]",
      },
      {
        actionValue: "export-image",
        automated: true,
        automatedTestName:
          "declares the image export path renders one deterministic frame",
        browser: true,
        browserTestName:
          "browser perf: croix10 image export renders one deterministic frame",
        completionEvidence: "download",
        controlLabel: "Export PNG",
        coversTargets: ["export.image.format", "export.image.resolution"],
        expectedObservable:
          "Exporting produces a decodable artifact at the selected resolution containing the chromatic field.",
        fixture: "default Couleur Additive module at the band-count default",
        id: "perf.export-image",
        interaction: "export",
        pathId:
          "performance-path:%5B%22batch-responsive%22%2C%22export%22%2C%5B%22chromatic-field%22%5D%2C%5B%22gpu%22%5D%2C%5B%22band-count%22%2C%22line-pair-frequency%22%5D%5D",
        uiSelector: "[data-toolcraft-product-output]",
      },
    ],
    usesCustomRenderer: true,
    workloadEnvelope: {
      dimensions: [
        {
          batchMax: CROIX10_STRIPE_COUNT.max,
          defaultValue: CROIX10_STRIPE_COUNT.defaultValue,
          id: "band-count",
          interactiveMax: CROIX10_STRIPE_COUNT.max,
          mapping: "direct",
          source: {
            kind: "schema-target",
            target: "stripe.count",
            workloadBoundary: "maximum",
          },
          unit: "bands",
        },
        {
          batchMax: CROIX10_INDUCTION_FREQUENCY.max,
          defaultValue: CROIX10_INDUCTION_FREQUENCY.defaultValue,
          id: "line-pair-frequency",
          interactiveMax: CROIX10_INDUCTION_FREQUENCY.max,
          mapping: "direct",
          source: {
            kind: "schema-target",
            target: "induction.frequency",
            workloadBoundary: "maximum",
          },
          unit: "cycles",
        },
      ],
    },
  });
