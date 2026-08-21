import type {
  ToolcraftComponentAcceptance,
  ToolcraftControlSectionInventoryEntry,
  ToolcraftProductReadiness,
  ToolcraftTransferMode,
} from "./acceptance/types";
import { appSchema } from "./app-schema";
import { STUDIO_LOOP_SECONDS } from "./studio-motion";
import {
  studioBackgroundAcceptanceRows,
  studioExportAcceptanceRows,
  studioGalleryAcceptanceRows,
  studioHistoryAcceptanceRows,
  studioLayerAcceptanceRows,
  studioMotionAcceptanceRows,
  studioSourceAcceptanceRows,
  studioRestoreAcceptanceRows,
  studioSvgAcceptanceRows,
  studioPointerAcceptanceRows,
  studioTimelineAcceptanceRows,
  studioReferenceAcceptanceRows,
} from "./studio-acceptance-rows";

const persistenceSlices =
  appSchema.persistence.storage === "localStorage"
    ? appSchema.persistence.include
    : [];

export const appTransferMode: ToolcraftTransferMode = {
  animationIntent: {
    loopDuration: {
      evidence:
        "One loop is one pass of a viewer along a static work. Under about four seconds a phase drift across a dense band field reads as flicker rather than travel, because the induced colour never holds long enough for the eye to make it; over about eight it stops reading as a single pass. Six seconds sits between those and matches the loop lengths phone-first destinations autoplay.",
      seconds: STUDIO_LOOP_SECONDS,
      source: "product-derived",
    },
    mode: "timeline-playback",
  },
  mode: "new-toolcraft-app",
};



export const appProductReadiness: ToolcraftProductReadiness = {
  exportIntent: {
    image: { mode: "toolcraft-default" },
    // Asked for, so declared. `export-pipeline` has required `Export Video` all
    // along and required this to say `user-requested` *with the evidence
    // recorded* -- so until now the product and its own spec disagreed, and the
    // request is what settles which of them was wrong.
    //
    // Shader source is still not an artifact (R55): it leaves through a
    // clipboard action, outside the export pipeline the runtime owns, and is
    // not what this intent describes.
    video: {
      evidence:
        "The product owner asked for the outcome to leave as a video as well as a still, in MP4, sized for the phone-first destinations they post to.",
      mode: "user-requested",
    },
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
    {
      alternative: {
        reason:
          "A product-authored media manager, which would restate the reorder, rename and delete the layers panel already owns and would drift from it the first time either changed.",
        surface: "canvas",
      },
      capability: "collection-edit",
      evidence: {
        detail:
          "An imported picture becomes a layer, so the list that manages pictures is the list that manages layers. Two lists over one collection is the ambiguity this entry exists to prevent, and the runtime's panel already names, orders, hides and deletes them.",
        source: "usability-analysis",
      },
      id: "media-management",
      reason:
        "Managing imported media is managing layers: the runtime creates a layer per imported file, so the layers panel is where they are named, ordered, hidden and removed.",
      surface: "panel",
      target: "media.image",
    },
    {
      alternative: {
        reason:
          "The four Layer Region sliders, which owned this until 14.1, and the Shape rotation slider, which owned the turn until 15.3. All five are retired. A number is exact but blind, and the judgement being made -- where this shape sits on this picture, how big, and which way it faces -- is one a number cannot show. Keeping them beside the handles would have made one operation answer to two surfaces, which is the rule that forced the choice rather than merely suggesting it.",
        surface: "panel",
      },
      capability: "direct-spatial-edit",
      evidence: {
        detail:
          "Placing, sizing and proportioning a shape are spatial judgements made against the picture the shape sits on. Driving them through four sliders means reading a value, moving it, looking back at the canvas, and repeating -- the author edits coordinates rather than shaping anything. The user asked for the sliders to go and for the forms to be shaped on the canvas instead.",
        source: "user-request",
      },
      id: "shape-shaping",
      reason:
        "A shape is moved, resized, proportioned and turned by dragging it, so the canvas both makes the edit and shows the evidence for it. One entry rather than four because all four gestures end in the same dispatch: `controls.setValue` against the geometry the handles own.",
      surface: "canvas",
      target: "controls.setValue",
    },
  ],
  mode: "product",
  productName: "Croix10",
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
  ...studioGalleryAcceptanceRows,
  ...studioReferenceAcceptanceRows,
  ...studioHistoryAcceptanceRows,
  ...studioBackgroundAcceptanceRows,
  ...studioLayerAcceptanceRows,
  ...studioMotionAcceptanceRows,
  ...studioSourceAcceptanceRows,
  ...studioRestoreAcceptanceRows,
  ...studioSvgAcceptanceRows,
  ...studioPointerAcceptanceRows,
  ...studioTimelineAcceptanceRows,
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
      entity: "Composition",
      entityId: "composition",
      groupingReason:
        "Everything the panel still does with a composition, once choosing one moved into the flow: the door back to it, the way back from a replacement it caused, and applying one to layers that already exist. They sit together because they are read together -- an author looking at their work decides to change what it is, to undo having changed it, or to push a construction onto part of it.",
      id: "composition",
      targets: ["gallery.actions"],
      title: "Composition",
      workflowStage: "start",
    },
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
        "Placing the layer: how much of it reaches the composite, which way it is turned, and which way round it is folded. An author turning a layer is deciding the same thing as an author folding one, so those controls answer together; the colours moved out to sit with the rest of the palette, because a layer's inks are one question and were being asked in two places. None of these depend on the kind, so none of them are gated.",
      id: "selected-layer",
      targets: [
        "selectedLayer.opacity",
        "selectedLayer.angle",
        "selectedLayer.flipX",
        "selectedLayer.flipY",
        "stack.actions",
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
        "selectedLayer.jitterVariation",
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
        "What form the selected layer takes, and which side of it the layer draws on. Independent of the kind, so it is neither gated nor placed beside the gate, and split from the other stages because one entity above ten controls must divide into explicit workflow stages. Where the form sits and how big it is left this section with 14.1, and how far it is turned left with 15.3: the canvas handles own all three, and a slider beside them would make one operation answer to two surfaces. What stays is the choice among a vocabulary of forms, which is not a spatial judgement and has no gesture.",
      id: "selected-layer-region",
      targets: [
        "selectedLayer.maskShape",
        "selectedLayer.maskSides",
        "stack.pen",
        "selectedLayer.maskInvert",
      ],
      title: "Layer Shape",
      workflowStage: "confine",
    },
    {
      entity: "Selected layer",
      entityId: "selected-layer-media",
      groupingReason:
        "Bringing a source into the stack. Its own stage because a file drop renders as a surface rather than as a field, and because import, storage and the transform buttons beside it belong to the runtime -- what this product owns is the layer that draws the result. Two surfaces rather than one because the runtime routes an import by what the file is, and a still and a moving source take different importers; they are one stage because to an author they are one act.",
      id: "selected-layer-media",
      targets: ["media.image", "media.video"],
      title: "Layer Media",
      workflowStage: "confine",
    },
    {
      entity: "Delivery",
      entityId: "delivery-svg",
      groupingReason:
        "Copying the selected layer as vector geometry, which is a different delivery from the artifacts the footer writes: it encodes nothing, downloads nothing, and exists only for the states that genuinely are geometry. Its own stage because it appears and disappears with the layer's expressibility, and a section that comes and goes cannot share a title with one that does not.",
      id: "delivery-svg",
      targets: ["export.svg"],
      title: "Vector Copy",
      workflowStage: "deliver",
    },
    {
      entity: "Composition",
      entityId: "randomize",
      groupingReason:
        "Being shown a corner of the space rather than typing one. Its own stage because a reroll and the locks that bound it are one decision -- reroll this, keep that -- and a lock rendered in the section it covers would be a switch whose label has to explain what it belongs to. It sits after the layer sections because it is what an author reaches for once a composition exists, not a way of starting one.",
      id: "randomize",
      targets: [
        "randomize.actions",
        "randomize.lockField",
        "randomize.lockPalette",
        "randomize.lockEngine",
        "randomize.lockMotion",
      ],
      title: "Randomize",
      workflowStage: "compose",
    },
    {
      entity: "Selected layer",
      entityId: "selected-layer-print",
      groupingReason:
        "How the layer is printed, as distinct from how it is coloured. A screen decides how much of a mark is there, a grain decides how coarsely the field is sampled, and quantization decides which of the layer's own inks a colour becomes -- reprographic operations rather than chromatic ones, and the printing half of a subject whose works are printed and assembled before they are optical. Its own stage because these act on the layer after it is drawn, where the treatment acts on what sits beneath it and the engine acts on the field itself.",
      id: "selected-layer-print",
      targets: [
        "selectedLayer.halftone",
        "selectedLayer.halftoneCell",
        "selectedLayer.halftoneAngle",
        "selectedLayer.pixelBlock",
        "selectedLayer.quantize",
      ],
      title: "Layer Print",
      workflowStage: "ink",
    },
    {
      entity: "Selected layer",
      entityId: "selected-layer-engine",
      groupingReason:
        "How the layer's field is coloured, as distinct from what the field is. The Cruz-Diez techniques read a field rather than build one, so they sit beside the layer kind as a second axis and carry their own gate -- which is what lets them be a stage of their own rather than a twelfth control in the kind's section.",
      id: "selected-layer-engine",
      targets: [
        "selectedLayer.engine",
        "selectedLayer.engineAmount",
        "selectedLayer.engineCursor",
        "selectedLayer.enginePitch",
      ],
      title: "Layer Engine",
      workflowStage: "colour",
    },
    {
      entity: "Layer source",
      entityId: "selected-layer-source",
      groupingReason:
        "How an imported picture is read -- as itself, or as the thing deciding where a band field's boundaries fall. Separate from the file drop because a drop zone is used once and hides itself when empty, while these are adjusted against the work and must not vanish with it.",
      id: "selected-layer-source",
      targets: [
        "selectedLayer.sourceMapping",
        "selectedLayer.sourceCount",
        "selectedLayer.sourceWidthRatio",
        "selectedLayer.sourceStrength",
      ],
      title: "Layer Source",
      workflowStage: "shape",
    },
    {
      entity: "Layer motion",
      entityId: "selected-layer-motion",
      groupingReason:
        "How a viewer passes this layer over one loop, which is a different question from what the layer looks like. Its own section because the work holds still and only the looking moves -- putting a rate beside a colour would invite drifting the colour, which would make every frame a different work rather than the same one seen from somewhere else.",
      id: "selected-layer-motion",
      targets: [
        "selectedLayer.driftShape",
        "selectedLayer.driftPhase",
        "selectedLayer.driftAngle",
      ],
      title: "Layer Motion",
      workflowStage: "move",
    },
    {
      entity: "Pointer",
      entityId: "pointer",
      groupingReason:
        "Deciding which layers a gesture reaches. Its own entity rather than a control on the selected layer: every other per-layer control edits whichever layer is selected, and this one says what the pointer touches across the whole stack -- a claim no single layer can hold, since a layer only knows about itself.",
      id: "pointer",
      targets: ["stack.pointerSubject", "stack.pointerPush"],
      title: "Pointer",
      workflowStage: "respond",
    },
    {
      entity: "Selected layer",
      entityId: "selected-layer-palette",
      groupingReason:
        "Choosing the layer's inks -- all of them, in one place. The first two used to sit with the layer's placement and the rest here, so answering \"what colours is this\" meant reading two sections that were four apart. Independent of the kind because the slots mean something to both -- extra inks in a stripe rhythm, extra stops in a ramp -- so they are neither gated nor placed beside the gate.",
      id: "selected-layer-palette",
      targets: [
        "selectedLayer.colorA",
        "selectedLayer.colorB",
        "selectedLayer.paletteSlots",
        "selectedLayer.mixSpace",
        "selectedLayer.colorC",
        "selectedLayer.colorD",
        "selectedLayer.colorE",
        "selectedLayer.colorF",
        "selectedLayer.colorG",
        "selectedLayer.colorH",
      ],
      title: "Layer Palette",
      workflowStage: "ink",
    },
    {
      entity: "Selected layer",
      entityId: "selected-layer-treatment",
      groupingReason:
        "What the layer does to the picture beneath it rather than what it paints. Its own stage because it is the one group that reads the composite instead of contributing to it, which is also why it is ungated: a lens is a lens whatever the layer's kind.",
      id: "selected-layer-treatment",
      targets: [
        "selectedLayer.hue",
        "selectedLayer.saturation",
        "selectedLayer.contrast",
        "selectedLayer.blendMode",
      ],
      title: "Layer Treatment",
      workflowStage: "treat",
    },
    {
      entity: "Video export",
      entityId: "video-export",
      groupingReason:
        "What a video artifact is encoded as and how large it comes out. Its own section beside the image settings because they are two artifacts a user chooses between, and the pipeline requires this one directly above the sticky actions that produce it.",
      id: "video-export",
      targets: ["export.video.format", "export.video.resolution"],
      title: "Video Export",
      workflowStage: "deliver",
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
