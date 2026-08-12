/**
 * Per-layer control sections.
 *
 * Split from `app-schema.ts` for the reason Croix10 splits its sections: that
 * file is the schema assembly, and it holds its line budget only while section
 * bodies live beside the entities they describe.
 *
 * One section, not two. An entity with ten or fewer controls must stay in a
 * single section — splitting `selected-layer` across two was rejected outright,
 * and the same rule forbids the workflow-shaped split that was tried first.
 *
 * That also settles where the gate goes. `selectedLayer.type` has to sit beside
 * the controls it gates (R34, which is scoped to the section rather than the
 * entity), and with one section there is nowhere else for it to be.
 *
 * Nine controls oblige a declared `semanticGroup` on every one of them, so
 * cohesion is checked from typed intent rather than guessed from labels. Three
 * clusters: what the layer is and how it sits in the composite, its two colours,
 * and how its kind draws.
 *
 * Titles name the entity, never the branch. Neither equals, contains, nor is
 * contained by "Stripes" or "Gradient", which are the gate's option labels (R33).
 */

const STRIPES_APPLICABILITY = {
  all: [{ oneOf: ["stripes"], target: "selectedLayer.type" }],
  mode: "conditional",
} as const;

const GRADIENT_APPLICABILITY = {
  all: [{ oneOf: ["gradient"], target: "selectedLayer.type" }],
  mode: "conditional",
} as const;

/**
 * The band count's numeric domain, exported because `app-performance.ts` builds
 * the `band-count` workload dimension from it. A schema-backed workload boundary
 * must equal the schema endpoint, so the two cannot be allowed to drift: one
 * literal, read by both the control and the envelope.
 */
export const STUDIO_BAND_COUNT = {
  defaultValue: 24,
  max: 200,
  min: 1,
} as const;

export const STUDIO_LAYER_SECTIONS = [
  {
    controls: {
      opacity: {
        semanticGroup: "composition",
        applicability: { mode: "always" },
        defaultValue: 1,
        label: "Opacity",
        max: 1,
        min: 0,
        performanceReason:
          "Opacity folds into the composite weight the blend already applies.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "selectedLayer.opacity",
        type: "slider",
      },
      angle: {
        semanticGroup: "composition",
        applicability: { mode: "always" },
        defaultValue: 0,
        label: "Angle",
        max: 180,
        min: 0,
        performanceReason:
          "The angle rotates a coordinate inside the existing per-pixel body.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 1,
        target: "selectedLayer.angle",
        type: "slider",
      },
      colorA: {
        semanticGroup: "colour",
        applicability: { mode: "always" },
        defaultValue: "#ffffff",
        label: "First colour",
        performanceReason: "A colour uploads as one vec3 read once per pixel.",
        performanceRole: "responsiveness",
        target: "selectedLayer.colorA",
        type: "color",
      },
      colorB: {
        semanticGroup: "colour",
        applicability: { mode: "always" },
        defaultValue: "#000000",
        label: "Second colour",
        performanceReason: "A colour uploads as one vec3 read once per pixel.",
        performanceRole: "responsiveness",
        target: "selectedLayer.colorB",
        type: "color",
      },
    },
    id: "selected-layer",
    title: "Selected Layer",
  },
  {
    controls: {
      type: {
        semanticGroup: "composition",
        applicability: { mode: "always" },
        defaultValue: "stripes",
        // The runtime layer model has no field for a product layer type
        // (R56), so this control is where a layer's type actually lives.
        label: "Layer kind",
        options: [
          { label: "Stripes", value: "stripes" },
          { label: "Gradient", value: "gradient" },
        ],
        // Not `workload`, for two reasons that agree. Structurally, a select
        // over string options is not a numeric schema source — it declares no
        // finite `min`/`max`/numeric default — so it cannot back a workload
        // dimension, and every explicit workload control must map to exactly
        // one. Substantively, the reason below is the argument against it: each
        // body is a constant per-pixel cost, so the kind changes *which* work
        // happens, never *how much*. Switching kind must stay responsive, which
        // is what this role claims.
        performanceReason:
          "The kind selects which body the assembled program calls; each is a constant per-pixel cost.",
        performanceRole: "responsiveness",
        target: "selectedLayer.type",
        type: "select",
      },
      count: {
        semanticGroup: "pattern",
        applicability: STRIPES_APPLICABILITY,
        defaultValue: STUDIO_BAND_COUNT.defaultValue,
        label: "Band count",
        max: STUDIO_BAND_COUNT.max,
        min: STUDIO_BAND_COUNT.min,
        // Boundaries resolve analytically from the screen-space derivative
        // rather than by supersampling, so per-pixel cost does not vary with
        // the count. The ceiling is the Nyquist limit against pixel pitch, not
        // a performance bound.
        performanceReason:
          "Band count changes the field's frequency, not the work per pixel.",
        performanceRole: "workload",
        sliderValueKind: "discrete",
        step: 1,
        target: "selectedLayer.count",
        // Stepped continuous rather than `variant: "discrete"`: 200 positions
        // would render 200 tick markers, which reads as noise rather than as
        // the whole-number steps the value actually takes.
        type: "slider",
      },
      mirror: {
        semanticGroup: "pattern",
        applicability: STRIPES_APPLICABILITY,
        defaultValue: false,
        label: "Mirror",
        performanceReason:
          "Folding the coordinate costs the same whether the switch is on or off; there is no branch.",
        performanceRole: "responsiveness",
        target: "selectedLayer.mirror",
        type: "switch",
      },
      separator: {
        semanticGroup: "pattern",
        applicability: STRIPES_APPLICABILITY,
        defaultValue: 0,
        label: "Band separator",
        max: 0.4,
        min: 0,
        performanceReason:
          "The gap is one smoothstep against the distance already computed for the band edge.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "selectedLayer.separator",
        type: "slider",
      },
      jitterAmount: {
        semanticGroup: "pattern",
        applicability: STRIPES_APPLICABILITY,
        defaultValue: 0,
        label: "Jitter",
        max: 0.9,
        min: 0,
        performanceReason:
          "One hash and one add inside the body already computing the position.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "selectedLayer.jitterAmount",
        type: "slider",
      },
      taper: {
        semanticGroup: "pattern",
        applicability: STRIPES_APPLICABILITY,
        defaultValue: 0,
        label: "Taper",
        max: 1,
        min: -1,
        performanceReason:
          "One multiply and add against a coordinate the body already has.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "selectedLayer.taper",
        type: "slider",
      },
widthRatio: {
        semanticGroup: "pattern",
        applicability: STRIPES_APPLICABILITY,
        defaultValue: 0.5,
        label: "Band width",
        max: 0.95,
        min: 0.05,
        performanceReason:
          "The ratio moves one threshold inside the existing band lookup.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "selectedLayer.widthRatio",
        type: "slider",
      },
      phase: {
        semanticGroup: "pattern",
        applicability: STRIPES_APPLICABILITY,
        defaultValue: 0,
        label: "Offset",
        max: 1,
        min: 0,
        performanceReason:
          "The offset shifts the band lookup inside the existing body.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "selectedLayer.phase",
        type: "slider",
      },
      rampType: {
        semanticGroup: "pattern",
        applicability: GRADIENT_APPLICABILITY,
        defaultValue: "linear",
        label: "Transition shape",
        options: [
          { label: "Linear", value: "linear" },
          { label: "Radial", value: "radial" },
          { label: "Angular", value: "angular" },
        ],
        performanceReason:
          "Each shape is one coordinate expression inside the same body.",
        performanceRole: "responsiveness",
        target: "selectedLayer.rampType",
        type: "select",
      },
    },
    id: "selected-layer-pattern",
    title: "Layer Pattern",
  },
] as const;
