import { appSchema } from "./app-schema";
import {
  collectStudioSelectedLayerEdit,
  projectStudioLayerEntry,
  readStudioLayerEntry,
  studioSelectedLayerTarget,
  STUDIO_LAYER_RECORD_TARGET,
  type StudioLayerRecord,
  type StudioLayerRecordEntry,
} from "./studio-stack-state";

/**
 * Randomize, and the four locks that decide what it is allowed to touch.
 *
 * A parametric instrument without a randomize is missing the way most people
 * actually use one: not to get a result, but to be shown a corner of the space
 * they would not have typed. What makes that useful rather than a slot machine
 * is the locks — an author keeps the part they like and rerolls the rest, which
 * turns one press into a search.
 *
 * **Values come from the schema, not from a table here.** Every randomizable
 * control is looked up in the declarations the panel itself renders, and the new
 * value is drawn inside that control's own `min`, `max`, `step` or option list.
 * A local copy of those ranges would agree with itself forever and drift from
 * the panel the first time either moved -- and the failure would be a slider
 * sitting past its own end, which reads as a rendering bug rather than as a
 * stale constant.
 *
 * **One press is one undo.** The plan writes the record once and projects the
 * selected layer's controls from it with `history: "skip"`, which is the same
 * shape a targeted preset application uses and for the same reason: a layer
 * lives in two places, and writing only the record lasts until the next sync
 * pass reads the untouched controls as an edit and puts everything back.
 */

/** One lockable group: what it covers, and the switch that excludes it. */
export type StudioRandomizeGroup = Readonly<{
  id: string;
  label: string;
  lockTarget: string;
  /** Uniform names, which `studioSelectedLayerTarget` turns into control targets. */
  uniforms: readonly string[];
}>;

/**
 * The four groups, and what is deliberately outside all of them.
 *
 * Each group is a thing an author would want to keep *whole* while rerolling
 * the rest, which is the only property that makes a lock worth having. Splitting
 * the palette from the field is the obvious one; separating motion from both is
 * the one that earns its place, because a drift that survives a reroll is how a
 * composition keeps its rhythm while changing its face.
 *
 * Excluded, and each for a reason rather than for being awkward:
 *
 * - **The layer kind.** Rerolling stripes into a gradient does not vary a
 *   composition, it replaces it. Randomize explores inside what the author
 *   built.
 * - **Following the pointer.** That is a relationship with the viewer, not a
 *   property of the work; a random one would move under the mouse in a way the
 *   author never asked for and could not see standing still.
 * - **The region and the treatments.** Where a layer is confined and how its
 *   colour is corrected afterwards are decisions *about* a composition rather
 *   than parameters within it -- and a random region is the fastest way to make
 *   a reroll look broken, because most of the frame simply empties.
 * - **Opacity and blend.** The same argument: they describe how a layer meets
 *   the stack, and a random one hides work the author is trying to look at.
 * - **The imported source.** A picture's mapping belongs to the picture.
 */
export const STUDIO_RANDOMIZE_GROUPS: readonly StudioRandomizeGroup[] = [
  {
    id: "field",
    label: "Lock the field",
    lockTarget: "randomize.lockField",
    uniforms: [
      "angle",
      "count",
      "jitterAmount",
      "mirror",
      "rampType",
      "separator",
      "taper",
      "widthRatio",
    ],
  },
  {
    id: "palette",
    label: "Lock the palette",
    lockTarget: "randomize.lockPalette",
    uniforms: ["colorA", "colorB", "colorC", "colorD", "paletteSlots"],
  },
  {
    id: "engine",
    label: "Lock the engine",
    lockTarget: "randomize.lockEngine",
    uniforms: ["engine", "engineAmount", "enginePitch"],
  },
  {
    id: "motion",
    label: "Lock the motion",
    lockTarget: "randomize.lockMotion",
    uniforms: ["driftAngle", "driftPhase"],
  },
];

/**
 * The action that rerolls, and the section both it and the locks live in.
 *
 * Named in the `randomize.*` family rather than under `stack.*`, which is not
 * cosmetic: the delivery catalog requires one acceptance domain per spec file,
 * so a press named `stack.randomize` beside locks named `randomize.lock*` would
 * split one feature's proofs across two files and leave neither able to state
 * the whole claim.
 */
export const STUDIO_RANDOMIZE_TARGET = "randomize.actions";
export const STUDIO_RANDOMIZE_ACTION = "randomize";

/** As much of a control declaration as choosing a value needs. */
export type StudioRandomizableControl = Readonly<{
  max?: number;
  min?: number;
  options?: readonly Readonly<{ value: unknown }>[];
  step?: number;
  type?: string;
}>;

/** A source of randomness, so a proof can pin one instead of hoping. */
export type StudioRandomSource = () => number;

function quantize(value: number, step: number | undefined, min: number): number {
  if (!step || !Number.isFinite(step) || step <= 0) {
    // Two decimals rather than full precision. A slider that reports
    // 0.7364918273 is telling the author something untrue about how finely they
    // can work, and every control here is either stepped or continuous at a
    // scale where hundredths are below the eye.
    return Math.round(value * 100) / 100;
  }

  return min + Math.round((value - min) / step) * step;
}

/**
 * A new value for one control, inside what that control declares.
 *
 * Returns `undefined` rather than guessing when the declaration says nothing
 * usable -- a control with no range and no options is one this does not
 * understand, and writing a value into it anyway is how a randomize starts
 * producing states the panel cannot represent.
 */
export function randomStudioControlValue(
  control: StudioRandomizableControl,
  random: StudioRandomSource,
): unknown {
  if (control.type === "switch") return random() < 0.5;

  if (control.options && control.options.length > 0) {
    const index = Math.min(
      control.options.length - 1,
      Math.floor(random() * control.options.length),
    );
    return control.options[index]?.value;
  }

  if (control.type === "color") {
    /**
     * Vivid rather than uniform in RGB, and that is a judgement about the
     * subject rather than about randomness.
     *
     * Three independent channels average to mud: most of the RGB cube is a
     * desaturated brown, so a "random palette" drawn from it produces the same
     * dull composition every time with the hue slightly moved. This product is
     * about what saturated inks do to one another when they meet at a band
     * edge, so the hue is what varies and the saturation stays where the
     * subject lives, with the lightness spread enough to keep the inks apart.
     */
    const hue = random() * 360;
    const saturation = 0.62 + random() * 0.38;
    const lightness = 0.32 + random() * 0.44;
    return hslToStudioHex(hue, saturation, lightness);
  }

  const min = control.min;
  const max = control.max;
  if (typeof min !== "number" || typeof max !== "number" || max <= min) {
    return undefined;
  }

  const raw = min + random() * (max - min);
  return Math.min(max, Math.max(min, quantize(raw, control.step, min)));
}

/** HSL to the `#rrggbb` a colour control reads. */
export function hslToStudioHex(
  hue: number,
  saturation: number,
  lightness: number,
): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = (((hue % 360) + 360) % 360) / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const [red, green, blue] =
    sector < 1
      ? [chroma, second, 0]
      : sector < 2
        ? [second, chroma, 0]
        : sector < 3
          ? [0, chroma, second]
          : sector < 4
            ? [0, second, chroma]
            : sector < 5
              ? [second, 0, chroma]
              : [chroma, 0, second];
  const offset = lightness - chroma / 2;
  const channel = (value: number): string =>
    Math.round(Math.min(1, Math.max(0, value + offset)) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

/**
 * Which control targets a reroll may write, given the locks.
 *
 * Separate from the planning so the decision can be read on its own: "what did
 * this press claim it was allowed to touch" is the question a lock failure
 * makes you ask, and answering it should not require a record and a layer list.
 */
export function studioRandomizableTargets(
  locks: Readonly<Record<string, unknown>>,
): readonly string[] {
  return STUDIO_RANDOMIZE_GROUPS.filter(
    (group) => locks[group.lockTarget] !== true,
  ).flatMap((group) => group.uniforms.map(studioSelectedLayerTarget));
}

/**
 * What one press of Randomize asks the runtime to do.
 *
 * A plan rather than a dispatch, so the part worth testing -- which targets
 * moved, which were spared, and that the values are inside their declared
 * ranges -- is testable without a runtime.
 *
 * The record is merged rather than written whole: layers this does not name keep
 * what they had, and a locked group keeps what it had on every layer this does
 * name. Both are the same promise from different directions, and both are lost
 * by the obvious implementation, which builds a fresh entry per layer and
 * quietly resets everything it did not think to copy.
 */
export function planStudioRandomization({
  controls,
  layerIds,
  locks,
  random,
  record,
  selectedLayerId = null,
}: {
  /** Control declarations by target, from the schema the panel renders. */
  readonly controls: Readonly<Record<string, StudioRandomizableControl>>;
  readonly layerIds: readonly string[];
  readonly locks: Readonly<Record<string, unknown>>;
  readonly random: StudioRandomSource;
  readonly record: StudioLayerRecord;
  readonly selectedLayerId?: string | null;
}): readonly Readonly<Record<string, unknown>>[] {
  const targets = studioRandomizableTargets(locks);
  // Everything locked is not a smaller reroll, it is no reroll: writing the
  // record anyway would put an undo step on the stack for a press that changed
  // nothing, which is worse than the press doing nothing.
  if (targets.length === 0 || layerIds.length === 0) return [];

  const next: Record<string, StudioLayerRecordEntry> = { ...record };
  for (const layerId of layerIds) {
    const values: Record<string, unknown> = {};
    for (const target of targets) {
      const control = controls[target];
      if (!control) continue;
      // Drawn per layer rather than once and copied: two layers given the same
      // values are a duplicate, and a stack of duplicates is the one result a
      // reroll must not produce.
      const value = randomStudioControlValue(control, random);
      if (value !== undefined) values[target] = value;
    }

    next[layerId] = collectStudioSelectedLayerEdit(
      readStudioLayerEntry(record, layerId),
      values,
    );
  }

  const commands: Readonly<Record<string, unknown>>[] = [
    {
      label: "Randomize",
      target: STUDIO_LAYER_RECORD_TARGET,
      type: "controls.setValue",
      value: next as StudioLayerRecord,
    },
  ];

  // The controls have to follow, or the write lasts exactly until the next sync
  // pass reads the untouched panel as an edit and puts the old values back --
  // the press looks like it worked and the canvas never moves. Skipped from
  // history because loading a layer's values into the controls is a consequence
  // of the record write above rather than a second edit beside it.
  const selectedEntry = selectedLayerId ? next[selectedLayerId] : undefined;
  if (selectedLayerId && layerIds.includes(selectedLayerId) && selectedEntry) {
    for (const assignment of projectStudioLayerEntry(selectedEntry)) {
      commands.push({
        history: "skip",
        target: assignment.target,
        type: "controls.setValue",
        value: assignment.value,
      });
    }
  }

  return commands;
}

/**
 * Every randomizable control, as the schema declares it.
 *
 * Read from the assembled schema rather than restated, which is the point: the
 * ranges a reroll draws inside are the ranges the panel renders, so they cannot
 * disagree. Restating them would produce a slider sitting past its own end the
 * first time either moved, and that reads as a rendering fault rather than as a
 * stale constant.
 *
 * Filtered to the randomizable targets rather than returning the whole schema,
 * because the caller should not be able to reroll something no group claims by
 * passing a wider map.
 */
export function studioRandomizableControls(): Readonly<
  Record<string, StudioRandomizableControl>
> {
  const wanted = new Set(
    STUDIO_RANDOMIZE_GROUPS.flatMap((group) =>
      group.uniforms.map(studioSelectedLayerTarget),
    ),
  );
  const controls: Record<string, StudioRandomizableControl> = {};

  for (const section of appSchema.panels.controls?.sections ?? []) {
    for (const control of Object.values(section.controls ?? {})) {
      const target = String(control.target);
      if (!wanted.has(target)) continue;
      controls[target] = control as StudioRandomizableControl;
    }
  }

  return controls;
}
