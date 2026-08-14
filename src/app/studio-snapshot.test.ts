import { describe, expect, it } from "vitest";

import {
  STUDIO_LAYER_RECORD_TARGET,
  STUDIO_SNAPSHOT_TARGET,
  captureStudioStackSnapshot,
  planStudioStackRestoration,
  readStudioStackSnapshot,
  type StudioLayerRecord,
  type StudioRuntimeLayer,
} from "./studio-stack-state";

/**
 * The stack an apply overwrites, and putting it back.
 *
 * These cover the framework gap recorded as issue 7: `layers.*` commands carry
 * no `historyGroup`, so an application's deletes and adds are separate undo
 * entries and no press count reaches the stack underneath. The product holds a
 * snapshot instead, and what is asserted here is that the snapshot is enough to
 * reconstruct what was lost -- order, names, parentage, values, and selection.
 */

const layers: readonly StudioRuntimeLayer[] = [
  { id: "ground", name: "Ground", visible: true },
  { id: "folder", kind: "group", name: "Folder", visible: true },
  { id: "inner", name: "Inner", parentGroupId: "folder", visible: false },
];

const record: StudioLayerRecord = {
  ground: { typeId: "gradient", values: { angle: 90 } },
  inner: { typeId: "stripes", values: { angle: 30, count: 12 } },
};

const snapshot = captureStudioStackSnapshot({
  appliedLabel: "Interference Beat",
  layers,
  record,
  selectedLayerId: "inner",
});

describe("capturing the stack an apply is about to overwrite", () => {
  it("carries order, names, parentage, and the group flag", () => {
    expect(snapshot.layers.map((layer) => layer.id)).toEqual([
      "ground",
      "folder",
      "inner",
    ]);
    expect(snapshot.layers[1]?.isGroup).toBe(true);
    expect(snapshot.layers[2]?.parentGroupId).toBe("folder");
    expect(snapshot.layers[2]?.visible).toBe(false);
  });

  it("carries each layer's own values, and none for a group", () => {
    // A group organises; it does not render, so it holds no entry. Inventing
    // one would restore a layer the author never built.
    expect(snapshot.layers[0]?.entry).toEqual(record.ground);
    expect(snapshot.layers[1]?.entry).toBeNull();
    expect(snapshot.layers[2]?.entry).toEqual(record.inner);
  });

  it("carries the selection, because restoring to a different layer is a different stack", () => {
    expect(snapshot.selectedLayerId).toBe("inner");
  });
});

describe("reading a snapshot back out of persisted state", () => {
  it("survives a round trip through JSON, which is how it is persisted", () => {
    expect(readStudioStackSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(
      snapshot,
    );
  });

  it("degrades anything malformed to nothing rather than to a restore", () => {
    // A half-read snapshot would rebuild a stack the author never had, which is
    // worse than offering no restore at all.
    expect(readStudioStackSnapshot(null)).toBeNull();
    expect(readStudioStackSnapshot("not a snapshot")).toBeNull();
    expect(readStudioStackSnapshot({ layers: [] })).toBeNull();
    expect(readStudioStackSnapshot({ layers: [{ name: "no id" }] })).toBeNull();
  });
});

describe("restoring the snapshot", () => {
  const commands = planStudioStackRestoration({
    currentLayerIds: ["beat-1", "beat-2"],
    snapshot,
  });

  const typesOf = (type: string) =>
    commands.filter((command) => command.type === type);

  it("removes every layer the application left behind", () => {
    expect(typesOf("layers.delete").map((command) => command.layerId)).toEqual([
      "beat-1",
      "beat-2",
    ]);
  });

  it("recreates every layer in its original order", () => {
    const added = typesOf("layers.add").map(
      (command) => (command.layer as { id: string }).id,
    );
    expect(added).toEqual(["ground", "folder", "inner"]);
  });

  it("recreates a group as a group", () => {
    const folder = typesOf("layers.add").find(
      (command) => (command.layer as { id: string }).id === "folder",
    );
    expect((folder?.layer as { kind?: string }).kind).toBe("group");
  });

  it("restores parentage after the layers exist, not on the draft", () => {
    // A member added before its group carries a parent id that names nothing,
    // and the snapshot's array makes no promise about which comes first.
    const moves = typesOf("layers.moveToGroup");
    expect(moves).toHaveLength(1);
    expect(moves[0]?.parentGroupId).toBe("folder");
    expect(moves[0]?.layerIds).toEqual(["inner"]);

    const addIndex = commands.findIndex(
      (command) =>
        command.type === "layers.add" &&
        (command.layer as { id: string }).id === "folder",
    );
    expect(commands.indexOf(moves[0]!)).toBeGreaterThan(addIndex);
  });

  it("writes back exactly the restored values, and no group entry", () => {
    const write = commands.find(
      (command) =>
        command.type === "controls.setValue" &&
        command.target === STUDIO_LAYER_RECORD_TARGET,
    );
    expect(write?.value).toEqual({ ground: record.ground, inner: record.inner });
  });

  it("writes the record whole rather than merging", () => {
    // Merging would leave the applied stack's values behind, to be picked up by
    // any later layer that happened to reuse an id.
    const write = commands.find(
      (command) =>
        command.type === "controls.setValue" &&
        command.target === STUDIO_LAYER_RECORD_TARGET,
    );
    expect(Object.keys(write?.value as object)).toEqual(["ground", "inner"]);
  });

  it("clears the snapshot, so a restore cannot be offered twice", () => {
    const clear = commands.find(
      (command) =>
        command.type === "controls.setValue" &&
        command.target === STUDIO_SNAPSHOT_TARGET,
    );
    expect(clear?.value).toBeNull();
  });

  it("restores the selection last, once the layer it names exists", () => {
    const select = commands.at(-1);
    expect(select?.type).toBe("layers.select");
    expect(select?.layerId).toBe("inner");
  });

  it("takes one restore whatever the size of the stack it replaces", () => {
    // The defect this exists for is that undo needs N+M presses and still does
    // not arrive. A restore that scaled with the stack would not have fixed it.
    const wide = planStudioStackRestoration({
      currentLayerIds: ["a", "b", "c", "d", "e"],
      snapshot,
    });
    expect(
      wide.filter((command) => command.type === "layers.add").length,
    ).toEqual(snapshot.layers.length);
  });
});
