/**
 * Croix10 timeline acceptance declarations.
 *
 * Split from the other acceptance declarations to keep both files inside the
 * test-file line budget. Everything here is about time: what the loop does, and
 * what the two drift rates do to the field across it.
 */

import { describe, expect, it } from "vitest";

import { appAcceptance, appTransferMode } from "./app-acceptance-data";
import { appSchema } from "./app-schema";
import {
  CROIX10_IMMERSION_BALANCE,
  CROIX10_LOOP_DURATION_SECONDS,
} from "./croix10-parameters";
import {
  croix10SequencePeriodBands,
  readCroix10SceneParameters,
} from "./croix10-scene";

const sections = appSchema.panels.controls?.sections ?? [];

function control(target: string) {
  for (const section of sections) {
    for (const candidate of Object.values(section.controls)) {
      if (candidate.target === target) return candidate;
    }
  }
  throw new Error(`No schema control renders target ${target}.`);
}

function acceptanceRow(id: string) {
  const row = appAcceptance.find((entry) => entry.id === id);
  if (!row) throw new Error(`No acceptance row with id ${id}.`);
  return row;
}

/**
 * The scene the renderer would draw at one instant of the timeline.
 *
 * Time reaches the field only through this reader, so a claim about what the
 * loop does is a claim about what this returns — which is checkable without a
 * GPU, and is the same function the export frame calls.
 */
function sceneAt(
  currentTimeSeconds: number,
  values: Record<string, unknown> = {},
  durationSeconds = CROIX10_LOOP_DURATION_SECONDS,
) {
  return readCroix10SceneParameters(
    {
      timeline: { currentTimeSeconds, durationSeconds, keyframeGroups: [] },
      values,
    } as never,
    true,
  );
}

describe("Croix10 timeline acceptance declarations", () => {
  // Timeline motion. The seam claim is a claim about the renderer's input: the
  // field is a pure function of scene parameters, so parameters that are equal at
  // both ends of the loop are the same frame. The browser proof samples the real
  // backing buffer as well, because equal inputs is a weaker statement than equal
  // pixels only if the renderer is not a function, and that is worth checking.
  it("declares the playback timeline drives the rendered field and loops seamlessly", () => {
    const timeline = appSchema.panels.timeline;
    expect(timeline).toEqual({
      defaultDurationSeconds: CROIX10_LOOP_DURATION_SECONDS,
      enabled: true,
      mode: "playback",
    });
    // The declared loop duration is the one the timeline opens on, so the initial
    // UI shows the product's period rather than a framework fallback.
    expect(appTransferMode.animationIntent).toMatchObject({
      loopDuration: { seconds: CROIX10_LOOP_DURATION_SECONDS, source: "product-derived" },
      mode: "timeline-playback",
    });

    const row = acceptanceRow("timeline.playback");
    expect(row.timelinePlaybackCoverage).toBe("all-playback-behavior");
    expect(row.timelineLoopProof).toEqual({
      direction: "forward-only",
      durationChange: "reproved-after-edit",
      reversePlayback: "forbidden",
      seam: "first-last-match",
    });

    // Every drift rate closes the loop, not just the default one, and it closes at
    // whatever duration the user has edited the timeline to.
    for (const durationSeconds of [4, CROIX10_LOOP_DURATION_SECONDS, 13.5]) {
      for (const cycles of [1, 2, 5, 8]) {
        const drifting = {
          "engine.active": "chromointerference",
          "immersion.driftCycles": cycles,
          "interference.driftCycles": cycles,
        };
        expect(sceneAt(0, drifting, durationSeconds)).toEqual(
          sceneAt(durationSeconds, drifting, durationSeconds),
        );
      }
    }
  });

  it("declares the sequence period is where the field returns to itself", () => {
    // A phase shift only restores the field after a whole number of palette
    // rotations and a whole number of the two-band width alternation, so the
    // period is their least common multiple, not the palette length.
    expect(croix10SequencePeriodBands(2)).toBe(2);
    expect(croix10SequencePeriodBands(3)).toBe(6);
    expect(croix10SequencePeriodBands(4)).toBe(4);
    expect(croix10SequencePeriodBands(5)).toBe(10);
    expect(croix10SequencePeriodBands(8)).toBe(8);
  });

  it("declares interference drift travels the beat across the loop", () => {
    expect(control("interference.driftCycles").sliderValueKind).toBe("discrete");
    expect(control("interference.driftCycles").step).toBe(1);
    expect(control("interference.driftCycles").defaultValue).toBe(0);

    const drifting = { "interference.driftCycles": 1 };
    const start = sceneAt(0, drifting);
    expect(sceneAt(CROIX10_LOOP_DURATION_SECONDS / 2, drifting)).not.toEqual(start);
    expect(sceneAt(CROIX10_LOOP_DURATION_SECONDS, drifting)).toEqual(start);

    // Zero is genuinely static rather than slow: time cannot reach the field.
    const still = { "interference.driftCycles": 0 };
    expect(sceneAt(CROIX10_LOOP_DURATION_SECONDS / 3, still)).toEqual(
      sceneAt(0, still),
    );
  });

  it("declares immersion drift sweeps the wash across the loop", () => {
    expect(control("immersion.driftCycles").sliderValueKind).toBe("discrete");
    expect(control("immersion.driftCycles").step).toBe(1);
    expect(control("immersion.driftCycles").defaultValue).toBe(0);

    const drifting = { "immersion.driftCycles": 1 };
    const quarter = sceneAt(CROIX10_LOOP_DURATION_SECONDS / 4, drifting);
    expect(quarter.immersionBalance).not.toBe(
      sceneAt(0, drifting).immersionBalance,
    );
    // Swept but never outside the range the control itself declares.
    for (const fraction of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const balance = sceneAt(
        CROIX10_LOOP_DURATION_SECONDS * fraction,
        drifting,
      ).immersionBalance;
      expect(balance).toBeGreaterThanOrEqual(CROIX10_IMMERSION_BALANCE.min);
      expect(balance).toBeLessThanOrEqual(CROIX10_IMMERSION_BALANCE.max);
    }

    const still = { "immersion.driftCycles": 0 };
    expect(sceneAt(CROIX10_LOOP_DURATION_SECONDS / 3, still)).toEqual(
      sceneAt(0, still),
    );
  });
});
