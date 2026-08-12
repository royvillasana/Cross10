import { defineToolcraft } from "@/toolcraft/runtime";

import {
  SHAPE_ACTIVE_APPLICABILITY,
  STRIPE_ENGINE_APPLICABILITY,
} from "./croix10-applicability";
import { CROIX10_COLOUR_SOURCE_SECTIONS } from "./croix10-colour-sections";
import { CROIX10_ENGINE_SECTIONS } from "./croix10-engine-sections";
import { CROIX10_PRESETS } from "./croix10-presets";

import { appIdentity } from "./app-identity";
import {
  CROIX10_ANGLE,
  CROIX10_FRINGE_INTENSITY,
  CROIX10_FRINGE_WIDTH,
  CROIX10_IMMERSION_BALANCE,
  CROIX10_IMMERSION_SPREAD,
  CROIX10_INTERFERENCE_ANGLE_OFFSET,
  CROIX10_INTERFERENCE_PHASE_OFFSET,
  CROIX10_INTERFERENCE_PITCH_RATIO,
  CROIX10_INTERFERENCE_WIDTH_RATIO,
  CROIX10_INDUCTION_FREQUENCY,
  CROIX10_STRIPE_ENGINES,
  CROIX10_VIEWER_ANGLE,
  CROIX10_VIEWER_PARALLAX,
  CROIX10_BACKGROUND_COLOR,
  CROIX10_CYCLING_OFFSET,
  CROIX10_DEFAULT_PALETTE,
  CROIX10_DEFAULT_PLANES,
  CROIX10_DRIFT_CYCLES,
  CROIX10_JITTER_AMOUNT,
  CROIX10_LOOP_DURATION_SECONDS,
  CROIX10_JITTER_FREQUENCY,
  CROIX10_MAX_PALETTE_SLOTS,
  CROIX10_MAX_PLANES,
  CROIX10_MIN_PALETTE_SLOTS,
  CROIX10_MIN_PLANES,
  CROIX10_PHASE,
  CROIX10_PLANE_OFFSET,
  CROIX10_PLANE_OPACITY,
  CROIX10_PLANE_ROTATION,
  CROIX10_SHAPE_SIZE,
  CROIX10_SHAPE_STRENGTH,
  CROIX10_SEPARATOR_WIDTH,
  CROIX10_STRIPE_COUNT,
  CROIX10_WIDTH_RATIO,
} from "./croix10-parameters";

/**
 * Croix10 product schema.
 *
 * Section titles name the entity edited, never the branch that reveals them, so
 * the dependency-branch rule cannot reject them once engine and tool selectors
 * are added in later stages. Every gate will live in the section it governs for
 * the same reason.
 */
export const appSchema = defineToolcraft({
  canvas: {
    enabled: true,
    renderScale: { step: 0.25 },
    sizing: { mode: "editable-output" },
    upload: false,
  },
  identity: appIdentity,
  panels: {
    controls: {
      sections: [
        {
          controls: {
            includeBackground: {
              applicability: { mode: "always" },
              defaultValue: true,
              label: "Background",
              performanceReason:
                "Toggling the product background redraws one present pass without changing stripe workload.",
              performanceRole: "responsiveness",
              target: "export.includeBackground",
              type: "switch",
            },
            color: {
              // Conditional on the switch beside it, and not merely for tidiness: the
              // separators are windows onto the support, so excluding the background
              // makes them transparent and the colour behind them has nothing to
              // colour. A control that is present but cannot change the output is the
              // thing applicability exists to prevent.
              applicability: {
                all: [{ equals: true, target: "export.includeBackground" }],
                mode: "conditional",
              },
              defaultValue: CROIX10_BACKGROUND_COLOR,
              label: "Background color",
              performanceReason:
                "The background colour is a uniform upload consumed by the present pass.",
              performanceRole: "responsiveness",
              target: "appearance.background",
              type: "color",
            },
          },
          id: "background",
          title: "Background",
        },
        {
          controls: {
            run: {
              applicability: { mode: "always" },
              actions: [
                {
                  label: "Randomize",
                  value: "randomize",
                },
              ],
              label: "Unlocked parameters",
              performanceReason:
                "Randomize writes ordinary control values once per press; the frame cost is whatever the new values already cost.",
              performanceRole: "responsiveness",
              target: "randomize.actions",
              type: "actions",
            },
            stripeField: {
              applicability: { mode: "always" },
              defaultValue: false,
              description:
                "Keeps the stripe field out of the next Randomize.",
              label: "Stripe field",
              performanceReason:
                "A lock is read once per Randomize command and never during a frame.",
              performanceRole: "responsiveness",
              target: "stripe.randomizeLock",
              type: "switch",
            },
            palette: {
              applicability: { mode: "always" },
              defaultValue: false,
              description:
                "Keeps the palette out of the next Randomize.",
              label: "Palette",
              performanceReason:
                "A lock is read once per Randomize command and never during a frame.",
              performanceRole: "responsiveness",
              target: "palette.randomizeLock",
              type: "switch",
            },
            immersiveField: {
              applicability: { mode: "always" },
              defaultValue: false,
              description:
                "Keeps the immersive field out of the next Randomize.",
              label: "Immersive field",
              performanceReason:
                "A lock is read once per Randomize command and never during a frame.",
              performanceRole: "responsiveness",
              target: "immersion.randomizeLock",
              type: "switch",
            },
            planes: {
              applicability: { mode: "always" },
              defaultValue: false,
              description:
                "Keeps the translucent planes out of the next Randomize.",
              label: "Planes",
              performanceReason:
                "A lock is read once per Randomize command and never during a frame.",
              performanceRole: "responsiveness",
              target: "transchromie.randomizeLock",
              type: "switch",
            },
          },
          id: "randomize",
          layoutGroups: [
            { columns: 2, controls: ["stripeField", "palette"], layout: "inline" },
            {
              columns: 2,
              controls: ["immersiveField", "planes"],
              layout: "inline",
            },
          ],
          title: "Randomize",
        },
        {
          controls: {
            active: {
              applicability: { mode: "always" },
              defaultValue: "couleurAdditive",
              label: "Engine",
              options: [
                { label: "Couleur Additive", value: "couleurAdditive" },
                { label: "Physichromie", value: "physichromie" },
                { label: "Induction Chromatique", value: "induction" },
                { label: "Chromosaturation", value: "chromosaturation" },
                { label: "Chromointerférence", value: "chromointerference" },
                { label: "Transchromie", value: "transchromie" },
              ],
              performanceReason:
                "The engine selects which fragment branch resolves the field; each branch is constant cost per pixel.",
              performanceRole: "responsiveness",
              target: "engine.active",
              type: "select",
            },
          },
          id: "chromatic-engine",
          title: "Chromatic Engine",
        },
        {
          controls: {
            count: {
              applicability: STRIPE_ENGINE_APPLICABILITY,
              defaultValue: CROIX10_STRIPE_COUNT.defaultValue,
              description:
                "Bands across the composition width. The maximum is the highest density the pixel grid can resolve without aliasing.",
              label: "Bands",
              max: CROIX10_STRIPE_COUNT.max,
              min: CROIX10_STRIPE_COUNT.min,
              performanceReason:
                "Band count sets the sequence period sampled by the engine pass; per-pixel cost does not vary with it, so it bounds fidelity rather than frame cost.",
              performanceRole: "workload",
              sliderValueKind: "discrete",
              step: CROIX10_STRIPE_COUNT.step,
              target: "stripe.count",
              type: "slider",
            },
            widthRatio: {
              applicability: STRIPE_ENGINE_APPLICABILITY,
              defaultValue: CROIX10_WIDTH_RATIO.defaultValue,
              description:
                "Ratio of narrow to wide bands. At 1 every band shares the same width.",
              label: "Width ratio",
              max: CROIX10_WIDTH_RATIO.max,
              min: CROIX10_WIDTH_RATIO.min,
              performanceReason:
                "Width ratio is a uniform read once per fragment inside the existing engine pass.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_WIDTH_RATIO.step,
              target: "stripe.widthRatio",
              type: "slider",
            },
            angle: {
              applicability: STRIPE_ENGINE_APPLICABILITY,
              defaultValue: CROIX10_ANGLE.defaultValue,
              label: "Angle",
              max: CROIX10_ANGLE.max,
              min: CROIX10_ANGLE.min,
              performanceReason:
                "Angle rotates stripe space inside the engine pass without adding work.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_ANGLE.step,
              target: "stripe.angle",
              type: "slider",
              unit: "°",
            },
            phase: {
              applicability: STRIPE_ENGINE_APPLICABILITY,
              defaultValue: CROIX10_PHASE.defaultValue,
              description:
                "Shifts the whole sequence sideways by a fraction of one period.",
              label: "Phase",
              max: CROIX10_PHASE.max,
              min: CROIX10_PHASE.min,
              performanceReason:
                "Phase offsets the field coordinate inside the existing engine pass.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_PHASE.step,
              target: "stripe.phase",
              type: "slider",
            },
            jitterAmount: {
              applicability: STRIPE_ENGINE_APPLICABILITY,
              defaultValue: CROIX10_JITTER_AMOUNT.defaultValue,
              description:
                "Lateral wobble reproducing the hand-cut edge of the original silkscreens. Zero gives perfectly straight boundaries.",
              label: "Wobble",
              max: CROIX10_JITTER_AMOUNT.max,
              min: CROIX10_JITTER_AMOUNT.min,
              performanceReason:
                "Wobble adds one noise evaluation per fragment at a fixed cost independent of band count.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_JITTER_AMOUNT.step,
              target: "stripe.jitterAmount",
              type: "slider",
            },
            jitterFrequency: {
              applicability: STRIPE_ENGINE_APPLICABILITY,
              defaultValue: CROIX10_JITTER_FREQUENCY.defaultValue,
              label: "Wobble rate",
              max: CROIX10_JITTER_FREQUENCY.max,
              min: CROIX10_JITTER_FREQUENCY.min,
              performanceReason:
                "Wobble rate scales the noise input coordinate without changing sample count.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_JITTER_FREQUENCY.step,
              target: "stripe.jitterFrequency",
              type: "slider",
            },
            mirror: {
              applicability: STRIPE_ENGINE_APPLICABILITY,
              defaultValue: false,
              label: "Mirror",
              performanceReason:
                "Mirroring folds the field coordinate inside the engine pass.",
              performanceRole: "responsiveness",
              target: "stripe.mirror",
              type: "switch",
            },
          },
          id: "stripe-field",
          title: "Stripe Field",
        },
        {
          controls: {
            separatorWidth: {
              applicability: STRIPE_ENGINE_APPLICABILITY,
              defaultValue: CROIX10_SEPARATOR_WIDTH.defaultValue,
              description:
                "Thin dividing line as a fraction of one band. Narrowing it strengthens the colour induced at each boundary.",
              label: "Separator",
              max: CROIX10_SEPARATOR_WIDTH.max,
              min: CROIX10_SEPARATOR_WIDTH.min,
              performanceReason:
                "Separator width is compared against the signed distance already computed by the engine pass.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_SEPARATOR_WIDTH.step,
              target: "bands.separatorWidth",
              type: "slider",
            },
          },
          id: "band-sequence",
          title: "Band Sequence",
        },
        {
          controls: {
            kind: {
              applicability: STRIPE_ENGINE_APPLICABILITY,
              defaultValue: "none",
              label: "Outline",
              options: [
                { label: "None", value: "none" },
                { label: "Circle", value: "circle" },
                { label: "Ellipse", value: "ellipse" },
                { label: "Rectangle", value: "rectangle" },
                { label: "Split blocks", value: "splitBlocks" },
              ],
              performanceReason:
                "The outline selects a distance function inside the existing pass.",
              performanceRole: "responsiveness",
              target: "shape.kind",
              type: "select",
            },
            strength: {
              applicability: SHAPE_ACTIVE_APPLICABILITY,
              defaultValue: CROIX10_SHAPE_STRENGTH.defaultValue,
              description:
                "How far the shape displaces the field. At zero the shape is not there at all: it has no fill of its own, so nothing marks it.",
              label: "Shape strength",
              max: CROIX10_SHAPE_STRENGTH.max,
              min: CROIX10_SHAPE_STRENGTH.min,
              performanceReason:
                "Strength scales a mask the engine pass already evaluated; zero short-circuits the shape entirely.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_SHAPE_STRENGTH.step,
              target: "shape.strength",
              type: "slider",
            },
            mode: {
              applicability: SHAPE_ACTIVE_APPLICABILITY,
              defaultValue: "phase",
              description:
                "Whether the shape shifts the bands sideways or narrows them where it sits.",
              label: "Perturbs",
              options: [
                { label: "Phase", value: "phase" },
                { label: "Width", value: "width" },
              ],
              performanceReason:
                "The mode selects which term of the field the mask feeds.",
              performanceRole: "responsiveness",
              target: "shape.mode",
              type: "select",
            },
            size: {
              applicability: SHAPE_ACTIVE_APPLICABILITY,
              defaultValue: CROIX10_SHAPE_SIZE.defaultValue,
              label: "Shape size",
              max: CROIX10_SHAPE_SIZE.max,
              min: CROIX10_SHAPE_SIZE.min,
              performanceReason:
                "Size scales the distance function's radius without adding work.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_SHAPE_SIZE.step,
              target: "shape.size",
              type: "slider",
            },
          },
          id: "embedded-shape",
          title: "Embedded Shape",
        },
        {
          controls: {
            active: {
              applicability: { mode: "always" },
              defaultValue: CROIX10_PRESETS[0].id,
              description:
                "Compositions from each of the six series. Loading one writes its values into the panel, where they stay editable.",
              label: "Built-in preset",
              options: CROIX10_PRESETS.map((preset) => ({
                label: preset.label,
                value: preset.id,
              })),
              performanceReason:
                "Selecting a preset stores a choice; loading it writes ordinary control values.",
              performanceRole: "responsiveness",
              target: "presets.active",
              type: "select",
            },
            load: {
              applicability: { mode: "always" },
              actions: [
                {
                  label: "Load",
                  value: "load-preset",
                },
              ],
              label: "Selected composition",
              performanceReason:
                "Loading a preset writes control values once; the frame cost is whatever those values already cost.",
              performanceRole: "responsiveness",
              target: "presets.actions",
              type: "actions",
            },
          },
          id: "preset-library",
          title: "Preset Library",
        },
        {
          controls: {
            slots: {
              applicability: { mode: "always" },
              defaultValue: [...CROIX10_DEFAULT_PALETTE],
              itemControl: {
                defaultValue: CROIX10_DEFAULT_PALETTE[0],
                type: "color",
              },
              label: "Palette",
              hardMaxItems: CROIX10_MAX_PALETTE_SLOTS,
              minItems: CROIX10_MIN_PALETTE_SLOTS,
              performanceReason:
                "Slot count sets how many colours the engine pass indexes, but the lookup is a constant-cost array read, so this is responsiveness rather than workload.",
              performanceRole: "responsiveness",
              target: "palette.slots",
              type: "collectionActions",
            },
          },
          id: "palette",
          title: "Palette",
        },
        {
          controls: {
            cyclingOffset: {
              applicability: { mode: "always" },
              defaultValue: CROIX10_CYCLING_OFFSET.defaultValue,
              description:
                "Rotates which band takes which colour, wrapping at the end of the sequence.",
              label: "Cycle",
              max: CROIX10_CYCLING_OFFSET.max,
              min: CROIX10_CYCLING_OFFSET.min,
              performanceReason:
                "The cycling offset shifts a palette index inside the existing engine pass.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: CROIX10_CYCLING_OFFSET.step,
              target: "palette.cyclingOffset",
              type: "slider",
            },
          },
          id: "colour-cycle",
          title: "Colour Cycle",
        },
        ...CROIX10_COLOUR_SOURCE_SECTIONS,
        ...CROIX10_ENGINE_SECTIONS,
        {
          controls: {
            format: {
              applicability: { mode: "always" },
              defaultValue: "png",
              label: "Format",
              options: [
                { label: "PNG", value: "png" },
                { label: "JPG", value: "jpg" },
              ],
              performanceReason:
                "Format selects the runtime encoder for one export action.",
              performanceRole: "responsiveness",
              target: "export.image.format",
              type: "select",
            },
            resolution: {
              applicability: { mode: "always" },
              defaultValue: "4k",
              label: "Resolution",
              options: [
                { label: "2K", value: "2k" },
                { label: "4K", value: "4k" },
                { label: "8K", value: "8k" },
              ],
              performanceReason:
                "Resolution sets the exported long edge, but the runtime owns artifact backing allocation and encoding; the contract also mandates a select here, which cannot carry the numeric schema bounds a workload dimension requires.",
              performanceRole: "responsiveness",
              target: "export.image.resolution",
              type: "select",
            },
          },
          id: "image-export",
          layoutGroups: [
            { columns: 2, controls: ["format", "resolution"], layout: "inline" },
          ],
          title: "Image Export",
        },
        {
          controls: {
            delivery: {
              applicability: { mode: "always" },
              actions: [
                {
                  icon: "upload-simple",
                  label: "Export PNG",
                  role: "export-image",
                  value: "export-image",
                },
              ],
              target: "export.actions",
              type: "panelActions",
            },
          },
          id: "delivery-actions",
        },
      ],
      title: "Controls",
    },
    // Playback rather than keyframes. The motion this product needs is a whole-cycle
    // drift of an already-declared parameter, which playback expresses exactly; the
    // drift controls below make the loop seamless by construction rather than by
    // keyframe placement. Keyframes mode is a later, larger change: it obliges
    // timelineCoverage "keyframes" acceptance for every keyframe-capable control,
    // which is every slider and colour in the panel.
    timeline: {
      defaultDurationSeconds: CROIX10_LOOP_DURATION_SECONDS,
      enabled: true,
      mode: "playback",
    },
  },
  // The committed hotspot has no control, so it is not in the derived value set
  // that persistence restores by default. Declaring it here is what makes the
  // canvas-authored position survive a reload, which is the half of R44 that
  // makes committing worth doing at all.
  // Restated in full rather than left to the default, because declaring
  // additionalValueTargets means declaring the whole persistence plan. The
  // include list and key reproduce exactly what the runtime resolved before —
  // base slices plus timeline, which this product enables — so the only change
  // is the hotspot.
  persistence: {
    additionalValueTargets: ["proximity.center"],
    include: ["canvas", "panels", "timeline", "values"],
    key: `toolcraft:${appIdentity.id}:state:v2`,
    storage: "localStorage",
    version: 2,
  },
  toolbar: {
    history: true,
    radar: true,
    theme: true,
    zoom: true,
  },
});
