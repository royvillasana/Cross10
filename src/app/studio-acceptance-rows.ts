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
  "Shader Studio with a two-layer stack, a stripes layer below a gradient layer, the stripes layer selected";

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
    automatedTestName: "declares grouped layers move and hide as one",
    browser: true,
    browserTestName: "browser: studio layer group moves and hides its members together",
    componentType: "layers",
    evidence: "rendered-pixels",
    expectedObservable:
      "Grouping two layers lets them be moved and hidden as one: hiding the group removes both contributions from the composite, and moving the group past a third layer moves both members past it in the same order.",
    fixture:
      "Shader Studio with a three-layer stack, the lower two grouped together",
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
    browserTestName: "browser: studio layer colours recolour only the selected layer",
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
    automatedTestName: "declares the region confines the layer to a rectangle",
    browser: true,
    browserTestName: "browser: studio region confines the layer to a rectangle",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Region size confines the selected layer to a rectangle centred on the frame, so the layer draws inside it and whatever sits beneath shows everywhere else.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.maskSize",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.maskSize",
    userAction: "Drag Region size with a layer selected.",
  },
  {
    automated: true,
    automatedTestName: "declares the region shape switches between a rectangle and an ellipse",
    browser: true,
    browserTestName: "browser: studio region shape switches the rectangle for an ellipse",
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "Choosing Ellipse rounds the region off, so the corners of the rectangle it replaces fall outside the layer while the middle of each edge stays inside.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.maskShape",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.maskShape",
    userAction: "Size a region, then choose Ellipse as the region shape.",
  },
  {
    automated: true,
    automatedTestName: "declares the region rotation turns the region about its own centre",
    browser: true,
    browserTestName: "browser: studio region rotation turns the region about its own centre",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Turning Region rotation swings a wide region off the horizontal, so it reaches above and below the frame's midline where it did not and stops reaching the sides.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.maskRotation",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.maskRotation",
    userAction: "Size a wide region, then drag Region rotation.",
  },
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
    automatedTestName: "declares the region aspect reshapes the rectangle",
    browser: true,
    browserTestName: "browser: studio region aspect reshapes the rectangle",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Region aspect widens the region without making it taller, so the layer reaches the sides of the frame while its top and bottom edges stay where they were.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.maskAspect",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.maskAspect",
    userAction: "Drag Region aspect with a region size set.",
  },
  {
    automated: true,
    automatedTestName: "declares the region moves across the frame",
    browser: true,
    browserTestName: "browser: studio region moves across the frame",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Dragging Region across moves the region horizontally, so the side of the frame it uncovers and the side it covers swap.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.maskCenterX",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.maskCenterX",
    userAction: "Drag Region across with a region size set.",
  },
  {
    automated: true,
    automatedTestName: "declares the region moves down the frame",
    browser: true,
    browserTestName: "browser: studio region moves down the frame",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Dragging Region down moves the region vertically, so the top and bottom of the frame trade which one the layer covers.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.maskCenterY",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.maskCenterY",
    userAction: "Drag Region down with a region size set.",
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
    automatedTestName: "declares the offset slides the band sequence",
    browser: true,
    browserTestName: "browser: studio offset slides the selected layer's bands",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Offset slides the whole band sequence across the selected layer without changing band count or width, and the control is absent while a gradient layer is selected.",
    fixture: SELECTED_LAYER_FIXTURE,
    id: "selectedLayer.phase",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    target: "selectedLayer.phase",
    userAction: "Drag Offset with a stripes layer selected.",
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
      "Shader Studio with a two-layer stack and the gradient layer selected",
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
      ],
      browser: true,
      browserTestName: "browser: studio background switch grounds the composite",
      componentType: "switch",
      evidence: "rendered-pixels",
      expectedObservable:
        "Turning Background off makes the composite transparent wherever no layer is opaque, removes Background color, and exports a transparent PNG; turning it on restores the ground behind the stack in the preview, in the exported image, and as the infinity viewport colour that depends on it.",
      fixture: "Shader Studio with a two-layer stack over the default ground",
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
      fixture: "Shader Studio with Background on and a partly transparent stack",
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
      fixture: "Shader Studio with a two-layer stack at its default values",
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
      fixture: "Shader Studio with a two-layer stack at its default values",
      id: "export.image-resolution",
      kind: "control",
      optionCoverage: "each-visible-item",
      target: "export.image.resolution",
      userAction:
        "Select each Resolution option in turn and export the image after each.",
    },
    {
      actionCoverage: ["copy-source", "export-image"],
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
      fixture: "Shader Studio with a two-layer stack at its default values",
      id: "export.image-action",
      kind: "control",
      target: "export.actions",
      userAction: "Press Export PNG in the sticky footer.",
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
      fixture: "Shader Studio with a two-layer stack in finite mode at 1920x1080",
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
      fixture: "Shader Studio with a two-layer stack in finite mode at 1920x1080",
      id: "canvas.infinity-mode",
      infinityCanvasCoverage: "mode-and-restoration",
      kind: "runtime",
      target: "canvas.infinity",
      userAction:
        "Toggle Infinity canvas on, observe the workspace, then toggle it off and compare the restored artboard.",
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
      fixture: "Shader Studio with a two-layer stack at its default values",
      id: "canvas.render-scale",
      kind: "runtime",
      // "playback" is deliberately absent: this app declares no timeline yet, so
      // there is no playback state for the scale to apply during. It joins the
      // list in the animation group, alongside the transport that creates it.
      renderScaleCoverage: {
        kind: "selected-backing-pixels",
        states: ["interaction", "steady"],
      },
      target: "canvas.renderScale",
      userAction: "Drag Render scale in Setup.",
    },
  ];
