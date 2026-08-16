import { describe, expect, it } from "vitest";

import { appSchema } from "./app-schema";
import {
  STUDIO_DRIFT_ANGLE_TARGET,
  STUDIO_DRIFT_PHASE_TARGET,
  STUDIO_LOOP_SECONDS,
  STUDIO_DRIFT_TURN_DEGREES,
  STUDIO_STATIC_PROPERTIES,
  studioDriftAt,
} from "./studio-motion";
import { studioAssembleStackFragmentShader } from "./studio-layers";
import { buildStudioSceneParameters, readStudioLoopProgress } from "./studio-scene";

describe("studio drift", () => {
  it("returns to exactly where it started at the end of a loop", () => {
    // The one property a loop must have, and the one a "the frame changed"
    // assertion passes straight over: a seam is a jump nobody chose.
    for (const cycles of [1, 2, -1, 4]) {
      expect(studioDriftAt({ cycles, timeSeconds: 0 })).toBe(0);
      expect(studioDriftAt({ cycles, timeSeconds: STUDIO_LOOP_SECONDS })).toBe(0);
      // And the moment before the seam is a whole cycle short of it, rather
      // than somewhere unrelated that happens to wrap.
      expect(
        studioDriftAt({ cycles, timeSeconds: STUDIO_LOOP_SECONDS - 0.001 }),
      ).toBeCloseTo(cycles - (cycles * 0.001) / STUDIO_LOOP_SECONDS, 6);
    }
  });

  it("is the identity at rate zero, at every moment", () => {
    // What makes adding motion safe: a composition that declared no drift
    // renders exactly as it did before any of this existed.
    for (const timeSeconds of [0, 1.7, 3, STUDIO_LOOP_SECONDS, 41.5]) {
      expect(studioDriftAt({ cycles: 0, timeSeconds })).toBe(0);
    }

  });

  it("wraps a time past the end of the loop forwards, not away", () => {
    // A timeline that has run for a minute is at the same place as one that has
    // run for four seconds; a drift that accumulated would have left the work.
    expect(studioDriftAt({ cycles: 1, timeSeconds: 4 })).toBeCloseTo(
      studioDriftAt({ cycles: 1, timeSeconds: 4 + STUDIO_LOOP_SECONDS * 7 }),
      10,
    );
    // Including backwards, which a bare `%` would have made negative.
    expect(studioDriftAt({ cycles: 1, timeSeconds: -1 })).toBeGreaterThan(0);
  });

  it("offers no rate over any property that constitutes the work", () => {
    // The list is the argument: the colour, the band count and the separators
    // are what the work *is*. Drifting them makes every frame a different work
    // rather than the same one seen from somewhere else, which is a screensaver.
    const targets = new Set(
      (appSchema.panels.controls?.sections ?? []).flatMap((section) =>
        Object.values(section.controls ?? {}).map((control) => String(control.target)),
      ),
    );

    for (const property of STUDIO_STATIC_PROPERTIES) {
      expect(targets.has(`selectedLayer.drift${property[0].toUpperCase()}${property.slice(1)}`))
        .toBe(false);
    }
    expect(targets.has(STUDIO_DRIFT_PHASE_TARGET)).toBe(true);
    expect(targets.has(STUDIO_DRIFT_ANGLE_TARGET)).toBe(true);
  });
});

describe("studio loop progress", () => {
  it("is zero when there is no timeline, which is what keeps a still still", () => {
    expect(readStudioLoopProgress({ layers: [], values: {} })).toBe(0);
    expect(
      readStudioLoopProgress({
        layers: [],
        timeline: { currentTimeSeconds: 3, durationSeconds: 0 },
        values: {},
      } as never),
    ).toBe(0);
  });

  it("reads a fraction of the loop, wrapped forwards", () => {
    const at = (currentTimeSeconds: number) =>
      readStudioLoopProgress({
        layers: [],
        timeline: { currentTimeSeconds, durationSeconds: STUDIO_LOOP_SECONDS },
        values: {},
      } as never);

    expect(at(0)).toBe(0);
    expect(at(STUDIO_LOOP_SECONDS / 4)).toBeCloseTo(0.25, 10);
    expect(at(STUDIO_LOOP_SECONDS)).toBe(0);
    expect(at(STUDIO_LOOP_SECONDS * 3.5)).toBeCloseTo(0.5, 10);
  });
});

describe("the assembled shader", () => {
  it("declares the loop position once, for the whole stack", () => {
    // One uniform rather than one per layer: every layer is passed by the same
    // viewer at the same moment, and a per-layer clock would let them disagree.
    const source = studioAssembleStackFragmentShader([
      { typeId: "stripes" },
      { typeId: "stripes" },
      { typeId: "gradient" },
    ]);

    expect(source.match(/uniform float uLoop;/g)).toHaveLength(1);
  });

  it("drifts by adding to what the author set, in every body that drifts", () => {
    // Additive, and asserted on the GLSL rather than on a JavaScript copy of
    // it, because the GLSL is the only version that draws anything. A body that
    // assigned instead of added would render the drift alone and silently throw
    // away the angle and phase the author chose -- which at loop position zero
    // would still look exactly right.
    const source = studioAssembleStackFragmentShader([
      { typeId: "stripes" },
      { typeId: "gradient" },
    ]);

    const angles = source.match(
      /float driftedAngle = angle \+ driftAngle \* 360\.0 \* loop;/g,
    );
    const phases = source.match(/float driftedPhase = phase \+ driftPhase \* loop;/g);

    // One of each per drifting body, so a third technique added without drift
    // fails here rather than quietly rendering a still layer inside a loop.
    expect(angles).toHaveLength(2);
    expect(phases).toHaveLength(2);
    expect(STUDIO_DRIFT_TURN_DEGREES).toBe(360);
  });
});

describe("the cost of a running clock", () => {
  /**
   * The regression that eighty-seven browser timeouts were made of.
   *
   * The runtime starts its timeline playing. If the loop position reaches the
   * scene regardless of whether anything responds to it, the scene is a new
   * value on every animation frame -- the canvas memo compares by serialising
   * it, so it misses every time, and the whole stack redraws sixty times a
   * second to produce the identical picture.
   *
   * Asserted on the scene rather than on a frame rate, because a frame rate is
   * not measurable here and is not the claim anyway. The claim is that an
   * undrifted composition produces the *same scene value* at every moment, which
   * is what lets everything downstream sleep.
   */
  const sceneAt = (currentTimeSeconds: number, drift: number) =>
    buildStudioSceneParameters(
      {
        layers: [{ id: "a", visible: true }],
        timeline: { currentTimeSeconds, durationSeconds: STUDIO_LOOP_SECONDS },
        values: {
          "stack.layerRecord": {
            a: { typeId: "stripes", values: { driftPhase: drift } },
          },
        },
      } as never,
      false,
    );

  it("gives a still composition the same scene at every moment", () => {
    expect(JSON.stringify(sceneAt(0, 0))).toBe(
      JSON.stringify(sceneAt(STUDIO_LOOP_SECONDS / 3, 0)),
    );
    expect(sceneAt(STUDIO_LOOP_SECONDS / 3, 0).loop).toBe(0);
  });

  it("lets a drifting composition see the clock", () => {
    // The other half, and the one that keeps the fix from being "turn it off":
    // a composition that asked to move must still move.
    expect(sceneAt(STUDIO_LOOP_SECONDS / 3, 1).loop).toBeCloseTo(1 / 3, 6);
    expect(JSON.stringify(sceneAt(0, 1))).not.toBe(
      JSON.stringify(sceneAt(STUDIO_LOOP_SECONDS / 3, 1)),
    );
  });
});

describe("the calling convention every body shares", () => {
  /**
   * The regression this exists to prevent, stated as the rule that was broken.
   *
   * The assembled call site hands every layer body the same leading arguments,
   * loop position among them. That makes the parameter part of the *convention*
   * rather than a statement about a technique: a body that leaves it out does
   * not compile, and because the bodies are concatenated into one program,
   * neither does anything else in the stack.
   *
   * Which is exactly how it escaped. `studioImageBody` never got the parameter,
   * so only stacks containing a picture failed -- every band-field proof passed,
   * the type checker had nothing to say about a string, and the failure surfaced
   * as five image tests going red for what looked like an unrelated reason.
   */
  it("declares the loop parameter in every layer body", () => {
    const source = studioAssembleStackFragmentShader([
      { typeId: "stripes" },
      { typeId: "gradient" },
      { typeId: "image" },
    ]);

    const bodies = source.match(/vec4 studio\w+Body\(([\s\S]*?)\)\s*\{/g) ?? [];
    // Three bodies, so a fourth technique added without the parameter fails here
    // rather than at the moment someone happens to put a picture on the canvas.
    expect(bodies).toHaveLength(3);
    for (const body of bodies) {
      expect(body, `${body.slice(0, 40)} must accept the loop position`).toMatch(
        /\bfloat loop\b/,
      );
    }
  });
});
