import { STUDIO_PRESETS } from "./studio-presets";

/**
 * The gallery: a picker, and the action that applies what it names (R71).
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
      entry: {
        semanticGroup: "gallery",
        applicability: { mode: "always" },
        defaultValue: STUDIO_PRESETS[0]?.id ?? "",
        label: "Composition",
        options: STUDIO_PRESETS.map((preset) => ({
          label: preset.label,
          value: preset.id,
        })),
        performanceReason:
          "Names an entry in a library held in memory; nothing is rendered until the entry is applied.",
        performanceRole: "responsiveness",
        target: "gallery.entry",
        type: "select",
      },
      // Both buttons on one control, which is not the first shape tried.
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
      apply: {
        semanticGroup: "gallery",
        applicability: { mode: "always" },
        actions: [
          { label: "Apply", value: "apply-preset" },
          { label: "Restore previous", value: "restore-stack" },
        ],
        label: "Chosen composition",
        performanceReason:
          "Replaces the stack once through runtime layer commands; the frame is redrawn by the same pass any edit uses.",
        performanceRole: "responsiveness",
        target: "gallery.actions",
        type: "actions",
      },
    },
    id: "gallery",
    title: "Gallery",
  },
] as const;
