/**
 * Colour-source sections: the chromatic ramp and the cursor field that pushes it.
 *
 * Split from `app-schema.ts` for the reason the engine sections are: that file is
 * the schema assembly and holds its line budget only while section bodies live
 * beside the entities they describe.
 *
 * These two are one story. The ramp decides where band colour comes from; the
 * cursor field decides how the pointer disturbs it, which is meaningless unless
 * the ramp is the active source — so its controls are conditional on both.
 */

import {
  PROXIMITY_APPLICABILITY,
  RAMP_APPLICABILITY,
} from "./croix10-applicability";
import {
  CROIX10_DEFAULT_RAMP,
  CROIX10_DRIFT_CYCLES,
  CROIX10_PROXIMITY_RADIUS,
  CROIX10_PROXIMITY_STRENGTH,
  CROIX10_RAMP_PHASE,
} from "./croix10-parameters";

export const CROIX10_COLOUR_SOURCE_SECTIONS = [
      // The ramp: a second colour source for the same stripe field.
      //
      // One section rather than two because `source` gates the rest, and R34
      // puts a gate in the entity it governs (R43). There is deliberately no
      // mapping or angle control here: the gradient owns its own type and
      // angle, and reproducing either as a sibling is what R23 forbids.
      {
        controls: {
          source: {
            applicability: { mode: "always" },
            defaultValue: "palette",
            label: "Band colour",
            options: [
              { label: "Palette", value: "palette" },
              { label: "Continuous", value: "continuous" },
            ],
            performanceReason:
              "The source selects which colour lookup the existing engine pass runs; both are constant cost per pixel.",
            performanceRole: "responsiveness",
            target: "ramp.source",
            type: "select",
          },
          ramp: {
            applicability: RAMP_APPLICABILITY,
            // Angle 0 runs the ramp across the bands, which is the arrangement
            // the source plates use. At 90 the ramp would run along them, and
            // since a band is sampled once at its centreline every band would
            // take the same colour — a flat wash rather than a transition.
            defaultValue: {
              angle: 0,
              gradientType: "linear",
              stops: CROIX10_DEFAULT_RAMP,
            },
            label: "Colour transition",
            performanceReason:
              "Stops upload as a small uniform array read once per band.",
            performanceRole: "responsiveness",
            target: "ramp.gradient",
            type: "gradient",
          },
          interpolationSpace: {
            applicability: RAMP_APPLICABILITY,
            defaultValue: "linear",
            label: "Mixing",
            options: [
              { label: "Linear light", value: "linear" },
              { label: "sRGB", value: "srgb" },
            ],
            performanceReason:
              "The space adds two conversions inside one existing lookup.",
            performanceRole: "responsiveness",
            target: "ramp.interpolationSpace",
            type: "select",
          },
          phase: {
            applicability: RAMP_APPLICABILITY,
            defaultValue: CROIX10_RAMP_PHASE.defaultValue,
            label: "Offset",
            max: CROIX10_RAMP_PHASE.max,
            min: CROIX10_RAMP_PHASE.min,
            performanceReason:
              "The offset shifts the ramp lookup inside the existing engine pass.",
            performanceRole: "responsiveness",
            sliderValueKind: "continuous",
            step: CROIX10_RAMP_PHASE.step,
            target: "ramp.phase",
            type: "slider",
          },
          driftCycles: {
            applicability: RAMP_APPLICABILITY,
            defaultValue: CROIX10_DRIFT_CYCLES.defaultValue,
            label: "Drift",
            max: CROIX10_DRIFT_CYCLES.max,
            min: CROIX10_DRIFT_CYCLES.min,
            performanceReason:
              "Drift resolves into the same offset the ramp lookup already reads; no extra work per frame.",
            performanceRole: "responsiveness",
            sliderValueKind: "discrete",
            step: CROIX10_DRIFT_CYCLES.step,
            target: "ramp.driftCycles",
            type: "slider",
            variant: "discrete",
          },
        },
        id: "chromatic-ramp",
        title: "Chromatic Ramp",
      },
      // Cursor field: how the ramp answers the pointer approaching.
      //
      // The panel owns the field's shape only. Where it is centred is written by
      // the canvas on gesture end and has no control here, because a pad for a
      // pointer position is both a mirrored capability and a named wrong
      // substitution (R44). The enable switch sits with what it gates (R34).
      {
        controls: {
          enabled: {
            applicability: RAMP_APPLICABILITY,
            defaultValue: false,
            label: "Follow the cursor",
            performanceReason:
              "The switch collapses the displacement to zero inside the existing ramp lookup.",
            performanceRole: "responsiveness",
            target: "proximity.enabled",
            type: "switch",
          },
          radius: {
            applicability: PROXIMITY_APPLICABILITY,
            defaultValue: CROIX10_PROXIMITY_RADIUS.defaultValue,
            label: "Reach",
            max: CROIX10_PROXIMITY_RADIUS.max,
            min: CROIX10_PROXIMITY_RADIUS.min,
            performanceReason:
              "The radius bounds one distance comparison per band.",
            performanceRole: "responsiveness",
            sliderValueKind: "continuous",
            step: CROIX10_PROXIMITY_RADIUS.step,
            target: "proximity.radius",
            type: "slider",
          },
          strength: {
            applicability: PROXIMITY_APPLICABILITY,
            defaultValue: CROIX10_PROXIMITY_STRENGTH.defaultValue,
            label: "Push",
            max: CROIX10_PROXIMITY_STRENGTH.max,
            min: CROIX10_PROXIMITY_STRENGTH.min,
            performanceReason:
              "The strength scales a value the ramp lookup already adds.",
            performanceRole: "responsiveness",
            sliderValueKind: "continuous",
            step: CROIX10_PROXIMITY_STRENGTH.step,
            target: "proximity.strength",
            type: "slider",
          },
          falloff: {
            applicability: PROXIMITY_APPLICABILITY,
            defaultValue: "smooth",
            label: "Falls off",
            options: [
              { label: "Evenly", value: "linear" },
              { label: "Gently", value: "smooth" },
              { label: "Sharply", value: "tight" },
            ],
            performanceReason:
              "The falloff selects one curve inside the existing displacement.",
            performanceRole: "responsiveness",
            target: "proximity.falloff",
            type: "select",
          },
        },
        id: "cursor-field",
        title: "Cursor Field",
      },
] as const;
