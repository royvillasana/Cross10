/**
 * Acceptance rows for the layer stack.
 *
 * Its own file because `app-acceptance-data.ts` is the declaration surface and
 * holds its line budget only while row bodies live beside the entity they cover.
 *
 * Two rules shape every row here. Enabling `panels.layers` obliges runtime rows
 * for selection, visibility, reorder, **and grouping**, each with automated and
 * browser proof (R50) — grouping included, whether or not the product asked for
 * it. And every `selectedLayer.*` control carries `layerCoverage:
 * "selected-layer-controls"` on top of its own coverage (R51), which is a
 * stronger claim than "the control changes the render": it obliges proof that
 * editing with one layer selected leaves the others alone.
 *
 * Layer coverage must drive real LayersPanel rows and buttons rather than
 * dispatching `layers.*` commands directly (`component-contracts.runtime.ts:297`).
 */

import type { ToolcraftComponentAcceptance } from "./acceptance/types";

const SELECTED_LAYER_FIXTURE =
  "Croix10 with a two-layer stack, a stripes layer below a gradient layer, the stripes layer selected";

/**
 * History, which the runtime owns and this product had broken.
 *
 * A row for a runtime capability is unusual and earns its place here: the undo
 * stack is shared, so whether Undo works at all is decided by what *this*
 * product puts on it. Nothing else in the table would have caught it -- every
 * other row asserts an edit reaching the frame, and an edit that cannot be
 * taken back reaches the frame perfectly well.
 */
export const studioHistoryAcceptanceRows: readonly ToolcraftComponentAcceptance[] = [
  {
    automated: true,
    automatedTestName: "keeps every derived write out of the undo stack",
    browser: true,
    browserTestName: "browser: studio undo reverts an edit, a layer, and a layer's values",
    componentType: "toolbar",
    evidence: "rendered-pixels",
    expectedObservable:
      "One press of Undo takes back one edit: a slider returns to the value it had, a layer that was added is gone again, and a layer that was deleted comes back as itself -- with the settings it had rather than as a fresh layer wearing its name.",
    fixture: "Croix10 with a layer edited, one added, and one deleted",
    id: "history.undo",
    kind: "runtime",
    target: "history.undo",
    userAction:
      "Edit a slider and press Undo; add a layer and press Undo; delete an edited layer and press Undo.",
  },
];

/**
 * The gallery's two rows (R71).
 *
 * They are two because the operation is two: naming an entry changes nothing on
 * the canvas, and applying it replaces the stack. A single row over a select
 * that applied on change would have been one claim covering both, and the
 * reason there is no such select is that its value would persist as a statement
 * about a stack the next edit contradicts.
 */
export const studioGalleryAcceptanceRows: readonly ToolcraftComponentAcceptance[] = [
  {
    actionCoverage: ["open-onboarding", "open-reference"],
    automated: true,
    automatedTestName: "opens the flow at the step each door names",
    browser: true,
    browserTestName: "browser: studio reopens the flow from the panel",
    componentType: "actions",
    // Opening changes nothing but which surface is showing. The rendered claim
    // belongs to what it opens, and to the rows below -- the half of the old
    // gallery that still edits work from the panel.
    evidence: "command-side-effect",
    expectedObservable:
      "Pressing Change the technique opens the flow on the technique cards; pressing Work against a study opens it on the studies. Neither changes a layer, a layer value, or the rendered composition until a choice is made inside it.",
    fixture: "Croix10 with a two-layer stack",
    id: "gallery.actions",
    kind: "control",
    target: "gallery.actions",
    userAction: "Press Change the technique, then Work against a study.",
  },
];

/**
 * The transport, which is a runtime capability this product now depends on.
 *
 * A row for a runtime surface earns its place the same way the history one did:
 * enabling a timeline is what makes video export possible, and every claim the
 * artifact makes about duration and cadence is really a claim about this.
 */
export const studioTimelineAcceptanceRows: readonly ToolcraftComponentAcceptance[] = [
  {
    automated: true,
    automatedTestName: "declares playback transport with the loop period the intent states",
    browser: true,
    browserTestName: "browser: studio timeline plays, scrubs, and loops the drift",
    componentType: "timeline",
    evidence: "rendered-pixels",
    expectedObservable:
      "The runtime timeline plays a six-second loop: the frame changes while it runs, holds still when paused, and follows a scrub to a named time. Editing the duration changes how long one pass takes without changing what the loop is of, and the last frame meets the first with no visible jump.",
    fixture: "Croix10 with a drifting one-layer stack",
    id: "timeline.playback",
    kind: "runtime",
    target: "timeline.playback",
    timelineCoverage: "playback",
    timelinePlaybackCoverage: "all-playback-behavior",
    // The seam is the claim a loop lives or dies on, and it is the one thing a
    // duration and a packet count cannot tell you.
    timelineLoopProof: {
      direction: "forward-only",
      durationChange: "reproved-after-edit",
      reversePlayback: "forbidden",
      seam: "first-last-match",
    },
    userAction: "Press play, pause, scrub to a time, and edit the duration.",
  },
];

/**
 * The drift, which is the one thing in this product that moves by itself.
 *
 * Both rows carry the same negative claim as well as their own positive one:
 * the layer's colours, count and separators are identical at every moment of the
 * loop. That is what keeps a loop a view of one work rather than a sequence of
 * different ones, and it is the assertion a "the frame changed" proof would pass
 * straight over.
 */
/**
 * Taking back a replacement, which now happens where the replacement was made.
 *
 * It was a panel row, kept there against the intent of the rest of the move
 * because the snapshot was believed not to reach a selector inside the dialog.
 * It does. What that note recorded was a conclusion from one instrumented run
 * rather than a property of the runtime, and it outlived whatever made it true.
 *
 * The row targets the door rather than a control of its own, because the offer
 * is no longer a control: it appears inside the flow, and only when a
 * replacement is actually held. That is the reverse of what a panel row can do
 * -- a permanent row has to be present and inert most of the time, while an
 * offer that appears exactly when it can be taken is an offer.
 */
/** Vector delivery, which exists only where the state genuinely is geometry. */
export const studioSvgAcceptanceRows: readonly ToolcraftComponentAcceptance[] = [
  {
    actionCoverage: ["copy-svg"],
    automated: true,
    automatedTestName: "declares vector delivery only for the states that are vector geometry",
    browser: true,
    browserTestName: "browser: studio copies a band field as vector geometry and hides the action otherwise",
    componentType: "actions",
    evidence: "command-side-effect",
    expectedObservable:
      "Copy SVG is offered only while the selected layer is geometry: a band field with no chromatic engine, no fold, and a rectangular or elliptical region. Choosing an engine or another layer kind removes the action rather than degrading it. When it is offered, pressing it puts SVG markup on the clipboard describing that layer's bands in its own inks, including jitter as displaced rectangles and taper as quadrilaterals. Nothing is downloaded and the recorded image-and-video artifact intent is unchanged.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "export.svg",
    kind: "control",
    target: "export.svg",
    userAction:
      "With a band field selected, press Copy SVG; then choose a chromatic engine and look for the action again.",
  },
];

export const studioRestoreAcceptanceRows: readonly ToolcraftComponentAcceptance[] = [
  {
    automated: true,
    automatedTestName: "restores the previous stack layer for layer with its own values",
    browser: true,
    browserTestName: "browser: studio gallery restores the stack an application replaced",
    componentType: "actions",
    evidence: "rendered-pixels",
    expectedObservable:
      "After a technique has replaced a stack, reopening the flow offers to restore what was there, and taking it brings back the layers, names and values the replacement removed. With no replacement held the offer is not shown at all, so there is no press that does nothing.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "gallery.restore",
    kind: "control",
    target: "gallery.actions",
    userAction:
      "Apply a technique over existing work, reopen the flow, and press Restore what was there.",
  },
];

/**
 * Reading an imported picture as a field rather than as a picture.
 *
 * Each row carries the same negative claim as well as its own: what changes is
 * where the boundaries of the band field fall, not what the picture is. The
 * source is never altered -- it is read.
 */
export const studioSourceAcceptanceRows: readonly ToolcraftComponentAcceptance[] = [
  {
    automated: true,
    automatedTestName: "declares the source mapping turns a picture into a field",
    browser: true,
    browserTestName: "browser: studio reads an imported picture as a band field",
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "Switching Read the picture as from The picture to Band width replaces the photograph with a band field whose boundaries follow the picture's light, drawn in the layer's own palette rather than the picture's colours.",
    fixture: SELECTED_LAYER_FIXTURE,
    layerCoverage: "selected-layer-controls",
    // Every reading owes evidence, including the one that draws the picture
    // unchanged -- that is the branch an author returns to, and a mapping that
    // could not get back to it would be a trap.
    optionCoverage: ["picture", "width", "phase"],
    id: "selectedLayer.sourceMapping",
    kind: "control",
    target: "selectedLayer.sourceMapping",
    userAction: "Import a picture and set Read the picture as to Band width.",
  },
  {
    automated: true,
    automatedTestName: "declares the band count across a read picture",
    browser: true,
    browserTestName: "browser: studio band count across a picture changes its frequency",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Bands across the picture puts more, narrower bands over the same source, and the picture's light still decides where each boundary falls.",
    fixture: SELECTED_LAYER_FIXTURE,
    layerCoverage: "selected-layer-controls",
    id: "selectedLayer.sourceCount",
    kind: "control",
    target: "selectedLayer.sourceCount",
    userAction: "Read a picture as bands and raise Bands across the picture.",
  },
  {
    automated: true,
    automatedTestName: "declares the balance of a read picture's bands",
    browser: true,
    browserTestName: "browser: studio balance shifts the ink in a read picture",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Moving Balance shifts how much of each band is the first ink rather than the second, over an unchanged rhythm and an unchanged source.",
    fixture: SELECTED_LAYER_FIXTURE,
    layerCoverage: "selected-layer-controls",
    id: "selectedLayer.sourceWidthRatio",
    kind: "control",
    target: "selectedLayer.sourceWidthRatio",
    userAction: "Read a picture as bands and move Balance.",
  },
  {
    automated: true,
    automatedTestName: "declares how far the picture drives the field",
    browser: true,
    browserTestName: "browser: studio source strength decides how much picture reaches the field",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "At zero the field is perfectly regular and the picture has left it entirely; raising it bends the field toward the picture's light. The bottom of the scale is a real reading rather than a disabled state.",
    fixture: SELECTED_LAYER_FIXTURE,
    layerCoverage: "selected-layer-controls",
    id: "selectedLayer.sourceStrength",
    kind: "control",
    target: "selectedLayer.sourceStrength",
    userAction: "Read a picture as bands and move How much the picture drives it.",
  },
];

export const studioMotionAcceptanceRows: readonly ToolcraftComponentAcceptance[] = [
  {
    automated: true,
    automatedTestName: "declares the travel shape walks the loop without opening the seam",
    browser: true,
    browserTestName: "browser: studio travel shape changes the walk and keeps the seam closed",
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "How it travels changes the way a drifting layer gets where it is going without changing where that is. Steady moves at one speed; Eased starts and ends at rest, so the loop no longer gives itself away at the seam; Swing goes out and comes back inside one loop. Whichever is chosen, the first frame of the loop and the last are identical -- the shape cannot open a seam.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.driftShape",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    optionCoverage: "each-visible-item",
    target: "selectedLayer.driftShape",
    userAction: "Set Travel per loop, then walk How it travels through its three options.",
  },
  {
    automated: true,
    automatedTestName: "declares travel drifts the field and returns it",
    browser: true,
    browserTestName:
      "browser: studio returns two layers drifting at different rates",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "With Travel per loop at one, scrubbing the timeline moves the band boundaries along the field and the frame at the end of the loop is the frame at its start. The layer's inks, band count and separators are identical at every moment, and at zero the composition is pixel-identical to the one built before any drift existed.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.driftPhase",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.driftPhase",
    userAction: "Set Travel per loop and scrub the timeline.",
  },
  {
    automated: true,
    automatedTestName: "declares turns drift the reading angle and return it",
    browser: true,
    browserTestName: "browser: studio turns drift the reading angle and return",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "With Turns per loop at one, scrubbing the timeline turns the direction the field is read from and the frame at the end of the loop is the frame at its start, because a whole turn returns. Only the selected layer turns; the others render exactly as they did.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.driftAngle",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.driftAngle",
    userAction: "Set Turns per loop and scrub the timeline.",
  },
];

export const studioPointerAcceptanceRows: readonly ToolcraftComponentAcceptance[] = [
  {
    automated: true,
    automatedTestName: "declares the pointer subject widens which layers follow it",
    browser: true,
    browserTestName: "browser: studio pointer subject reaches every layer",
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "With the subject set to every layer, moving the pointer across the canvas changes a layer whose own Follow the pointer switch is off; setting it back to layers that follow it leaves that layer still again, and a layer whose switch is on keeps following either way. Selecting a different layer while every layer is the subject moves nothing: the same layers keep responding, because the subject is a claim about the stack rather than about the selection.",
    fixture: "Croix10 with a two-layer stack, one layer following the pointer and one not",
    id: "stack.pointerSubject",
    kind: "control",
    // Both readings have to be shown, because the whole control is the
    // difference between them: a proof that only widened the reach would pass
    // while narrowing it again did nothing.
    optionCoverage: "each-visible-item",
    target: "stack.pointerSubject",
    userAction:
      "Set Pointer reaches to Every layer, move the pointer over the canvas, select a different layer, then set it back.",
  },
  {
    automated: true,
    automatedTestName: "declares the pointer push displaces the field it reaches",
    browser: true,
    browserTestName: "browser: studio pointer push displaces the field",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Pointer push with the pointer over the canvas bends the bands near it away from the pointer, leaving the field at the far edge where it was; a pointer that has left the frame reaches nothing at any amount. An exported image is unmoved by it either way -- an artifact exported with the pointer parked over the canvas decodes to the same pixels as one exported with the pointer away, because a still carries the field at rest rather than wherever the mouse was.",
    fixture: "Croix10 with one layer following the pointer",
    id: "stack.pointerPush",
    kind: "control",
    target: "stack.pointerPush",
    userAction:
      "Point at the canvas, raise Pointer push, and export an image with the pointer still over it.",
  },
];


/**
 * The reference, and the two claims that matter about it.
 *
 * One is ordinary — it shows, it can be dismissed, it can be read as a
 * difference. The other is a correctness claim rather than a convenience: the
 * reference must reach no artifact, which is why the export row below is
 * written as identity against the no-reference case rather than as "the export
 * looks right".
 */
export const studioReferenceAcceptanceRows: readonly ToolcraftComponentAcceptance[] = [
];

export const studioLayerAcceptanceRows: readonly ToolcraftComponentAcceptance[] = [
  {
    automated: true,
    automatedTestName: "declares selecting a layer row loads that layer's controls",
    browser: true,
    browserTestName: "browser: studio layer selection loads the selected layer values",
    componentType: "layers",
    evidence: "rendered-pixels",
    expectedObservable:
      "Clicking a different row in the layers panel loads that layer's own kind and parameters into the controls, and the previously selected layer keeps the values it had.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "layers.selection",
    kind: "runtime",
    layerCoverage: "selection",
    target: "selectedLayer.type",
    userAction: "Click the other layer's row in the layers panel.",
  },
  {
    automated: true,
    automatedTestName: "declares hiding a layer removes its contribution",
    browser: true,
    browserTestName: "browser: studio layer visibility removes the layer from the composite",
    componentType: "layers",
    evidence: "rendered-pixels",
    expectedObservable:
      "Hiding a layer from its panel row removes that layer's contribution from the rendered composite and leaves every other layer identical; showing it again restores the previous render exactly.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "layers.visibility",
    kind: "runtime",
    layerCoverage: "visibility",
    target: "selectedLayer.type",
    userAction: "Toggle the visibility control on a layer row.",
  },
  {
    automated: true,
    automatedTestName: "declares reordering a layer changes what covers what",
    browser: true,
    browserTestName: "browser: studio layer reorder changes which layer covers which",
    componentType: "layers",
    evidence: "rendered-pixels",
    expectedObservable:
      "Moving a layer above another in the panel composites it over that layer, changing the rendered output, and moving it back restores the original composition exactly.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "layers.reorder",
    kind: "runtime",
    layerCoverage: "reorder",
    target: "selectedLayer.type",
    userAction: "Move the lower layer above the upper one using the panel's reorder control.",
  },
  {
    automated: true,
    automatedTestName:
      "composites an image layer where the panel puts it, above and below procedural layers",
    browser: true,
    browserTestName:
      "browser: studio image layer composites above, below, and between procedural layers",
    componentType: "layers",
    evidence: "rendered-pixels",
    expectedObservable:
      "An imported picture is a layer like any other in the stack: a procedural layer above it hides it where the two meet, moving the picture up shows it over that layer instead, and with one procedural layer above and one below, a single frame carries all three — the top layer over the picture on one side, the picture over the bottom layer in the middle, and the bottom layer alone where the picture does not reach.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "layers.imageComposite",
    kind: "runtime",
    layerCoverage: "reorder",
    target: "selectedLayer.type",
    userAction:
      "Import a picture, add procedural layers above and below it, and move the picture through the stack from the panel rows.",
  },
  {
    automated: true,
    automatedTestName: "declares grouped layers move and hide as one",
    browser: true,
    browserTestName: "browser: studio layer group moves and hides its members together",
    componentType: "layers",
    evidence: "rendered-pixels",
    expectedObservable:
      "Grouping two layers lets them be moved and hidden as one: hiding the group removes both contributions from the composite, and moving the group past a third layer moves both members past it in the same order.",
    fixture:
      "Croix10 with a three-layer stack, the lower two grouped together",
    id: "layers.grouping",
    kind: "runtime",
    layerCoverage: "grouping",
    target: "selectedLayer.type",
    userAction:
      "Group the lower two layers, hide the group, show it again, then move the group above the third layer.",
  },
  {
    automated: true,
    automatedTestName: "declares layer kind switches which body the layer draws",
    browser: true,
    browserTestName: "browser: studio layer kind switches the layer between stripes and gradient",
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "Changing Layer kind replaces that layer's contribution with the other kind's, reveals that kind's own controls in Layer Pattern, and leaves every other layer in the stack rendering unchanged.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.type",
    // Links this row to the layer-selection ownership entry: the row is the
    // proof that editing the selected layer happens on the panel rather than by
    // clicking the canvas, which is the choice that entry records.
    interactionId: "layer-selection",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    optionCoverage: "each-visible-item",
    target: "selectedLayer.type",
    userAction: "Switch Layer kind between Stripes and Gradient.",
  },
  {
    actionCoverage: ["randomize"],
    automated: true,
    automatedTestName: "declares a reroll writes every unlocked target inside its declared range",
    browser: true,
    browserTestName: "browser: studio randomize moves the composition and one undo returns it",
    componentType: "actions",
    evidence: "command-side-effect",
    expectedObservable:
      "Pressing Randomize gives the composition new values and a visibly different frame. Every value it writes lies inside the range its own control declares, so no slider reports a position past its end and the frame is never blank. One press is one history step: a single Undo returns the composition exactly as it was.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "randomize.actions",
    kind: "control",
    target: "randomize.actions",
    userAction: "Press Randomize, then press Undo once.",
  },
  {
    automated: true,
    automatedTestName: "declares locking the band field excludes it from a reroll",
    browser: true,
    browserTestName: "browser: studio randomize spares the band field when it is locked",
    componentType: "switch",
    evidence: "command-side-effect",
    expectedObservable:
      "With this lock on, a reroll leaves band count, band width, the boundary shape, jitter, taper and the reading angle exactly as they were while the groups that are not locked take new values. Turning the lock off again lets the next reroll reach them.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "randomize.lockField",
    kind: "control",
    target: "randomize.lockField",
    userAction: "Turn on field lock, press Randomize, and compare the composition before and after.",
  },
  {
    automated: true,
    automatedTestName: "declares locking the inks excludes it from a reroll",
    browser: true,
    browserTestName: "browser: studio randomize spares the inks when it is locked",
    componentType: "switch",
    evidence: "command-side-effect",
    expectedObservable:
      "With this lock on, a reroll leaves every colour slot and how many of them the layer cycles exactly as they were while the groups that are not locked take new values. Turning the lock off again lets the next reroll reach them.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "randomize.lockPalette",
    kind: "control",
    target: "randomize.lockPalette",
    userAction: "Turn on palette lock, press Randomize, and compare the composition before and after.",
  },
  {
    automated: true,
    automatedTestName: "declares locking the chromatic engine excludes it from a reroll",
    browser: true,
    browserTestName: "browser: studio randomize spares the chromatic engine when it is locked",
    componentType: "switch",
    evidence: "command-side-effect",
    expectedObservable:
      "With this lock on, a reroll leaves which technique colours the field, how strongly, and at what pitch exactly as they were while the groups that are not locked take new values. Turning the lock off again lets the next reroll reach them.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "randomize.lockEngine",
    kind: "control",
    target: "randomize.lockEngine",
    userAction: "Turn on engine lock, press Randomize, and compare the composition before and after.",
  },
  {
    automated: true,
    automatedTestName: "declares locking the drift excludes it from a reroll",
    browser: true,
    browserTestName: "browser: studio randomize spares the drift when it is locked",
    componentType: "switch",
    evidence: "command-side-effect",
    expectedObservable:
      "With this lock on, a reroll leaves how far the field travels and turns over one loop exactly as they were while the groups that are not locked take new values. Turning the lock off again lets the next reroll reach them.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "randomize.lockMotion",
    kind: "control",
    target: "randomize.lockMotion",
    userAction: "Turn on motion lock, press Randomize, and compare the composition before and after.",
  },
  {
    automated: true,
    automatedTestName: "declares a screen turns a tone into marks whose area follows it",
    browser: true,
    browserTestName: "browser: studio screen turns a tone into marks that let the stack through",
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "Screen renders the layer as marks whose area follows its own tone rather than as flat colour: Dot gives round marks, Line gives bands, Cross gives both crossed. The mark carries the layer's colour and the space between marks carries nothing, so whatever sits beneath shows through. None is the layer as it was.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.halftone",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    optionCoverage: "each-visible-item",
    target: "selectedLayer.halftone",
    userAction: "Put a layer over another, then walk Screen through its four options.",
  },
  {
    automated: true,
    automatedTestName: "declares the screen cell decides how fine the marks are",
    browser: true,
    browserTestName: "browser: studio screen cell changes how many marks cover the layer",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Screen cell decides the grain the screen is cut at: a smaller cell puts more and smaller marks across the same area, and a larger one fewer and bigger. The tone the marks describe is unchanged, which is what makes this a resolution rather than a darkness.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.halftoneCell",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.halftoneCell",
    userAction: "Choose a screen, then lower Screen cell.",
  },
  {
    automated: true,
    automatedTestName: "declares the screen angle turns the screen and not the picture",
    browser: true,
    browserTestName: "browser: studio screen angle turns the screen without turning the layer",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Screen angle turns the screen the marks are cut from, so a line screen runs in a different direction while the layer underneath it stays where it was -- which is the difference between rotating a halftone and halftoning a rotated picture.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.halftoneAngle",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.halftoneAngle",
    userAction: "Choose the line screen, then raise Screen angle.",
  },
  {
    automated: true,
    automatedTestName: "declares the sample grain reads the field coarsely rather than blurring it",
    browser: true,
    browserTestName: "browser: studio sample grain reads the field in blocks",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Sample grain reads the layer's field once per block instead of once per pixel, so the output is uniform blocks with hard edges rather than a smeared version of the same picture. At zero the layer is drawn exactly as it was.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.pixelBlock",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.pixelBlock",
    userAction: "Raise Sample grain on a banded layer.",
  },
  {
    automated: true,
    automatedTestName: "declares quantization admits only the inks the layer carries",
    browser: true,
    browserTestName: "browser: studio quantization keeps only the inks the layer carries",
    componentType: "switch",
    evidence: "rendered-pixels",
    expectedObservable:
      "With Only the layer's inks on, every colour the layer draws is one of the slots in use -- the blends between two inks snap to whichever they are nearest, measured perceptually rather than by distance in linear light. Turning it off returns the blends.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.quantize",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.quantize",
    userAction: "Put a gradient layer on four inks, then turn on Only the layer's inks.",
  },
  {
    automated: true,
    automatedTestName: "declares importing an image creates the layer that draws it",
    browser: true,
    browserTestName: "browser: studio image import creates a layer that draws it",
    componentType: "fileDrop",
    evidence: "media-lifecycle",
    expectedObservable:
      "Choosing an image on Import image brings it in through the runtime, which creates a layer for it, and that layer draws the picture rather than a procedural field. Deleting the layer removes the picture with it and the frame stops carrying its colours.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "media.image",
    kind: "control",
    mediaLifecycleCoverage: ["upload", "remove", "reset"],
    target: "media.image",
    userAction: "Press Import image and choose a picture, then delete its layer.",
  },
  {
    automated: true,
    automatedTestName: "declares importing a video creates the layer that draws it",
    browser: true,
    browserTestName: "browser: studio video import creates a layer that draws it",
    componentType: "fileDrop",
    evidence: "media-lifecycle",
    expectedObservable:
      "Choosing a video on Import video brings it in through the runtime, which creates a layer for it, and that layer draws a frame of the clip rather than a procedural field. The clip runs as an endless loop tied to the timeline, so the frame the layer draws changes as the loop advances and is the same frame again at the same loop position. Deleting the layer removes the clip with it.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "media.video",
    kind: "control",
    mediaLifecycleCoverage: ["upload", "remove", "reset"],
    target: "media.video",
    userAction: "Press Import video and choose a clip, then move the loop and delete its layer.",
  },
  {
    automated: true,
    automatedTestName: "declares the runtime image transform reaches the rendered frame",
    browser: true,
    browserTestName: "browser: studio image transform turns what the layer draws",
    componentType: "layers",
    evidence: "media-lifecycle",
    expectedObservable:
      "Rotating and flipping an imported picture from the runtime's own media controls turns and mirrors what its layer draws, so a corner that carried one colour carries another. The transform reaches the rendered frame rather than only the asset's metadata.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "media.transform",
    interactionId: "media-management",
    kind: "runtime",
    layerCoverage: "selected-layer-controls",
    mediaLifecycleCoverage: ["rotate", "flip", "transform-output"],
    target: "media.image",
    userAction:
      "Import a picture, then rotate and flip it from the runtime's media controls.",
  },
  {
    actionCoverage: ["draw-shape"],
    automated: true,
    automatedTestName: "declares the pen collects a vertex path on the canvas",
    browser: true,
    browserTestName: "browser: studio pen draws a free path on the canvas",
    componentType: "actions",
    // The path is state until the shader consumes it, so what changed is a
    // command side effect rather than pixels. Filling the path is the second
    // half of 14.4 and brings its own rendered-pixels claim with it.
    evidence: "command-side-effect",
    expectedObservable:
      "Pressing Draw hands the canvas to the pen: each click places a node, holding and dragging lays down a continuous run of them, the path so far is drawn between them, and the layer's own extent handles stand aside so every press is the pen's. One held stroke can place far more nodes than a click could, and takes one Undo to remove rather than one per node. Clicking the first node again closes the path and gives the canvas back, leaving the nodes in place.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "stack.pen",
    kind: "control",
    target: "stack.pen",
    userAction:
      "Press Draw, click a point, then hold and drag a stroke, then click the first node again.",
  },
  {
    automated: true,
    automatedTestName: "declares a node carries the tangents that bend the path through it",
    browser: true,
    browserTestName: "browser: studio path nodes bend the region through their handles",
    canvasHandle: {
      exportCleanTestName: "browser: studio region handles stay out of the exported artifact",
      outputObservable:
        "The region's edge bends between the node and its neighbour, so the field reaches into ground it did not cover and leaves ground it did.",
      testId: "studio-path-handle-0-outgoing",
      writesTarget: "controls.setValue",
    },
    componentType: "canvas-handle",
    evidence: "product-output",
    expectedObservable:
      "A closed path shows its nodes on the canvas. Selecting one reveals the two tangent handles that decide how the curve arrives at and leaves that node, drawn hollow while the node is still a corner. Dragging a handle bends the region between that node and its neighbour, and the rendered composite follows; dragging the node itself moves it and carries its curvature with it.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "stack.pathNodes",
    interactionId: "shape-shaping",
    kind: "canvas-handle",
    target: "stack.vertexPaths",
    userAction:
      "Draw and close a path, click one of its nodes, then drag the handle that appears.",
  },
  {
    automated: true,
    automatedTestName: "planStudioPenDrawing starts one drawing, whichever surface asked for it",
    browser: true,
    browserTestName: "browser: pressing P hands the canvas to the pen",
    componentType: "keyboard-shortcut",
    // The same side effect the Draw button has, reached by a key. Declared as
    // its own row rather than folded into `stack.pen` because a shortcut that
    // is only implied by another row's prose is a shortcut nothing checks.
    evidence: "command-side-effect",
    expectedObservable:
      "Pressing P with a layer selected hands the canvas to the pen exactly as the Draw button does: the extent handles stand aside and the layer's previous path is cleared, so the next click starts a fresh drawing. It is the only key this product takes -- undo, redo and zoom belong to the runtime and are left to it.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "stack.pen.shortcut",
    kind: "runtime",
    target: "stack.penLayerId",
    userAction: "Select a layer and press P.",
  },
  {
    actionCoverage: ["duplicate-layer"],
    automated: true,
    automatedTestName: "declares duplicating copies a layer or a whole group under new ids",
    browser: true,
    browserTestName: "browser: studio duplicate copies the layer and its settings",
    componentType: "actions",
    // A duplicate changes the stack, not the picture: a copy composited over an
    // opaque source is the same frame, so rendered pixels would be unchanged by
    // a duplicate that worked perfectly. The side effect is the observable.
    evidence: "command-side-effect",
    expectedObservable:
      "Duplicate adds a copy directly after the selection and the assembled stack grows by what that copy draws, so the panel gains rows named after their sources. Selecting the copy loads the source's values rather than the defaults a fresh layer would carry, and the source keeps every value it had. Duplicating a group copies the group and every layer under it, with each copied member inside the copied group rather than the original.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.duplicate",
    kind: "control",
    target: "stack.actions",
    userAction:
      "Edit a layer and press Duplicate in the Selected Layer section, then select a group and press it again.",
  },
  {
    automated: true,
    automatedTestName: "declares layer opacity fades only the selected layer",
    browser: true,
    browserTestName: "browser: studio layer opacity fades only the selected layer",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Lowering Opacity lets the layers beneath the selected one show through it; at zero the composite is identical to that layer being hidden, and the other layers are unchanged throughout.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.opacity",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.opacity",
    userAction: "Drag Opacity on the selected layer.",
  },
  {
    automated: true,
    automatedTestName: "declares layer angle rotates only the selected layer",
    browser: true,
    browserTestName: "browser: studio layer angle rotates only the selected layer",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Angle rotates the selected layer's field while the other layers keep their orientation, so the composite changes where the two overlap and nowhere else.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.angle",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.angle",
    userAction: "Drag Angle on the selected layer.",
  },
  {
    automated: true,
    automatedTestName: "declares a horizontal flip folds only the selected layer",
    browser: true,
    browserTestName: "browser: studio layer flip folds only the selected layer",
    componentType: "switch",
    evidence: "rendered-pixels",
    expectedObservable:
      "Turning Flip horizontally on reverses the selected layer's field across the frame -- a tapered band that widened to the right now widens to the left -- while every other layer draws exactly as it did, and turning it off again returns the layer to what it was. Over an imported picture the reading is exact rather than statistical: the corner that carried one colour carries the colour the opposite corner had, the fold runs in the picture's own axes, and the source asset is not decoded again to do it.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.flipX",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.flipX",
    userAction:
      "Turn Flip horizontally on for the selected layer, then off again, on a band field and on an imported picture.",
  },
  {
    automated: true,
    automatedTestName: "declares a vertical flip folds only the selected layer",
    browser: true,
    browserTestName:
      "browser: studio vertical flip folds only the selected layer",
    componentType: "switch",
    evidence: "rendered-pixels",
    expectedObservable:
      "Turning Flip vertically on reverses the selected layer along its bands, so a wedge that pointed one way points the other, while every other layer draws exactly as it did.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.flipY",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.flipY",
    userAction: "Turn Flip vertically on for the selected layer.",
  },
  {
    automated: true,
    automatedTestName: "declares the first layer colour recolours only that layer",
    browser: true,
    browserTestName: "browser: studio layer colours recolour only the selected layer",
    componentType: "color",
    evidence: "rendered-pixels",
    expectedObservable:
      "Changing First colour recolours the selected layer's own bands or the near end of its transition, leaving the other layers' colours untouched.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.colorA",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.colorA",
    userAction: "Change First colour on the selected layer.",
  },
  {
    automated: true,
    automatedTestName: "declares the second layer colour recolours only that layer",
    browser: true,
    browserTestName:
      "browser: studio second layer colour recolours its own slot",
    componentType: "color",
    evidence: "rendered-pixels",
    expectedObservable:
      "Changing Second colour recolours the selected layer's alternate bands or the far end of its transition, leaving the other layers' colours untouched.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.colorB",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.colorB",
    userAction: "Change Second colour on the selected layer.",
  },
  {
    automated: true,
    automatedTestName: "declares band count changes the selected stripe layer's frequency",
    browser: true,
    browserTestName: "browser: studio band count changes the selected layer's frequency",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Band count packs more bands into the selected stripes layer without changing their angle or colours, and the control is absent entirely while a gradient layer is selected.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.count",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.count",
    userAction: "Drag Band count with a stripes layer selected.",
  },
  {
    automated: true,
    automatedTestName: "declares mirror reflects the selected layer about its axis",
    browser: true,
    browserTestName: "browser: studio mirror reflects the selected layer about its axis",
    componentType: "switch",
    evidence: "rendered-pixels",
    expectedObservable:
      "Enabling Mirror renders the two halves of the selected layer's field as reflections of one another, and leaves every other layer untouched.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.mirror",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.mirror",
    userAction: "Toggle the Mirror switch.",
  },
  {
    automated: true,
    automatedTestName: "declares the band separator opens a gap to what sits beneath",
    browser: true,
    browserTestName: "browser: studio band separator opens a gap to what sits beneath",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Band separator opens an unpainted gap at each band seam, so whatever sits beneath the layer shows through it, and the control is absent while a gradient layer is selected.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.separator",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.separator",
    userAction: "Drag Band separator with a stripes layer selected.",
  },
  {
    automated: true,
    automatedTestName: "declares jitter displaces each band from its even position",
    browser: true,
    browserTestName: "browser: studio jitter displaces each band from its even position",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Jitter moves each band off its even spacing by an amount drawn from its own index, so the bands become irregular without changing how many there are, and the control is absent while a gradient layer is selected.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.jitterAmount",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.jitterAmount",
    userAction: "Drag Jitter with a stripes layer selected.",
  },
  {
    automated: true,
    automatedTestName: "declares the jitter variation where the stripe body reads it",
    browser: true,
    browserTestName: "browser: studio jitter variation rearranges which bands moved where",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Stepping Jitter variation re-scatters which bands took which displacement: three places inside the shape each swap ink while the field stays the same field — same band count, same jitter, same two inks. It is the arrangement that moves and nothing else, and the control is absent while a gradient layer is selected.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.jitterVariation",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.jitterVariation",
    userAction: "Drag Jitter variation with a stripes layer selected and the jitter raised.",
  },
  {
    automated: true,
    automatedTestName: "declares taper turns each band into a wedge",
    browser: true,
    browserTestName: "browser: studio taper turns each band into a wedge",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Taper moves the split between a band's two colours along the band's length, so each band reads as a wedge that is thick at one end and thin at the other, while the bands keep their count and their spacing, and the control is absent while a gradient layer is selected.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.taper",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.taper",
    userAction: "Drag Taper with a stripes layer selected.",
  },
  {
    automated: true,
    automatedTestName: "declares the chromatic engine changes how the field is coloured",
    browser: true,
    browserTestName: "browser: studio chromatic engine recolours the field it is given",
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "Choosing Induction adds the complement of each band's own colour along every boundary and leaves the middle of each band exactly as it was, so the field gains colours neither ink contains without either ink changing.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.engine",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    optionCoverage: "each-visible-item",
    target: "selectedLayer.engine",
    userAction: "Choose a chromatic engine with a layer selected.",
  },
  {
    automated: true,
    automatedTestName: "declares the engine amount scales the technique it belongs to",
    browser: true,
    browserTestName: "browser: studio engine amount scales the technique",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Engine amount widens the induced fringe along each boundary, so more of the field carries the complement; at zero the engine leaves the field indistinguishable from None. The control is absent while the engine is None, which has no amount to scale.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.engineAmount",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.engineAmount",
    userAction: "Choose an engine, then drag Engine amount.",
  },
  {
    automated: true,
    automatedTestName: "declares following the pointer confines the engine to its reach",
    browser: true,
    browserTestName: "browser: studio engine follows the pointer across the field",
    componentType: "switch",
    evidence: "rendered-pixels",
    expectedObservable:
      "Turning on Follow the pointer confines the engine to the pointer's neighbourhood, so the field carries the technique where the pointer is and its plain colours everywhere else; moving the pointer moves which part of the field is affected. The control is absent while the engine is None.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.engineCursor",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.engineCursor",
    userAction:
      "Choose an engine, turn on Follow the pointer, then move the pointer across the canvas.",
  },
  {
    automated: true,
    automatedTestName: "declares the interference pitch sets the beat period",
    browser: true,
    browserTestName: "browser: studio interference pitch changes the beat",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "With Interference chosen, changing Interference pitch changes the period at which the two printed structures agree, so the beat the moire reads as moves through the field. The control is absent for every other engine.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.enginePitch",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.enginePitch",
    userAction: "Choose Interference, then drag Interference pitch.",
  },
  {
    automated: true,
    automatedTestName: "declares the hue shift turns the colours the layer covers",
    browser: true,
    browserTestName: "browser: studio hue shift turns the colours beneath the layer",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Dragging Hue shift turns the colours of whatever the layer reaches, so a red field beneath it reads green inside the layer's region and stays red outside it.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.hue",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.hue",
    userAction:
      "Put a region-confined layer at zero opacity over a coloured field, then drag Hue shift.",
  },
  {
    automated: true,
    automatedTestName: "declares saturation drains the colour the layer covers",
    browser: true,
    browserTestName: "browser: studio saturation drains the colour beneath the layer",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Dropping Saturation to zero leaves what the layer reaches grey at the same brightness, while the field outside its region keeps its colour.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.saturation",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.saturation",
    userAction:
      "Put a region-confined layer at zero opacity over a coloured field, then drag Saturation to zero.",
  },
  {
    automated: true,
    automatedTestName: "declares contrast flattens what the layer covers toward mid grey",
    browser: true,
    browserTestName: "browser: studio contrast flattens what the layer covers",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Dropping Contrast to zero collapses what the layer reaches to a single mid tone, while the field outside its region keeps its own.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.contrast",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.contrast",
    userAction:
      "Put a region-confined layer at zero opacity over a coloured field, then drag Contrast to zero.",
  },
  {
    automated: true,
    automatedTestName: "declares the blend mode changes how the layer meets what it sits on",
    browser: true,
    browserTestName: "browser: studio blend mode changes how the layer meets what it sits on",
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "Choosing Multiply darkens the layer's own colour against what is beneath it instead of covering it, so a mid grey over a red field reads dark red where it read mid grey.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.blendMode",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    optionCoverage: "each-visible-item",
    target: "selectedLayer.blendMode",
    userAction:
      "Put a mid grey layer over a coloured field, then choose Multiply as the blend mode.",
  },
  {
    automated: true,
    automatedTestName: "studioMoveRegion keeps the region's size and only moves its centre",
    browser: true,
    browserTestName: "browser: studio region body drags the layer across the canvas",
    canvasHandle: {
      exportCleanTestName: "browser: studio region handles stay out of the exported artifact",
      outputObservable:
        "The layer's confined area moves with the pointer, so the field appears where the region was dragged to and the ground shows where it left.",
      testId: "studio-region-move",
      writesTarget: "controls.setValue",
    },
    componentType: "canvas-handle",
    evidence: "product-output",
    expectedObservable:
      "Dragging the region body moves the selected layer's area on the canvas, and the Region across and Region down sliders follow it.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.regionHandle.move",
    interactionId: "shape-shaping",
    kind: "canvas-handle",
    target: "selectedLayer.maskCenterX",
    userAction: "Drag the dashed region body on the canvas.",
  },
  {
    automated: true,
    automatedTestName:
      "studioResizeRegion holds the opposite corner still, so a corner drag resizes rather than moves",
    browser: true,
    browserTestName: "browser: studio region corner node resizes the layer on the canvas",
    canvasHandle: {
      exportCleanTestName: "browser: studio region handles stay out of the exported artifact",
      outputObservable:
        "The layer's confined area grows or shrinks about the opposite corner, so the field reaches further across the frame than it did.",
      testId: "studio-region-node-southEast",
      writesTarget: "controls.setValue",
    },
    componentType: "canvas-handle",
    evidence: "product-output",
    expectedObservable:
      "Dragging a corner node resizes the selected layer's area about the opposite corner, and the Region size slider follows it.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.regionHandle.corner",
    interactionId: "shape-shaping",
    kind: "canvas-handle",
    target: "selectedLayer.maskSize",
    userAction: "Drag the south-east node of the region on the canvas.",
  },
  {
    automated: true,
    automatedTestName:
      "studioResizeRegion leaves the height alone when a side node carries only the width",
    browser: true,
    browserTestName: "browser: studio region side node widens the layer without heightening it",
    canvasHandle: {
      exportCleanTestName: "browser: studio region handles stay out of the exported artifact",
      outputObservable:
        "The layer's confined area widens while its top and bottom stay where they were, so the field reaches the sides of the frame and no further up or down.",
      testId: "studio-region-node-east",
      writesTarget: "controls.setValue",
    },
    componentType: "canvas-handle",
    evidence: "product-output",
    expectedObservable:
      "Dragging a side node changes only the width of the selected layer's area, and the Region aspect slider follows it.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.regionHandle.side",
    interactionId: "shape-shaping",
    kind: "canvas-handle",
    target: "selectedLayer.maskAspect",
    userAction: "Drag the east node of the region on the canvas.",
  },
  {
    automated: true,
    automatedTestName:
      "studioRotateRegion turns the shape to follow the grip, carrying the angle it was grabbed at",
    browser: true,
    browserTestName: "browser: studio rotation grip turns the layer's shape on the canvas",
    canvasHandle: {
      exportCleanTestName: "browser: studio region handles stay out of the exported artifact",
      outputObservable:
        "The layer's shape swings about its own centre, so a triangle's apex leaves the top of the extent and appears at the side it was turned towards.",
      testId: "studio-region-rotate",
      writesTarget: "controls.setValue",
    },
    componentType: "canvas-handle",
    evidence: "product-output",
    expectedObservable:
      "Dragging the round grip above the shape turns the selected layer's shape about its own centre, and the extent nodes turn with it so a corner is still a corner of the shape.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.regionHandle.rotate",
    interactionId: "shape-shaping",
    kind: "canvas-handle",
    target: "selectedLayer.maskRotation",
    userAction: "Drag the round grip that sits above the shape on the canvas.",
  },
  {
    automated: true,
    automatedTestName: "declares the region shape offers a vocabulary of named forms",
    browser: true,
    browserTestName: "browser: studio region shape switches the rectangle for an ellipse",
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "Choosing Ellipse rounds the region off, so the corners of the rectangle it replaces fall outside the layer while the middle of each edge stays inside; choosing Triangle cuts the same extent down to three sides, so the two upper corners go and the bottom edge stays.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.maskShape",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    optionCoverage: "each-visible-item",
    target: "selectedLayer.maskShape",
    userAction:
      "Choose Ellipse as the region shape on a layer, then choose Triangle.",
  },
  {
    automated: true,
    automatedTestName: "declares the side count reshapes the polygon form",
    browser: true,
    browserTestName: "browser: studio region sides reshape the polygon",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "With Polygon chosen, dropping Region sides to three cuts the shape's corners back to a triangle, so the upper corners of the extent that a many-sided polygon reached fall outside the layer while its centre stays inside. The control is absent for every named form, which carries its own count.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.maskSides",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.maskSides",
    userAction: "Choose Polygon as the region shape, then drag Region sides.",
  },
  // The `selectedLayer.maskRotation` control row retired with 15.3 along with
  // the slider it proved. The turn is not unproved: it is the canvas-handle row
  // above, which drives the grip that now owns it.
  {
    automated: true,
    automatedTestName: "declares the region sense swaps which side the layer draws on",
    browser: true,
    browserTestName: "browser: studio region sense swaps which side the layer draws on",
    componentType: "switch",
    evidence: "rendered-pixels",
    expectedObservable:
      "Turning on Outside the region swaps which side of the rectangle the selected layer draws on, so the region becomes a hole in the layer rather than the whole of it.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.maskInvert",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.maskInvert",
    userAction: "Toggle Outside the region with a region size set.",
  },
  {
    automated: true,
    automatedTestName: "declares the colour slot count changes how many inks the layer cycles",
    browser: true,
    browserTestName: "browser: studio colour slots change how many inks the layer cycles",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Colour slots brings the third and fourth colours into the layer, so consecutive bands take consecutive inks instead of alternating between two.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.paletteSlots",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.paletteSlots",
    userAction: "Drag Colour slots with a layer selected.",
  },
  {
    automated: true,
    automatedTestName: "declares where two inks are mixed is an authored choice",
    browser: true,
    browserTestName: "browser: studio ink mixing space changes what falls between two colours",
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "How inks meet decides where the walk between two colours happens. Light mixes them as light does, so saturated opposites pass through a pale middle; Screen mixes them the way a display encodes them, keeping more chroma; Even mixes them perceptually, holding lightness steady across the walk. The ends of the walk are the inks the author chose in every case -- only what falls between them changes.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.mixSpace",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    optionCoverage: "each-visible-item",
    target: "selectedLayer.mixSpace",
    userAction: "Put two saturated opposite inks on a layer, then walk How inks meet through its three options.",
  },
  {
    automated: true,
    automatedTestName: "declares the third and fourth colours recolour the extra slots",
    browser: true,
    browserTestName: "browser: studio third palette colour recolours its own slot",
    componentType: "color",
    evidence: "rendered-pixels",
    expectedObservable:
      "With four colour slots in use, changing the third colour recolours the bands that carry it and leaves the other three inks untouched.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.colorC",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.colorC",
    userAction: "Raise Colour slots, then change the third colour.",
  },
  {
    automated: true,
    automatedTestName: "declares the fourth colour occupies the last slot",
    browser: true,
    browserTestName: "browser: studio fourth palette colour occupies the last slot",
    componentType: "color",
    evidence: "rendered-pixels",
    expectedObservable:
      "With four colour slots in use, changing the fourth colour recolours the last band of each cycle and leaves the other three inks untouched.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.colorD",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.colorD",
    userAction: "Raise Colour slots, then change the fourth colour.",
  },
  {
    automated: true,
    automatedTestName: "declares the fifth colour appears only once the slots reach it",
    browser: true,
    browserTestName:
      "browser: studio palette grows past four inks",
    componentType: "color",
    evidence: "rendered-pixels",
    expectedObservable:
      "The fifth colour is not offered at all until Colour slots reaches it, and once it is, changing it recolours the bands carrying that position of the cycle and leaves the other inks untouched.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.colorE",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.colorE",
    userAction: "Raise Colour slots past four, then change the fifth colour.",
  },
  {
    automated: true,
    automatedTestName: "declares the sixth colour appears only once the slots reach it",
    browser: true,
    browserTestName:
      "browser: studio palette cycle lengthens with every added ink",
    componentType: "color",
    evidence: "rendered-pixels",
    expectedObservable:
      "The sixth colour is not offered at all until Colour slots reaches it, and once it is, changing it recolours the bands carrying that position of the cycle and leaves the other inks untouched.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.colorF",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.colorF",
    userAction: "Raise Colour slots past four, then change the sixth colour.",
  },
  {
    automated: true,
    automatedTestName: "declares the seventh colour appears only once the slots reach it",
    browser: true,
    browserTestName:
      "browser: studio seventh ink takes its own turn in the cycle",
    componentType: "color",
    evidence: "rendered-pixels",
    expectedObservable:
      "The seventh colour is not offered at all until Colour slots reaches it, and once it is, changing it recolours the bands carrying that position of the cycle and leaves the other inks untouched. A gradient shows this differently: its stops walk across the frame while a layer shows a slice of it, so a late stop may not fall inside the shape at all.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.colorG",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.colorG",
    userAction: "Raise Colour slots past four, then change the seventh colour.",
  },
  {
    automated: true,
    automatedTestName: "declares the eighth colour appears only once the slots reach it",
    browser: true,
    browserTestName:
      "browser: studio palette hides the inks a lowered count no longer uses",
    componentType: "color",
    evidence: "rendered-pixels",
    expectedObservable:
      "The eighth colour is not offered at all until Colour slots reaches it, and once it is, changing it recolours the bands carrying that position of the cycle and leaves the other inks untouched.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.colorH",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.colorH",
    userAction: "Raise Colour slots past four, then change the eighth colour.",
  },
  {
    automated: true,
    automatedTestName: "declares band width changes the light-to-dark balance",
    browser: true,
    browserTestName: "browser: studio band width changes the selected layer's balance",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Band width widens each band against its neighbour without changing how many there are, and the control is absent while a gradient layer is selected.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.widthRatio",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.widthRatio",
    userAction: "Drag Band width with a stripes layer selected.",
  },
  {
    automated: true,
    automatedTestName: "declares the offset where each field body reads it",
    browser: true,
    browserTestName: "browser: studio offset slides the selected layer's field along its own axis",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Offset slides the selected layer's field along its own axis: a band sequence moves across the layer without changing band count or width, and a gradient's ramp slides so that the colour at a fixed place changes -- far enough either way and the transition is carried clear of the shape, leaving one end of the ramp everywhere. It is one operation over two kinds of field, so the control stays as the kind changes and is absent only for an image layer, which has no field of its own to shift.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.phase",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.phase",
    userAction:
      "Drag Offset with a stripes layer selected, then switch the layer to Gradient and drag it again.",
  },
  {
    automated: true,
    automatedTestName: "declares the transition shape redistributes the gradient",
    browser: true,
    browserTestName: "browser: studio transition shape redistributes the gradient",
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "Each transition shape distributes the same two colours differently across the selected gradient layer — along an axis, out from the centre, or around it — and the control is absent while a stripes layer is selected.",
    fixture:
      "Croix10 with a two-layer stack and the gradient layer selected",
    id: "selectedLayer.rampType",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    optionCoverage: "each-visible-item",
    target: "selectedLayer.rampType",
    userAction: "Switch Transition shape with a gradient layer selected.",
  },
];

/**
 * Background rows.
 *
 * Separate export because the Background section is an obligation of declaring
 * image export rather than part of the layer entity, and its rows belong beside
 * the section they cover rather than inside the layer list.
 */
export const studioBackgroundAcceptanceRows: readonly ToolcraftComponentAcceptance[] =
  [
    {
      automated: true,
      automatedTestName: "declares the background switch reveals and grounds the composite",
      backgroundOutputCoverage: [
        "preview-hidden-when-excluded",
        "image-transparent-when-excluded",
        "infinity-viewport-color-and-dependency",
        // Video keeps its ground even when the image drops it: an exported video
        // has no transparency to fall back to, so Background off still encodes
        // the selected colour rather than nothing.
        "video-background-preserved",
      ],
      browser: true,
      browserTestName: "browser: studio background switch grounds the composite",
      componentType: "switch",
      evidence: "rendered-pixels",
      expectedObservable:
        "Turning Background off makes the composite transparent wherever no layer is opaque, removes Background color, and exports a transparent PNG; turning it on restores the ground behind the stack in the preview, in the exported image, and as the infinity viewport colour that depends on it.",
      fixture: "Croix10 with a two-layer stack over the default ground",
      id: "background.include",
      kind: "control",
      target: "export.includeBackground",
      userAction: "Toggle Background.",
    },
    {
      automated: true,
      automatedTestName: "declares the background colour grounds preview and export alike",
      browser: true,
      browserTestName: "browser: studio background color grounds preview and export alike",
      componentType: "color",
      evidence: "rendered-pixels",
      expectedObservable:
        "Changing Background color recolours the ground the stack composites over, identically in the preview and in the exported image, while every layer keeps its own colours.",
      fixture: "Croix10 with Background on and a partly transparent stack",
      id: "background.color",
      kind: "control",
      target: "appearance.background",
      userAction: "Change Background color.",
    },
  ];

/**
 * Export rows.
 *
 * The picture, not the shader. Source leaves through the clipboard or the MCP
 * and is never an artifact (R55); these rows cover the image the runtime encodes.
 *
 * The infinity row is here rather than with the canvas because Export PNG on an
 * `editable-output` canvas is what obliges it — it arrives with the export
 * surface, not with the artboard.
 */
export const studioExportAcceptanceRows: readonly ToolcraftComponentAcceptance[] =
  [
    {
      automated: true,
      automatedTestName: "declares image export format selection coverage",
      browser: true,
      browserTestName:
        "browser: studio image export format changes the decoded artifact type",
      componentType: "select",
      evidence: "exported-bytes",
      expectedObservable:
        "Choosing PNG then JPG and exporting produces artifacts whose decoded media type matches the selection.",
      fixture: "Croix10 with a two-layer stack at its default values",
      id: "export.image-format",
      kind: "control",
      optionCoverage: "each-visible-item",
      target: "export.image.format",
      userAction:
        "Select each Format option in turn and export the image after each.",
    },
    {
      automated: true,
      automatedTestName: "declares image export resolution selection coverage",
      browser: true,
      browserTestName:
        "browser: studio image export resolution changes decoded pixel dimensions",
      componentType: "select",
      evidence: "exported-bytes",
      expectedObservable:
        "Choosing 2K then 4K and exporting produces artifacts whose decoded long edge is 2048 and 4096 pixels respectively, showing the same composition at a higher sample count rather than more bands.",
      fixture: "Croix10 with a two-layer stack at its default values",
      id: "export.image-resolution",
      kind: "control",
      optionCoverage: "each-visible-item",
      target: "export.image.resolution",
      userAction:
        "Select each Resolution option in turn and export the image after each.",
    },
    {
      automated: true,
      automatedTestName: "declares the video format options the pipeline fixes",
      browser: true,
      browserTestName:
        "browser: studio video export format changes the encoded artifact type",
      componentType: "select",
      evidence: "exported-bytes",
      expectedObservable:
        "Exporting at MP4 produces a decodable MP4; exporting at WebM produces a decodable WebM. The frames are the same either way -- the format selects the runtime's encoder, not what the renderer draws.",
      fixture: "Croix10 with a drifting one-layer stack",
      id: "export.video-format",
      kind: "control",
      optionCoverage: ["mp4", "webm"],
      target: "export.video.format",
      userAction: "Change the video format and export again.",
    },
    {
      automated: true,
      automatedTestName: "declares the video resolution options the pipeline fixes",
      browser: true,
      browserTestName:
        "browser: studio video export resolution changes the encoded dimensions",
      componentType: "select",
      evidence: "exported-bytes",
      expectedObservable:
        "Exporting at Current produces an artifact at the canvas's own dimensions; exporting at 4K produces one whose long edge is 4096. Duration and packet count are the same either way, because those follow the timeline rather than the size.",
      fixture: "Croix10 with a drifting one-layer stack",
      id: "export.video-resolution",
      kind: "control",
      optionCoverage: ["current", "4k"],
      target: "export.video.resolution",
      userAction: "Change the video resolution and export again.",
    },
    {
      // The footer is one surface and its coverage is checked against every
      // action in it, whichever row declares them -- so this names all three
      // while the row below carries the video artifact's own obligations.
      actionCoverage: ["copy-source", "export-image", "export-video"],
      automated: true,
      automatedTestName: "declares complete image export artifact behaviour",
      browser: true,
      browserTestName:
        "browser: studio export png produces a decodable layer stack artifact",
      componentType: "panelActions",
      evidence: "exported-bytes",
      expectedObservable:
        "Export PNG produces a non-empty decodable artifact containing the composited stack at the selected format and resolution, and the sticky footer indicator advances through render and download work before hiding.",
      exportArtifactCoverage: "all-required-image-export-behavior",
      fixture: "Croix10 with a two-layer stack at its default values",
      id: "export.image-action",
      kind: "control",
      target: "export.actions",
      userAction: "Press Export PNG in the sticky footer.",
    },
    {
      // Every footer action again: the check runs per row, and the footer is one
      // surface whichever row is describing it. What differs between the two
      // rows is the artifact each one proves, not the buttons they can see.
      actionCoverage: ["copy-source", "export-image", "export-video"],
      automated: true,
      automatedTestName: "declares complete video export artifact behaviour",
      browser: true,
      browserTestName: "browser: studio export video loops without a seam",
      componentType: "panelActions",
      evidence: "exported-bytes",
      expectedObservable:
        "Export Video produces a non-empty decodable artifact whose duration and packet count follow the runtime timeline at its fixed 30 FPS schedule, whose last frame meets its first with no visible jump on repeat, and which keeps the selected background even when the image export would drop it. The sticky footer indicator advances through render and download work before hiding.",
      exportArtifactCoverage: "all-required-video-export-behavior",
      fixture: "Croix10 with a drifting one-layer stack",
      id: "export.video-action",
      kind: "control",
      target: "export.actions",
      userAction: "Press Export Video in the sticky footer.",
    },
    {
      automated: true,
      automatedTestName:
        "declares infinite video export unions every frame's scene bounds",
      browser: true,
      browserTestName:
        "browser: studio infinite video export holds one frame size across the loop",
      componentType: "canvas",
      evidence: "exported-bytes",
      expectedObservable:
        "Exporting video from Infinity canvas crops to one envelope that contains every frame of the loop, so a composition that drifts outward is not clipped part-way through and the frame does not resize between packets.",
      fixture: "Croix10 on Infinity canvas with a drifting one-layer stack",
      id: "canvas.infinity-video-export",
      infinityCanvasCoverage: "scene-bounds-video-export",
      kind: "runtime",
      target: "canvas.infinity",
      userAction: "Turn Infinity canvas on, give a layer a drift, and press Export Video.",
    },
    {
      automated: true,
      automatedTestName:
        "declares infinite export crops to the union of visible scene bounds",
      browser: true,
      browserTestName:
        "browser: studio infinite export crops to the union of visible scene bounds",
      componentType: "canvas",
      evidence: "exported-bytes",
      expectedObservable:
        "Exporting from Infinity canvas crops the artifact to the union of the visible layers' bounds rather than to the viewport, so the same stack exports the same pixels regardless of where the workspace happens to be scrolled.",
      fixture: "Croix10 with a two-layer stack in finite mode at 1920x1080",
      id: "canvas.infinity-export",
      infinityCanvasCoverage: "scene-bounds-image-export",
      kind: "runtime",
      target: "canvas.infinity",
      userAction:
        "Turn Infinity canvas on, scroll the workspace, then export the image.",
    },
    {
      automated: true,
      automatedTestName:
        "declares infinity canvas mode and finite restoration coverage",
      browser: true,
      browserTestName:
        "browser: studio enters infinity canvas and restores the exact finite artboard",
      componentType: "canvas",
      evidence: "viewport-side-effect",
      expectedObservable:
        "Enabling Infinity canvas hides finite size controls and removes artboard clipping; disabling it restores the exact previous width, height, and artboard pixels.",
      fixture: "Croix10 with a two-layer stack in finite mode at 1920x1080",
      id: "canvas.infinity-mode",
      infinityCanvasCoverage: "mode-and-restoration",
      kind: "runtime",
      target: "canvas.infinity",
      userAction:
        "Toggle Infinity canvas on, observe the workspace, then toggle it off and compare the restored artboard.",
    },
    {
      automated: true,
      automatedTestName: "declares animation work yields while the view is moved",
      browser: true,
      browserTestName:
        "browser: studio holds the frame while the view is panned and resumes on the clock",
      componentType: "canvas",
      evidence: "viewport-side-effect",
      expectedObservable:
        "Panning or zooming a playing composition stops it redrawing for the length of the gesture: the frame on screen is the one that was already there. Play state is unchanged throughout -- nothing is paused and nothing is resumed -- and once the gesture ends the composition continues from the moment the clock reached rather than from the moment the drag stopped.",
      fixture: "Croix10 with a drifting single-layer stack, playback running",
      id: "canvas.viewport-yield",
      infinityCanvasCoverage: "mode-and-restoration",
      kind: "runtime",
      target: "canvas.infinity",
      userAction:
        "Start a drifting composition playing, then drag the canvas and watch the frame during and after the gesture.",
    },
    {
      automated: true,
      automatedTestName: "declares render scale changes preview backing pixels only",
      browser: true,
      browserTestName:
        "browser: studio render scale changes preview backing without changing the export",
      componentType: "slider",
      evidence: "rendered-pixels",
      expectedObservable:
        "Lowering Render scale reduces the preview's backing pixel dimensions while the composition and the exported artifact stay the same, so the control trades preview sharpness for responsiveness and nothing else.",
      fixture: "Croix10 with a two-layer stack at its default values",
      id: "canvas.render-scale",
      kind: "runtime",
      // "playback" joined the list with the transport that creates it, exactly
      // as the note here predicted it would: a render scale now has a playback
      // state to apply during, because the renderer runs continuously rather
      // than on edit.
      renderScaleCoverage: {
        kind: "selected-backing-pixels",
        states: ["interaction", "playback", "steady"],
      },
      target: "canvas.renderScale",
      userAction: "Drag Render scale in Setup.",
    },
  ];
