import { describe, expect, it } from "vitest";

import { buildStudioSceneParameters, studioColorToLinear } from "./studio-scene";
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
    });

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
    });

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
    });

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
    });

    expect(scene.layers[0]?.values.colorA).toEqual([1, 1, 1]);
  });

  it("reads the background colour and its include switch", () => {
    const scene = buildStudioSceneParameters({
      layers: [],
      values: {
        "appearance.background": "#000000",
        "export.includeBackground": false,
      },
    });

    expect(scene.backgroundColor).toEqual([0, 0, 0]);
    expect(scene.includeBackground).toBe(false);
  });

  it("treats an unset background switch as included", () => {
    // The switch defaults on in the schema, and an absent value must not read as
    // "excluded" — that would silently drop the background on a fresh state.
    const scene = buildStudioSceneParameters({ layers: [], values: {} });

    expect(scene.includeBackground).toBe(true);
  });
});
