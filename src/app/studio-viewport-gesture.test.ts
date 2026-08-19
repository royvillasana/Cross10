import { describe, expect, it } from "vitest";

import { readStudioViewportPose } from "./studio-viewport-gesture";

describe("seeing a viewport gesture from outside the runtime", () => {
  it("changes when the view moves", () => {
    const still = readStudioViewportPose({ offset: { x: 10, y: 20 }, zoom: 1 });
    expect(readStudioViewportPose({ offset: { x: 11, y: 20 }, zoom: 1 })).not.toBe(
      still,
    );
    expect(readStudioViewportPose({ offset: { x: 10, y: 20 }, zoom: 1.5 })).not.toBe(
      still,
    );
  });

  it("does not change when an unrelated edit rebuilds the slice", () => {
    // The failure this guards is specific and would be invisible: the runtime
    // rebuilds its canvas slice on writes that have nothing to do with the
    // view, so a check by identity would report a gesture on every slider move
    // and freeze the animation whenever an author touched anything.
    expect(readStudioViewportPose({ offset: { x: 3, y: 4 }, zoom: 2 })).toBe(
      readStudioViewportPose({ offset: { x: 3, y: 4 }, zoom: 2 }),
    );
  });

  it("reads a missing pose as a still one rather than as movement", () => {
    expect(readStudioViewportPose(undefined)).toBe("");
    // A partial pose is the shape early state takes; it must not read as a
    // different view from the default it is about to become.
    expect(readStudioViewportPose({})).toBe(readStudioViewportPose({ zoom: 1 }));
  });
});
