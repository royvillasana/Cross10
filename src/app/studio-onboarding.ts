import { getToolcraftCanvasAspectRatioPresetBySize } from "@/toolcraft/runtime/schema/canvas-aspect-ratio-presets";

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
/** Reopened over existing work, which is a replacement and has to be agreed to. */
export const STUDIO_ONBOARDING_REPLACING = "replacing";
/** Choosing what to work against, rather than what to make. */
export const STUDIO_ONBOARDING_REFERENCE = "reference";

export type StudioOnboardingStep =
  | typeof STUDIO_ONBOARDING_CHOOSING
  | typeof STUDIO_ONBOARDING_CLOSED
  | typeof STUDIO_ONBOARDING_REFERENCE
  | typeof STUDIO_ONBOARDING_REPLACING
  | typeof STUDIO_ONBOARDING_SIZING;

const STUDIO_ONBOARDING_STEPS = new Set<string>([
  STUDIO_ONBOARDING_CHOOSING,
  STUDIO_ONBOARDING_REFERENCE,
  STUDIO_ONBOARDING_REPLACING,
  STUDIO_ONBOARDING_SIZING,
]);

export function readStudioOnboardingStep(value: unknown): StudioOnboardingStep {
  return typeof value === "string" && STUDIO_ONBOARDING_STEPS.has(value)
    ? (value as StudioOnboardingStep)
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

/**
 * Choosing a card: recorded, and the flow moves on. Nothing is applied yet.
 *
 * Where it moves to depends on whether there is work to lose. On an empty canvas
 * the next question is how big it should be. Over an existing composition the
 * next question is whether the author means to replace it, because a technique
 * *is* a stack (R71) and changing it means becoming that stack.
 */
export function planStudioOnboardingChoice(
  choice: string,
  { hasWork = false }: { readonly hasWork?: boolean } = {},
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
      value: hasWork ? STUDIO_ONBOARDING_REPLACING : STUDIO_ONBOARDING_SIZING,
    },
  ];
}

/** Going back a step, which changes nothing but where the flow is. */
export function planStudioOnboardingStep(
  step: StudioOnboardingStep,
): readonly StudioOnboardingCommand[] {
  return [
    {
      history: "skip",
      target: STUDIO_ONBOARDING_TARGET,
      type: "controls.setValue",
      value: step,
    },
  ];
}

/**
 * Agreeing to replace the current work.
 *
 * The canvas is not resized here: an author who already has a composition chose
 * its dimensions once, and a technique change is not the moment to take that
 * back. Only the stack is replaced, through the same planner the gallery used,
 * so the snapshot that makes it revertible is captured by the plan rather than
 * by this caller.
 */
export function planStudioOnboardingReplacement({
  choice,
  layers,
  record,
  selectedLayerId,
}: {
  readonly choice: string;
  readonly layers: readonly StudioRuntimeLayer[];
  readonly record: StudioLayerRecord;
  readonly selectedLayerId: string | null;
}): readonly StudioOnboardingCommand[] {
  const preset = findStudioPreset(choice);
  if (!preset) return planStudioOnboardingDismissal();

  return [
    ...planStudioPresetApplication({ layers, preset, record, selectedLayerId }),
    ...planStudioOnboardingDismissal(),
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

    // ...and the aspect select beside it, which `canvas.setSize` does not touch.
    // Without this the flow lands an author on a 1080x1920 canvas whose Aspect
    // ratio reads "16:9" -- the runtime's untouched default -- directly above the
    // two numbers that say otherwise. One of the pair is wrong and the author has
    // no way to tell which, which is worse than either being blank.
    //
    // Matched by exact size through the runtime's own lookup rather than by
    // computing a ratio here, so the two agree by construction. A shape with no
    // preset writes nothing and leaves the select to derive what it can: 4:5 is
    // the case, and it is not in the runtime's list at all.
    const preset = getToolcraftCanvasAspectRatioPresetBySize({
      height: shape.height,
      unit: "px",
      width: shape.width,
    });
    if (preset) {
      commands.push({
        target: "canvas.aspectRatio",
        type: "controls.setValue",
        value: preset.value,
      });
    }
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
