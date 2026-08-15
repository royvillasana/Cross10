import {
  STUDIO_REFERENCE_ITEMS,
  STUDIO_REFERENCE_COMPARE_TARGET,
  STUDIO_REFERENCE_ENTRY_TARGET,
  STUDIO_REFERENCE_OPACITY_TARGET,
} from "./studio-reference";

/**
 * The reference: something to aim at, and how hard to look at it.
 *
 * Two sections rather than one for the same reason the gallery is two:
 * `imagePicker` is a standalone control, so the runtime gives it a section of
 * its own whatever the product declares. Declaring the split keeps the ids
 * nameable by the inventory.
 *
 * Placed after the gallery and before the layer sections, which is the order
 * the work happens in: see what the techniques look like, put one behind the
 * canvas to work against, then build.
 */
export const STUDIO_REFERENCE_SECTIONS = [
  {
    controls: {
      // The same pictures the gallery offers, and deliberately the same ones:
      // the library is what this product knows how to make, so it is also what
      // it can honestly ask an author to reproduce.
      //
      // The verbs are opposite and the titles carry that. The gallery's picker
      // *replaces the canvas*. This one changes nothing about the composition —
      // it puts a picture behind the work so the author can see how far off
      // they are, and pressing nothing is what applies it.
      entry: {
        semanticGroup: "reference",
        applicability: { mode: "always" },
        defaultValue: STUDIO_REFERENCE_ITEMS[0]?.value ?? "",
        items: STUDIO_REFERENCE_ITEMS,
        label: "Study",
        performanceReason:
          "Names a picture already held in memory; it is drawn by the browser beside the canvas rather than by the renderer.",
        performanceRole: "responsiveness",
        target: STUDIO_REFERENCE_ENTRY_TARGET,
        type: "imagePicker",
      },
    },
    id: "reference",
    title: "Reference",
  },
  {
    controls: {
      // Zero by default, and zero is how a reference is dismissed.
      //
      // No switch beside it: a guide nobody has turned up is not displayed, and
      // one turned back to zero has been dismissed without anything else in the
      // product moving. A switch would be a second control answering the same
      // question, and two controls over one condition eventually disagree.
      opacity: {
        semanticGroup: "reference",
        applicability: { mode: "always" },
        defaultValue: 0,
        label: "Reference opacity",
        max: 1,
        min: 0,
        performanceReason:
          "One CSS opacity on an element the browser composites; the renderer draws nothing extra and the pass is untouched.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: STUDIO_REFERENCE_OPACITY_TARGET,
        type: "slider",
      },
      // More than opacity, because at fifty percent every mismatch looks like a
      // mismatch — including one that is only a difference in brightness.
      // Difference collapses "identical" to black, which is the reading an
      // author actually wants: it answers *how far off am I* rather than
      // *are both pictures present*.
      compare: {
        semanticGroup: "reference",
        applicability: { mode: "always" },
        defaultValue: "overlay",
        label: "Compare by",
        options: [
          { label: "Laying it over", value: "overlay" },
          { label: "Their difference", value: "difference" },
        ],
        performanceReason:
          "Selects a CSS blend mode on one element; no renderer work changes and no pass is added.",
        performanceRole: "responsiveness",
        target: STUDIO_REFERENCE_COMPARE_TARGET,
        type: "select",
      },
    },
    id: "reference-view",
    title: "Reference View",
  },
] as const;
