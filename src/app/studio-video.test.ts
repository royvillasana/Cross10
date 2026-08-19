import { describe, expect, it } from "vitest";

import {
  isStudioVideoAsset,
  studioVideoLoopTime,
  studioVideoRepeatCount,
} from "./studio-video";

describe("a clip read at the loop position", () => {
  it("closes the loop wherever the clip's length falls", () => {
    // The claim the whole design exists for, made for lengths that divide the
    // loop and lengths that do not: the frame at the end of the loop is the
    // frame at its start.
    for (const clip of [0.5, 1, 1.7, 4, 9.3, 30]) {
      expect(studioVideoLoopTime(clip, 4, 1)).toBeCloseTo(
        studioVideoLoopTime(clip, 4, 0),
        10,
      );
    }
  });

  it("runs a clip shorter than the loop at close to its own speed", () => {
    // A two-second clip in a four-second loop should run twice, not at half
    // speed -- which is the failure "fit" would produce.
    expect(studioVideoRepeatCount(2, 4)).toBe(2);
    // A quarter of the way through the loop is halfway through the first pass.
    expect(studioVideoLoopTime(2, 4, 0.25)).toBeCloseTo(1, 10);
  });

  it("runs a clip longer than the loop once rather than not at all", () => {
    expect(studioVideoRepeatCount(30, 4)).toBe(1);
    expect(studioVideoLoopTime(30, 4, 0.5)).toBeCloseTo(15, 10);
  });

  it("advances monotonically within a pass", () => {
    const times = [0, 0.1, 0.2, 0.3, 0.4].map((progress) =>
      studioVideoLoopTime(3, 3, progress),
    );
    for (let index = 1; index < times.length; index += 1) {
      expect(times[index]).toBeGreaterThan(times[index - 1] as number);
    }
  });

  it("reads a scrub behind zero as a position rather than as an error", () => {
    // A negative progress modulo one is still negative in JS, and a seek to a
    // negative time is either clamped or rejected -- either way the frame is
    // wrong rather than merely early.
    expect(studioVideoLoopTime(2, 2, -0.25)).toBeCloseTo(1.5, 10);
  });

  it("asks for no frame at all when there is no clip to read", () => {
    expect(studioVideoLoopTime(0, 4, 0.5)).toBe(0);
    expect(studioVideoLoopTime(Number.NaN, 4, 0.5)).toBe(0);
    // A loop with no duration is the runtime's "not running", not a divide.
    expect(studioVideoRepeatCount(2, 0)).toBe(1);
  });

  it("tells a clip from every other upload by what the importer recorded", () => {
    expect(isStudioVideoAsset({ assetKind: "file", mimeType: "video/mp4" })).toBe(
      true,
    );
    // A picture is imported by the picture handler and is not this path.
    expect(isStudioVideoAsset({ assetKind: "image", mimeType: "image/png" })).toBe(
      false,
    );
    // A file upload that is not a clip belongs to nothing here.
    expect(
      isStudioVideoAsset({ assetKind: "file", mimeType: "application/pdf" }),
    ).toBe(false);
    expect(isStudioVideoAsset({ assetKind: "file" })).toBe(false);
  });
});
