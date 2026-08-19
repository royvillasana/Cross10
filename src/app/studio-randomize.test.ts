import { describe, expect, it } from "vitest";

import { appSchema } from "./app-schema";
import {
  planStudioRandomization,
  randomStudioControlValue,
  studioRandomizableControls,
  studioRandomizableTargets,
  STUDIO_RANDOMIZE_GROUPS,
} from "./studio-randomize";
import {
  readStudioLayerEntry,
  studioSelectedLayerTarget,
  STUDIO_LAYER_RECORD_TARGET,
  type StudioLayerRecord,
} from "./studio-stack-state";

/**
 * A reroll, and the four locks that bound it.
 *
 * The interesting claims are all about *restraint* rather than about randomness:
 * that nothing leaves its declared range, that a locked group is untouched, and
 * that one press is one thing the runtime can undo. Randomness itself is fed in,
 * so none of this is a test that happens to pass on a lucky draw.
 */

/** A deterministic stand-in for `Math.random`, cycling a fixed sequence. */
function sequence(values: readonly number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

const RECORD: StudioLayerRecord = {
  "layer-1": { typeId: "stripes", values: { count: 12, colorA: [1, 0, 0] } },
  "layer-2": { typeId: "gradient", values: { count: 5 } },
};

describe("rerolling a composition", () => {
  it("declares a reroll writes every unlocked target inside its declared range", () => {
    const controls = studioRandomizableControls();
    // Extremes rather than a middle: a value drawn at 0 and at 1 is where an
    // off-by-one in the quantizer shows up, and a mid-range draw would sit
    // comfortably inside a broken range and prove nothing.
    for (const draw of [0, 0.0001, 0.5, 0.9999, 1]) {
      for (const [target, control] of Object.entries(controls)) {
        const value = randomStudioControlValue(control, () => draw);
        if (typeof value !== "number") continue;
        expect(value, `${target} at draw ${draw}`).toBeGreaterThanOrEqual(
          control.min ?? Number.NEGATIVE_INFINITY,
        );
        expect(value, `${target} at draw ${draw}`).toBeLessThanOrEqual(
          control.max ?? Number.POSITIVE_INFINITY,
        );
      }
    }

    // A select never invents an option, which is the failure that would render
    // as a layer drawing nothing rather than as a bad value.
    const engine = controls[studioSelectedLayerTarget("engine")];
    expect(engine?.options?.length ?? 0).toBeGreaterThan(1);
    const chosen = new Set(
      [0, 0.3, 0.6, 0.99].map((draw) =>
        randomStudioControlValue(engine ?? {}, () => draw),
      ),
    );
    const declared = new Set((engine?.options ?? []).map((option) => option.value));
    for (const value of chosen) expect(declared.has(value)).toBe(true);

    // And the press is one history step: exactly one recorded command, with the
    // control projection that follows it skipped. Two recorded writes would
    // need two undos, and the first would leave the record and the panel
    // disagreeing about what the layer is.
    const commands = planStudioRandomization({
      controls,
      layerIds: ["layer-1", "layer-2"],
      locks: {},
      random: sequence([0.1, 0.4, 0.7, 0.9]),
      record: RECORD,
      selectedLayerId: "layer-1",
    });
    const recorded = commands.filter((command) => command.history !== "skip");
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.target).toBe(STUDIO_LAYER_RECORD_TARGET);
    expect(commands.length).toBeGreaterThan(1);

    // Every layer moved, and none of them the same way. Drawing once and
    // copying would turn a stack into duplicates, which is the one result a
    // reroll must not produce.
    const next = recorded[0]?.value as StudioLayerRecord;
    expect(next["layer-1"]?.values).not.toEqual(RECORD["layer-1"]?.values);
    expect(next["layer-2"]?.values).not.toEqual(RECORD["layer-2"]?.values);
  });

  for (const group of STUDIO_RANDOMIZE_GROUPS) {
    const what = {
      engine: "the chromatic engine",
      field: "the band field",
      motion: "the drift",
      palette: "the inks",
    }[group.id];

    it(`declares locking ${what} excludes it from a reroll`, () => {
      const locked = studioRandomizableTargets({ [group.lockTarget]: true });
      for (const uniform of group.uniforms) {
        expect(locked).not.toContain(studioSelectedLayerTarget(uniform));
      }
      // The other groups are still in play. A lock that excluded everything
      // would pass the assertion above and be useless.
      expect(locked.length).toBeGreaterThan(0);

      // And through the plan: the locked uniforms keep their values while the
      // record is still written for the rest.
      const commands = planStudioRandomization({
        controls: studioRandomizableControls(),
        layerIds: ["layer-1"],
        locks: { [group.lockTarget]: true },
        random: sequence([0.2, 0.8, 0.35]),
        record: RECORD,
        selectedLayerId: "layer-1",
      });
      const next = commands[0]?.value as StudioLayerRecord;
      const before = readStudioLayerEntry(RECORD, "layer-1");
      for (const uniform of group.uniforms) {
        expect(next["layer-1"]?.values[uniform]).toEqual(before.values[uniform]);
      }
    });
  }

  it("keeps the lock switches and the planner's groups the same list", () => {
    // The pair that would otherwise drift silently: a lock renders, an author
    // turns it on, and the reroll ignores it because the group list beside the
    // planner never learned about it.
    const rendered = new Set(
      (appSchema.panels.controls?.sections ?? [])
        .flatMap((section) => Object.values(section.controls ?? {}))
        .map((control) => String(control.target))
        .filter((target) => target.startsWith("randomize.lock")),
    );
    expect([...rendered].sort()).toEqual(
      STUDIO_RANDOMIZE_GROUPS.map((group) => group.lockTarget).sort(),
    );
  });

  it("does nothing at all when everything is locked", () => {
    const locks = Object.fromEntries(
      STUDIO_RANDOMIZE_GROUPS.map((group) => [group.lockTarget, true]),
    );
    // Not "writes an identical record": an undo step for a press that changed
    // nothing is worse than the press doing nothing, because it makes the next
    // Undo appear to do nothing too.
    expect(
      planStudioRandomization({
        controls: studioRandomizableControls(),
        layerIds: ["layer-1"],
        locks,
        random: () => 0.5,
        record: RECORD,
        selectedLayerId: "layer-1",
      }),
    ).toEqual([]);
  });
});
