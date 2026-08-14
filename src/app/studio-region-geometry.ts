/**
 * The region as a rectangle on screen, and what a drag on it means.
 *
 * The shader reads the region in its own units — normalised against frame
 * height, measured from the centre of the frame, with y running up. A pointer
 * reads in CSS pixels from the top left of the canvas with y running down. This
 * module is the whole of the conversion, kept apart from the component so the
 * arithmetic can be tested without a pointer, a canvas, or a browser.
 *
 * Every drag ends in a value for a control the product already has, which is
 * what keeps the handles a second way to drive the region rather than a second
 * copy of it (R44).
 */

/** Half-extents and centre, in the shader's own units. */
export type StudioRegionValues = {
  readonly aspect: number;
  readonly centerX: number;
  readonly centerY: number;
  /** Degrees about the shape's own centre. Optional so a drag can ignore it. */
  readonly rotation?: number;
  /** The named form, as the control spells it. Absent reads as a rectangle. */
  readonly shape?: string;
  /** Side count, read only by the `polygon` form. */
  readonly sides?: number;
  readonly size: number;
};

/** A point on screen, in CSS pixels. */
export type StudioScreenPoint = { readonly x: number; readonly y: number };

/** The canvas as the pointer sees it: CSS pixels, y down. */
export type StudioCanvasRect = {
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
};

/** A rectangle on screen, in CSS pixels. */
export type StudioScreenRect = {
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
};

/**
 * The domains of the controls the handles write, so a drag cannot ask for a
 * value the slider beside it could not hold. One literal per control, matching
 * `studio-layer-sections.ts` — a handle that could write past the slider's end
 * would make the two disagree about the same target.
 */
export const STUDIO_REGION_LIMITS = {
  aspect: { max: 4, min: 0.25 },
  center: { max: 1, min: -1 },
  rotation: { max: 180, min: -180 },
  size: { max: 0.8, min: 0.01 },
} as const;

/**
 * How far past the shape's own edge the rotation grip sits, in CSS pixels.
 *
 * A screen distance rather than a field one: the grip is something to aim at
 * with a pointer, and a gap measured in field units would close to nothing on a
 * small shape and drift half a frame away on a large one.
 */
export const STUDIO_ROTATION_HANDLE_GAP = 28;

/**
 * What the handles show for a layer that has no region yet.
 *
 * Size zero means unmasked rather than empty, so there is no rectangle to draw
 * and nothing to grab. Showing the frame itself is the honest picture of what
 * the layer currently covers, and dragging a node from there sets a real size —
 * which is how a region gets started without a slider.
 */
export function studioRegionDisplayValues(
  values: StudioRegionValues,
  canvas: StudioCanvasRect,
): StudioRegionValues {
  if (values.size > 0) return values;

  const height = Math.max(canvas.height, 1);
  return {
    aspect: canvas.width / height,
    centerX: 0,
    centerY: 0,
    size: 0.5,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** One shader unit in CSS pixels. Both axes normalise against height. */
function unit(canvas: StudioCanvasRect): number {
  return Math.max(canvas.height, 1);
}

/** Where the region sits on screen. */
export function studioRegionScreenRect(
  values: StudioRegionValues,
  canvas: StudioCanvasRect,
): StudioScreenRect {
  const perUnit = unit(canvas);
  const halfWidth = values.size * values.aspect * perUnit;
  const halfHeight = values.size * perUnit;
  const centreX = canvas.left + canvas.width / 2 + values.centerX * perUnit;
  // The shader's y runs up from the centre and the screen's runs down, so the
  // centre offset is subtracted rather than added.
  const centreY = canvas.top + canvas.height / 2 - values.centerY * perUnit;

  return {
    height: halfHeight * 2,
    left: centreX - halfWidth,
    top: centreY - halfHeight,
    width: halfWidth * 2,
  };
}

/**
 * How many sides a named form has, and how far it is turned to stand up.
 *
 * The single source of this mapping is the shader (`studio-layers.ts`); this is
 * the drawing side of the same contract, and the two have to agree or the
 * outline traces a shape the renderer is not filling.
 *
 * The shader turns by `90 - 180/n` because its base angle points at a *side* —
 * the fold that test performs is measured from an apothem. Here the points are
 * the vertices, which sit half a wedge further round, and `base + 180/n` is
 * exactly 90 degrees for every count. So every polygon starts with a vertex
 * straight up, which is the same "point-up" the shader produces and a good deal
 * easier to read. Getting this wrong drew each form rotated by half a wedge,
 * which is a triangle standing on its point.
 *
 * The rectangle is not a polygon here because it is the box itself.
 */
function polygonForm(
  shape: string | undefined,
  sides: number | undefined,
): { readonly count: number } | null {
  const count =
    shape === "triangle"
      ? 3
      : shape === "diamond"
        ? 4
        : shape === "pentagon"
          ? 5
          : shape === "hexagon"
            ? 6
            : shape === "polygon"
              ? Math.max(Math.round(sides ?? 8), 3)
              : 0;

  return count === 0 ? null : { count };
}

/**
 * The outline of the shape as a list of screen points, ready to be drawn.
 *
 * A list rather than a box, which is the whole of 14.3: until now the overlay
 * drew an axis-aligned rectangle whatever the layer actually was, so a diamond
 * wore a rectangle's outline and a rotated shape wore an unrotated one. The pen
 * (14.4) needs the same list to render a free vertex path, so the shape of this
 * function is the shape that has to hold.
 *
 * Built in the shader's own space and then converted once: the extent is read
 * from `size` and `aspect` exactly as the mask test reads it, the form supplies
 * its points, rotation turns them about the centre, and only then does the
 * result become CSS pixels with y running down.
 *
 * The ellipse is sampled rather than described because the caller draws a
 * polyline; sixty-four points is smooth at any size the canvas is shown at and
 * costs nothing next to a repaint.
 */
export function studioRegionOutlinePoints(
  values: StudioRegionValues,
  canvas: StudioCanvasRect,
): readonly StudioScreenPoint[] {
  const perUnit = unit(canvas);
  const halfHeight = values.size;
  const halfWidth = values.size * values.aspect;
  const form = polygonForm(values.shape, values.sides);

  // Local points, in field units, before rotation and before the screen flip.
  let local: readonly StudioScreenPoint[];
  if (form) {
    // Inscribed in the extent, as the shader inscribes it: the vertices sit on
    // the ellipse the size and aspect describe, so no form spills past a corner
    // a handle is drawn on (R65).
    local = Array.from({ length: form.count }, (_unused, index) => {
      const angle = ((90 + (index * 360) / form.count) * Math.PI) / 180;
      return { x: Math.cos(angle) * halfWidth, y: Math.sin(angle) * halfHeight };
    });
  } else if (values.shape === "ellipse") {
    local = Array.from({ length: 64 }, (_unused, index) => {
      const angle = (index * 2 * Math.PI) / 64;
      return { x: Math.cos(angle) * halfWidth, y: Math.sin(angle) * halfHeight };
    });
  } else {
    local = [
      { x: -halfWidth, y: -halfHeight },
      { x: halfWidth, y: -halfHeight },
      { x: halfWidth, y: halfHeight },
      { x: -halfWidth, y: halfHeight },
    ];
  }

  const angle = ((values.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const centreX = canvas.left + canvas.width / 2 + values.centerX * perUnit;
  const centreY = canvas.top + canvas.height / 2 - values.centerY * perUnit;

  return local.map((point) => ({
    x: centreX + (point.x * cos - point.y * sin) * perUnit,
    // Flipped once, here: the shader's y runs up from the centre and the
    // screen's runs down.
    y: centreY - (point.x * sin + point.y * cos) * perUnit,
  }));
}

/**
 * A field-unit point as CSS pixels, which is the inverse of
 * `studioPointerToRegionUnits` and shares its one subtlety: the shader's y runs
 * up from the centre and the screen's runs down.
 */
/**
 * A point on the canvas as the layer's own frame sees it, which is where a
 * drawn vertex has to be stored.
 *
 * The shader tests a path against `maskLocal` -- the delta from the shape's
 * centre, turned by its rotation -- so a path stored in absolute field units
 * lands wherever the centre happens to be rather than where it was drawn. This
 * is the same transform the mask performs, applied once at authoring time.
 */
export function studioPointToShapeFrame(
  point: StudioScreenPoint,
  values: StudioRegionValues,
): readonly [number, number] {
  const deltaX = point.x - values.centerX;
  const deltaY = point.y - values.centerY;
  const angle = ((values.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [deltaX * cos + deltaY * sin, -deltaX * sin + deltaY * cos];
}

/** The inverse of `studioPointToShapeFrame`, for drawing a stored vertex. */
export function studioShapeFrameToPoint(
  vertex: readonly [number, number],
  values: StudioRegionValues,
): readonly [number, number] {
  const angle = ((values.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [
    values.centerX + vertex[0] * cos - vertex[1] * sin,
    values.centerY + vertex[0] * sin + vertex[1] * cos,
  ];
}

export function studioVertexToScreen(
  point: readonly [number, number],
  canvas: StudioCanvasRect,
): StudioScreenPoint {
  const perUnit = unit(canvas);
  return {
    x: canvas.left + canvas.width / 2 + point[0] * perUnit,
    y: canvas.top + canvas.height / 2 - point[1] * perUnit,
  };
}

/** Where a pointer is, in the shader's units, relative to the frame centre. */
export function studioPointerToRegionUnits(
  point: { readonly x: number; readonly y: number },
  canvas: StudioCanvasRect,
): { readonly x: number; readonly y: number } {
  const perUnit = unit(canvas);
  return {
    x: (point.x - (canvas.left + canvas.width / 2)) / perUnit,
    y: ((canvas.top + canvas.height / 2) - point.y) / perUnit,
  };
}

/**
 * Which part of the region a handle grabs.
 *
 * The corners carry both half-extents, the sides carry the width, and the caps
 * carry the height — which is exactly the difference between resizing freely
 * and resizing along one axis.
 */
export type StudioRegionHandleId =
  | "east"
  | "north"
  | "northEast"
  | "northWest"
  | "south"
  | "southEast"
  | "southWest"
  | "west";

export const STUDIO_REGION_HANDLES: readonly StudioRegionHandleId[] = [
  "northWest",
  "north",
  "northEast",
  "west",
  "east",
  "southWest",
  "south",
  "southEast",
];

/** Where a handle sits within the region, as a fraction from its centre. */
export function studioRegionHandleAnchor(handle: StudioRegionHandleId): {
  readonly x: number;
  readonly y: number;
} {
  const x = handle.toLowerCase().includes("west")
    ? -1
    : handle.toLowerCase().includes("east")
      ? 1
      : 0;
  const y = handle.toLowerCase().startsWith("north")
    ? -1
    : handle.toLowerCase().startsWith("south")
      ? 1
      : 0;
  return { x, y };
}

/**
 * Where a node sits on screen, which is on the shape rather than on a box
 * drawn around it.
 *
 * The nodes were placed from the axis-aligned screen rectangle until the
 * rotation grip made turning a shape a gesture rather than a slider. That was
 * survivable while rotation was rare and deliberate, and is not now: a node
 * drawn at the corner of an upright box on a shape that is turned forty
 * degrees is pointing at pixels the shape does not occupy, and grabbing it
 * resizes along an axis the author cannot see.
 */
export function studioRegionHandlePoint(
  handle: StudioRegionHandleId,
  values: StudioRegionValues,
  canvas: StudioCanvasRect,
): StudioScreenPoint {
  const anchor = studioRegionHandleAnchor(handle);
  // The anchor's y is a screen direction and the shape's frame runs up, so the
  // node's own y is the negated anchor.
  const local: readonly [number, number] = [
    anchor.x * values.size * values.aspect,
    -anchor.y * values.size,
  ];

  return studioVertexToScreen(studioShapeFrameToPoint(local, values), canvas);
}

/**
 * Where the rotation grip sits: off the shape's north edge, turned with it.
 *
 * Placed along the line from the centre through that edge rather than straight
 * up the screen, so the grip stays the same part of the shape at every angle —
 * which is what lets the gesture read as turning *this* shape rather than
 * dragging an unrelated dot around it.
 */
export function studioRotationHandlePoint(
  values: StudioRegionValues,
  canvas: StudioCanvasRect,
): StudioScreenPoint {
  const edge = studioRegionHandlePoint("north", values, canvas);
  const centre = studioVertexToScreen([values.centerX, values.centerY], canvas);
  const deltaX = edge.x - centre.x;
  const deltaY = edge.y - centre.y;
  const length = Math.hypot(deltaX, deltaY);

  // A shape with no extent has no direction to leave along; straight up the
  // screen is the reading that matches an unrotated shape.
  if (length === 0) return { x: edge.x, y: edge.y - STUDIO_ROTATION_HANDLE_GAP };

  return {
    x: edge.x + (deltaX / length) * STUDIO_ROTATION_HANDLE_GAP,
    y: edge.y + (deltaY / length) * STUDIO_ROTATION_HANDLE_GAP,
  };
}

/** Degrees folded onto the slider's own domain, so -190 reads as 170. */
function foldRotation(degrees: number): number {
  const folded = ((degrees + 180) % 360 + 360) % 360 - 180;
  return folded === -180 ? 180 : folded;
}

/**
 * The angle the pointer stands at, measured the way `maskRotation` measures.
 *
 * Zero is the shape's north edge, and the count runs the way the shader turns:
 * its y runs up, so a positive rotation is counter-clockwise both in the field
 * and — after the one flip the screen conversion performs — on screen.
 */
export function studioPointerRotation({
  canvas,
  pointer,
  values,
}: {
  readonly canvas: StudioCanvasRect;
  readonly pointer: { readonly x: number; readonly y: number };
  readonly values: StudioRegionValues;
}): number {
  const here = studioPointerToRegionUnits(pointer, canvas);
  const deltaX = here.x - values.centerX;
  const deltaY = here.y - values.centerY;
  if (deltaX === 0 && deltaY === 0) return values.rotation ?? 0;

  return foldRotation((Math.atan2(deltaY, deltaX) * 180) / Math.PI - 90);
}

/**
 * The rotation a grip drag asks for.
 *
 * Carried by the offset between the pointer's angle and the shape's when the
 * drag began, for the same reason a move drag carries its grab offset: the
 * grip sits off the edge rather than under the cursor, and a shape that
 * snapped its north edge to the pointer would jump the moment it was grabbed.
 */
export function studioRotateRegion({
  canvas,
  grabRotation,
  pointer,
  values,
}: {
  readonly canvas: StudioCanvasRect;
  readonly grabRotation: number;
  readonly pointer: { readonly x: number; readonly y: number };
  readonly values: StudioRegionValues;
}): StudioRegionValues {
  return {
    ...values,
    rotation: clamp(
      foldRotation(studioPointerRotation({ canvas, pointer, values }) + grabRotation),
      STUDIO_REGION_LIMITS.rotation.min,
      STUDIO_REGION_LIMITS.rotation.max,
    ),
  };
}

/**
 * The region a resize drag asks for.
 *
 * The dragged node moves to the pointer and the opposite node stays put, which
 * is what makes a corner drag resize rather than move: the centre follows to
 * the midpoint of the two. An axis a handle does not carry is left exactly as
 * it was, so dragging a side cannot change the height by rounding.
 *
 * Measured in the shape's own frame rather than in the field's. The two are the
 * same thing at rest, and once a shape is turned they are not: the half-extents
 * the mask tests are along the shape's axes, so a drag resolved against the
 * frame's axes would feed a width to a control that means something else. In
 * that frame the node the author grabbed is the one that moves and the opposite
 * one holds, at every angle.
 */
export function studioResizeRegion({
  canvas,
  handle,
  pointer,
  values,
}: {
  readonly canvas: StudioCanvasRect;
  readonly handle: StudioRegionHandleId;
  readonly pointer: { readonly x: number; readonly y: number };
  readonly values: StudioRegionValues;
}): StudioRegionValues {
  const anchor = studioRegionHandleAnchor(handle);
  const here = studioPointToShapeFrame(
    studioPointerToRegionUnits(pointer, canvas),
    values,
  );

  const halfWidth = values.size * values.aspect;
  const halfHeight = values.size;
  // The edge that stays put during the drag, in the shape's own frame — where
  // the centre is the origin, so the opposite edge is just the negated node.
  const fixedX = -anchor.x * halfWidth;
  // The anchor's y is a screen direction and the shape's frame runs up, so the
  // opposite edge sits at plus the anchor rather than minus it.
  const fixedY = anchor.y * halfHeight;

  let nextHalfHeight = halfHeight;
  // Offsets from the shape's own centre, so an axis the handle does not carry
  // stays at zero and the centre does not move along it.
  let localY = 0;
  if (anchor.y !== 0) {
    nextHalfHeight = Math.abs(here[1] - fixedY) / 2;
    localY = (here[1] + fixedY) / 2;
  }

  let nextHalfWidth = halfWidth;
  let localX = 0;
  if (anchor.x !== 0) {
    nextHalfWidth = Math.abs(here[0] - fixedX) / 2;
    localX = (here[0] + fixedX) / 2;
  }

  const [nextCenterX, nextCenterY] = studioShapeFrameToPoint([localX, localY], values);

  const size = clamp(
    nextHalfHeight,
    STUDIO_REGION_LIMITS.size.min,
    STUDIO_REGION_LIMITS.size.max,
  );

  return {
    ...values,
    aspect: clamp(
      nextHalfWidth / size,
      STUDIO_REGION_LIMITS.aspect.min,
      STUDIO_REGION_LIMITS.aspect.max,
    ),
    centerX: clamp(
      nextCenterX,
      STUDIO_REGION_LIMITS.center.min,
      STUDIO_REGION_LIMITS.center.max,
    ),
    centerY: clamp(
      nextCenterY,
      STUDIO_REGION_LIMITS.center.min,
      STUDIO_REGION_LIMITS.center.max,
    ),
    size,
  };
}

/**
 * The centre a move drag asks for.
 *
 * Carried by the offset between the pointer and the centre when the drag began,
 * so the region does not jump to sit under the cursor the moment it is grabbed.
 */
export function studioMoveRegion({
  canvas,
  grabOffset,
  pointer,
  values,
}: {
  readonly canvas: StudioCanvasRect;
  readonly grabOffset: { readonly x: number; readonly y: number };
  readonly pointer: { readonly x: number; readonly y: number };
  readonly values: StudioRegionValues;
}): StudioRegionValues {
  const here = studioPointerToRegionUnits(pointer, canvas);

  return {
    ...values,
    centerX: clamp(
      here.x + grabOffset.x,
      STUDIO_REGION_LIMITS.center.min,
      STUDIO_REGION_LIMITS.center.max,
    ),
    centerY: clamp(
      here.y + grabOffset.y,
      STUDIO_REGION_LIMITS.center.min,
      STUDIO_REGION_LIMITS.center.max,
    ),
  };
}
