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
      apply: {
        semanticGroup: "gallery",
        applicability: { mode: "always" },
        // One button, so the control's label is the context it acts in rather
        // than a repeat of the button beside it.
        actions: [{ label: "Apply", value: "apply-preset" }],
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
