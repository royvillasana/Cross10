import {
  STUDIO_PRESETS,
  findStudioPreset,
  planStudioPresetApplication,
  studioPresetPickerLabel,
  type StudioPreset,
} from "./studio-presets";
import { STUDIO_TECHNIQUE_THUMBNAILS } from "./studio-technique-thumbnails";
import type { StudioLayerRecord, StudioRuntimeLayer } from "./studio-stack-state";

/**
 * The flow a user meets before there is a canvas: pick something to make, size
 * it, and land on it.
 *
 * **This deviates from a decision contract, deliberately and on the record.**
 * `decision-contracts.ts:61` lists the surfaces a product may render into, and a
 * modal is not among them: `controlRenderers` requires a `builtInFitCheck` that
 * modality cannot honestly supply, `canvasContent` "must not contain buttons,
 * forms, CTAs, helper text, upload prompts, menus, settings UI", and
 * `infiniteCanvasContent` takes no pointer input. Upstream issue 14 asks for a
 * surface; none exists today.
 *
 * The product owner asked for this flow three times and, told it was blocked,
 * instructed that it be built anyway. So it is built here, in product code,
 * using the runtime's own `Dialog` composite — which the product boundary does
 * permit importing (`studio-dialog-boundary.test.ts`).
 *
 * **No framework file is modified.** `src/toolcraft/**` stays signed and the
 * integrity gate stays green; the deviation is a contract judgement rather than
 * a tampered dependency, which is the reversible half of the two.
 *
 * Everything the flow decides is written through ordinary runtime commands
 * against the targets the control surface already uses, so persistence, reset
 * and history behave exactly as they do for any other edit. The flow stores no
 * canvas size, no layer, and no composition of its own.
 */

/** Which step is showing, or that the flow is closed. */
export const STUDIO_ONBOARDING_TARGET = "stack.onboardingStep";

/** The entry the flow is about to start from, before it has been applied. */
export const STUDIO_ONBOARDING_CHOICE_TARGET = "stack.onboardingChoice";

/**
 * Whether the user has answered the flow, by finishing it or by leaving it.
 *
 * Needed because "has not started" cannot be read from an empty canvas alone:
 * *start from nothing* finishes the flow and leaves nothing, so a rule keyed on
 * the layer count reopens the flow on the very canvas it just created, forever.
 * That was the first thing the proofs caught.
 *
 * It also answers the design's open question about deleting every layer
 * mid-session: an author who empties their canvas has already answered, so they
 * are left alone.
 */
export const STUDIO_ONBOARDING_SETTLED_TARGET = "stack.onboardingSettled";

export const STUDIO_ONBOARDING_CLOSED = "closed";
export const STUDIO_ONBOARDING_CHOOSING = "choosing";
export const STUDIO_ONBOARDING_SIZING = "sizing";

export type StudioOnboardingStep =
  | typeof STUDIO_ONBOARDING_CHOOSING
  | typeof STUDIO_ONBOARDING_CLOSED
  | typeof STUDIO_ONBOARDING_SIZING;

export function readStudioOnboardingStep(value: unknown): StudioOnboardingStep {
  return value === STUDIO_ONBOARDING_CHOOSING || value === STUDIO_ONBOARDING_SIZING
    ? value
    : STUDIO_ONBOARDING_CLOSED;
}

/** Starting from nothing, which is a choice rather than the absence of one. */
export const STUDIO_ONBOARDING_BLANK = "blank";

export function readStudioOnboardingChoice(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** A card in the first step: a technique, or the blank canvas beside them. */
export type StudioOnboardingCard = Readonly<{
  label: string;
  preset: StudioPreset | null;
  src: string;
  value: string;
}>;

export const STUDIO_ONBOARDING_CARDS: readonly StudioOnboardingCard[] = [
  {
    label: "Start from nothing",
    preset: null,
    src: "",
    value: STUDIO_ONBOARDING_BLANK,
  },
  ...STUDIO_PRESETS.map((preset) => ({
    label: studioPresetPickerLabel(preset),
    preset,
    src: STUDIO_TECHNIQUE_THUMBNAILS[preset.id] ?? "",
    value: preset.id,
  })),
];

/**
 * The output shapes offered when the canvas is sized.
 *
 * Named for the shape rather than for a platform. The dimensions are facts about
 * a picture; a product that brands them takes on a claim it cannot keep the day
 * the platform changes its numbers. `4:5` in particular has no runtime aspect
 * preset — the list is 1:1, 3:2, 16:9, 3:4, 9:16, 2:3, 4:3 — which is why these
 * are set as real width and height rather than as a ratio.
 */
export type StudioOutputShape = Readonly<{
  height: number;
  label: string;
  value: string;
  width: number;
}>;

export const STUDIO_OUTPUT_SHAPES: readonly StudioOutputShape[] = [
  { height: 1080, label: "Square (1:1)", value: "square", width: 1080 },
  { height: 1350, label: "Portrait (4:5)", value: "portrait", width: 1080 },
  { height: 1920, label: "Vertical (9:16)", value: "vertical", width: 1080 },
  { height: 1080, label: "Landscape (16:9)", value: "landscape", width: 1920 },
];

export function findStudioOutputShape(value: unknown): StudioOutputShape | null {
  return STUDIO_OUTPUT_SHAPES.find((shape) => shape.value === value) ?? null;
}

export type StudioOnboardingCommand = Readonly<Record<string, unknown>>;

/**
 * Whether the flow should open on its own.
 *
 * Two conditions, and the second was learned the hard way. An empty canvas alone
 * is not "has not started": *start from nothing* finishes the flow and leaves
 * nothing, so keying on the layer count alone reopened the flow on the canvas it
 * had just created, forever. What is asked is whether the user has *answered* —
 * by finishing or by leaving — and separately whether there is anything to come
 * back to.
 */
export function shouldStudioOnboardingOpen({
  layerCount,
  settled,
  step,
}: {
  readonly layerCount: number;
  readonly settled: boolean;
  readonly step: StudioOnboardingStep;
}): boolean {
  return step === STUDIO_ONBOARDING_CLOSED && !settled && layerCount === 0;
}

/** Choosing a card: recorded, and the flow moves on. Nothing is applied yet. */
export function planStudioOnboardingChoice(
  choice: string,
): readonly StudioOnboardingCommand[] {
  return [
    {
      history: "skip",
      target: STUDIO_ONBOARDING_CHOICE_TARGET,
      type: "controls.setValue",
      value: choice,
    },
    {
      history: "skip",
      target: STUDIO_ONBOARDING_TARGET,
      type: "controls.setValue",
      value: STUDIO_ONBOARDING_SIZING,
    },
  ];
}

/**
 * Leaving without finishing, which must be indistinguishable from never having
 * started.
 *
 * One write, and it is the step. No canvas, no layer, no value — a half-finished
 * setup that left the canvas partly configured would be a state nobody chose,
 * which is worse than the state they were in.
 */
export function planStudioOnboardingDismissal(): readonly StudioOnboardingCommand[] {
  return [
    {
      history: "skip",
      target: STUDIO_ONBOARDING_SETTLED_TARGET,
      type: "controls.setValue",
      value: true,
    },
    {
      history: "skip",
      target: STUDIO_ONBOARDING_TARGET,
      type: "controls.setValue",
      value: STUDIO_ONBOARDING_CLOSED,
    },
  ];
}

/** Reopening it later, from the panel, to change what the canvas is working in. */
export function planStudioOnboardingReopen(): readonly StudioOnboardingCommand[] {
  return [
    {
      history: "skip",
      target: STUDIO_ONBOARDING_TARGET,
      type: "controls.setValue",
      value: STUDIO_ONBOARDING_CHOOSING,
    },
  ];
}

/**
 * Confirming: the canvas is created at the chosen size and the chosen entry is
 * rendered on it.
 *
 * Ordered so nothing is half-done. The size lands first, because a composition
 * applied before it would be built against the old dimensions and then reflowed
 * by the very step that was supposed to precede it. The entry lands second,
 * through the same planner the gallery uses — one code path decides what
 * applying a technique means, and the flow is a caller rather than a second
 * implementation.
 *
 * Nothing is applied for a blank start beyond the size, which is what "start
 * from nothing" has to mean.
 */
export function planStudioOnboardingConfirmation({
  background,
  choice,
  layers,
  record,
  selectedLayerId,
  shape,
}: {
  readonly background: string;
  readonly choice: string;
  readonly layers: readonly StudioRuntimeLayer[];
  readonly record: StudioLayerRecord;
  readonly selectedLayerId: string | null;
  readonly shape: StudioOutputShape | null;
}): readonly StudioOnboardingCommand[] {
  const commands: StudioOnboardingCommand[] = [];

  if (shape) {
    // The runtime's own canvas size, not a size the flow keeps. Canvas sizing has
    // one owner; this is that owner reached before there is a canvas, rather
    // than a second one.
    commands.push({
      size: { height: shape.height, width: shape.width },
      type: "canvas.setSize",
    });
  }

  if (background) {
    commands.push({
      target: "appearance.background",
      type: "controls.setValue",
      value: background,
    });
  }

  const preset = findStudioPreset(choice);
  if (preset) {
    commands.push(
      ...planStudioPresetApplication({ layers, preset, record, selectedLayerId }),
    );
  }

  commands.push(
    {
      history: "skip",
      target: STUDIO_ONBOARDING_SETTLED_TARGET,
      type: "controls.setValue",
      value: true,
    },
    {
      history: "skip",
      target: STUDIO_ONBOARDING_TARGET,
      type: "controls.setValue",
      value: STUDIO_ONBOARDING_CLOSED,
    },
  );

  return commands;
}
