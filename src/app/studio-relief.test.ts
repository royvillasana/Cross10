import { describe, expect, it } from "vitest";

import {
  readStudioReliefFins,
  studioReliefSweep,
  STUDIO_RELIEF_SWEEP_DEGREES,
} from "./studio-relief";

/**
 * A viewer walking past a relief, and the two properties that have to hold.
 *
 * The seam is the one this product has protected everywhere: the last frame of
 * a loop is its first. The other is that the fins come from the field rather
 * than from a second set of numbers, which is what keeps one composition one
 * work in two views.
 */
describe("walking past a relief", () => {
  it("returns the viewer to where they started, at every whole rate", () => {
    // By construction rather than by choosing a lucky rate: a sine at a whole
    // number of passes is zero at both ends of the loop.
    for (const travel of [1, 2, 3, 4, -1, -3]) {
      expect(studioReliefSweep(travel, 1)).toBeCloseTo(
        studioReliefSweep(travel, 0),
        10,
      );
    }
  });

  it("moves the viewer to both sides rather than only one", () => {
    // A ramp would walk them one way and teleport them back. Passing means
    // arriving, passing, and leaving the other way.
    const quarter = studioReliefSweep(1, 0.25);
    const threeQuarters = studioReliefSweep(1, 0.75);
    expect(quarter).toBeCloseTo(STUDIO_RELIEF_SWEEP_DEGREES, 6);
    expect(threeQuarters).toBeCloseTo(-STUDIO_RELIEF_SWEEP_DEGREES, 6);
  });

  it("never turns the work away from the viewer", () => {
    // A Physichromie hangs on a wall and has no back. Whatever the rate, the
    // sweep stays inside the arc a viewer walking past would cover.
    for (const travel of [1, 4]) {
      for (let step = 0; step <= 40; step += 1) {
        const angle = Math.abs(studioReliefSweep(travel, step / 40));
        expect(angle).toBeLessThanOrEqual(STUDIO_RELIEF_SWEEP_DEGREES + 1e-9);
      }
    }
  });

  it("stands still when the field declares no travel", () => {
    // The same rule the flat view follows: a composition that does not move
    // must not redraw, which is what the constant sweep gives the scene.
    expect(studioReliefSweep(0, 0.37)).toBe(0);
  });

  it("takes the fins from the field rather than from numbers of its own", () => {
    const fins = readStudioReliefFins([
      {
        typeId: "stripes",
        values: { angle: 30, colorA: [1, 0, 0], count: 17, visible: 1, widthRatio: 0.25 },
      },
    ]);
    expect(fins?.count).toBe(17);
    expect(fins?.coverage).toBeCloseTo(0.25, 6);
    expect(fins?.angle).toBe(30);
    expect(fins?.colors[0]).toEqual([1, 0, 0]);

    // A hidden field is not stood up, and a stack with no band field has no
    // relief to draw rather than a default one.
    expect(
      readStudioReliefFins([
        { typeId: "stripes", values: { count: 8, visible: 0 } },
      ]),
    ).toBeNull();
    expect(readStudioReliefFins([{ typeId: "gradient", values: {} }])).toBeNull();

    // Bounded by the band count's own ceiling, so geometry cannot be asked for
    // more fins than a band count can name.
    expect(
      readStudioReliefFins([
        { typeId: "stripes", values: { count: 9000, visible: 1 } },
      ])?.count,
    ).toBe(200);
  });
});
