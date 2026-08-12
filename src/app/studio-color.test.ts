import { describe, expect, it } from "vitest";

import {
  studioColorToLinear,
  studioHexToLinear,
  studioLinearToHex,
} from "./studio-color";

describe("studio colour representation", () => {
  it("decodes sRGB hex into linear light", () => {
    // Mid grey is the case worth pinning: sRGB 50% is roughly 21.6% linear, not
    // 50%. If this ever reads 0.5 the transfer function has been dropped and
    // every overlap composites too bright.
    expect(studioHexToLinear("#808080")?.[0]).toBeCloseTo(0.2159, 3);
    expect(studioHexToLinear("#ffffff")).toEqual([1, 1, 1]);
    expect(studioHexToLinear("#000000")).toEqual([0, 0, 0]);
  });

  it("accepts short hex and a missing hash", () => {
    expect(studioHexToLinear("#fff")).toEqual([1, 1, 1]);
    expect(studioHexToLinear("ffffff")).toEqual([1, 1, 1]);
  });

  it("rejects a malformed colour rather than guessing one", () => {
    expect(studioHexToLinear("#12345")).toBeUndefined();
    expect(studioHexToLinear("not-a-colour")).toBeUndefined();
    expect(studioColorToLinear(42)).toBeUndefined();
  });

  it("passes a linear triple through untouched", () => {
    expect(studioColorToLinear([0.25, 0.5, 0.75])).toEqual([0.25, 0.5, 0.75]);
  });

  it("round-trips every 8-bit grey without drift", () => {
    // The round trip runs on every selection change: an edit decodes into the
    // record and projects back into the picker. A single rounding step in either
    // direction would walk the colour away from what the author chose, one
    // selection at a time.
    for (let byte = 0; byte <= 255; byte += 1) {
      const hex = `#${byte.toString(16).padStart(2, "0").repeat(3)}`;
      const linear = studioHexToLinear(hex);

      expect(linear).toBeDefined();
      expect(studioLinearToHex(linear!)).toBe(hex);
    }
  });

  it("round-trips saturated and mixed colours", () => {
    for (const hex of ["#ff0000", "#00ff00", "#0000ff", "#1a2b3c", "#fedcba"]) {
      expect(studioLinearToHex(studioHexToLinear(hex)!)).toBe(hex);
    }
  });

  it("clamps out-of-range linear values into the encodable byte range", () => {
    expect(studioLinearToHex([-1, 0.5, 2])).toBe("#00bcff");
  });
});
