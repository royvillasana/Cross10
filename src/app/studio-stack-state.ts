/**
 * Per-layer values, keyed by the runtime's own layer ids (R56).
 *
 * The runtime carries `layers`, `selectedLayerId`, and one flat `values` map —
 * no per-layer value store, and no field in which a layer declares a product
 * type. `selectedLayer.*` is a naming convention the contract rules describe,
 * not storage: `selectedLayer.angle` holds one value, and selecting a different
 * layer does not swap it.
 *
 * So the runtime owns identity, order, selection, visibility, and grouping, and
 * this module owns everything hung off an id. Same division as R46, where shape
 * positions sat in a product-owned array beside a runtime-owned collection.
 *
 * Everything here is pure. The React wiring lives with the canvas; keeping the
 * rules separate is what lets the sync be tested without a browser, and the sync
 * is where the bugs would be.
 */

import {
  STUDIO_LAYER_TYPE_IDS,
  studioLayerUniforms,
  type StudioLayerTypeId,
} from "./studio-layers";
import {
  isStudioLinearColor,
  studioColorToLinear,
  studioLinearToHex,
} from "./studio-color";
import {
  studioLayerDefaults,
  type StudioLayerValues,
} from "./studio-stack-render";

/** Uncontrolled product target. Needs `persistence.additionalValueTargets`. */
export const STUDIO_LAYER_RECORD_TARGET = "stack.layerRecord";

/**
 * The shape's geometry: uncontrolled since 14.1, because the canvas handles own
 * it and a slider beside them would make one operation answer to two surfaces.
 *
 * They are still value targets -- the handles dispatch `controls.setValue`
 * against exactly these names, and `collectStudioSelectedLayerEdit` reads them
 * back out of the same value map it always did. What they stopped being is
 * *controls*, so they have to be declared here or persistence drops them and a
 * reload throws away every shape the author placed.
 */
/**
 * Where the pointer is, committed to state (R68).
 *
 * Uncontrolled, like the layer record: the canvas writes it and no control
 * edits it. Committing it rather than reading an event is what keeps the
 * artifact deterministic — an export has no pointer, and a delivered shader has
 * no pointer either, so what they both need is a *position*, and the honest one
 * is the last place the author left it.
 */
export const STUDIO_CURSOR_TARGET = "stack.cursor";

/** Field units, from the centre of the frame. Off-frame until the pointer arrives. */
export const STUDIO_CURSOR_AWAY: readonly [number, number] = [-9, -9];

export function readStudioCursor(value: unknown): readonly [number, number] {
  return Array.isArray(value) &&
    value.length === 2 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
    ? [value[0] as number, value[1] as number]
    : STUDIO_CURSOR_AWAY;
}

/**
 * Free vertex paths, keyed by layer id (14.4).
 *
 * Uncontrolled, like the layer record and for the same reason: the canvas
 * writes it and no control edits it. Keyed rather than held on the selected
 * layer because a path belongs to the layer that was drawn, and selection moves.
 *
 * Points are in field units -- normalised against height, from the centre of the
 * frame -- which is the one form that survives a change of backing size, a zoom,
 * or an export at another resolution.
 */
export const STUDIO_VERTEX_PATH_TARGET = "stack.vertexPaths";

/**
 * Which layer the pen is currently drawing, or absent when it is not drawing.
 *
 * A mode, and deliberately a *product* one rather than a runtime canvas mode:
 * the runtime owns viewport navigation, and this owns what a click on the
 * canvas means while it is on. Held per layer id rather than as a boolean so a
 * selection change while drawing cannot silently retarget the path.
 */
export const STUDIO_PEN_TARGET = "stack.penLayerId";

export type StudioVertexPoint = readonly [number, number];
export type StudioVertexPaths = Readonly<Record<string, readonly StudioVertexPoint[]>>;

/** Reads the paths out of raw state, discarding anything malformed. */
export function readStudioVertexPaths(value: unknown): StudioVertexPaths {
  if (typeof value !== "object" || value === null) return {};

  const paths: Record<string, readonly StudioVertexPoint[]> = {};
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(entry)) continue;
    const points = entry.filter(
      (point): point is StudioVertexPoint =>
        Array.isArray(point) &&
        point.length === 2 &&
        point.every((axis) => typeof axis === "number" && Number.isFinite(axis)),
    );
    if (points.length > 0) paths[id] = points;
  }
  return paths;
}

/** The path a layer carries, or an empty one. */
export function readStudioVertexPath(
  paths: StudioVertexPaths,
  layerId: string,
): readonly StudioVertexPoint[] {
  return paths[layerId] ?? [];
}

/**
 * The most vertices one path may hold.
 *
 * A cap rather than an open list because the path is compiled into the shader
 * (R69): every vertex is a literal and an unrolled iteration, so an unbounded
 * path is an unbounded program. Twenty-four is well past what the reference
 * works ask for and still a shader that compiles quickly.
 */
export const STUDIO_PATH_VERTEX_MAX = 24;

/**
 * Appends one point to a layer's path, leaving every other path identical.
 *
 * At the cap the path stops growing rather than dropping its start: what an
 * author has already drawn is the part they have decided on.
 */
export function appendStudioVertex(
  paths: StudioVertexPaths,
  layerId: string,
  point: StudioVertexPoint,
): StudioVertexPaths {
  const existing = readStudioVertexPath(paths, layerId);
  if (existing.length >= STUDIO_PATH_VERTEX_MAX) return paths;

  return { ...paths, [layerId]: [...existing, point] };
}

/** Drops a layer's path entirely, which is how a fresh drawing starts. */
export function clearStudioVertexPath(
  paths: StudioVertexPaths,
  layerId: string,
): StudioVertexPaths {
  const next = { ...paths };
  delete next[layerId];
  return next;
}

export const STUDIO_SHAPE_GEOMETRY_TARGETS = [
  "selectedLayer.maskSize",
  "selectedLayer.maskAspect",
  "selectedLayer.maskCenterX",
  "selectedLayer.maskCenterY",
] as const;

/** Control target carrying the product layer type the runtime has no field for. */
export const STUDIO_LAYER_TYPE_TARGET = "selectedLayer.type";

export type StudioLayerRecordEntry = Readonly<{
  typeId: StudioLayerTypeId;
  values: Readonly<Record<string, number | readonly [number, number, number]>>;
}>;

export type StudioLayerRecord = Readonly<Record<string, StudioLayerRecordEntry>>;

function isLayerTypeId(value: unknown): value is StudioLayerTypeId {
  return STUDIO_LAYER_TYPE_IDS.includes(value as StudioLayerTypeId);
}

/**
 * Reads the record out of raw state, discarding anything malformed.
 *
 * Persisted state is not trusted: a record written by an older version, or by
 * hand, must degrade to defaults rather than reach the renderer as a uniform of
 * the wrong arity and fail the draw.
 */
export function readStudioLayerRecord(value: unknown): StudioLayerRecord {
  if (typeof value !== "object" || value === null) return {};

  const record: Record<string, StudioLayerRecordEntry> = {};
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) continue;
    const candidate = entry as { typeId?: unknown; values?: unknown };
    if (!isLayerTypeId(candidate.typeId)) continue;

    const values =
      typeof candidate.values === "object" && candidate.values !== null
        ? (candidate.values as StudioLayerRecordEntry["values"])
        : {};
    record[id] = { typeId: candidate.typeId, values };
  }
  return record;
}

/** The entry for a layer, falling back to registry defaults for an unknown id. */
export function readStudioLayerEntry(
  record: StudioLayerRecord,
  layerId: string,
  fallbackTypeId: StudioLayerTypeId = "stripes",
): StudioLayerRecordEntry {
  return (
    record[layerId] ?? {
      typeId: fallbackTypeId,
      values: studioLayerDefaults(fallbackTypeId),
    }
  );
}

/**
 * Drops entries for layers that no longer exist.
 *
 * Pruned on read rather than on delete: a delete the product never observes
 * would otherwise leak an entry forever, and undo can bring a layer back — which
 * a prune-on-delete would have made unrecoverable.
 */
export function pruneStudioLayerRecord(
  record: StudioLayerRecord,
  layerIds: readonly string[],
): StudioLayerRecord {
  const live = new Set(layerIds);
  const pruned: Record<string, StudioLayerRecordEntry> = {};
  for (const [id, entry] of Object.entries(record)) {
    if (live.has(id)) pruned[id] = entry;
  }
  return pruned;
}

/**
 * An id for a copy of a layer, unique against the ids already in the stack.
 *
 * Derived from the source id rather than random: a duplicate is a thing with a
 * provenance, and an id that says so is readable in persisted state and in a
 * failing test. The counter only appears when it has to.
 */
export function studioDuplicateLayerId(
  sourceId: string,
  takenIds: readonly string[],
): string {
  const taken = new Set(takenIds);
  const base = `${sourceId}-copy`;
  if (!taken.has(base)) return base;

  let index = 2;
  while (taken.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

/**
 * A name for the copy, following whatever the source is called.
 *
 * The runtime names a fresh layer "Layer N" from a counter, which for a
 * duplicate would say nothing about what it is a duplicate of.
 */
export function studioDuplicateLayerName(sourceName: string): string {
  return `${sourceName} copy`;
}

/** One layer to create when a duplication runs, in the order it must be created. */
export type StudioDuplicationStep = Readonly<{
  copyId: string;
  insertIndex: number;
  isGroup: boolean;
  name: string;
  parentGroupId?: string;
  sourceId: string;
  visible: boolean;
}>;

/**
 * Everything a duplication has to create, worked out before anything is
 * dispatched.
 *
 * A group is not one layer, it is a block: the group plus everything under it,
 * nested groups included. Copying it means re-creating that whole block with
 * its internal parentage rewired to the copies — a member of the duplicated
 * group must point at the *new* group, not the old one, or the copy's contents
 * would be the original's contents seen twice.
 *
 * Pure, and returned as a plan rather than executed, because the interesting
 * part is exactly this rewiring and it is worth testing without a runtime. A
 * plain layer is a block of one, so there is a single path rather than two.
 *
 * The block is read in array order and inserted directly after itself, so the
 * copy composites in the same order the original does.
 */
export function planStudioLayerDuplication(
  layers: readonly StudioRuntimeLayer[],
  sourceId: string,
): readonly StudioDuplicationStep[] {
  const sourceIndex = layers.findIndex((layer) => layer.id === sourceId);
  const source = layers[sourceIndex];
  if (!source) return [];

  // Descendants by ancestry rather than by position: the array is flat and
  // nothing guarantees a group's members sit next to it.
  const inBlock = new Set<string>([sourceId]);
  for (const layer of layers) {
    const seen = new Set<string>();
    let parentId = layer.parentGroupId ?? undefined;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      if (inBlock.has(parentId)) {
        inBlock.add(layer.id);
        break;
      }
      parentId = layers.find((entry) => entry.id === parentId)?.parentGroupId ?? undefined;
    }
  }

  const block = layers.filter((layer) => inBlock.has(layer.id));
  const lastBlockIndex = layers.reduce(
    (highest, layer, index) => (inBlock.has(layer.id) ? index : highest),
    sourceIndex,
  );

  const taken = new Set(layers.map((layer) => layer.id));
  const copyIds = new Map<string, string>();
  for (const layer of block) {
    const copyId = studioDuplicateLayerId(layer.id, [...taken]);
    taken.add(copyId);
    copyIds.set(layer.id, copyId);
  }

  return block.map((layer, offset) => {
    const label = layer.displayName ?? layer.name ?? layer.id;
    const parentId = layer.parentGroupId ?? undefined;

    return {
      copyId: copyIds.get(layer.id) ?? layer.id,
      insertIndex: lastBlockIndex + 1 + offset,
      isGroup: layer.kind === "group",
      // Only the thing that was duplicated says so. A member keeps its own
      // name, because inside its new group it is that layer, not a copy of a
      // sibling — which is also what every design tool does.
      name: layer.id === sourceId ? studioDuplicateLayerName(label) : label,
      // Rewired: a member points at the copied group, and the copied block as a
      // whole hangs wherever the original did.
      ...(parentId
        ? { parentGroupId: copyIds.get(parentId) ?? parentId }
        : {}),
      sourceId: layer.id,
      visible: layer.visible,
    };
  });
}

/** Writes one layer's entry, leaving every other entry identical. */
export function writeStudioLayerEntry(
  record: StudioLayerRecord,
  layerId: string,
  entry: StudioLayerRecordEntry,
): StudioLayerRecord {
  return { ...record, [layerId]: entry };
}

/**
 * Changing a layer's type replaces its values with that type's defaults.
 *
 * Carrying values across would silently reinterpret them — a stripe `count` of
 * 24 becoming a gradient `rampType` of 24 is not a value the gradient has any
 * meaning for, and the renderer would clamp it into a shape the user never chose.
 */
export function retypeStudioLayerEntry(
  entry: StudioLayerRecordEntry,
  typeId: StudioLayerTypeId,
): StudioLayerRecordEntry {
  if (entry.typeId === typeId) return entry;
  return { typeId, values: studioLayerDefaults(typeId) };
}

/** The `selectedLayer.*` target for one of a type's uniforms. */
export function studioSelectedLayerTarget(uniformName: string): string {
  return `selectedLayer.${uniformName}`;
}

/**
 * Values to push into the `selectedLayer.*` targets when the selection changes.
 *
 * One direction only. The reverse — an edit flowing into the record — is
 * `collectStudioSelectedLayerEdit`. Running both on the same event is what would
 * overwrite the layer just selected with the values of the one just left, so the
 * two are deliberately separate functions rather than one reconciler.
 */
export function projectStudioLayerEntry(
  entry: StudioLayerRecordEntry,
): ReadonlyArray<
  Readonly<{
    target: string;
    // Boolean included because a switch-driven float projects back as one: the
    // record stores the shader's number, the control wants the checkbox state.
    value: boolean | number | readonly [number, number, number] | string;
  }>
> {
  const assignments: Array<{
    target: string;
    value: boolean | number | readonly [number, number, number] | string;
  }> = [{ target: STUDIO_LAYER_TYPE_TARGET, value: entry.typeId }];

  for (const uniform of studioLayerUniforms(entry.typeId)) {
    const stored = entry.values[uniform.name] ?? uniform.defaultValue;
    assignments.push({
      target: studioSelectedLayerTarget(uniform.name),
      // The record holds a uniform's own representation; a control holds its
      // own. Projecting one unconverted is how a value silently fails to
      // round-trip: a triple pushed into a colour picker, or an index pushed
      // into a select that has no option named "1".
      value:
        uniform.type === "vec3" && isStudioLinearColor(stored)
          ? studioLinearToHex(stored)
          : uniform.optionValues && typeof stored === "number"
            ? (uniform.optionValues[stored] ?? uniform.optionValues[0] ?? stored)
            : uniform.booleanControl && typeof stored === "number"
              ? stored > 0.5
              : stored,
    });
  }
  return assignments;
}

/** Folds the current `selectedLayer.*` values back into one record entry. */
export function collectStudioSelectedLayerEdit(
  entry: StudioLayerRecordEntry,
  values: Readonly<Record<string, unknown>>,
): StudioLayerRecordEntry {
  const next: Record<string, number | readonly [number, number, number]> = {
    ...entry.values,
  };

  for (const uniform of studioLayerUniforms(entry.typeId)) {
    const raw = values[studioSelectedLayerTarget(uniform.name)];
    if (uniform.type === "float" && typeof raw === "number") {
      next[uniform.name] = raw;
    } else if (uniform.type === "float" && typeof raw === "boolean") {
      // A switch-driven float: the control carries a boolean and the shader
      // branches on a number.
      next[uniform.name] = raw ? 1 : 0;
    } else if (uniform.type === "float" && typeof raw === "string") {
      // A float uniform driven by a select: the control carries the option's
      // string and the shader branches on its index. Without this the edit is
      // dropped for not already being a number, and the control moves while the
      // render stays exactly where it was.
      const index = uniform.optionValues?.indexOf(raw) ?? -1;
      if (index >= 0) next[uniform.name] = index;
    } else if (uniform.type === "vec3") {
      // A colour control holds sRGB hex, so the edit decodes here rather than
      // being dropped for not already being a triple. Accepting a triple too
      // keeps a value that never went through a picker working unchanged.
      const color = studioColorToLinear(raw);
      if (color) next[uniform.name] = color;
    }
  }

  return { typeId: entry.typeId, values: next };
}

/** An uploaded picture and the transform the runtime holds for it. */
export type StudioLayerMedia = Readonly<{
  image: TexImageSource;
  transform?: Readonly<{
    flipHorizontal?: boolean;
    flipVertical?: boolean;
    rotationDeg?: number;
  }>;
}>;

/** One entry of the runtime layer list, as much of it as the stack reads. */
export type StudioRuntimeLayer = Readonly<{
  displayName?: string;
  id: string;
  kind?: string;
  name?: string;
  parentGroupId?: string | null;
  visible: boolean;
}>;

/**
 * Whether a layer actually reaches the composite.
 *
 * A layer inside a hidden group draws nothing, but the runtime does not write
 * that through to the member: `layers.toggleVisibility` flips only the layer it
 * names, so a member of a hidden group still reports `visible: true`. Reading
 * the member's own flag alone would keep drawing it and make the group's hidden
 * state a panel-only illusion.
 *
 * Resolved by walking the parent chain, with a seen-set because a corrupted or
 * hand-edited parent link could otherwise cycle forever.
 */
function isEffectivelyVisible(
  layer: StudioRuntimeLayer,
  byId: ReadonlyMap<string, StudioRuntimeLayer>,
): boolean {
  const seen = new Set<string>();
  let current: StudioRuntimeLayer | undefined = layer;

  while (current) {
    if (!current.visible) return false;
    if (seen.has(current.id)) return false;
    seen.add(current.id);
    current = current.parentGroupId ? byId.get(current.parentGroupId) : undefined;
  }
  return true;
}

/**
 * The ordered stack the renderer draws.
 *
 * Order comes from the runtime's `layers` array, which is what makes reordering
 * a runtime concern the product never reimplements. Groups are skipped as
 * entries — a group is an organising container in the panel, not something that
 * renders — but they still govern whether their members draw.
 */
export function buildStudioStack(
  record: StudioLayerRecord,
  layers: readonly StudioRuntimeLayer[],
  paths: StudioVertexPaths = {},
  images: ReadonlyMap<string, StudioLayerMedia> = new Map(),
): readonly StudioLayerValues[] {
  const byId = new Map(layers.map((layer) => [layer.id, layer]));

  return layers
    .filter((layer) => layer.kind !== "group")
    .map((layer) => {
      const entry = readStudioLayerEntry(record, layer.id);
      const path = readStudioVertexPath(paths, layer.id);
      const media = images.get(layer.id);
      // A layer the runtime created for an imported picture *is* an image
      // layer, whatever the record says. The record cannot know: the runtime
      // allocates the layer and the asset together on import, and a product
      // default of "stripes" would have that layer draw bands over the picture
      // it was created to show.
      const typeId = media ? "image" : entry.typeId;

      return {
        typeId,
        // Carried only when there is a path to carry, so a stack of ordinary
        // layers signs exactly as it did before the pen existed.
        ...(path.length >= 3 ? { vertices: path } : {}),
        ...(media ? { image: media.image } : {}),
        values: {
          // Defaults for the *effective* type, not the recorded one: an
          // imported layer's record still says stripes, and seeding it with
          // stripe defaults left the image uniforms unset.
          ...studioLayerDefaults(typeId),
          ...entry.values,
          // Runtime-owned, so they always win over anything the record holds.
          // The transform belongs to the media rather than to the layer -- the
          // runtime's own buttons write it onto the asset -- so it is applied
          // last, over a record that has nothing to say about it.
          ...(media
            ? {
                imageFlipX: media.transform?.flipHorizontal ? 1 : 0,
                imageFlipY: media.transform?.flipVertical ? 1 : 0,
                imageRotation: media.transform?.rotationDeg ?? 0,
              }
            : {}),
          visible: isEffectivelyVisible(layer, byId) ? 1 : 0,
        },
      };
    });
}
