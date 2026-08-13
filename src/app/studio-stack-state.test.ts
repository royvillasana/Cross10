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
  studioDuplicateLayerId,
  studioDuplicateLayerName,
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

  it("hides a layer whose group is hidden", () => {
    // The runtime toggles only the layer named by the command, so a member of a
    // hidden group still reports visible: true. Reading that flag alone would
    // keep drawing the member and make the group's hidden state a panel-only
    // illusion.
    const stack = buildStudioStack({}, [
      { id: "folder", kind: "group", visible: false },
      { id: "inside", parentGroupId: "folder", visible: true },
      { id: "outside", visible: true },
    ]);

    expect(stack).toHaveLength(2);
    expect(stack[0].values.visible).toBe(0);
    expect(stack[1].values.visible).toBe(1);
  });

  it("keeps a hidden layer hidden inside a visible group", () => {
    const stack = buildStudioStack({}, [
      { id: "folder", kind: "group", visible: true },
      { id: "inside", parentGroupId: "folder", visible: false },
    ]);

    expect(stack[0].values.visible).toBe(0);
  });

  it("hides through nested groups", () => {
    const stack = buildStudioStack({}, [
      { id: "outer", kind: "group", visible: false },
      { id: "inner", kind: "group", parentGroupId: "outer", visible: true },
      { id: "deep", parentGroupId: "inner", visible: true },
    ]);

    expect(stack[0].values.visible).toBe(0);
  });

  it("survives a cyclic parent link rather than hanging", () => {
    // Persisted state is not trusted: a hand-edited or corrupted parent chain
    // must degrade to hidden rather than spin forever on the render path.
    const stack = buildStudioStack({}, [
      { id: "a", kind: "group", parentGroupId: "b", visible: true },
      { id: "b", kind: "group", parentGroupId: "a", visible: true },
      { id: "leaf", parentGroupId: "a", visible: true },
    ]);

    expect(stack[0].values.visible).toBe(0);
  });

  it("folds a select-driven float uniform into the record as its index", () => {
    // The transition shape is a select whose value is a string, while its
    // uniform is a float the shader branches on. Without the mapping the edit is
    // dropped for not already being a number, and the control moves while the
    // render stays exactly where it was.
    const entry = collectStudioSelectedLayerEdit(
      { typeId: "gradient", values: {} },
      { "selectedLayer.rampType": "radial" },
    );

    expect(entry.values.rampType).toBe(1);
  });

  it("projects a select-driven float back as its option value", () => {
    const assignments = projectStudioLayerEntry({
      typeId: "gradient",
      values: { rampType: 2 },
    });

    expect(
      assignments.find((entry) => entry.target === "selectedLayer.rampType")?.value,
    ).toBe("angular");
  });

  it("ignores an option value the uniform does not declare", () => {
    const entry = collectStudioSelectedLayerEdit(
      { typeId: "gradient", values: { rampType: 1 } },
      { "selectedLayer.rampType": "spiral" },
    );

    expect(entry.values.rampType).toBe(1);
  });

  it("folds a colour control's hex edit into the record", () => {
    // The colour controls hold hex, and this collector used to accept only a
    // numeric triple — so a colour edit was silently dropped and every layer
    // rendered with its default colour no matter what the author picked.
    const entry = collectStudioSelectedLayerEdit(
      { typeId: "stripes", values: {} },
      { "selectedLayer.colorA": "#ff0000" },
    );

    expect(entry.values.colorA).toEqual([1, 0, 0]);
  });

  it("projects a stored colour back as hex the picker can hold", () => {
    const assignments = projectStudioLayerEntry({
      typeId: "stripes",
      values: { colorA: [1, 0, 0] },
    });

    expect(
      assignments.find((entry) => entry.target === "selectedLayer.colorA")?.value,
    ).toBe("#ff0000");
  });

  it("survives an edit and projection round trip unchanged", () => {
    // Selection changes run project, edits run collect. A drift in either
    // direction would walk a colour away from what the author chose each time
    // they clicked between layers.
    const edited = collectStudioSelectedLayerEdit(
      { typeId: "stripes", values: {} },
      { "selectedLayer.colorA": "#3c8fd1" },
    );
    const projected = projectStudioLayerEntry(edited);

    expect(
      projected.find((entry) => entry.target === "selectedLayer.colorA")?.value,
    ).toBe("#3c8fd1");
  });
});

describe("duplicating a layer", () => {
  it("derives the copy's id from its source so the provenance is readable", () => {
    expect(studioDuplicateLayerId("layer-1", ["layer-1"])).toBe("layer-1-copy");
  });

  it("counts up only when the derived id is already taken", () => {
    expect(studioDuplicateLayerId("layer-1", ["layer-1", "layer-1-copy"])).toBe(
      "layer-1-copy-2",
    );
    expect(
      studioDuplicateLayerId("layer-1", ["layer-1", "layer-1-copy", "layer-1-copy-2"]),
    ).toBe("layer-1-copy-3");
  });

  it("names the copy after its source rather than after the stack's counter", () => {
    expect(studioDuplicateLayerName("Layer 3")).toBe("Layer 3 copy");
  });

  it("gives the copy the source's values, and leaves the source alone", () => {
    // The whole point: a duplicate that carried registry defaults would be a
    // new layer wearing a copy's name.
    const record = writeStudioLayerEntry({}, "layer-1", {
      typeId: "stripes",
      values: { count: 7 },
    });
    const entry = readStudioLayerEntry(record, "layer-1");
    const next = writeStudioLayerEntry(record, "layer-1-copy", entry);

    expect(next["layer-1-copy"]?.values.count).toBe(7);
    expect(next["layer-1"]?.values.count).toBe(7);
  });
});
