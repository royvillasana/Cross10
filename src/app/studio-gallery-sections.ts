import { STUDIO_TECHNIQUE_THUMBNAILS } from "./studio-technique-thumbnails";
import { STUDIO_PRESETS, studioPresetPickerLabel } from "./studio-presets";

/**
 * What is left in the panel now that choosing happens in a dialog.
 *
 * The thumbnails, the technique change and its confirmation all moved to the
 * onboarding flow, where they belong: they decide what the canvas *is*, and a
 * decision taken before there is work does not belong beside the controls that
 * shape the work afterwards. What stays here is the door back to that flow, the
 * way back from a replacement, and the narrow application -- the one that adds
 * to the work rather than replacing it.
 *
 * `gallery.entry` is still a value and is still what a narrow application
 * applies; it simply has no control any more. The dialog writes it, the panel
 * reads it, and one target keeps one meaning across both.
 */
export const STUDIO_GALLERY_SECTIONS = [
  {
    controls: {
      // The door. It reopens the flow rather than doing anything itself, which
      // is why it is one press with no confirmation attached: what it opens asks
      // its own question, and asking twice trains the answer out of anyone.
      open: {
        semanticGroup: "composition",
        applicability: { mode: "always" },
        actions: [
          { label: "Change the technique", value: "open-onboarding" },
          { label: "Work against a study", value: "open-reference" },
        ],
        label: "What the canvas is working in",
        performanceReason:
          "Opens a product surface; nothing is rendered and no value changes until a choice is made in it.",
        performanceRole: "responsiveness",
        target: "gallery.actions",
        type: "actions",
      },
    },
    id: "composition",
    title: "Composition",
  },
  {
    controls: {
      // Which composition the narrow application pushes.
      //
      // This is *not* the technique picker that moved into the flow, and the
      // difference is the whole reason it is here. The flow decides what the
      // canvas *is* -- a replacement, asked about, taken before there is work.
      // This decides what gets pushed onto a layer that already exists, which is
      // an edit to work in progress and belongs beside the press that makes it.
      //
      // Without it there was no user path to a narrow application at all: the
      // press read an entry only the flow could set, and setting it there
      // replaced the canvas. The proofs caught that by losing their fixture.
      entry: {
        semanticGroup: "apply",
        applicability: { mode: "always" },
        defaultValue: STUDIO_PRESETS[0]?.id ?? "",
        items: STUDIO_PRESETS.map((preset) => ({
          alt: studioPresetPickerLabel(preset),
          src: STUDIO_TECHNIQUE_THUMBNAILS[preset.id] ?? "",
          value: preset.id,
        })),
        label: "Composition",
        performanceReason:
          "Names an entry in a library held in memory; nothing is rendered until the entry is applied.",
        performanceRole: "responsiveness",
        target: "gallery.entry",
        type: "imagePicker",
      },
    },
    id: "composition-source",
    title: "Composition Source",
  },
  {
    controls: {
      // What a composition is aimed at, for the half that stays in the panel.
      //
      // The canvas aim went with the technique change, so what is left is the
      // additive half: applying a chosen construction to a layer, a group, or
      // the pictures. That is an edit to work that exists, which is what the
      // panel is for.
      target: {
        semanticGroup: "apply",
        applicability: { mode: "always" },
        defaultValue: "layer",
        label: "Apply a composition to",
        options: [
          { label: "The selected layer", value: "layer" },
          { label: "The selected group", value: "group" },
          { label: "The pictures", value: "image" },
        ],
        performanceReason:
          "Names which layers the next press writes to; nothing is rendered until the press.",
        performanceRole: "responsiveness",
        target: "gallery.target",
        type: "select",
      },
      engine: {
        semanticGroup: "apply",
        applicability: { mode: "always" },
        actions: [{ label: "Apply to the selection", value: "apply-engine" }],
        label: "The rest of the stack is left alone",
        performanceReason:
          "Writes one record of per-layer values; the frame is redrawn by the same pass any edit uses.",
        performanceRole: "responsiveness",
        target: "gallery.engineActions",
        type: "actions",
      },
    },
    id: "composition-apply",
    title: "Apply A Composition",
  },
  {
    controls: {
      // Restore wants to appear only once there is a stack to come back to, and
      // that is still not expressible: an applicability predicate may only name
      // a rendered control's target, and the snapshot is product-owned state
      // with no control of its own. So it is always offered and does nothing
      // when nothing is held.
      //
      // It stays in the panel rather than moving to the dialog because it is
      // read at a different moment from everything else here -- after a change,
      // looking at the result, deciding against it. A dialog you would have to
      // reopen in order to undo something is a worse home than a button beside
      // the work.
      restore: {
        semanticGroup: "previous-stack",
        applicability: { mode: "always" },
        actions: [{ label: "Restore previous", value: "restore-stack" }],
        label: "Undoing the last replacement",
        performanceReason:
          "Rebuilds the recorded stack once through runtime layer commands; the frame is redrawn by the same pass any edit uses.",
        performanceRole: "responsiveness",
        target: "gallery.restore",
        type: "actions",
      },
    },
    id: "composition-restore",
    title: "Previous Stack",
  },
] as const;
