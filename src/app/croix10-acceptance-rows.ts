/**
 * Croix10 acceptance rows.
 *
 * Split out of `app-acceptance-data.ts` so that file stays within its line budget
 * as engines and tools land: the row list grows with every control, while product
 * readiness and transfer mode are declared once. Each row names the automated test
 * and the browser test that prove it, so the two are derivable from one another.
 */

import type { ToolcraftComponentAcceptance } from "./acceptance/types";
import { croix10EngineAcceptanceRows } from "./croix10-acceptance-rows-engines";
import {
  croix10ProximityAcceptanceRows,
  croix10RampAcceptanceRows,
} from "./croix10-acceptance-rows-ramp";
import { appSchema } from "./app-schema";
import {
  CROIX10_MAX_PALETTE_SLOTS,
  CROIX10_STRIPE_COUNT,
} from "./croix10-parameters";

const persistenceSlices =
  appSchema.persistence.storage === "localStorage"
    ? appSchema.persistence.include
    : [];

export const appAcceptance: readonly ToolcraftComponentAcceptance[] = [
  {
    automated: true,
    automatedTestName:
      "declares the playback timeline drives the rendered field and loops seamlessly",
    browser: true,
    browserTestName:
      "browser: croix10 plays, scrubs, and loops the drifting field seamlessly",
    componentType: "timelinePanel",
    evidence: "rendered-pixels",
    expectedObservable:
      "With drift set, playing advances the field and pausing holds it; scrubbing to a time renders that time's field; the frame at the end of the loop is byte-identical to the frame at its start; and editing the duration changes how long the loop takes without changing the composition, after which the seam still matches.",
    fixture: "Croix10 with the interference layer drifting one cycle per loop",
    id: "timeline.playback",
    kind: "runtime",
    // The loop proof is a declaration of what forward-only seamlessness means
    // here; the browser test still samples the real renderer at both ends of the
    // loop rather than trusting it.
    timelineCoverage: "playback",
    timelineLoopProof: {
      direction: "forward-only",
      durationChange: "reproved-after-edit",
      reversePlayback: "forbidden",
      seam: "first-last-match",
    },
    timelinePlaybackCoverage: "all-playback-behavior",
    // Deliberately untargeted. The subject is the runtime timeline, which owns no
    // schema control target, and the framework's timeline evidence helpers attach
    // without one. Naming canvas.renderScale here — as this row once did — made
    // every derived requirement demand evidence at that target, which no timeline
    // helper can emit, so the row could never be satisfied.
    userAction:
      "Set a drift rate, press Play, pause, scrub to a time, read the field at the loop's first and last instant, then edit the duration and read the seam again.",
  },
  {
    automated: true,
    automatedTestName:
      "declares production reload coverage for the Croix10 schema",
    browser: true,
    // Named for the framework-owned persistence spec, which is signed and already
    // proves this exact reload behaviour; renaming its subject would break the
    // integrity manifest.
    browserTestName:
      "browser: app restores exact canvas, values, and panel workspace slices after reload",
    componentType: "persistence",
    evidence: "persistence-state",
    expectedObservable:
      "Canvas size and zoom, the edited band count, and the moved and collapsed Controls workspace remain visibly restored after a real browser reload.",
    fixture: "Croix10 runtime persisted workspace",
    id: "persistence.reload",
    kind: "runtime",
    persistenceCoverage: "reload",
    persistenceSlices,
    target: "canvas.size.width",
    userAction:
      "Edit Canvas width, Bands, and zoom, move and collapse Controls, wait for persistence, then reload the page.",
  },
  {
    automated: true,
    automatedTestName:
      "declares selected render scale backing for interaction, playback, and steady state",
    browser: true,
    browserTestName:
      "browser: croix10 keeps selected render scale backing pixels in every state",
    componentType: "canvas",
    evidence: "rendered-pixels",
    expectedObservable:
      "Canvas CSS size stays fixed while actual backing pixels equal CSS size times devicePixelRatio times the selected resolution scale.",
    fixture: "Croix10 chromatic field at the default band count",
    id: "canvas.render-scale",
    kind: "runtime",
    renderScaleCoverage: {
      kind: "selected-backing-pixels",
      states: ["interaction", "playback", "steady"],
    },
    target: "canvas.renderScale",
    userAction:
      "Move Resolution scale, drag the canvas, then let it settle while sampling backing pixels in each state.",
  },
  {
    automated: true,
    automatedTestName:
      "declares infinity canvas mode and finite restoration coverage",
    browser: true,
    browserTestName:
      "browser: croix10 enters infinity canvas and restores the exact finite artboard",
    componentType: "canvas",
    evidence: "viewport-side-effect",
    expectedObservable:
      "Enabling Infinity canvas hides finite size controls and removes artboard clipping; disabling it restores the exact previous width, height, and artboard pixels.",
    fixture: "Croix10 chromatic field in finite mode at 1920x1080",
    id: "canvas.infinity-mode",
    infinityCanvasCoverage: "mode-and-restoration",
    kind: "runtime",
    target: "canvas.infinity",
    userAction:
      "Toggle Infinity canvas on, observe the workspace, then toggle it off and compare the restored artboard.",
  },
  {
    automated: true,
    automatedTestName:
      "declares infinite image export crops to the product scene bounds",
    browser: true,
    browserTestName:
      "browser: croix10 infinite image export crops to the product scene bounds",
    componentType: "canvas",
    evidence: "exported-bytes",
    expectedObservable:
      "Exporting in infinite mode produces an artifact cropped to the fixed product scene rectangle rather than to the dormant finite size.",
    fixture: "Croix10 chromatic field with Infinity canvas enabled",
    id: "canvas.infinity-image-export",
    infinityCanvasCoverage: "scene-bounds-image-export",
    kind: "runtime",
    target: "canvas.infinity",
    userAction:
      "Enable Infinity canvas, trigger Export PNG, and decode the artifact bounds.",
  },
  {
    automated: true,
    automatedTestName: "declares background inclusion output coverage",
    backgroundOutputCoverage: [
      "image-transparent-when-excluded",
      "infinity-viewport-color-and-dependency",
      "preview-hidden-when-excluded",
    ],
    browser: true,
    browserTestName:
      "browser: croix10 background switch controls preview and artifact alpha",
    componentType: "switch",
    evidence: "product-output",
    expectedObservable:
      "Switching Background off hides the bounded product background in preview and makes the exported PNG transparent while the chromatic field remains.",
    fixture: "Croix10 chromatic field with a non-black background colour",
    id: "background.include",
    kind: "control",
    target: "export.includeBackground",
    userAction: "Toggle the Background switch in Setup and export a PNG.",
  },
  {
    automated: true,
    automatedTestName: "declares background colour drives rendered output",
    browser: true,
    browserTestName:
      "browser: croix10 background colour changes the rendered field backdrop",
    componentType: "color",
    evidence: "product-output",
    expectedObservable:
      "Choosing a different Background color changes the rendered backdrop behind the colour bands.",
    fixture: "Croix10 chromatic field with a wide separator so the backdrop reads",
    id: "background.color",
    kind: "control",
    target: "appearance.background",
    userAction: "Open Background color in Setup and select a different colour.",
  },
  {
    automated: true,
    automatedTestName: "declares band count changes the rendered band density",
    browser: true,
    browserTestName:
      "browser: croix10 band count drag changes density live during the gesture",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Dragging Bands changes how many colour bands are rendered, updating continuously during the drag rather than only on release.",
    fixture: `Croix10 chromatic field between ${CROIX10_STRIPE_COUNT.min} and ${CROIX10_STRIPE_COUNT.max} bands`,
    id: "stripe.count",
    interactionId: "chromatic-field-properties",
    kind: "control",
    target: "stripe.count",
    userAction: "Drag the Bands slider thumb across its range.",
  },
  {
    automated: true,
    automatedTestName: "declares width ratio narrows alternate bands",
    browser: true,
    browserTestName:
      "browser: croix10 width ratio narrows alternate bands in the rendered field",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Lowering Width ratio narrows every alternate band while the sequence period is preserved.",
    fixture: "Croix10 chromatic field at the default band count",
    id: "stripe.width-ratio",
    kind: "control",
    target: "stripe.widthRatio",
    userAction: "Drag the Width ratio slider from 1 toward its minimum.",
  },
  {
    automated: true,
    automatedTestName: "declares angle rotates the rendered stripe field",
    browser: true,
    browserTestName:
      "browser: croix10 angle rotates the rendered stripe field",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Raising Angle rotates the bands away from vertical while their perpendicular pitch is unchanged.",
    fixture: "Croix10 chromatic field at the default band count",
    id: "stripe.angle",
    kind: "control",
    target: "stripe.angle",
    userAction: "Drag the Angle slider to 45 degrees.",
  },
  {
    automated: true,
    automatedTestName: "declares phase shifts the rendered sequence sideways",
    browser: true,
    browserTestName:
      "browser: croix10 phase shifts the rendered sequence sideways",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Moving Phase slides the whole band sequence laterally without changing band widths.",
    fixture: "Croix10 chromatic field at the default band count",
    id: "stripe.phase",
    kind: "control",
    target: "stripe.phase",
    userAction: "Drag the Phase slider across a half period.",
  },
  {
    automated: true,
    automatedTestName:
      "declares wobble bends band boundaries and is exactly straight at zero",
    browser: true,
    browserTestName:
      "browser: croix10 wobble bends band boundaries and is straight at zero",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Raising Wobble bends the band boundaries laterally; returning it to zero renders perfectly straight boundaries again.",
    fixture: "Croix10 chromatic field at the default band count",
    id: "stripe.jitter-amount",
    kind: "control",
    target: "stripe.jitterAmount",
    userAction: "Drag Wobble up from zero and then back to zero.",
  },
  {
    automated: true,
    automatedTestName: "declares wobble rate changes the boundary wobble period",
    browser: true,
    browserTestName:
      "browser: croix10 wobble rate changes the boundary wobble period",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "With Wobble raised, changing Wobble rate changes how often the boundaries deviate along their length.",
    fixture: "Croix10 chromatic field with wobble raised above zero",
    id: "stripe.jitter-frequency",
    kind: "control",
    target: "stripe.jitterFrequency",
    userAction: "Raise Wobble, then drag the Wobble rate slider.",
  },
  {
    automated: true,
    automatedTestName: "declares mirror reflects the field about its axis",
    browser: true,
    browserTestName:
      "browser: croix10 mirror reflects the rendered field about its axis",
    componentType: "switch",
    evidence: "product-output",
    expectedObservable:
      "Enabling Mirror renders the two halves of the composition as reflections of one another.",
    fixture: "Croix10 chromatic field with phase offset so the seam is visible",
    id: "stripe.mirror",
    kind: "control",
    target: "stripe.mirror",
    userAction: "Toggle the Mirror switch.",
  },
  {
    automated: true,
    automatedTestName: "declares separator width changes the divider thickness",
    browser: true,
    browserTestName:
      "browser: croix10 separator width changes the rendered divider thickness",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Raising Separator thickens the dark dividing line between colour bands; lowering it to zero removes the divider so bands meet directly.",
    fixture: "Croix10 chromatic field at the default band count",
    id: "bands.separator-width",
    kind: "control",
    target: "bands.separatorWidth",
    userAction: "Drag the Separator slider from its default to zero and back.",
  },
  {
    automated: true,
    automatedTestName: "declares the shape is absent until an outline is chosen",
    browser: true,
    browserTestName:
      "browser: croix10 shape outline selection reveals the perturbation controls",
    componentType: "select",
    evidence: "product-output",
    expectedObservable:
      "With no outline the shape controls are absent and the field is unperturbed; choosing each outline reveals them and perturbs the field once strength is raised.",
    fixture: "Croix10 Couleur Additive module with wide band spacing",
    id: "shape.kind",
    kind: "control",
    optionCoverage: "each-visible-item",
    target: "shape.kind",
    userAction: "Choose each Outline option in turn and raise Shape strength.",
  },
  {
    automated: true,
    automatedTestName:
      "declares zero strength renders identically to having no shape",
    browser: true,
    browserTestName:
      "browser: croix10 shape strength reveals the shape and zero restores the plain field",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Shape strength makes the shape emerge from displaced bands; returning it to zero restores the field bit-identically, because the shape has no fill of its own.",
    fixture:
      "Croix10 Couleur Additive module with a circle outline already selected before load",
    id: "shape.strength",
    kind: "control",
    target: "shape.strength",
    userAction: "Raise Shape strength to its maximum, then return it to zero.",
  },
  {
    automated: true,
    automatedTestName: "declares the perturbation mode changes how bands react",
    browser: true,
    browserTestName:
      "browser: croix10 shape perturbation mode switches between phase and width",
    componentType: "select",
    evidence: "product-output",
    expectedObservable:
      "Switching Perturbs from Phase to Width changes the field from laterally displaced bands to locally narrowed ones.",
    fixture: "Croix10 with a circle outline and strength raised before load",
    id: "shape.mode",
    kind: "control",
    optionCoverage: "each-visible-item",
    target: "shape.mode",
    userAction: "Switch Perturbs between Width and Phase.",
  },
  {
    automated: true,
    automatedTestName: "declares shape size changes the perturbed region",
    browser: true,
    browserTestName:
      "browser: croix10 shape size changes how much of the field is perturbed",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Enlarging Shape size widens the region of displaced bands.",
    fixture: "Croix10 with a circle outline and strength raised before load",
    id: "shape.size",
    kind: "control",
    target: "shape.size",
    userAction: "Drag Shape size to its maximum.",
  },
  {
    automated: true,
    automatedTestName: "declares a preset for every engine series",
    browser: true,
    browserTestName:
      "browser: croix10 preset library loads a composition from each series",
    componentType: "select",
    evidence: "product-output",
    expectedObservable:
      "Choosing a preset stores the choice; loading it renders that composition and every panel control shows its values.",
    fixture: "Croix10 with the built-in preset library",
    id: "presets.active",
    kind: "control",
    optionCoverage: "each-visible-item",
    target: "presets.active",
    userAction: "Choose a preset from each series in turn and press Load.",
  },
  {
    automated: true,
    automatedTestName: "declares the preset load command writes schema targets",
    browser: true,
    browserTestName:
      "browser: croix10 loading a preset writes control values and is one undo step",
    componentType: "actions",
    actionCoverage: ["load-preset"],
    evidence: "product-output",
    expectedObservable:
      "Load writes the preset's targets through runtime commands, so the panel updates, the canvas re-renders, and a single undo restores the previous values.",
    fixture: "Croix10 with an edited band count before loading a preset",
    id: "presets.load",
    kind: "control",
    target: "presets.actions",
    userAction: "Press Load, then trigger runtime undo.",
  },
  {
    automated: true,
    automatedTestName: "declares randomize assigns in-range values in one step",
    browser: true,
    browserTestName:
      "browser: croix10 randomize assigns new in-range values as one undo step",
    componentType: "actions",
    actionCoverage: ["randomize"],
    evidence: "product-output",
    expectedObservable:
      "Randomize gives the unlocked composition new values inside their declared ranges, the field re-renders and never goes blank, and a single undo restores the previous values.",
    fixture: "Croix10 with every randomize lock off",
    id: "randomize.action",
    kind: "control",
    target: "randomize.actions",
    userAction: "Press Randomize, then trigger runtime undo.",
  },
  {
    automated: true,
    automatedTestName: "declares the stripe field lock excludes its targets",
    browser: true,
    browserTestName:
      "browser: croix10 stripe field lock survives randomize",
    componentType: "switch",
    evidence: "product-output",
    expectedObservable:
      "With the stripe field locked, Randomize still changes the rendered field through the unlocked groups, while the band count, angle, and wobble it protects are unchanged.",
    fixture: "Croix10 with the stripe field lock on and every other lock off",
    id: "randomize.lock-stripe",
    kind: "control",
    target: "stripe.randomizeLock",
    userAction: "Turn the stripe field lock on and press Randomize.",
  },
  {
    automated: true,
    automatedTestName: "declares the palette lock excludes its targets",
    browser: true,
    browserTestName:
      "browser: croix10 palette lock survives randomize",
    componentType: "switch",
    evidence: "product-output",
    expectedObservable:
      "With the palette locked, Randomize still changes the rendered field through the unlocked groups, while every colour slot it protects is unchanged.",
    fixture: "Croix10 with the palette lock on and every other lock off",
    id: "randomize.lock-palette",
    kind: "control",
    target: "palette.randomizeLock",
    userAction: "Turn the palette lock on and press Randomize.",
  },
  {
    automated: true,
    automatedTestName: "declares the immersive field lock excludes its targets",
    browser: true,
    browserTestName:
      "browser: croix10 immersive field lock survives randomize",
    componentType: "switch",
    evidence: "product-output",
    expectedObservable:
      "With the immersive field locked, Randomize still changes the rendered field through the unlocked groups, while the spread and balance it protects are unchanged.",
    fixture: "Croix10 with the immersive field lock on and every other lock off",
    id: "randomize.lock-immersion",
    kind: "control",
    target: "immersion.randomizeLock",
    userAction: "Turn the immersive field lock on and press Randomize.",
  },
  {
    automated: true,
    automatedTestName: "declares the plane lock excludes its targets",
    browser: true,
    browserTestName:
      "browser: croix10 plane lock survives randomize",
    componentType: "switch",
    evidence: "product-output",
    expectedObservable:
      "With the planes locked, Randomize still changes the rendered field through the unlocked groups, while every sheet's colour, opacity, offset, and rotation is unchanged.",
    fixture: "Croix10 with the translucent planes lock on and every other lock off",
    id: "randomize.lock-planes",
    kind: "control",
    target: "transchromie.randomizeLock",
    userAction: "Turn the translucent planes lock on and press Randomize.",
  },
  {
    automated: true,
    automatedTestName: "declares the randomize shortcut and its suppression",
    browser: true,
    browserTestName:
      "browser: croix10 the R key randomizes and is suppressed while typing",
    componentType: "actions",
    actionCoverage: ["randomize"],
    evidence: "product-output",
    expectedObservable:
      "Pressing R changes the rendered field exactly as the button does and honours every lock; while a text field has focus, R belongs to the field and the composition is untouched.",
    fixture: "Croix10 with every randomize lock off",
    id: "randomize.shortcut",
    kind: "control",
    target: "randomize.actions",
    userAction:
      "Press R with the canvas focused, then focus a palette hex field and press R again.",
  },
  {
    automated: true,
    automatedTestName:
      "declares palette collection add, remove, and item coverage",
    browser: true,
    browserTestName:
      "browser: croix10 palette collection adds, edits, and removes colour slots",
    componentType: "collectionActions",
    controlPartCoverage: [
      "collectionActions.add",
      "collectionActions.items",
      "collectionActions.remove",
    ],
    evidence: "product-output",
    expectedObservable:
      "Adding a slot lengthens the rendered colour sequence, editing one slot recolours only its bands while siblings are preserved, and removing the final slot shortens the sequence.",
    fixture: `Croix10 palette between two and ${CROIX10_MAX_PALETTE_SLOTS} colour slots`,
    id: "palette.slots",
    kind: "control",
    target: "palette.slots",
    userAction:
      "Press the palette add control up to its limit, edit a middle slot's colour, then press remove.",
  },
  {
    automated: true,
    automatedTestName: "declares cycling offset rotates band colours",
    browser: true,
    browserTestName:
      "browser: croix10 cycling offset rotates which band takes which colour",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Advancing Cycle rotates the palette so each band takes the colour previously used by its neighbour, wrapping at the end.",
    fixture: "Croix10 palette with three visibly distinct colours",
    id: "palette.cycling-offset",
    kind: "control",
    target: "palette.cyclingOffset",
    userAction: "Drag the Cycle slider through one whole step.",
  },
  {
    automated: true,
    automatedTestName: "declares image export format selection coverage",
    browser: true,
    browserTestName:
      "browser: croix10 image export format changes the decoded artifact type",
    componentType: "select",
    evidence: "exported-bytes",
    expectedObservable:
      "Choosing PNG then JPG and exporting produces artifacts whose decoded media type matches the selection.",
    fixture: "Croix10 chromatic field at the default band count",
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
      "browser: croix10 image export resolution changes decoded pixel dimensions",
    componentType: "select",
    evidence: "exported-bytes",
    expectedObservable:
      "Choosing 2K then 4K and exporting produces artifacts whose decoded long edge is 2048 and 4096 pixels respectively, showing the same composition rather than more bands.",
    fixture: "Croix10 chromatic field at the default band count",
    id: "export.image-resolution",
    kind: "control",
    optionCoverage: "each-visible-item",
    target: "export.image.resolution",
    userAction:
      "Select each Resolution option in turn and export the image after each.",
  },
  {
    automated: true,
    automatedTestName: "declares complete image export artifact behaviour",
    browser: true,
    browserTestName:
      "browser: croix10 export png produces a decodable chromatic field artifact",
    componentType: "panelActions",
    evidence: "exported-bytes",
    expectedObservable:
      "Export PNG produces a non-empty decodable artifact containing the chromatic field at the selected format and resolution, and the sticky footer indicator advances through render and download work before hiding.",
    actionCoverage: ["export-image"],
    exportArtifactCoverage: "all-required-image-export-behavior",
    fixture: "Croix10 chromatic field at the default band count",
    id: "export.image-action",
    kind: "control",
    target: "export.actions",
    userAction: "Press Export PNG in the sticky footer.",
  },  ...croix10EngineAcceptanceRows,
  ...croix10RampAcceptanceRows,
  ...croix10ProximityAcceptanceRows,
];
