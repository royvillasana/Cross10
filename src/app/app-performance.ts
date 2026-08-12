import {
  defineToolcraftPerformance,
  type ToolcraftEnvelopePerformanceConfig,
} from "@/toolcraft/runtime";

import { STUDIO_BAND_COUNT } from "./studio-layer-sections";
import { studioPipelineRegistration } from "./studio-pipeline";

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
    scenarios: [],
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
      ],
    },
  });
