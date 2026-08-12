import { describe, expect, it } from "vitest";

import {
  STUDIO_REGION_LIMITS,
  studioMoveRegion,
  studioPointerToRegionUnits,
  studioRegionDisplayValues,
  studioRegionHandleAnchor,
  studioRegionScreenRect,
  studioResizeRegion,
  type StudioCanvasRect,
  type StudioRegionValues,
} from "./studio-region-geometry";

/** A 16:9 canvas at a round size, so the arithmetic stays readable. */
const CANVAS: StudioCanvasRect = { height: 360, left: 100, top: 50, width: 640 };

const CENTRED: StudioRegionValues = {
  aspect: 1,
  centerX: 0,
  centerY: 0,
  size: 0.25,
};

describe("studioRegionScreenRect", () => {
  it("places a centred square region on the centre of the canvas", () => {
    // Half-height 0.25 of 360px is 90px, so the region is 180px square and
    // centred on (100 + 320, 50 + 180).
    expect(studioRegionScreenRect(CENTRED, CANVAS)).toEqual({
      height: 180,
      left: 330,
      top: 140,
      width: 180,
    });
  });

  it("measures width against height, so aspect widens without heightening", () => {
    const wide = studioRegionScreenRect({ ...CENTRED, aspect: 2 }, CANVAS);

    expect(wide.width).toBe(360);
    expect(wide.height).toBe(180);
  });

  it("sends a positive centre up the screen, not down", () => {
    // The shader's y runs up and the screen's runs down. Getting this backwards
    // is invisible in a centred fixture and wrong everywhere else, which is why
    // it is asserted on its own.
    const raised = studioRegionScreenRect({ ...CENTRED, centerY: 0.5 }, CANVAS);

    expect(raised.top).toBeLessThan(studioRegionScreenRect(CENTRED, CANVAS).top);
  });
});

describe("studioPointerToRegionUnits", () => {
  it("reads the canvas centre as the origin", () => {
    expect(studioPointerToRegionUnits({ x: 420, y: 230 }, CANVAS)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("is the inverse of the screen rect for a region's own centre", () => {
    const values = { ...CENTRED, centerX: -0.4, centerY: 0.3 };
    const rect = studioRegionScreenRect(values, CANVAS);
    const centre = studioPointerToRegionUnits(
      { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      CANVAS,
    );

    expect(centre.x).toBeCloseTo(values.centerX, 10);
    expect(centre.y).toBeCloseTo(values.centerY, 10);
  });
});

describe("studioRegionDisplayValues", () => {
  it("shows the whole frame for a layer that has no region yet", () => {
    // Size zero means unmasked, so there is no rectangle to grab. The frame is
    // what the layer actually covers, and dragging a node from there is how a
    // region gets started without touching a slider.
    const shown = studioRegionDisplayValues({ ...CENTRED, size: 0 }, CANVAS);
    const rect = studioRegionScreenRect(shown, CANVAS);

    expect(rect).toEqual({ height: 360, left: 100, top: 50, width: 640 });
  });

  it("leaves a region that exists exactly as it is", () => {
    expect(studioRegionDisplayValues(CENTRED, CANVAS)).toEqual(CENTRED);
  });
});

describe("studioResizeRegion", () => {
  it("holds the opposite corner still, so a corner drag resizes rather than moves", () => {
    const before = studioRegionScreenRect(CENTRED, CANVAS);
    const next = studioResizeRegion({
      canvas: CANVAS,
      handle: "southEast",
      pointer: { x: before.left + before.width + 90, y: before.top + before.height + 90 },
      values: CENTRED,
    });
    const after = studioRegionScreenRect(next, CANVAS);

    expect(after.left).toBeCloseTo(before.left, 6);
    expect(after.top).toBeCloseTo(before.top, 6);
    expect(after.width).toBeGreaterThan(before.width);
    expect(after.height).toBeGreaterThan(before.height);
  });

  it("leaves the height alone when a side node carries only the width", () => {
    const next = studioResizeRegion({
      canvas: CANVAS,
      handle: "east",
      pointer: { x: 600, y: 230 },
      values: CENTRED,
    });

    expect(next.size).toBe(CENTRED.size);
    expect(next.centerY).toBe(CENTRED.centerY);
    expect(next.aspect).not.toBe(CENTRED.aspect);
  });

  it("leaves the width alone when a cap node carries only the height", () => {
    const before = studioRegionScreenRect(CENTRED, CANVAS);
    const next = studioResizeRegion({
      canvas: CANVAS,
      handle: "south",
      // Past the region's existing bottom edge at 320, so the drag actually
      // asks for a different height.
      pointer: { x: 420, y: 380 },
      values: CENTRED,
    });
    const after = studioRegionScreenRect(next, CANVAS);

    expect(next.centerX).toBe(CENTRED.centerX);
    expect(after.width).toBeCloseTo(before.width, 6);
    expect(after.height).not.toBeCloseTo(before.height, 6);
  });

  it("cannot ask for a value the slider beside it could not hold", () => {
    const next = studioResizeRegion({
      canvas: CANVAS,
      handle: "southEast",
      pointer: { x: 100_000, y: 100_000 },
      values: CENTRED,
    });

    expect(next.size).toBeLessThanOrEqual(STUDIO_REGION_LIMITS.size.max);
    expect(next.aspect).toBeLessThanOrEqual(STUDIO_REGION_LIMITS.aspect.max);
    expect(next.centerX).toBeLessThanOrEqual(STUDIO_REGION_LIMITS.center.max);
    expect(next.centerY).toBeGreaterThanOrEqual(STUDIO_REGION_LIMITS.center.min);
  });
});

describe("studioMoveRegion", () => {
  it("keeps the region's size and only moves its centre", () => {
    const next = studioMoveRegion({
      canvas: CANVAS,
      grabOffset: { x: 0, y: 0 },
      pointer: { x: 500, y: 200 },
      values: CENTRED,
    });

    expect(next.size).toBe(CENTRED.size);
    expect(next.aspect).toBe(CENTRED.aspect);
    expect(next.centerX).not.toBe(CENTRED.centerX);
  });

  it("carries the grab offset, so the region does not jump under the cursor", () => {
    const grabbed = studioMoveRegion({
      canvas: CANVAS,
      grabOffset: { x: 0.1, y: -0.2 },
      pointer: { x: 420, y: 230 },
      values: CENTRED,
    });

    expect(grabbed.centerX).toBeCloseTo(0.1, 10);
    expect(grabbed.centerY).toBeCloseTo(-0.2, 10);
  });
});

describe("studioRegionHandleAnchor", () => {
  it("puts each node where its name says", () => {
    expect(studioRegionHandleAnchor("northWest")).toEqual({ x: -1, y: -1 });
    expect(studioRegionHandleAnchor("east")).toEqual({ x: 1, y: 0 });
    expect(studioRegionHandleAnchor("south")).toEqual({ x: 0, y: 1 });
  });
});
