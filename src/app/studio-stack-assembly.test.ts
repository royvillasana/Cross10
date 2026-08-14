import { describe, expect, it } from "vitest";

import { studioAssembleStackFragmentShader } from "./studio-layers";
import { buildStudioStack, type StudioRuntimeLayer } from "./studio-stack-state";

/**
 * The assembled shader against the panel's own order.
 *
 * `studio-layers.test.ts` already proves the assembler emits a hand-built stack
 * in index order. What it cannot show is that the stack handed to it is the one
 * the panel is displaying — that link runs through the runtime layer array and
 * `buildStudioStack`, and it is the link a user actually sees when they drag a
 * row. These tests start from runtime layer state for that reason.
 */

const record = {
  bottom: { typeId: "stripes", values: {} },
  middle: { typeId: "image", values: {} },
  top: { typeId: "gradient", values: {} },
} as const;

function callOrder(layers: readonly StudioRuntimeLayer[]): readonly string[] {
  const stack = buildStudioStack(record, layers);
  const source = studioAssembleStackFragmentShader(
    stack.map((entry) => ({ typeId: entry.typeId })),
  );

  return (
    [
      { call: source.indexOf("studioStripesBody(fragmentPosition"), type: "stripes" },
      { call: source.indexOf("studioGradientBody(fragmentPosition"), type: "gradient" },
      { call: source.indexOf("studioImageBody(fragmentPosition"), type: "image" },
    ]
      .filter((entry) => entry.call > -1)
      .sort((left, right) => left.call - right.call)
      .map((entry) => entry.type)
  );
}

describe("assembled shader order", () => {
  it("emits the layers in the order the runtime holds them", () => {
    expect(
      callOrder([
        { id: "bottom", visible: true },
        { id: "top", visible: true },
      ]),
    ).toEqual(["stripes", "gradient"]);
  });

  it("follows a reorder rather than a fixed type order", () => {
    // The guard that matters for a drag: the emitted order has to come from the
    // runtime array, not from the registry's own type order. If the assembler
    // ever sorted by type this would keep passing the first case and fail here.
    expect(
      callOrder([
        { id: "top", visible: true },
        { id: "bottom", visible: true },
      ]),
    ).toEqual(["gradient", "stripes"]);
  });

  it("composites an image layer where the panel puts it, above and below procedural layers", () => {
    // The scenario the whole stack was built for: a picture is a layer like any
    // other, so it takes its place among the procedural ones rather than
    // sitting above or below them as a special case. Read as a sandwich
    // because that is the arrangement neither "always first" nor "always last"
    // could produce.
    expect(
      callOrder([
        { id: "bottom", visible: true },
        { id: "middle", visible: true },
        { id: "top", visible: true },
      ]),
    ).toEqual(["stripes", "image", "gradient"]);

    // And it moves with a drag rather than being pinned to a position in the
    // registry: the same three layers in another order emit in that order.
    expect(
      callOrder([
        { id: "middle", visible: true },
        { id: "top", visible: true },
        { id: "bottom", visible: true },
      ]),
    ).toEqual(["image", "gradient", "stripes"]);
  });

  it("gives a group no place in the assembled stack", () => {
    // A group organises the panel; it draws nothing, so it must not consume a
    // layer index — if it did, every layer after it would read another layer's
    // mangled uniforms.
    const stack = buildStudioStack(record, [
      { id: "bottom", visible: true },
      { id: "folder", kind: "group", visible: true },
      { id: "top", parentGroupId: "folder", visible: true },
    ]);

    expect(stack).toHaveLength(2);
    expect(stack.map((entry) => entry.typeId)).toEqual(["stripes", "gradient"]);
  });

  it("keeps a hidden layer in place rather than collapsing the stack", () => {
    // Visibility folds into the composite weight, so a hidden layer keeps its
    // index. Dropping it instead would renumber every layer above it and shift
    // their uniforms onto the wrong values mid-edit.
    const stack = buildStudioStack(record, [
      { id: "bottom", visible: false },
      { id: "top", visible: true },
    ]);

    expect(stack.map((entry) => entry.typeId)).toEqual(["stripes", "gradient"]);
    expect(stack[0].values.visible).toBe(0);
    expect(stack[1].values.visible).toBe(1);
  });
});

describe("which layers the pointer reaches", () => {
  const followers: StudioRuntimeLayer[] = [
    { id: "opted-in", visible: true },
    { id: "opted-out", visible: true },
  ];
  const cursorRecord = {
    "opted-in": { typeId: "stripes" as const, values: { engineCursor: 1 } },
    "opted-out": { typeId: "stripes" as const, values: { engineCursor: 0 } },
  };

  it("leaves each layer to its own switch by default", () => {
    const stack = buildStudioStack(cursorRecord, followers);

    expect(stack[0]?.values.engineCursor).toBe(1);
    expect(stack[1]?.values.engineCursor).toBe(0);
  });

  it("reaches every layer when the stack says so", () => {
    const stack = buildStudioStack(
      cursorRecord,
      followers,
      {},
      new Map(),
      "every-layer",
    );

    expect(stack[0]?.values.engineCursor).toBe(1);
    expect(stack[1]?.values.engineCursor).toBe(1);
  });

  it("gives the layers back their own switches when it stops", () => {
    // The stack-level choice widens, it does not overwrite. A version that
    // wrote the switch onto every layer would lose which of them the author had
    // set by hand, and narrowing again would leave them all following.
    const stack = buildStudioStack(
      cursorRecord,
      followers,
      {},
      new Map(),
      "per-layer",
    );

    expect(stack[0]?.values.engineCursor).toBe(1);
    expect(stack[1]?.values.engineCursor).toBe(0);
  });

  it("treats an unknown subject as per-layer rather than as everything", () => {
    // Persisted state is not trusted, and the safe reading is the narrower one:
    // a bad value that widened the reach would move layers the author never
    // asked it to.
    const stack = buildStudioStack(
      cursorRecord,
      followers,
      {},
      new Map(),
      "nonsense",
    );

    expect(stack[1]?.values.engineCursor).toBe(0);
  });
});
