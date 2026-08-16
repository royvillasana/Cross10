import {
  STUDIO_REFERENCE_COMPARE_TARGET,
  STUDIO_REFERENCE_OPACITY_TARGET,
} from "./studio-reference";

/**
 * The reference: something to aim at, and how hard to look at it.
 *
 * One section now. *Which* study to work against is chosen in the onboarding
 * dialog, because that is a decision taken before building and revisited
 * occasionally rather than a control that shapes the work. What stays is how
 * hard to look at it and how to read it against the work -- both adjusted while
 * looking at the canvas, which is exactly what the panel is for.
 */
export const STUDIO_REFERENCE_SECTIONS = [
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
