import { STUDIO_PRESETS, studioPresetPickerLabel } from "./studio-presets";
import { STUDIO_TECHNIQUE_THUMBNAILS } from "./studio-technique-thumbnails";

/**
 * A reference to author against, and the reason it is a built-in rather than
 * the user's own file.
 *
 * The change this implements asked for a user-loaded image. That is not
 * expressible: every route the framework offers for reading a user's file goes
 * through the runtime's media import, which creates a layer for every asset
 * unconditionally — no branch on kind, on source target, or on whether the
 * layers panel is even enabled — and a custom control may not stand in for the
 * built-in uploader. A guide that arrives as a layer is not a guide; it is
 * content, in the compositing order, one drag from being part of the artwork.
 * Recorded as issue 10 in `docs/upstream/toolcraft-0.0.18-issues.md`.
 *
 * What is expressible is a reference the product already owns: the same renders
 * the gallery shows, put *behind the canvas* instead of *onto it*. That keeps
 * every property the requirement was protecting — it is not a layer, it is not
 * in compositing order, it is not selectable, and it cannot reach an artifact —
 * and gives up only the one thing the framework will not allow.
 *
 * **The two pickers are not the same act and the surface has to say so.** The
 * gallery's picker *replaces the canvas* with a construction. This one changes
 * nothing about the composition at all: it puts a picture behind the work so an
 * author can see how far off they are. Same images, opposite verbs.
 *
 * Everything here is a value the product owns and the renderer never sees. The
 * scene the renderer draws has no field for a reference, which is what makes
 * "the export never receives it" a property of the types rather than a promise
 * about a code path.
 */

/** Which built-in render is shown behind the work. */
export const STUDIO_REFERENCE_ENTRY_TARGET = "reference.entry";

/**
 * How strongly it shows, and how it is dismissed.
 *
 * Zero is the default and zero is "no reference", which is why there is no
 * separate switch to gate the rest: a guide nobody has turned up is not
 * displayed, and one turned back down to zero has been dismissed without
 * anything else in the product moving. A switch beside the slider would be a
 * second control answering the same question, and the two would eventually
 * disagree.
 */
export const STUDIO_REFERENCE_OPACITY_TARGET = "reference.opacity";

/** Overlay, or the difference between the two. */
export const STUDIO_REFERENCE_COMPARE_TARGET = "reference.compare";

export const STUDIO_REFERENCE_OVERLAY = "overlay";
export const STUDIO_REFERENCE_DIFFERENCE = "difference";

export type StudioReferenceCompare =
  | typeof STUDIO_REFERENCE_DIFFERENCE
  | typeof STUDIO_REFERENCE_OVERLAY;

/** The entries offered as references, which are the entries the gallery offers. */
export const STUDIO_REFERENCE_ITEMS = STUDIO_PRESETS.map((preset) => ({
  alt: studioPresetPickerLabel(preset),
  src: STUDIO_TECHNIQUE_THUMBNAILS[preset.id] ?? "",
  value: preset.id,
}));

export function readStudioReferenceCompare(value: unknown): StudioReferenceCompare {
  return value === STUDIO_REFERENCE_DIFFERENCE
    ? STUDIO_REFERENCE_DIFFERENCE
    : STUDIO_REFERENCE_OVERLAY;
}

export function readStudioReferenceOpacity(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0;
}

/**
 * The render a chosen entry names, or the first one when nothing is chosen yet.
 *
 * The fallback exists because the choice moved into a dialog. As a control it
 * carried a `defaultValue`; as a plain value it starts undefined, and without a
 * fallback the strength slider in the panel moved with nothing to show — which
 * reads as a broken slider rather than as an unmade choice.
 */
export function readStudioReferenceSource(value: unknown): string {
  const chosen = typeof value === "string" ? STUDIO_TECHNIQUE_THUMBNAILS[value] : undefined;
  return chosen ?? STUDIO_REFERENCE_ITEMS[0]?.src ?? "";
}

export type StudioReferenceView = Readonly<{
  compare: StudioReferenceCompare;
  opacity: number;
  /** Empty whenever nothing should be drawn, so the caller has one condition. */
  src: string;
}>;

/**
 * What the overlay should show, derived from committed values alone.
 *
 * Pure, and separate from the component, because the interesting part is the
 * *nothing* case: at zero opacity, or with an entry that names no render, the
 * overlay must draw nothing at all rather than draw a transparent element. An
 * element that is present but invisible is the shape a leak takes — it survives
 * a screenshot, a compositing change, or a future export path that walks the
 * DOM.
 */
export function readStudioReferenceView(
  values: Readonly<Record<string, unknown>>,
): StudioReferenceView {
  const opacity = readStudioReferenceOpacity(values[STUDIO_REFERENCE_OPACITY_TARGET]);
  const src = readStudioReferenceSource(values[STUDIO_REFERENCE_ENTRY_TARGET]);

  return {
    compare: readStudioReferenceCompare(values[STUDIO_REFERENCE_COMPARE_TARGET]),
    opacity,
    src: opacity > 0 ? src : "",
  };
}

/**
 * The two ways a study can be read against the work.
 *
 * Held here rather than in the dialog that renders them, because the reader
 * below already decides what a valid compare value is and two lists would
 * eventually disagree about it.
 */
export const STUDIO_REFERENCE_COMPARE_MODES = [
  {
    hint: "the study behind the work",
    label: "Laying it over",
    value: "overlay",
  },
  {
    // Difference collapses "identical" to black, which answers *how far off am
    // I* rather than *are both pictures present*.
    hint: "black where they agree",
    label: "Their difference",
    value: "difference",
  },
] as const;

/**
 * How strongly a study shows, as named stops rather than a continuous scale.
 *
 * Four, and the ends matter most: `Hidden` is how a study is dismissed without
 * anything else moving, and `Full` is the reading where a difference comparison
 * is at its most legible. The two between are for looking through the study at
 * the work and for looking at both at once.
 */
export const STUDIO_REFERENCE_STRENGTHS = [
  { label: "Hidden", value: 0 },
  { label: "Faint", value: 0.25 },
  { label: "Half", value: 0.5 },
  { label: "Full", value: 1 },
] as const;
