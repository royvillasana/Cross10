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
