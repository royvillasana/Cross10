import {
  studioNodeIncoming,
  studioNodeOutgoing,
  studioNodePosition,
  studioPathIsCurved,
  type StudioVertexPoint,
} from "./studio-stack-state";

/**
 * A drawn region, rasterized once instead of tested per pixel.
 *
 * **Why this exists at all.** A path used to be compiled into the shader: every
 * node became a `vec2` literal and an iteration of an unrolled loop, so the
 * cost of drawing was paid again at every pixel of every frame. That put a hard
 * ceiling on how much an author could draw -- two dozen nodes, not because two
 * dozen is a natural number of nodes but because it was the largest count that
 * architecture could compile quickly and run at speed. It also made curves
 * impossible: a cubic evaluated per pixel per segment is the same bill again,
 * several times over.
 *
 * Rasterizing inverts the economics. The path is drawn once, on the CPU, into a
 * single-channel mask; the shader reads one texel. Per-pixel cost is now
 * constant in the node count, which is what lets a path hold thousands of nodes
 * and carry a bézier at every one of them. The cost that remains is paid when
 * the path *changes*, which is exactly when an author is expecting the picture
 * to be catching up with them.
 *
 * Two things come free with it. The rasterizer antialiases, so a drawn edge is
 * smooth where the point-in-polygon test gave a hard staircase. And curves are
 * whatever `Path2D` can describe rather than whatever is cheap to evaluate per
 * pixel.
 *
 * **The trade is honest and worth stating**: a drawn region no longer travels
 * inside the delivered shader source. It could when it was a list of literals.
 * A mask is an image, and an image cannot be a line of GLSL.
 */

/** Every path mask for one stack, packed into one texture. */
export type StudioPathAtlas = Readonly<{
  /** The atlas image, ready to upload. */
  image: HTMLCanvasElement;
  /** Where each layer's mask sits, by the layer's index in the stack. */
  tiles: ReadonlyMap<number, StudioPathTile>;
}>;

/** Where one layer's mask sits in the atlas, and what region of the shape frame it covers. */
export type StudioPathTile = Readonly<{
  /** The shape-frame point the tile's lower-left corner maps to. */
  origin: readonly [number, number];
  /** How much of the shape frame the tile spans. */
  extent: readonly [number, number];
  /** The tile's rectangle in atlas texture coordinates: origin then size. */
  rect: readonly [number, number, number, number];
}>;

/**
 * One atlas rather than one texture per layer, and that is a hardware
 * constraint rather than tidiness.
 *
 * WebGL2 guarantees only sixteen texture units to a fragment shader, and this
 * product already spends one per layer on imported pictures at a declared stack
 * depth of sixteen. A second texture per layer would ask for thirty-two and
 * fail on conforming hardware. An atlas asks for exactly one, whatever the
 * stack does.
 */
const ATLAS_TILES = 4;
const TILE_SIZE = 512;
const ATLAS_SIZE = ATLAS_TILES * TILE_SIZE;

/**
 * Empty pixels kept around every path, in tile pixels.
 *
 * Two jobs at once. The mask is sampled with linear filtering, so a shape
 * touching its tile's edge would blend with whatever the neighbouring tile
 * holds -- a padding ring of zero is what makes neighbours invisible to one
 * another. And an edge exactly on the boundary has no room to be antialiased
 * into, so it would come back hard on that side and soft everywhere else.
 */
const TILE_PADDING = 6;

/** The largest number of drawn regions one atlas can hold. */
export const STUDIO_PATH_ATLAS_CAPACITY = ATLAS_TILES * ATLAS_TILES;

/**
 * The box a path occupies in its own frame, with room for its handles.
 *
 * Handles are included because a curve leaves the line between its nodes: a box
 * around the nodes alone clips exactly the bulge that made someone reach for a
 * curve. This is a bound rather than the true hull of the cubics -- a hull would
 * be tighter and is not worth solving, since being generous costs resolution
 * and being wrong costs the shape.
 */
export function studioPathBounds(
  path: readonly StudioVertexPoint[],
): Readonly<{ origin: readonly [number, number]; extent: readonly [number, number] }> {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const include = (x: number, y: number): void => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const node of path) {
    const [x, y] = studioNodePosition(node);
    include(x, y);
    const incoming = studioNodeIncoming(node);
    const outgoing = studioNodeOutgoing(node);
    include(x + incoming[0], y + incoming[1]);
    include(x + outgoing[0], y + outgoing[1]);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { extent: [1, 1], origin: [0, 0] };
  }

  // A path that is a straight horizontal line has no height, and dividing by
  // that extent is how a mask becomes a division by zero rather than a shape.
  const width = Math.max(maxX - minX, 1e-3);
  const height = Math.max(maxY - minY, 1e-3);
  // The same fraction the padding ring occupies in pixels, so the shape lands
  // inside the padded area rather than being scaled to the whole tile and then
  // clipped by it.
  const margin = (TILE_PADDING / TILE_SIZE) * 2;

  return {
    extent: [width * (1 + margin), height * (1 + margin)],
    origin: [minX - (width * margin) / 2, minY - (height * margin) / 2],
  };
}

/**
 * Traces one path into a 2D context, in tile pixels.
 *
 * Closed unconditionally, because a region is an area rather than a stroke: an
 * open path filled by the even-odd rule is filled as though the last node were
 * joined to the first anyway, so closing it explicitly makes the closing
 * segment a real segment that the last node's outgoing handle can bend.
 */
export function traceStudioPath(
  context: Path2D,
  path: readonly StudioVertexPoint[],
  toTile: (point: readonly [number, number]) => readonly [number, number],
): void {
  if (path.length < 2) return;

  const first = path[0];
  if (!first) return;
  const start = toTile(studioNodePosition(first));
  context.moveTo(start[0], start[1]);

  const curved = studioPathIsCurved(path);

  for (let index = 1; index <= path.length; index += 1) {
    const from = path[index - 1];
    // The wrap is the closing segment, which is a segment like any other.
    const to = path[index % path.length];
    if (!from || !to) continue;

    const fromPoint = studioNodePosition(from);
    const toPoint = studioNodePosition(to);
    const target = toTile(toPoint);

    if (!curved) {
      context.lineTo(target[0], target[1]);
      continue;
    }

    // A cubic whose handles are both zero *is* the straight line between its
    // ends, so a path mixing corners and curves needs no branch per segment --
    // which is what keeps a corner exactly a corner rather than a curve that
    // rounds it slightly.
    const out = studioNodeOutgoing(from);
    const incoming = studioNodeIncoming(to);
    const control1 = toTile([fromPoint[0] + out[0], fromPoint[1] + out[1]]);
    const control2 = toTile([toPoint[0] + incoming[0], toPoint[1] + incoming[1]]);
    context.bezierCurveTo(
      control1[0],
      control1[1],
      control2[0],
      control2[1],
      target[0],
      target[1],
    );
  }

  context.closePath();
}

/**
 * Every drawn region in a stack, rasterized into one atlas.
 *
 * Returns `null` when nothing is drawn, which is the common case and is worth
 * making cheap: a stack with no path allocates nothing, uploads nothing, and
 * costs one comparison per draw.
 *
 * Filled with the **non-zero** rule rather than even-odd. The two disagree
 * exactly where a path crosses itself, and a freehand stroke crosses itself
 * constantly -- even-odd punches those overlaps into holes, which is the
 * failure that makes a hand-drawn shape look moth-eaten.
 */
export function rasterizeStudioPathAtlas(
  paths: ReadonlyMap<number, readonly StudioVertexPoint[]>,
): StudioPathAtlas | null {
  const drawable = [...paths.entries()]
    .filter(([, path]) => path.length >= 2)
    .slice(0, STUDIO_PATH_ATLAS_CAPACITY);
  if (drawable.length === 0) return null;

  const image = document.createElement("canvas");
  image.width = ATLAS_SIZE;
  image.height = ATLAS_SIZE;
  const context = image.getContext("2d", { willReadFrequently: false });
  if (!context) return null;

  context.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  context.fillStyle = "#ffffff";

  const tiles = new Map<number, StudioPathTile>();

  drawable.forEach(([layerIndex, path], slot) => {
    const column = slot % ATLAS_TILES;
    const row = Math.floor(slot / ATLAS_TILES);
    const left = column * TILE_SIZE;
    const top = row * TILE_SIZE;
    const { extent, origin } = studioPathBounds(path);

    const toTile = (point: readonly [number, number]): readonly [number, number] => [
      left + ((point[0] - origin[0]) / extent[0]) * TILE_SIZE,
      // Flipped, because the shape frame's y runs up from the centre and a
      // canvas raster's runs down. Sampling without this gives a mask that is
      // the drawing upside down, which looks like a shape someone else drew
      // rather than like a bug.
      top + TILE_SIZE - ((point[1] - origin[1]) / extent[1]) * TILE_SIZE,
    ];

    const shape = new Path2D();
    traceStudioPath(shape, path, toTile);
    context.fill(shape, "nonzero");

    tiles.set(layerIndex, {
      extent,
      origin,
      rect: [
        left / ATLAS_SIZE,
        top / ATLAS_SIZE,
        TILE_SIZE / ATLAS_SIZE,
        TILE_SIZE / ATLAS_SIZE,
      ],
    });
  });

  return { image, tiles };
}

/**
 * What the atlas was built from, so it is rebuilt only when a path changes.
 *
 * Rasterizing thousands of nodes on every frame of a drifting composition would
 * cost more than the per-pixel test this replaced. The signature is the cheap
 * question "is this the same drawing" asked before the expensive answer.
 */
export function studioPathAtlasSignature(
  paths: ReadonlyMap<number, readonly StudioVertexPoint[]>,
): string {
  // A numeric hash rather than a joined string, and at this scale that is the
  // difference between a cost worth paying and one that would undo the point of
  // rasterizing at all. This runs on every draw; a path of a few thousand nodes
  // formatted into a string is thousands of allocations and conversions per
  // frame to answer a question whose answer is almost always "yes, the same".
  //
  // Every coordinate is folded in, so this is not a sample: an edit to any node
  // changes the hash. Quantised to five decimals first, which is finer than a
  // pointer can place a node and coarse enough that the same drawing hashes the
  // same after a round trip through storage.
  let hash = 0x811c9dc5;
  const fold = (value: number): void => {
    hash ^= Math.round(value * 1e5) | 0;
    hash = Math.imul(hash, 0x01000193);
  };

  for (const [index, path] of [...paths.entries()].sort((a, b) => a[0] - b[0])) {
    fold(index);
    fold(path.length);
    for (const node of path) for (const axis of node) fold(axis);
  }

  return `${hash >>> 0}`;
}
