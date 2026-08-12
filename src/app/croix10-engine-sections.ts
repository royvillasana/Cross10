/**
 * Panel sections owned by individual engines.
 *
 * Split from the schema assembly so both files stay within their line budget as
 * engines land. These sections are all conditional on engine selection, so they are
 * the part of the panel that changes most as the studio grows, while the assembly
 * itself stays a readable outline of the app.
 */

import {
  CROIX10_DEFAULT_PLANES,
  CROIX10_DRIFT_CYCLES,
  CROIX10_FRINGE_INTENSITY,
  CROIX10_FRINGE_WIDTH,
  CROIX10_IMMERSION_BALANCE,
  CROIX10_IMMERSION_SPREAD,
  CROIX10_INDUCTION_FREQUENCY,
  CROIX10_INTERFERENCE_ANGLE_OFFSET,
  CROIX10_INTERFERENCE_PHASE_OFFSET,
  CROIX10_INTERFERENCE_PITCH_RATIO,
  CROIX10_INTERFERENCE_WIDTH_RATIO,
  CROIX10_MAX_PLANES,
  CROIX10_MIN_PLANES,
  CROIX10_PLANE_OFFSET,
  CROIX10_PLANE_OPACITY,
  CROIX10_PLANE_ROTATION,
  CROIX10_VIEWER_ANGLE,
  CROIX10_VIEWER_PARALLAX,
} from "./croix10-parameters";
import {
  INTERFERENCE_ACTIVE_APPLICABILITY,
  STRIPE_ENGINE_APPLICABILITY,
  engineApplicability,
} from "./croix10-applicability";

export const CROIX10_ENGINE_SECTIONS = [
        {
          controls: {
            planes: {
              applicability: engineApplicability("transchromie"),
              addLabel: "Add plane",
              defaultValue: CROIX10_DEFAULT_PLANES.map((plane) => ({
                ...plane,
                offset: { ...plane.offset },
              })),
              hardMaxItems: CROIX10_MAX_PLANES,
              itemControls: {
                color: {
                  defaultValue: CROIX10_DEFAULT_PLANES[0].color,
                  type: "color",
                },
                opacity: {
                  defaultValue: CROIX10_PLANE_OPACITY.defaultValue,
                  max: CROIX10_PLANE_OPACITY.max,
                  min: CROIX10_PLANE_OPACITY.min,
                  sliderValueKind: "continuous",
                  step: CROIX10_PLANE_OPACITY.step,
                  type: "slider",
                },
                offset: {
                  defaultValue: { x: 0, y: 0 },
                  max: CROIX10_PLANE_OFFSET.max,
                  min: CROIX10_PLANE_OFFSET.min,
                  step: CROIX10_PLANE_OFFSET.step,
                  type: "vector",
                },
                rotation: {
                  defaultValue: CROIX10_PLANE_ROTATION.defaultValue,
                  max: CROIX10_PLANE_ROTATION.max,
                  min: CROIX10_PLANE_ROTATION.min,
                  sliderValueKind: "continuous",
                  step: CROIX10_PLANE_ROTATION.step,
                  type: "slider",
                  unit: "\u00B0",
                },
              },
              itemLabel: "Plane",
              label: "Planes",
              minItems: CROIX10_MIN_PLANES,
              performanceReason:
                "Plane count sets how many filter terms the fragment accumulates; the loop is bounded by the schema maximum and each term is constant cost.",
              performanceRole: "responsiveness",
              target: "transchromie.planes",
              type: "collectionActions",
            },
          },
          id: "translucent-planes",
          title: "Translucent Planes",
        },
        {
          controls: {
            blendMode: {
              applicability: engineApplicability("transchromie"),
              defaultValue: "subtractive",
              description:
                "Whether the sheets filter light or add it. Subtractive multiplies transmittances against a white ground, which is what stacked colour gels actually do; additive sums them against a dark one.",
              label: "Stacking",
              options: [
                { label: "Subtractive", value: "subtractive" },
                { label: "Additive", value: "additive" },
              ],
              performanceReason:
                "The mode selects one arithmetic expression per plane per pixel.",
              performanceRole: "responsiveness",
              target: "transchromie.blendMode",
              type: "select",
            },
          },
          id: "plane-stacking",
          title: "Plane Stacking",
        },
        {
          controls: {
            angle: {
              applicability: engineApplicability("physichromie"),
              defaultValue: CROIX10_VIEWER_ANGLE.defaultValue,
              description:
                "Where the viewer stands. Sweeping it moves the composition through its colour states the way walking past the physical relief does.",
              label: "Viewing angle",
              max: CROIX10_VIEWER_ANGLE.max,
              min: CROIX10_VIEWER_ANGLE.min,
              performanceReason:
                "The viewing angle shears a slot selection inside the existing engine branch.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_VIEWER_ANGLE.step,
              target: "viewer.angle",
              type: "slider",
              unit: "°",
            },
            parallax: {
              applicability: engineApplicability("physichromie"),
              defaultValue: CROIX10_VIEWER_PARALLAX.defaultValue,
              description:
                "How deep the strip modules stand off the backing, which sets how strongly the angle shifts colour.",
              label: "Depth",
              max: CROIX10_VIEWER_PARALLAX.max,
              min: CROIX10_VIEWER_PARALLAX.min,
              performanceReason:
                "Depth scales the same shear term without adding work.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_VIEWER_PARALLAX.step,
              target: "viewer.parallax",
              type: "slider",
            },
          },
          id: "viewer-parallax",
          title: "Viewer Parallax",
        },
        {
          controls: {
            frequency: {
              applicability: engineApplicability("induction"),
              defaultValue: CROIX10_INDUCTION_FREQUENCY.defaultValue,
              description:
                "Line pairs across the composition. The maximum is the Nyquist limit for the pixel grid, above which the pairs cannot be resolved.",
              label: "Line pairs",
              max: CROIX10_INDUCTION_FREQUENCY.max,
              min: CROIX10_INDUCTION_FREQUENCY.min,
              performanceReason:
                "Line-pair frequency divides a coordinate; per-pixel cost does not vary with it, so it bounds fidelity rather than frame cost.",
              performanceRole: "workload",
              sliderValueKind: "continuous",
              step: CROIX10_INDUCTION_FREQUENCY.step,
              target: "induction.frequency",
              type: "slider",
            },
            fringeWidth: {
              applicability: engineApplicability("induction"),
              defaultValue: CROIX10_FRINGE_WIDTH.defaultValue,
              label: "Fringe width",
              max: CROIX10_FRINGE_WIDTH.max,
              min: CROIX10_FRINGE_WIDTH.min,
              performanceReason:
                "Fringe width is compared against a coordinate the branch already computed.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_FRINGE_WIDTH.step,
              target: "induction.fringeWidth",
              type: "slider",
            },
            fringeIntensity: {
              applicability: engineApplicability("induction"),
              defaultValue: CROIX10_FRINGE_INTENSITY.defaultValue,
              description:
                "How strongly the complementary colour appears along each boundary.",
              label: "Fringe strength",
              max: CROIX10_FRINGE_INTENSITY.max,
              min: CROIX10_FRINGE_INTENSITY.min,
              performanceReason:
                "Fringe strength mixes two colours already resolved in the branch.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_FRINGE_INTENSITY.step,
              target: "induction.fringeIntensity",
              type: "slider",
            },
          },
          id: "afterimage-fringe",
          title: "Afterimage Fringe",
        },
        {
          controls: {
            spread: {
              applicability: engineApplicability("chromosaturation"),
              defaultValue: CROIX10_IMMERSION_SPREAD.defaultValue,
              description:
                "How far the colour transition reaches across the field. Narrow spreads concentrate the change; wide spreads immerse the whole canvas.",
              label: "Spread",
              max: CROIX10_IMMERSION_SPREAD.max,
              min: CROIX10_IMMERSION_SPREAD.min,
              performanceReason:
                "Spread scales one coordinate inside the immersion branch.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_IMMERSION_SPREAD.step,
              target: "immersion.spread",
              type: "slider",
            },
            balance: {
              applicability: engineApplicability("chromosaturation"),
              defaultValue: CROIX10_IMMERSION_BALANCE.defaultValue,
              label: "Balance",
              max: CROIX10_IMMERSION_BALANCE.max,
              min: CROIX10_IMMERSION_BALANCE.min,
              performanceReason:
                "Balance offsets the same coordinate without adding work.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_IMMERSION_BALANCE.step,
              target: "immersion.balance",
              type: "slider",
            },
            driftCycles: {
              applicability: engineApplicability("chromosaturation"),
              defaultValue: CROIX10_DRIFT_CYCLES.defaultValue,
              description:
                "Whole sweeps of the transition across the field per loop. Zero holds the field still; the timeline plays the sweep.",
              label: "Drift",
              max: CROIX10_DRIFT_CYCLES.max,
              min: CROIX10_DRIFT_CYCLES.min,
              performanceReason:
                "Drift resolves to the balance uniform the immersion branch already reads; the frame cost is unchanged.",
              performanceRole: "responsiveness",
              sliderValueKind: "discrete",
              step: CROIX10_DRIFT_CYCLES.step,
              target: "immersion.driftCycles",
              type: "slider",
              variant: "discrete",
            },
          },
          id: "field-immersion",
          title: "Field Immersion",
        },
        {
          controls: {
            enabled: {
              applicability: engineApplicability("chromointerference"),
              defaultValue: true,
              description:
                "Prints a second stripe structure over the first. What you see is the beat between them, not either layer alone.",
              label: "Second layer",
              performanceReason:
                "The layer is a compiled shader variant, so switching it off removes the code path instead of branching around it.",
              performanceRole: "responsiveness",
              target: "interference.enabled",
              type: "switch",
            },
            pitchRatio: {
              applicability: INTERFERENCE_ACTIVE_APPLICABILITY,
              defaultValue: CROIX10_INTERFERENCE_PITCH_RATIO.defaultValue,
              description:
                "The second layer's density relative to the first. The moiré period is widest near 1 and tightens as the ratio moves away from it.",
              label: "Pitch ratio",
              max: CROIX10_INTERFERENCE_PITCH_RATIO.max,
              min: CROIX10_INTERFERENCE_PITCH_RATIO.min,
              performanceReason:
                "The ratio scales one density inside the two-layer variant; density does not drive per-pixel cost.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_INTERFERENCE_PITCH_RATIO.step,
              target: "interference.pitchRatio",
              type: "slider",
            },
            angleOffset: {
              applicability: INTERFERENCE_ACTIVE_APPLICABILITY,
              defaultValue: CROIX10_INTERFERENCE_ANGLE_OFFSET.defaultValue,
              label: "Angle offset",
              max: CROIX10_INTERFERENCE_ANGLE_OFFSET.max,
              min: CROIX10_INTERFERENCE_ANGLE_OFFSET.min,
              performanceReason:
                "The offset rotates the second layer's coordinate, which is two multiplies.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_INTERFERENCE_ANGLE_OFFSET.step,
              target: "interference.angleOffset",
              type: "slider",
              unit: "\u00B0",
            },
            phaseOffset: {
              applicability: INTERFERENCE_ACTIVE_APPLICABILITY,
              defaultValue: CROIX10_INTERFERENCE_PHASE_OFFSET.defaultValue,
              description:
                "Slides the second layer along its own axis, which translates the beat without changing its period.",
              label: "Phase offset",
              max: CROIX10_INTERFERENCE_PHASE_OFFSET.max,
              min: CROIX10_INTERFERENCE_PHASE_OFFSET.min,
              performanceReason:
                "The offset adds a constant to one coordinate.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_INTERFERENCE_PHASE_OFFSET.step,
              target: "interference.phaseOffset",
              type: "slider",
            },
            widthRatio: {
              applicability: INTERFERENCE_ACTIVE_APPLICABILITY,
              defaultValue: CROIX10_INTERFERENCE_WIDTH_RATIO.defaultValue,
              description:
                "How much of each period the second layer prints. Below one it leaves windows the layer beneath shows through.",
              label: "Layer coverage",
              max: CROIX10_INTERFERENCE_WIDTH_RATIO.max,
              min: CROIX10_INTERFERENCE_WIDTH_RATIO.min,
              performanceReason:
                "Coverage scales the same occupancy term the primary layer already computes.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_INTERFERENCE_WIDTH_RATIO.step,
              target: "interference.widthRatio",
              type: "slider",
            },
            blendMode: {
              applicability: INTERFERENCE_ACTIVE_APPLICABILITY,
              defaultValue: "normal",
              description:
                "How the two layers combine. Blending is in linear light, so additive really adds and difference is black where the layers agree.",
              label: "Blend",
              options: [
                { label: "Normal", value: "normal" },
                { label: "Multiply", value: "multiply" },
                { label: "Screen", value: "screen" },
                { label: "Difference", value: "difference" },
                { label: "Additive", value: "additive" },
              ],
              performanceReason:
                "The mode selects one arithmetic expression per pixel.",
              performanceRole: "responsiveness",
              target: "interference.blendMode",
              type: "select",
            },
            driftCycles: {
              applicability: INTERFERENCE_ACTIVE_APPLICABILITY,
              defaultValue: CROIX10_DRIFT_CYCLES.defaultValue,
              description:
                "Whole sequence periods the second layer travels per loop. The beat translates while its period stays put. Zero holds the moiré still.",
              label: "Drift",
              max: CROIX10_DRIFT_CYCLES.max,
              min: CROIX10_DRIFT_CYCLES.min,
              performanceReason:
                "Drift resolves to the phase-offset uniform the two-layer variant already reads.",
              performanceRole: "responsiveness",
              sliderValueKind: "discrete",
              step: CROIX10_DRIFT_CYCLES.step,
              target: "interference.driftCycles",
              type: "slider",
              variant: "discrete",
            },
          },
          id: "interference-layer",
          title: "Interference Layer",
        },
] as const;
