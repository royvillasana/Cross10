import { STUDIO_TECHNIQUE_THUMBNAILS } from "./studio-technique-thumbnails";
import { STUDIO_PRESETS } from "./studio-presets";

/**
 * The gallery: a picker, and the action that applies what it names (R71).
 *
 * Two sections rather than one, and not by choice: `imagePicker` is a
 * standalone control, so the runtime gives it a section of its own whatever the
 * product declares. Declaring the split here rather than letting it happen is
 * what keeps the section ids stable -- an auto-split section is named with a
 * generated hash, which no inventory entry can name back.
 *
 * Two controls rather than one select that applies on change, because every
 * rendered control's value is persisted and R58 decided the gallery stores no
 * claim about the stack. A select that applied on change would store exactly
 * that claim, and it would be false the moment anything was edited. Named as a
 * picker, its value stays true whatever the author does next: it is the entry
 * you are looking at, not the composition you are in.
 *
 * The action sits in this section because that is where what it acts on is, and
 * because a preset is applied rather than configured -- there is nothing here to
 * gate and nothing gated by it.
 */
export const STUDIO_GALLERY_SECTIONS = [
  {
    controls: {
      // A picker of thumbnails rather than a list of names, because a name is
      // not what anyone is choosing between. "Physichromie 500" and "Lamella
      // Sweep" tell an author nothing about which one they want; the pictures
      // do, and they are the first thing the panel shows.
      //
      // `imagePicker` is the built-in for exactly this -- choosing one visual
      // option from a set of thumbnails -- and it owns its own grid, so the
      // item list is all that is passed. A product-authored gallery panel is
      // not an option in any case: custom controls may not recreate runtime
      // panels, and the runtime's dialog composites reach no product surface.
      //
      // Every thumbnail is a render the product itself produced from the entry
      // it selects (`npm run thumbnails`). An approximation would be a second
      // renderer free to drift, and a picture of something the app would not
      // actually draw misdescribes the technique it is selling.
      entry: {
        semanticGroup: "gallery",
        applicability: { mode: "always" },
        defaultValue: STUDIO_PRESETS[0]?.id ?? "",
        items: STUDIO_PRESETS.map((preset) => ({
          alt: preset.label,
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
    id: "gallery",
    title: "Gallery",
  },
  {
    controls: {
      // What the entry is aimed at, and the reason there are two action
      // controls below rather than one.
      //
      // The canvas target and the narrow targets are different verbs with
      // different blast radii. Aiming at the canvas *replaces* the composition:
      // it decides which layers exist, so it asks first. Aiming at a layer, a
      // group, or the pictures restyles layers that already exist: it creates
      // and destroys nothing, so it does not ask, and ordinary Undo takes it
      // back because the only thing it writes is one `controls.setValue`.
      //
      // Naming the target first and gating the presses on it is what keeps
      // those two verbs from sitting side by side under one label -- a
      // destructive press one pixel from an additive one is how a user learns
      // to dismiss the confirmation that protects them.
      target: {
        semanticGroup: "gallery",
        applicability: { mode: "always" },
        defaultValue: "canvas",
        label: "Apply it to",
        options: [
          { label: "The whole canvas", value: "canvas" },
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
      // The destructive press, and its confirmation, as one deliberate pair.
      //
      // Two presses rather than one, because there is no modal to raise:
      // product code may not author panels or dialogs, and the runtime exposes
      // neither composite. What is available is a control whose labels say what
      // is about to happen, so the labels carry the statement the confirmation
      // has to make.
      //
      // The first press arms and changes nothing on the canvas; the second
      // carries it out; the third abandons it. Arming is skipped entirely when
      // there is no work to replace -- an empty canvas has nothing to lose, and
      // asking anyway is how a confirmation becomes noise.
      apply: {
        semanticGroup: "gallery",
        applicability: {
          all: [{ oneOf: ["canvas"], target: "gallery.target" }],
          mode: "conditional",
        },
        actions: [
          { label: "Change the technique", value: "apply-preset" },
          { label: "Yes — replace my work", value: "confirm-preset" },
          { label: "Keep my work", value: "cancel-preset" },
        ],
        label: "Changing the technique replaces the current work",
        performanceReason:
          "Replaces the stack once through runtime layer commands; the frame is redrawn by the same pass any edit uses.",
        performanceRole: "responsiveness",
        target: "gallery.actions",
        type: "actions",
      },
      // The additive press. One button, no confirmation, and deliberately so:
      // confirming an action that adds to the work trains the user to dismiss
      // confirmations, which is what makes the destructive one dangerous.
      engine: {
        semanticGroup: "gallery",
        applicability: {
          all: [{ oneOf: ["group", "image", "layer"], target: "gallery.target" }],
          mode: "conditional",
        },
        actions: [{ label: "Apply to the selection", value: "apply-engine" }],
        label: "The rest of the stack is left alone",
        performanceReason:
          "Writes one record of per-layer values; the frame is redrawn by the same pass any edit uses.",
        performanceRole: "responsiveness",
        target: "gallery.engineActions",
        type: "actions",
      },
    },
    id: "gallery-apply",
    title: "Chosen composition",
  },
  {
    controls: {
      // Its own section, and its own entity, because what it acts on is not the
      // chosen entry -- it is the stack that was there before the last
      // replacement, whatever entry caused it. Sitting it beside the presses
      // would also make the target above its semantic peer, which would oblige
      // a proof that an ungated button is visible under each of four aims that
      // have nothing to do with it.
      //
      // Restore wants to appear only once there is a stack to come back to, and
      // that is not expressible: an applicability predicate may only name a
      // rendered control's target, and the snapshot is product-owned state with
      // no control of its own. A discriminant target written beside the snapshot
      // was rejected by the schema with "predicate target does not exist".
      //
      // So it is always offered and does nothing when nothing is held. The
      // alternative -- giving the snapshot a rendered control purely so a
      // predicate could read it -- would put a control in the panel that exists
      // for the schema rather than for the user.
      //
      // Restore exists at all because the runtime cannot express it as undo:
      // `layers.*` commands carry no `historyGroup`, so an application's deletes
      // and adds are separate history entries and no press count reaches the
      // stack underneath. Issue 7 in `docs/upstream/toolcraft-0.0.18-issues.md`.
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
    id: "gallery-restore",
    title: "Previous Stack",
  },
] as const;
