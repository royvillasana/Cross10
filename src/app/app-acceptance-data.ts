import type {
  ToolcraftComponentAcceptance,
  ToolcraftProductReadiness,
  ToolcraftTransferMode,
} from "./acceptance/types";
import { appSchema } from "./app-schema";
import {
  CROIX10_LOOP_DURATION_SECONDS,
  CROIX10_MAX_PALETTE_SLOTS,
  CROIX10_STRIPE_COUNT,
} from "./croix10-parameters";

const persistenceSlices =
  appSchema.persistence.storage === "localStorage"
    ? appSchema.persistence.include
    : [];

export const appTransferMode: ToolcraftTransferMode = {
  animationIntent: {
    loopDuration: {
      evidence:
        "Derived from the slowest intended modulation rather than from the runtime default: a full sweep through the Physichromie colour states has to read as a walk past the work, which is roughly two seconds per perceptible state across four states. The coincidence with the framework's 8s fallback is noted in croix10-parameters.ts so the value is not mistaken for an unset default.",
      seconds: CROIX10_LOOP_DURATION_SECONDS,
      source: "product-derived",
    },
    mode: "timeline-playback",
  },
  mode: "new-toolcraft-app",
};

export const appProductReadiness: ToolcraftProductReadiness = {
  exportIntent: {
    image: { mode: "toolcraft-default" },
    // Video was explicitly requested and is planned, but intent must correspond
    // exactly to the schema: declaring it before a Video Export section and
    // action exist fails correspondence, and it would oblige complete video
    // artifact coverage at this delivery. It flips to user-requested in the
    // batch that ships those.
    video: { mode: "not-requested" },
  },
  interactionOwnership: [
    {
      alternative: {
        reason:
          "A canvas handle for band density would have to sit over the composition it changes, obscuring exactly the boundaries the user is judging, and it offers no spatial correspondence because density is a global field property rather than a located object.",
        surface: "canvas",
      },
      capability: "property-edit",
      evidence: {
        detail:
          "Band count, width ratio, angle, phase, and wobble are global field properties with no located referent on the canvas, and they need precise repeatable values that a drag cannot express.",
        source: "usability-analysis",
      },
      id: "chromatic-field-properties",
      reason:
        "The panel keeps every field property discoverable, precisely settable, and out of the way of the output being judged.",
      surface: "panel",
      target: "stripe.count",
    },
  ],
  mode: "product",
  productName: "Croix10",
  productSummary:
    "A chromatic field studio that renders Carlos Cruz-Diez's colour research as live, inspectable shader parameters.",
  requestedBehavior:
    "Render the Couleur Additive module as parallel colour bands divided by thin dark separators, with the stripe field, palette, and separators editable in real time, and export the result as an image.",
  viewInteraction: {
    mode: "non-spatial",
    reason:
      "Output is a two-dimensional shader field with no scene geometry, model, or camera to orbit. Physichromie's viewing angle, added in a later stage, is a colour-state parameter of that flat field rather than a camera pose; the 3D lamellae tool is the point at which a genuine editable spatial scene appears and this declaration becomes orbit.",
  },
};

export { appAcceptance } from "./croix10-acceptance-rows";
export { appControlSectionInventory } from "./croix10-control-sections";
