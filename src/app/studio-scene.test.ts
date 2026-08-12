import { describe, expect, it } from "vitest";

import {
  buildStudioSceneParameters,
  readStudioRenderScale,
  studioColorToLinear,
} from "./studio-scene";
import { STUDIO_LAYER_RECORD_TARGET } from "./studio-stack-state";

const layer = (id: string, overrides: Partial<{ kind: string; visible: boolean }> = {}) => ({
  id,
  visible: true,
  ...overrides,
});

describe("studio scene parameters", () => {
  it("decodes sRGB hex into linear light", () => {
    // Mid grey is the case worth pinning: sRGB 50% is roughly 21.6% linear, not
    // 50%. If this ever reads 0.5 the transfer function has been dropped and
    // every overlap composites too bright.
    const grey = studioColorToLinear("#808080");

    expect(grey?.[0]).toBeCloseTo(0.2159, 3);
    expect(studioColorToLinear("#ffffff")).toEqual([1, 1, 1]);
    expect(studioColorToLinear("#000000")).toEqual([0, 0, 0]);
  });

  it("accepts short hex and a missing hash", () => {
    expect(studioColorToLinear("#fff")).toEqual([1, 1, 1]);
    expect(studioColorToLinear("ffffff")).toEqual([1, 1, 1]);
  });

  it("passes a numeric triple through as already linear", () => {
    // The layer-type registry declares its vec3 defaults as numbers rather than
    // hex, and those are linear by construction. Running them through the
    // transfer function would darken every default colour.
    expect(studioColorToLinear([0.25, 0.5, 0.75])).toEqual([0.25, 0.5, 0.75]);
  });

  it("rejects a malformed colour rather than guessing one", () => {
    expect(studioColorToLinear("#12345")).toBeUndefined();
    expect(studioColorToLinear("not-a-colour")).toBeUndefined();
    expect(studioColorToLinear(42)).toBeUndefined();
  });

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
