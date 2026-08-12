import type { ToolcraftControlSectionInventoryEntry } from "./acceptance/types";

/**
 * Croix10 control section inventory.
 *
 * Populated per stage, alongside the schema sections it describes: the validator
 * rejects an inventory entry with no rendered section just as it rejects a
 * section with no entry. The full 26-section decomposition lives in the change
 * design document; these are the sections this delivery actually renders.
 *
 * Titles name the entity edited, never the branch that reveals them, so the
 * dependency-branch rule cannot reject them once engine and tool selectors
 * arrive. Gates will live in the section they govern for the same reason.
 */
export const appControlSectionInventory: readonly ToolcraftControlSectionInventoryEntry[] = [
  {
    entity: "Background",
    entityId: "background",
    groupingReason:
      "The standard authored background pair. Runtime relocates both controls into Setup, but they keep their inventory entry here and count against this section's budget.",
    id: "background",
    targets: ["export.includeBackground", "appearance.background"],
    title: "Background",
  },
  {
    entity: "Chromatic engine",
    entityId: "chromatic-engine",
    groupingReason:
      "The engine selector is the product's primary mode choice and its complete editable surface. It gates controls across other entities, which is the recorded cross-entity exception proved by named Playwright tests rather than derived applicability cases.",
    id: "chromatic-engine",
    targets: ["engine.active"],
    title: "Chromatic Engine",
  },
  {
    entity: "Viewer parallax",
    entityId: "viewer-parallax",
    groupingReason:
      "The simulated viewing angle and the depth that scales it together stand in for walking past a physical relief; they are one perceptual pair, not camera controls.",
    id: "viewer-parallax",
    targets: ["viewer.angle", "viewer.parallax"],
    title: "Viewer Parallax",
  },
  {
    entity: "Afterimage fringe",
    entityId: "afterimage-fringe",
    groupingReason:
      "Line-pair frequency and the complementary fringe along each boundary are one induced-colour entity: the fringe only means anything relative to the pairs it edges. Titled for the effect rather than the engine branch that reveals it.",
    id: "afterimage-fringe",
    targets: [
      "induction.frequency",
      "induction.fringeWidth",
      "induction.fringeIntensity",
    ],
    title: "Afterimage Fringe",
  },
  {
    entity: "Field immersion",
    entityId: "field-immersion",
    groupingReason:
      "Full-field immersion is defined by how far the transition reaches, where it sits, and whether that position travels over the loop; all three describe the same whole-canvas wash. Drift belongs here rather than in a motion section because it is a property of this wash, not a transport control.",
    id: "field-immersion",
    targets: [
      "immersion.spread",
      "immersion.balance",
      "immersion.driftCycles",
    ],
    title: "Field Immersion",
  },
  {
    entity: "Stripe field",
    entityId: "stripe-field",
    groupingReason:
      "The shared stripe field is one entity: band count, relative widths, and angle define the regular module, while phase, wobble, and mirroring perturb that same module. Seven controls stay in one section because splitting is only permitted above ten.",
    id: "stripe-field",
    targets: [
      "stripe.count",
      "stripe.widthRatio",
      "stripe.angle",
      "stripe.phase",
      "stripe.jitterAmount",
      "stripe.jitterFrequency",
      "stripe.mirror",
    ],
    title: "Stripe Field",
  },
  {
    entity: "Band sequence",
    entityId: "band-sequence",
    groupingReason:
      "Separator width is the band sequence's complete editable surface. The separator is a window onto the support rather than a painted mark, so it takes the background colour and needs no colour of its own.",
    id: "band-sequence",
    targets: ["bands.separatorWidth"],
    title: "Band Sequence",
  },
  {
    entity: "Embedded shape",
    entityId: "embedded-shape",
    groupingReason:
      "The shape exists only as a perturbation of the stripe field, so its outline, strength, mode, and size are one entity. The outline selector sits with the controls it gates, which is what lets the harness derive real presence and absence cases.",
    id: "embedded-shape",
    targets: ["shape.kind", "shape.strength", "shape.mode", "shape.size"],
    title: "Embedded Shape",
  },
  {
    entity: "Interference layer",
    entityId: "interference-layer",
    groupingReason:
      "The second stripe layer is one entity: its enable switch, geometry relative to the primary layer, and the blend that combines them describe a single superimposed structure. The switch sits with the controls it gates so presence and absence are both derivable.",
    id: "interference-layer",
    targets: [
      "interference.enabled",
      "interference.pitchRatio",
      "interference.angleOffset",
      "interference.phaseOffset",
      "interference.widthRatio",
      "interference.blendMode",
      "interference.driftCycles",
    ],
    title: "Interference Layer",
  },
  {
    entity: "Translucent planes",
    entityId: "translucent-planes",
    groupingReason:
      "One compound collection: a plane's colour, opacity, offset, and rotation are one record added and removed atomically, because a sheet without all four is not a sheet. Stacking is a separate entity because it describes how the sheets combine rather than what any one of them is, and runtime splits a large compound control out of any section it shares.",
    id: "translucent-planes",
    targets: ["transchromie.planes"],
    title: "Translucent Planes",
  },
  {
    entity: "Plane stacking",
    entityId: "plane-stacking",
    groupingReason:
      "How the sheets combine is a property of the stack, not of any plane, so it cannot live inside the per-plane record. It sits beside the collection that runtime renders as its own section.",
    id: "plane-stacking",
    targets: ["transchromie.blendMode"],
    title: "Plane Stacking",
  },
  {
    entity: "Preset library",
    entityId: "preset-library",
    groupingReason:
      "One entity: the preset choice and the command that loads it. The command sits with the selection it acts on, and loading writes ordinary control values rather than a product scene format.",
    id: "preset-library",
    targets: ["presets.active", "presets.actions"],
    title: "Preset Library",
    workflowStage: "Choosing a starting composition",
  },
  {
    entity: "Randomize",
    entityId: "randomize",
    groupingReason:
      "One entity: the command and the locks that constrain it. The locks cannot live in the sections they name — Palette and Translucent Planes each hold a large compound control, and runtime splits such a control into its own section, which would duplicate those titles — and the command belongs beside the locks that decide what it may touch.",
    id: "randomize",
    targets: [
      "randomize.actions",
      "stripe.randomizeLock",
      "palette.randomizeLock",
      "immersion.randomizeLock",
      "transchromie.randomizeLock",
    ],
    title: "Randomize",
    workflowStage: "Constraining and running Randomize",
  },
  {
    entity: "Palette",
    entityId: "palette",
    groupingReason:
      "The colour bank is the palette's complete editable surface and the user owns how many colours exist. It stands alone because runtime splits a large compound control out of any section it shares.",
    id: "palette",
    targets: ["palette.slots"],
    title: "Palette",
  },
  {
    entity: "Colour cycle",
    entityId: "colour-cycle",
    groupingReason:
      "The cycling offset is the complete editable surface of the colour-rotation behaviour, which is why a single-control section is valid here. It cannot share the palette section because the collection control is split out on its own.",
    id: "colour-cycle",
    targets: ["palette.cyclingOffset"],
    title: "Colour Cycle",
  },
  {
    entity: "Chromatic ramp",
    entityId: "chromatic-ramp",
    groupingReason:
      "One colour source: what the bands take their colour from, the transition itself, how it mixes, and how it moves. Drift lives here rather than in a motion section because the source gates it — a rate that cannot change the output while the palette is active must share the entity with the control that decides that (R43). There is no mapping or angle control because the gradient owns both (R23).",
    id: "chromatic-ramp",
    targets: [
      "ramp.source",
      "ramp.gradient",
      "ramp.interpolationSpace",
      "ramp.phase",
      "ramp.driftCycles",
    ],
    title: "Chromatic Ramp",
    workflowStage: "Choosing where band colour comes from",
  },
  {
    entity: "Cursor field",
    entityId: "cursor-field",
    groupingReason:
      "One entity: whether the ramp answers the pointer, and the shape of the answer. Where the field is centred is deliberately absent — the canvas writes that on gesture end and a panel control for it would mirror the same capability on two surfaces (R44).",
    id: "cursor-field",
    targets: [
      "proximity.enabled",
      "proximity.radius",
      "proximity.strength",
      "proximity.falloff",
    ],
    title: "Cursor Field",
    workflowStage: "Disturbing the ramp by hand",
  },
  {
    entity: "Image export",
    entityId: "image-export",
    groupingReason:
      "Format and resolution tune one artifact type and render as a compact two-column select row. These are ordinary product controls that consume this section's budget; only the sticky action control is exempt.",
    id: "image-export",
    targets: ["export.image.format", "export.image.resolution"],
    title: "Image Export",
  },
];
