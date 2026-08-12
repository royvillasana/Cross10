import type {
  ToolcraftComponentAcceptance,
  ToolcraftControlSectionInventoryEntry,
  ToolcraftProductReadiness,
  ToolcraftTransferMode,
} from "./acceptance/types";
import { appSchema } from "./app-schema";
import {
  studioBackgroundAcceptanceRows,
  studioExportAcceptanceRows,
  studioLayerAcceptanceRows,
} from "./studio-acceptance-rows";

const persistenceSlices =
  appSchema.persistence.storage === "localStorage"
    ? appSchema.persistence.include
    : [];

export const appTransferMode: ToolcraftTransferMode = {
  // Animation is a later group. Declaring a timeline before one exists would
  // oblige playback coverage in this batch and fail correspondence, the same way
  // Croix10's video intent had to wait for its export section.
  animationIntent: { mode: "none" },
  mode: "new-toolcraft-app",
};

export const appProductReadiness: ToolcraftProductReadiness = {
  exportIntent: {
    image: { mode: "toolcraft-default" },
    // Shader source is not an artifact (R55). It leaves through a clipboard
    // action or the MCP, both outside the export pipeline the runtime owns, so
    // intent describes only what this app actually produces as a file.
    video: { mode: "not-requested" },
  },
  interactionOwnership: [
    // `ToolcraftInteractionSurface` is "canvas" | "panel" only — there is no
    // "layers" value, so layer-management ownership cannot be stated here as the
    // change's spec assumed. What this row can say is the part that is genuinely
    // ambiguous: choosing which layer to edit is a panel act, not a canvas one.
    // Layer ownership itself is carried instead by the four runtime layerCoverage
    // rows, which is the mechanism the runtime contract actually checks.
    {
      alternative: {
        reason:
          "Picking a layer by clicking its contribution on the canvas would be ambiguous wherever layers overlap, which in a composited stack is most of the field — and the topmost layer at a point is often not the one the author means.",
        surface: "canvas",
      },
      capability: "structured-selection",
      evidence: {
        detail:
          "Layers composite over one another by design, so a point on the canvas belongs to every layer beneath it. Only an explicit list can express which one is being edited.",
        source: "usability-analysis",
      },
      id: "layer-selection",
      reason:
        "The runtime layers panel names every layer in stack order and makes selection unambiguous regardless of overlap.",
      surface: "panel",
      target: "selectedLayer.type",
    },
  ],
  mode: "product",
  productName: "Shader Studio",
  productSummary:
    "A shader studio whose artifact is the shader: layers of procedural fields composited in an order the author builds, delivered as standalone source.",
  requestedBehavior:
    "Build a shader from an ordered stack of layers — stripes, gradients, and later images and shapes — editing each layer's own parameters, and take the composed result away as source rather than only as a picture.",
  viewInteraction: {
    mode: "non-spatial",
    reason:
      "Output is a two-dimensional shader field with no scene geometry, model, or camera to orbit. Layer order is a compositing sequence rather than depth in a space, so there is nothing an orbit gesture would move around.",
  },
};

export const appAcceptance: readonly ToolcraftComponentAcceptance[] = [
  {
    automated: true,
    automatedTestName: "declares production reload coverage for the product schema",
    browser: true,
    browserTestName:
      "browser: app restores exact canvas, values, and panel workspace slices after reload",
    componentType: "persistence",
    evidence: "persistence-state",
    expectedObservable:
      "Canvas size and zoom, their runtime values, the layer stack, and each layer's own parameters remain visibly restored after a real browser reload.",
    fixture: "product runtime persisted workspace with a two-layer stack",
    id: "persistence.reload",
    kind: "runtime",
    persistenceCoverage: "reload",
    persistenceSlices,
    target: "canvas.size.width",
    userAction:
      "Build a two-layer stack, edit both layers, move and collapse Controls, wait for persistence, and reload the page.",
  },
  ...studioBackgroundAcceptanceRows,
  ...studioLayerAcceptanceRows,
  ...studioExportAcceptanceRows,
];

/**
 * Both sections edit one entity — the selected layer — so they share an
 * `entityId` and record why they are split rather than joined. The split follows
 * the workflow: decide what the layer is, then shape it. Joining them would put
 * nine controls under one title, and the gate would sit further from the
 * controls it reveals.
 */
export const appControlSectionInventory: readonly ToolcraftControlSectionInventoryEntry[] =
  [
    {
      entity: "Background",
      entityId: "background",
      groupingReason:
        "The ground the stack composites over, and whether there is one at all. The switch gates the colour in the same section, since a colour behind nothing has nothing to colour.",
      id: "background",
      targets: ["export.includeBackground", "appearance.background"],
      title: "Background",
      workflowStage: "ground",
    },
    {
      entity: "Selected layer",
      entityId: "selected-layer",
      groupingReason:
        "What the selected layer is as a whole: how much of it reaches the composite, how it sits, and the two colours every kind of layer carries. None of these depend on the kind, so none of them are gated.",
      id: "selected-layer",
      targets: [
        "selectedLayer.opacity",
        "selectedLayer.angle",
        "selectedLayer.colorA",
        "selectedLayer.colorB",
      ],
      title: "Selected Layer",
      workflowStage: "compose",
    },
    {
      entity: "Selected layer",
      entityId: "selected-layer-pattern",
      groupingReason:
        "How the selected layer's kind draws, and the kind selector itself. The gate sits here rather than above because R34 scopes gating to the section, so it has to share a section with everything it reveals. Split from the composition stage because one entity above ten controls must divide into explicit workflow stages.",
      id: "selected-layer-pattern",
      targets: [
        "selectedLayer.type",
        "selectedLayer.count",
        "selectedLayer.mirror",
        "selectedLayer.separator",
        "selectedLayer.taper",
        "selectedLayer.jitterAmount",
        "selectedLayer.widthRatio",
        "selectedLayer.phase",
        "selectedLayer.rampType",
      ],
      title: "Layer Pattern",
      workflowStage: "shape",
    },
    {
      entity: "Selected layer",
      entityId: "selected-layer-region",
      groupingReason:
        "Where the selected layer is allowed to draw. Independent of the kind, so it is neither gated nor placed beside the gate, and split from the other stages because one entity above ten controls must divide into explicit workflow stages.",
      id: "selected-layer-region",
      targets: [
        "selectedLayer.maskSize",
        "selectedLayer.maskAspect",
        "selectedLayer.maskCenterX",
        "selectedLayer.maskCenterY",
        "selectedLayer.maskInvert",
      ],
      title: "Layer Region",
      workflowStage: "confine",
    },
    {
      entity: "Image export",
      entityId: "image-export",
      groupingReason:
        "The two settings that decide what the encoded file is — its type and its size. The export action itself is not listed: the runtime owns the sticky footer and renders it outside the product sections.",
      id: "image-export",
      targets: ["export.image.format", "export.image.resolution"],
      title: "Image Export",
      workflowStage: "deliver",
    },
  ];
