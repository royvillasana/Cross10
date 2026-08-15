import { describe, expect, it } from "vitest";

import { buildStudioSceneParameters, readStudioRenderScale } from "./studio-scene";
import {
  STUDIO_CURSOR_AWAY,
  STUDIO_CURSOR_TARGET,
  STUDIO_LAYER_RECORD_TARGET,
} from "./studio-stack-state";

const layer = (id: string, overrides: Partial<{ kind: string; visible: boolean }> = {}) => ({
  id,
  visible: true,
  ...overrides,
});

describe("studio scene parameters", () => {
  it("prunes record entries whose layers no longer exist", () => {
    // A record read from persistence can name a deleted layer. Left in, its
    // values would be uploaded as a uniform for a layer the stack does not draw.
    const scene = buildStudioSceneParameters({
      layers: [layer("keep")],
      values: {
        [STUDIO_LAYER_RECORD_TARGET]: {
          gone: { typeId: "gradient", values: { angle: 90 } },
          keep: { typeId: "stripes", values: { count: 8 } },
        },
      },
    }, true);

    expect(scene.layers).toHaveLength(1);
    expect(scene.layers[0]?.typeId).toBe("stripes");
    expect(scene.layers[0]?.values.count).toBe(8);
  });

  it("draws in the runtime's layer order and skips groups", () => {
    const scene = buildStudioSceneParameters({
      layers: [layer("a"), layer("folder", { kind: "group" }), layer("b")],
      values: {
        [STUDIO_LAYER_RECORD_TARGET]: {
          a: { typeId: "stripes", values: {} },
          b: { typeId: "gradient", values: {} },
        },
      },
    }, true);

    expect(scene.layers.map((entry) => entry.typeId)).toEqual(["stripes", "gradient"]);
  });

  it("lets runtime visibility win over the record", () => {
    const scene = buildStudioSceneParameters({
      layers: [layer("a", { visible: false })],
      values: {
        [STUDIO_LAYER_RECORD_TARGET]: {
          a: { typeId: "stripes", values: { visible: 1 } },
        },
      },
    }, true);

    expect(scene.layers[0]?.values.visible).toBe(0);
  });

  it("converts a layer's stored hex colour to linear light", () => {
    const scene = buildStudioSceneParameters({
      layers: [layer("a")],
      values: {
        [STUDIO_LAYER_RECORD_TARGET]: {
          a: { typeId: "stripes", values: { colorA: "#ffffff" } },
        },
      },
    }, true);

    expect(scene.layers[0]?.values.colorA).toEqual([1, 1, 1]);
  });

  it("reads the background colour from state", () => {
    const scene = buildStudioSceneParameters(
      { layers: [], values: { "appearance.background": "#000000" } },
      true,
    );

    expect(scene.backgroundColor).toEqual([0, 0, 0]);
  });

  it("takes background inclusion from its caller, not the export switch", () => {
    // Preview and export ask different questions. `export.includeBackground`
    // says whether an exported artifact carries the background; whether the
    // preview shows it is the runtime's call. Reading the switch here would tie
    // them together and make `backgroundOutputCoverage: "preview-hidden"` false.
    const hidden = buildStudioSceneParameters(
      { layers: [], values: { "export.includeBackground": true } },
      false,
    );

    expect(hidden.includeBackground).toBe(false);
  });

  it("falls back to a render scale of 1", () => {
    expect(readStudioRenderScale({ layers: [], values: {} })).toBe(1);
    expect(
      readStudioRenderScale({ layers: [], values: { "canvas.renderScale": 2 } }),
    ).toBe(2);
    // A zero or negative scale would produce a zero-sized backing and a failed
    // draw, so it degrades rather than reaching the renderer.
    expect(
      readStudioRenderScale({ layers: [], values: { "canvas.renderScale": 0 } }),
    ).toBe(1);
  });
});

/**
 * The pointer and the artifact.
 *
 * Preview and export share one scene builder deliberately, so the one thing
 * they are allowed to disagree about has to be stated rather than assumed --
 * and this is it. A still that carried the live cursor would differ between two
 * exports of one composition, and neither of them would be the composition.
 */
describe("the pointer in an exported scene", () => {
  const parked = {
    layers: [layer("only")],
    values: {
      [STUDIO_CURSOR_TARGET]: [0.2, -0.1],
      [STUDIO_LAYER_RECORD_TARGET]: {
        only: { typeId: "stripes", values: { count: 8 } },
      },
    },
  };

  it("carries the committed cursor when no position is named", () => {
    // Which is what the preview does, and what keeps a render deterministic
    // within itself rather than reading a live event (R68).
    expect(buildStudioSceneParameters(parked, true).cursor).toEqual([0.2, -0.1]);
  });

  it("carries the named position instead when the caller names one", () => {
    expect(
      buildStudioSceneParameters(parked, false, new Map(), STUDIO_CURSOR_AWAY).cursor,
    ).toEqual(STUDIO_CURSOR_AWAY);
  });

  it("builds the same scene at rest whether or not a pointer was ever there", () => {
    // The claim the export makes: a render taken with the pointer parked over
    // the canvas is the render of a canvas nobody is pointing at. Compared over
    // the whole scene rather than the cursor alone, because the pointer reaches
    // the layers through their own values and a difference could land there.
    const untouched = {
      layers: parked.layers,
      values: { [STUDIO_LAYER_RECORD_TARGET]: parked.values[STUDIO_LAYER_RECORD_TARGET] },
    };

    expect(
      buildStudioSceneParameters(parked, false, new Map(), STUDIO_CURSOR_AWAY),
    ).toEqual(buildStudioSceneParameters(untouched, false, new Map(), STUDIO_CURSOR_AWAY));
  });
});
