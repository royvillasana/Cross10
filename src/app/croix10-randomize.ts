import {
  doesToolcraftApplicabilityMatch,
  type ResolvedToolcraftControlSchema,
  type ToolcraftState,
} from "@/toolcraft/runtime";

import { appSchema } from "./app-schema";

/**
 * Randomize, derived from the schema rather than from a parallel table.
 *
 * Every value comes out of the control's own declared domain — `min`, `max`, `step`,
 * `options`, or a collection's `itemControls` — so a range can never drift out of
 * agreement with the schema, and a control added later is randomized on the same
 * terms without a second declaration. Nothing is randomized that the panel is not
 * currently showing: a control whose applicability does not match would be an
 * invisible change, and an invisible change is indistinguishable from a bug.
 *
 * Scope is deliberately narrower than "every parameter". These four sections are the
 * ones that describe a composition rather than refine one, and between them every
 * engine has something to randomize — stripes and palette for the four banded
 * engines, immersion for Chromosaturation, sheets for Transchromie. Viewer parallax,
 * the afterimage fringe, the interference relationship, and the embedded shape are
 * left alone on purpose: randomizing them tends to destroy a composition rather than
 * find one. Extending randomize to them later means adding their lock switches too,
 * because a randomizable section without a lock is a section the user cannot protect.
 */

export type Croix10RandomizeGroup = Readonly<{
  lockTarget: string;
  sectionId: string;
  targets: readonly string[];
}>;

export const CROIX10_RANDOMIZE_GROUPS: readonly Croix10RandomizeGroup[] = [
  {
    lockTarget: "stripe.randomizeLock",
    sectionId: "stripe-field",
    targets: [
      "stripe.count",
      "stripe.widthRatio",
      "stripe.angle",
      "stripe.phase",
      "stripe.jitterAmount",
      "stripe.jitterFrequency",
      "stripe.mirror",
    ],
  },
  {
    lockTarget: "palette.randomizeLock",
    sectionId: "palette",
    targets: ["palette.slots"],
  },
  {
    lockTarget: "immersion.randomizeLock",
    sectionId: "field-immersion",
    targets: ["immersion.spread", "immersion.balance"],
  },
  {
    lockTarget: "transchromie.randomizeLock",
    sectionId: "translucent-planes",
    targets: ["transchromie.planes"],
  },
];

export const CROIX10_RANDOMIZE_LOCK_TARGETS = CROIX10_RANDOMIZE_GROUPS.map(
  (group) => group.lockTarget,
);

/**
 * Floors that keep a randomized composition from being technically in range and
 * visually nothing. A width ratio at zero collapses every alternate band, and a
 * handful of bands across 1920 pixels is a colour field rather than a stripe field.
 */
const CROIX10_RANDOMIZE_FLOORS: Readonly<Record<string, number>> = {
  "stripe.count": 12,
  "stripe.widthRatio": 0.2,
};

const CROIX10_RANDOMIZE_CEILINGS: Readonly<Record<string, number>> = {
  // Well inside the Nyquist bound: at the very top of the range a random angle can
  // put the field at the edge of what the pixel grid resolves, and a preset the user
  // did not choose should not land them there.
  "stripe.count": 320,
};

export type Croix10RandomAssignment = Readonly<{
  target: string;
  value: unknown;
}>;

type Random = () => number;

function collectControls(): Map<string, ResolvedToolcraftControlSchema> {
  const controls = new Map<string, ResolvedToolcraftControlSchema>();
  for (const section of appSchema.panels.controls?.sections ?? []) {
    for (const control of Object.values(section.controls)) {
      if (typeof control.target === "string") {
        controls.set(control.target, control);
      }
    }
  }
  return controls;
}

function snap(value: number, step: number | undefined): number {
  if (typeof step !== "number" || !Number.isFinite(step) || step <= 0) {
    return value;
  }
  return Math.round(value / step) * step;
}

function randomNumberInRange(
  random: Random,
  target: string,
  min: number,
  max: number,
  step: number | undefined,
): number {
  const low = Math.max(min, CROIX10_RANDOMIZE_FLOORS[target] ?? min);
  const high = Math.min(max, CROIX10_RANDOMIZE_CEILINGS[target] ?? max);
  const span = Math.max(high - low, 0);
  const raw = low + random() * span;
  // Snapping can leave the value a step outside the range at either end, so the
  // clamp is after the snap rather than before it.
  return Math.min(Math.max(snap(raw, step), low), high);
}

function randomHex(random: Random): string {
  // Full saturation at a random hue, so a randomized palette reads as colour
  // relationships rather than as mud. Cruz-Diez's palettes are saturated.
  const hue = random() * 360;
  const sector = Math.floor(hue / 60) % 6;
  const fraction = hue / 60 - Math.floor(hue / 60);
  const rising = Math.round(fraction * 255);
  const falling = 255 - rising;
  const channels: readonly [number, number, number] = [
    [255, rising, 0],
    [falling, 255, 0],
    [0, 255, rising],
    [0, falling, 255],
    [rising, 0, 255],
    [255, 0, falling],
  ][sector] as [number, number, number];
  return `#${channels
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function randomizeValue(
  control: ResolvedToolcraftControlSchema,
  currentValue: unknown,
  random: Random,
): unknown {
  switch (control.type) {
    case "slider":
      return randomNumberInRange(
        random,
        control.target ?? "",
        typeof control.min === "number" ? control.min : 0,
        typeof control.max === "number" ? control.max : 1,
        control.step,
      );
    case "switch":
      return random() < 0.5;
    case "select":
      return (
        control.options?.[Math.floor(random() * (control.options.length || 1))]
          ?.value ?? control.defaultValue
      );
    case "collectionActions":
      return randomizeCollection(control, currentValue, random);
    default:
      // A control type randomize does not understand keeps its value rather than
      // receiving a guess: a wrong shape written into state is worse than no change.
      return currentValue;
  }
}

/**
 * Randomizes a collection's existing records without changing how many there are.
 *
 * Cardinality is the user's composition decision — how many colours are in play,
 * how many sheets are stacked — so randomize varies what the records say and never
 * how many there are.
 */
function randomizeCollection(
  control: ResolvedToolcraftControlSchema,
  currentValue: unknown,
  random: Random,
): unknown {
  const items = Array.isArray(currentValue)
    ? currentValue
    : Array.isArray(control.defaultValue)
      ? control.defaultValue
      : [];

  if (control.itemControl?.type === "color") {
    return items.map(() => randomHex(random));
  }

  const itemControls = control.itemControls;
  if (!itemControls) return currentValue;

  return items.map((item) => {
    const record =
      item !== null && typeof item === "object"
        ? { ...(item as Record<string, unknown>) }
        : {};
    for (const [field, fieldControl] of Object.entries(itemControls)) {
      switch (fieldControl.type) {
        case "color":
          record[field] = randomHex(random);
          break;
        case "slider":
          record[field] = randomNumberInRange(
            random,
            `${control.target}.${field}`,
            typeof fieldControl.min === "number" ? fieldControl.min : 0,
            typeof fieldControl.max === "number" ? fieldControl.max : 1,
            fieldControl.step,
          );
          break;
        case "vector": {
          const min = typeof fieldControl.min === "number" ? fieldControl.min : -1;
          const max = typeof fieldControl.max === "number" ? fieldControl.max : 1;
          record[field] = {
            x: randomNumberInRange(random, "", min, max, fieldControl.step),
            y: randomNumberInRange(random, "", min, max, fieldControl.step),
          };
          break;
        }
        default:
          break;
      }
    }
    return record;
  });
}

/**
 * The assignments one randomize should dispatch.
 *
 * Pure, and the source of randomness is injected, so the range and lock rules are
 * provable without a browser.
 */
export function buildCroix10RandomizeAssignments(
  state: ToolcraftState,
  random: Random = Math.random,
): readonly Croix10RandomAssignment[] {
  const controls = collectControls();
  const readTarget = (target: string): unknown => state.values[target];
  const assignments: Croix10RandomAssignment[] = [];

  for (const group of CROIX10_RANDOMIZE_GROUPS) {
    if (state.values[group.lockTarget] === true) continue;
    for (const target of group.targets) {
      const control = controls.get(target);
      if (!control) continue;
      if (!doesToolcraftApplicabilityMatch(control.applicability, readTarget)) {
        continue;
      }
      const value = randomizeValue(control, state.values[target], random);
      if (value === undefined) continue;
      assignments.push({ target, value });
    }
  }

  return assignments;
}
