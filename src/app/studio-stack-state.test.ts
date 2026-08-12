import { describe, expect, it } from "vitest";

import {
  STUDIO_LAYER_TYPE_TARGET,
  buildStudioStack,
  collectStudioSelectedLayerEdit,
  projectStudioLayerEntry,
  pruneStudioLayerRecord,
  readStudioLayerEntry,
  readStudioLayerRecord,
  retypeStudioLayerEntry,
  writeStudioLayerEntry,
  type StudioLayerRecord,
} from "./studio-stack-state";

const record: StudioLayerRecord = {
  "layer-a": { typeId: "stripes", values: { angle: 30, count: 12 } },
  "layer-b": { typeId: "gradient", values: { angle: 90 } },
};

describe("reading persisted state", () => {
  it("degrades a malformed record to empty rather than to the renderer", () => {
    // Persisted state is not trusted. A bad entry reaching the renderer as a
    // uniform of the wrong arity fails the draw, which looks like a GPU problem.
    expect(readStudioLayerRecord(null)).toEqual({});
    expect(readStudioLayerRecord("not a record")).toEqual({});
  });

  it("drops entries whose type is not a registered layer type", () => {
    const parsed = readStudioLayerRecord({
      bad: { typeId: "hologram", values: {} },
      good: { typeId: "stripes", values: {} },
    });

    expect(Object.keys(parsed)).toEqual(["good"]);
  });

  it("falls back to registry defaults for a layer it has never seen", () => {
    const entry = readStudioLayerEntry({}, "unknown");

    expect(entry.typeId).toBe("stripes");
    expect(entry.values.count).toBe(24);
  });
});

describe("record lifecycle", () => {
  it("writes one entry without disturbing the others", () => {
    const next = writeStudioLayerEntry(record, "layer-a", {
      typeId: "stripes",
      values: { angle: 45 },
    });

    expect(next["layer-a"].values.angle).toBe(45);
    expect(next["layer-b"]).toBe(record["layer-b"]);
  });

  it("prunes only entries whose layer is gone", () => {
    expect(Object.keys(pruneStudioLayerRecord(record, ["layer-b"]))).toEqual([
      "layer-b",
    ]);
  });

  it("keeps every entry when every layer is live", () => {
    // Prune runs on read, so an over-eager prune would delete a layer's values
    // on an ordinary frame rather than on a delete.
    expect(pruneStudioLayerRecord(record, ["layer-a", "layer-b"])).toEqual(record);
  });

  it("resets values when a layer changes type", () => {
    const next = retypeStudioLayerEntry(record["layer-a"], "gradient");

    // Carrying values across would reinterpret a stripe count of 12 as a
    // gradient ramp type of 12 — a value the gradient has no meaning for.
    expect(next.typeId).toBe("gradient");
    expect(next.values.count).toBeUndefined();
    expect(next.values.rampType).toBe(0);
  });

  it("leaves the entry untouched when the type is unchanged", () => {
    expect(retypeStudioLayerEntry(record["layer-a"], "stripes")).toBe(
      record["layer-a"],
    );
  });
});

describe("selection sync", () => {
  it("projects the type and every uniform of the selected layer", () => {
    const assignments = projectStudioLayerEntry(record["layer-a"]);
    const targets = assignments.map((entry) => entry.target);

    expect(targets).toContain(STUDIO_LAYER_TYPE_TARGET);
    expect(targets).toContain("selectedLayer.angle");
    expect(targets).toContain("selectedLayer.opacity");
    expect(
      assignments.find((entry) => entry.target === "selectedLayer.angle")?.value,
    ).toBe(30);
  });

  it("projects a registry default for a uniform the record omits", () => {
    const assignments = projectStudioLayerEntry({
      typeId: "stripes",
      values: {},
    });

    expect(
      assignments.find((entry) => entry.target === "selectedLayer.count")?.value,
    ).toBe(24);
  });

  it("collects an edit back into the entry", () => {
    const next = collectStudioSelectedLayerEdit(record["layer-a"], {
      "selectedLayer.angle": 75,
    });

    expect(next.values.angle).toBe(75);
    expect(next.values.count).toBe(12);
  });

  it("ignores a value of the wrong shape rather than storing it", () => {
    const next = collectStudioSelectedLayerEdit(record["layer-a"], {
      "selectedLayer.angle": "75",
      "selectedLayer.colorA": [1, 0],
    });

    expect(next.values.angle).toBe(30);
    expect(next.values.colorA).toBeUndefined();
  });

  it("round-trips a projection back to the same values", () => {
    // Project then collect is the exact sequence a selection change followed by
    // no edit produces. If it were lossy, merely clicking a layer would change it.
    const projected = Object.fromEntries(
      projectStudioLayerEntry(record["layer-b"])
        .filter((entry) => entry.target !== STUDIO_LAYER_TYPE_TARGET)
        .map((entry) => [entry.target, entry.value]),
    );
    const collected = collectStudioSelectedLayerEdit(record["layer-b"], projected);

    expect(collected.values.angle).toBe(90);
    expect(collected.typeId).toBe("gradient");
  });
});

describe("stack construction", () => {
  const layers = [
    { id: "layer-a", visible: true },
    { id: "layer-b", visible: false },
  ];

  it("takes its order from the runtime layer array", () => {
    const stack = buildStudioStack(record, layers);

    expect(stack.map((entry) => entry.typeId)).toEqual(["stripes", "gradient"]);
  });

  it("lets runtime visibility win over anything the record holds", () => {
    const stack = buildStudioStack(
      { "layer-b": { typeId: "gradient", values: { visible: 1 } } },
      layers,
    );

    expect(stack[1].values.visible).toBe(0);
  });

  it("skips groups, which organise the panel rather than render", () => {
    const stack = buildStudioStack(record, [
      { id: "group-1", kind: "group", visible: true },
      ...layers,
    ]);

    expect(stack).toHaveLength(2);
  });

  it("fills every uniform so the renderer never reads an absent value", () => {
    const stack = buildStudioStack({}, [{ id: "fresh", visible: true }]);

    expect(stack[0].values.count).toBe(24);
    expect(stack[0].values.colorA).toEqual([1, 1, 1]);
  });
});
