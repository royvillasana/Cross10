import { describe, expect, it } from "vitest";

import {
  STUDIO_REGION_LIMITS,
  studioMoveRegion,
  studioPointerRotation,
  studioPointerToRegionUnits,
  studioRegionDisplayValues,
  studioRegionHandleAnchor,
  studioRegionHandlePoint,
  studioRegionOutlinePoints,
  studioRegionScreenRect,
  studioResizeRegion,
  studioRotateRegion,
  studioRotationHandlePoint,
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

describe("the nodes on a turned shape", () => {
  const TURNED: StudioRegionValues = { ...CENTRED, rotation: 90 };

  it("puts each node on the shape rather than on an upright box around it", () => {
    // A quarter turn sends the north node to the west of the centre. Drawn from
    // the screen rectangle it would have stayed straight above it, pointing at
    // pixels the shape no longer occupies.
    const north = studioRegionHandlePoint("north", TURNED, CANVAS);

    expect(north.x).toBeCloseTo(330, 6);
    expect(north.y).toBeCloseTo(230, 6);
  });

  it("holds the opposite node still through a corner drag, at any angle", () => {
    // The claim a resize rests on, made where it used to break: measured
    // against the frame's axes, a drag on a turned shape moved both corners.
    const before = studioRegionHandlePoint("northWest", TURNED, CANVAS);
    const next = studioResizeRegion({
      canvas: CANVAS,
      handle: "southEast",
      // Further out along the shape's own diagonal, past the node at (510, 140).
      pointer: { x: 570, y: 80 },
      values: TURNED,
    });
    const after = studioRegionHandlePoint("northWest", next, CANVAS);

    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(next.size).toBeGreaterThan(TURNED.size);
    // The drag resizes; it does not quietly re-aim the shape.
    expect(next.rotation).toBe(90);
  });
});

describe("the rotation grip", () => {
  it("sits off the shape's north edge, clear of the node already there", () => {
    const grip = studioRotationHandlePoint(CENTRED, CANVAS);
    const north = studioRegionHandlePoint("north", CENTRED, CANVAS);

    expect(grip.x).toBeCloseTo(north.x, 6);
    // Screen y runs down, so "further out" from a north edge is a smaller y.
    expect(north.y - grip.y).toBeCloseTo(28, 6);
  });

  it("travels with the shape, so it stays the same part of it", () => {
    const grip = studioRotationHandlePoint({ ...CENTRED, rotation: 90 }, CANVAS);

    // A quarter turn carries the grip round to the west, at the same distance.
    expect(grip.x).toBeCloseTo(302, 6);
    expect(grip.y).toBeCloseTo(230, 6);
  });

  it("reads the pointer's angle the way the shader counts rotation", () => {
    // Zero is straight up, and the count runs counter-clockwise: the shader's y
    // runs up, so a positive turn carries the north edge towards the west.
    expect(
      studioPointerRotation({ canvas: CANVAS, pointer: { x: 420, y: 140 }, values: CENTRED }),
    ).toBeCloseTo(0, 6);
    expect(
      studioPointerRotation({ canvas: CANVAS, pointer: { x: 330, y: 230 }, values: CENTRED }),
    ).toBeCloseTo(90, 6);
    expect(
      studioPointerRotation({ canvas: CANVAS, pointer: { x: 510, y: 230 }, values: CENTRED }),
    ).toBeCloseTo(-90, 6);
  });
});

describe("studioRotateRegion", () => {
  it("studioRotateRegion turns the shape to follow the grip, carrying the angle it was grabbed at", () => {
    const grabbed = studioRotateRegion({
      canvas: CANVAS,
      // Grabbed at rest and dragged a quarter turn: the shape follows the grip.
      grabRotation: 0,
      pointer: { x: 330, y: 230 },
      values: CENTRED,
    });

    expect(grabbed.rotation).toBeCloseTo(90, 6);
    // A turn is a turn: nothing about the extent moves with it.
    expect(grabbed.size).toBe(CENTRED.size);
    expect(grabbed.aspect).toBe(CENTRED.aspect);
    expect(grabbed.centerX).toBe(CENTRED.centerX);

    // And the offset is carried rather than snapped, so a shape already turned
    // does not jump its north edge to the pointer the moment it is grabbed.
    const offset = studioRotateRegion({
      canvas: CANVAS,
      grabRotation: 30,
      pointer: { x: 420, y: 140 },
      values: { ...CENTRED, rotation: 30 },
    });
    expect(offset.rotation).toBeCloseTo(30, 6);
  });

  it("cannot ask for a value the shader's rotation could not hold", () => {
    // Past half a turn the angle folds rather than running off the end: 90 + 150
    // is the same shape as -120, and only one of the two is a value the domain
    // this writes into accepts.
    const folded = studioRotateRegion({
      canvas: CANVAS,
      grabRotation: 150,
      pointer: { x: 330, y: 230 },
      values: CENTRED,
    });

    expect(folded.rotation).toBeCloseTo(-120, 6);
    expect(folded.rotation ?? 0).toBeLessThanOrEqual(STUDIO_REGION_LIMITS.rotation.max);
    expect(folded.rotation ?? 0).toBeGreaterThanOrEqual(STUDIO_REGION_LIMITS.rotation.min);
  });
});

describe("studioRegionHandleAnchor", () => {
  it("puts each node where its name says", () => {
    expect(studioRegionHandleAnchor("northWest")).toEqual({ x: -1, y: -1 });
    expect(studioRegionHandleAnchor("east")).toEqual({ x: 1, y: 0 });
    expect(studioRegionHandleAnchor("south")).toEqual({ x: 0, y: 1 });
  });
});

describe("the shape outline", () => {
  // A frame whose centre is the origin and whose unit is 100 CSS pixels, so a
  // half-extent of 0.25 is 25 pixels and every expectation below is readable.
  const canvas = { height: 100, left: 0, top: 0, width: 200 } as const;
  const base = { aspect: 1, centerX: 0, centerY: 0, size: 0.25 } as const;

  it("traces a rectangle as its four corners", () => {
    const points = studioRegionOutlinePoints(base, canvas);

    expect(points).toHaveLength(4);
    expect(points).toContainEqual({ x: 75, y: 25 });
    expect(points).toContainEqual({ x: 125, y: 75 });
  });

  it("gives a triangle three points and stands it up", () => {
    const points = studioRegionOutlinePoints({ ...base, shape: "triangle" }, canvas);

    expect(points).toHaveLength(3);
    // The apex is directly above the centre: the screen's y runs down, so
    // "above" is the smallest y in the list.
    const apex = points.reduce((lowest, point) => (point.y < lowest.y ? point : lowest));
    expect(apex.x).toBeCloseTo(100, 6);
    // The centre is at y=50 and the extent is 25 pixels, so an apex above the
    // centre is at 25 rather than 75. Screen y runs down.
    expect(apex.y).toBeCloseTo(25, 6);
  });

  it("gives a polygon the side count it asks for", () => {
    expect(
      studioRegionOutlinePoints({ ...base, shape: "polygon", sides: 7 }, canvas),
    ).toHaveLength(7);
    // Below three there is no polygon to draw, so the count is held there.
    expect(
      studioRegionOutlinePoints({ ...base, shape: "polygon", sides: 1 }, canvas),
    ).toHaveLength(3);
  });

  it("inscribes every form in the same extent", () => {
    // What R65 promises: no form reaches further than the box its handles are
    // drawn on, so the furthest any point sits from the centre is the size.
    for (const shape of ["rectangle", "ellipse", "triangle", "diamond", "hexagon"]) {
      const points = studioRegionOutlinePoints({ ...base, shape }, canvas);
      const furthest = Math.max(
        ...points.map((point) => Math.hypot(point.x - 100, point.y - 50)),
      );
      // The rectangle's corners sit at the diagonal of the extent; every
      // inscribed form stays within the circle the extent describes.
      expect(furthest).toBeLessThanOrEqual(shape === "rectangle" ? 35.4 : 25.01);
    }
  });

  it("turns the outline with the shape rather than leaving it square", () => {
    const upright = studioRegionOutlinePoints({ ...base, shape: "triangle" }, canvas);
    const turned = studioRegionOutlinePoints(
      { ...base, rotation: 90, shape: "triangle" },
      canvas,
    );

    // A quarter turn puts the apex on a side instead of on top, which the old
    // rectangular outline could not have shown at all.
    const apexOf = (points: readonly { x: number; y: number }[]) =>
      points.reduce((lowest, point) => (point.y < lowest.y ? point : lowest));
    expect(apexOf(upright).y).toBeCloseTo(25, 6);
    expect(apexOf(turned).y).not.toBeCloseTo(25, 1);
  });

  it("stretches the form with the aspect without bending it", () => {
    const wide = studioRegionOutlinePoints({ ...base, aspect: 2, shape: "diamond" }, canvas);
    const spanX = Math.max(...wide.map((p) => p.x)) - Math.min(...wide.map((p) => p.x));
    const spanY = Math.max(...wide.map((p) => p.y)) - Math.min(...wide.map((p) => p.y));

    expect(spanX).toBeCloseTo(spanY * 2, 6);
  });
});
