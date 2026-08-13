import {
  defineToolcraftPerformance,
  type ToolcraftEnvelopePerformanceConfig,
} from "@/toolcraft/runtime";

import { STUDIO_BAND_COUNT, STUDIO_REGION_SIDES } from "./studio-layer-sections";
import {
  STUDIO_DRAGGABLE_TARGETS,
  STUDIO_SCENE_TARGETS,
  studioPipelineRegistration,
} from "./studio-pipeline";

/**
 * Shader Studio performance model.
 *
 * Two workload dimensions, and the interesting one is `stack-depth`. Every
 * other Toolcraft workload dimension written so far has been a count inside a
 * single shader body; this one is the number of bodies. The assembled program
 * calls each visible layer's function once per pixel and composites the result,
 * so per-pixel cost grows with the length of the stack. That is a real cost
 * relationship rather than a bookkeeping one, and it is why the dimension has
 * to exist before the pipeline can declare what its pass costs.
 *
 * `stack-depth` has no schema control behind it. The runtime owns the layer
 * list — product code authors neither the panel nor the add/remove commands —
 * so the magnitude is read from runtime state rather than from a target. The
 * contract admits exactly this: a `runtime-state` source declares its
 * maximum-workload value directly, with no `workloadBoundary`, because there is
 * no schema endpoint for a boundary to equal.
 *
 * That resolution matters, because the obvious alternative is wrong. Declaring
 * a maximum here does **not** cap the stack, and must not be implemented as
 * one: R52 chose name-mangled per-layer uniforms precisely so the layer model
 * carries no depth limit, and the runtime owns the add-layer surface anyway, so
 * product code could not enforce a cap without rebuilding a forbidden runtime
 * surface. `STUDIO_STACK_DEPTH.max` is the depth this product claims to render
 * at full quality and will be measured at — a proof ceiling, not a product one.
 *
 * `band-count` is the ordinary case and mirrors Croix10's: the boundary equals
 * the schema endpoint, read from the same literal the control reads so the two
 * cannot drift.
 *
 * Note what is *not* here. `selectedLayer.type` selects which body runs, and
 * each body is a constant per-pixel cost, so it changes which work happens and
 * never how much. It is `responsiveness`, not a third dimension.
 */

/**
 * `defaultValue` is 0 because that is the honest default: the runtime builds
 * its default layer list from default media, this product declares none, and no
 * product code seeds a first layer. If 2.8e decides the app should open with one
 * layer rather than an empty stack, this default moves to 1 with it.
 *
 * `max` is a declared proof ceiling (see above). 16 is chosen as an authoring
 * depth a shader stack can plausibly reach while every layer still recompiles
 * into one readable program; it is not derived from a measurement, and a
 * measurement is exactly what could later move it.
 */
const STUDIO_STACK_DEPTH = {
  defaultValue: 0,
  max: 16,
} as const;

const STACK_DEPTH_ENTRIES = Array.from(
  { length: STUDIO_STACK_DEPTH.max + 1 },
  (_unused, depth) => ({ appliedValue: depth, value: depth }),
);

export const appPerformance: ToolcraftEnvelopePerformanceConfig =
  defineToolcraftPerformance({
    fixtureAdapters: {
      dimensions: {
        // A slider's applied value is the value; nothing to convert.
        "band-count": {
          apply: (value: number) => value,
          dimensionId: "band-count",
          observe: (value: number) => value,
        },
        // A stepped slider over ten whole positions; the applied value is the
        // value, as with the band count.
        "polygon-sides": {
          apply: (value: number) => value,
          dimensionId: "polygon-sides",
          observe: (value: number) => value,
        },
        // Finite runtime-state source, so the domain is exhaustive rather than
        // continuous: the fixture builds a stack of exactly this many layers,
        // and a fractional depth is not a state the product can be in.
        "stack-depth": {
          apply: (value: number) => value,
          dimensionId: "stack-depth",
          domain: {
            attestation:
              "Stack depth is the length of the runtime layer array. Every integer from the empty stack to the declared proof ceiling is reachable by adding layers through the runtime layers panel, and no other value exists.",
            kind: "runtime-state",
            path: "layers",
          },
          entries: STACK_DEPTH_ENTRIES,
          kind: "exhaustive-discrete",
          observe: (value: number) => value,
        },
      },
    },
    rendererPipeline: studioPipelineRegistration,
    rendererStrategy: "webgl",
    rendererTechnique: {
      exportRenderer: "webgl",
      fidelityRisks: [
        "Stacked bands alias at high counts. Boundaries resolve analytically from screen-space derivatives rather than by supersampling, so the ceiling is the Nyquist limit against pixel pitch; a deeper stack does not lower that limit, it repeats it per layer.",
        "Compositing happens in linear light, so an author who expects sRGB-space blending will read overlaps as brighter than intended. This is the same trade Croix10 made, and it is what makes additive overlap correct.",
      ],
      intentionalRasterizationReason:
        "Each layer is a continuous per-pixel colour field, and the composite of several is still one. There is no vector original being rasterized; the product's exportable non-raster artifact is the assembled shader source, which group 7 delivers as text rather than as a renderer.",
      layers: [
        {
          content: ["shader"],
          exportMode: "included",
          id: "layer-stack",
          kind: "product-foreground",
          primitiveCount: "low",
          renderer: "webgl",
          uiSelector: "[data-toolcraft-product-output]",
        },
      ],
      performanceRisks: [
        "Stack depth is the cost concentration: every visible layer adds a body call and a composite step to every pixel, so the deep end of the envelope is where the budget is spent.",
        "A stack edit changes the program signature and forces a recompile (R54 keys the program cache on that signature). The recompile is inherent to the feature under every uniform scheme considered in R52, so it must be absorbed by cache lifetime and scheduling rather than by degrading output.",
      ],
      previewRenderer: "webgl",
      productRepresentation: "pixel",
      rendererStrategy: "webgl",
      sourceRepresentation: "procedural-data",
      whyNotAlternativeStrategies: [
        "Canvas 2D: the output is per-pixel field math whose boundaries are antialiased from screen-space derivatives, and compositing an arbitrary stack of such fields per pixel in JavaScript forfeits both the antialiasing and the frame budget.",
        "SVG or DOM: cannot express a per-pixel field at all, let alone a stack of them composited in linear light.",
        "WebGPU: no coverage advantage over WebGL2 for these passes, and the assembled-source artifact this product delivers targets one GLSL dialect.",
      ],
    },
    // One scenario per derived canonical path. The path ids are products of
    // `deriveToolcraftPerformancePaths` rather than hand-authored strings, and
    // `coversTargets` equals each path's exact target set — the two are checked
    // against each other, so a widened invalidation list must be reflected here.
    scenarios: [
      {
        automated: true,
        automatedTestName:
          "declares the initial render path resolves the stack once at mount",
        browser: true,
        browserTestName:
          "browser perf: shader studio initial render resolves the layer stack",
        coversTargets: [...STUDIO_SCENE_TARGETS],
        expectedObservable:
          "The composited stack is visible on first paint with the seeded stripes layer.",
        fixture: "a single stripes layer at the band-count default",
        id: "perf.initial-render",
        interaction: "initial-render",
        pathId:
          "performance-path:%5B%22initial-render%22%2C%22initial-render%22%2C%5B%22layer-stack%22%5D%2C%5B%22gpu%22%5D%2C%5B%22band-count%22%2C%22polygon-sides%22%2C%22stack-depth%22%5D%5D",
        uiSelector: "[data-toolcraft-product-output]",
      },
      {
        automated: true,
        automatedTestName:
          "declares the control change path re-resolves the stack for discrete edits",
        browser: true,
        browserTestName:
          "browser perf: shader studio control change re-resolves the layer stack",
        coversTargets: [...STUDIO_SCENE_TARGETS, "canvas.renderScale"],
        expectedObservable:
          "Committing a control edit produces a changed composite without recompiling an unchanged stack signature.",
        fixture: "a single stripes layer at the band-count default",
        id: "perf.control-change",
        interaction: "control-change",
        pathId:
          "performance-path:%5B%22interactive-discrete%22%2C%22control-change%22%2C%5B%22layer-stack%22%5D%2C%5B%22gpu%22%5D%2C%5B%22band-count%22%2C%22polygon-sides%22%2C%22stack-depth%22%5D%5D",
        uiSelector: "[data-toolcraft-product-output]",
      },
      {
        automated: true,
        automatedTestName:
          "declares the control drag path stays live through the gesture",
        browser: true,
        browserTestName:
          "browser perf: shader studio band count drag stays live through the gesture",
        controlLabel: "Band count",
        coversTargets: [...STUDIO_DRAGGABLE_TARGETS],
        expectedObservable:
          "The composite updates continuously while the band count thumb is dragged, before pointer release.",
        fixture: "a single stripes layer at the band-count default",
        id: "perf.control-drag",
        interaction: "control-drag",
        pathId:
          "performance-path:%5B%22interactive-continuous%22%2C%22control-drag%22%2C%5B%22layer-stack%22%5D%2C%5B%22gpu%22%5D%2C%5B%22band-count%22%2C%22polygon-sides%22%2C%22stack-depth%22%5D%5D",
        target: "selectedLayer.count",
        uiSelector: "[data-toolcraft-product-output]",
      },
      {
        automated: true,
        automatedTestName:
          "declares the viewport drag path keeps the stack resident",
        browser: true,
        browserTestName:
          "browser perf: shader studio viewport drag keeps the layer stack resident",
        coversTargets: ["canvas.offset"],
        expectedObservable:
          "Panning moves the viewport without re-resolving the stack, and canvas zoom and offset stay stable afterwards.",
        fixture: "a single stripes layer at the band-count default",
        id: "perf.viewport-drag",
        interaction: "viewport-drag",
        pathId:
          "performance-path:%5B%22interactive-continuous%22%2C%22viewport-drag%22%2C%5B%5D%2C%5B%5D%2C%5B%5D%5D",
        uiSelector: "[data-toolcraft-product-output]",
      },
      {
        automated: true,
        automatedTestName:
          "declares the viewport zoom path keeps the stack resident",
        browser: true,
        browserTestName:
          "browser perf: shader studio viewport zoom keeps the layer stack resident",
        coversTargets: ["canvas.zoom"],
        expectedObservable:
          "Zoom magnifies the presented frame without re-resolving the stack.",
        fixture: "a single stripes layer at the band-count default",
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
          "browser perf: shader studio image export renders one deterministic frame",
        completionEvidence: "download",
        controlLabel: "Export PNG",
        coversTargets: ["export.image.format", "export.image.resolution"],
        expectedObservable:
          "Exporting produces a decodable artifact at the selected resolution containing the composited stack.",
        fixture: "a single stripes layer at the band-count default",
        id: "perf.export-image",
        interaction: "export",
        pathId:
          "performance-path:%5B%22batch-responsive%22%2C%22export%22%2C%5B%22layer-stack%22%5D%2C%5B%22gpu%22%5D%2C%5B%22band-count%22%2C%22polygon-sides%22%2C%22stack-depth%22%5D%5D",
        uiSelector: "[data-toolcraft-product-output]",
      },
    ],
    usesCustomRenderer: true,
    workloadEnvelope: {
      dimensions: [
        {
          // Both profiles: the stack is drawn every preview frame and again for
          // a batch export, and depth reaches the cost of both.
          batchMax: STUDIO_STACK_DEPTH.max,
          defaultValue: STUDIO_STACK_DEPTH.defaultValue,
          id: "stack-depth",
          interactiveMax: STUDIO_STACK_DEPTH.max,
          mapping: "direct",
          source: {
            kind: "runtime-state",
            path: "layers",
          },
          unit: "layers",
        },
        {
          batchMax: STUDIO_BAND_COUNT.max,
          defaultValue: STUDIO_BAND_COUNT.defaultValue,
          id: "band-count",
          interactiveMax: STUDIO_BAND_COUNT.max,
          mapping: "direct",
          source: {
            kind: "schema-target",
            target: "selectedLayer.count",
            workloadBoundary: "maximum",
          },
          unit: "bands",
        },
        {
          // Declared because the pass reads it and path coverage derives from
          // this list, and constant in exactly the way `band-count` is: the
          // polygon test folds its angle into one wedge, so the side count
          // changes the shape rather than the work. The free vertex list the
          // pen brings (14.4) is the one that will genuinely vary this, and it
          // is a different source than a slider endpoint.
          batchMax: STUDIO_REGION_SIDES.max,
          defaultValue: STUDIO_REGION_SIDES.defaultValue,
          id: "polygon-sides",
          interactiveMax: STUDIO_REGION_SIDES.max,
          mapping: "direct",
          source: {
            kind: "schema-target",
            target: "selectedLayer.maskSides",
            workloadBoundary: "maximum",
          },
          unit: "sides",
        },
      ],
    },
  });
