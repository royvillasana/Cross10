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

/**
 * Starting a drawing, as the two writes it takes.
 *
 * The layer's previous path goes and the canvas is handed to the pen for that
 * layer, one edit each so undo steps through them the way it steps through any
 * other product edit.
 *
 * A plan rather than a dispatch because two surfaces ask for this one
 * operation: the Draw button in Layer Shape, and the P shortcut (15.4). They
 * are not two operations and must not be two implementations -- a shortcut that
 * re-derived the writes would be free to drift from the button, and the first
 * thing to drift would be the path-clearing that makes the drawing fresh.
 *
 * Empty for a selection that cannot draw, so neither caller has to decide what
 * "no layer" means.
 */
export function planStudioPenDrawing(
  layerId: string,
  vertexPaths: unknown,
): readonly Readonly<{
  target: string;
  type: "controls.setValue";
  value: unknown;
}>[] {
  if (!layerId) return [];

  return [
    {
      target: STUDIO_VERTEX_PATH_TARGET,
      type: "controls.setValue",
      value: clearStudioVertexPath(readStudioVertexPaths(vertexPaths), layerId),
    },
    { target: STUDIO_PEN_TARGET, type: "controls.setValue", value: layerId },
  ];
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
  pointerSubject: string = STUDIO_POINTER_PER_LAYER,
  pointerPush = 0,
): readonly StudioLayerValues[] {
  const byId = new Map(layers.map((layer) => [layer.id, layer]));
  const everyLayerFollows = pointerSubject === STUDIO_POINTER_EVERY_LAYER;

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
          // The stack-level choice widens the per-layer switch rather than
          // replacing it: "every layer" turns it on everywhere, and turning it
          // back to "per layer" restores exactly the layers the author had set.
          ...(everyLayerFollows ? { engineCursor: 1 } : {}),
          // Only the layers the pointer reaches are pushed by it. A layer that
          // does not follow the pointer should not be moved by it either --
          // otherwise "reaches" would mean one thing for the engine and another
          // for the displacement.
          pointerPush:
            everyLayerFollows || entry.values.engineCursor === 1 ? pointerPush : 0,
          visible: isEffectivelyVisible(layer, byId) ? 1 : 0,
        },
      };
    });
}

/**
 * The stack an application is about to overwrite, kept so it can be put back.
 *
 * This exists because the runtime cannot express the undo it would otherwise
 * be. `layers.add`, `layers.delete`, `layers.select` and `layers.reorder` carry
 * no `history` or `historyGroup` -- only `controls.setValue` and
 * `canvas.applySettings` do -- so the N deletes and M adds an application emits
 * are N+M separate entries, and no press count reaches the stack that preceded
 * them. Documented as issue 7 in `docs/upstream/toolcraft-0.0.18-issues.md`.
 *
 * Routing the rebuild through `controls.setValue` instead is not an option:
 * the runtime owns identity, order, name, visibility and parentage, so
 * restoring values onto a layer list whose layers are gone restores nothing,
 * and recreating the list needs the very `layers.add` calls that cannot be
 * grouped.
 *
 * One snapshot, replaced by each application. This is "undo the last
 * application", not a second history -- a stack of them would be a parallel
 * undo system, which is the thing the framework should be providing rather than
 * the product reimplementing.
 */
export type StudioStackSnapshotLayer = Readonly<{
  collapsed: boolean;
  /** The layer's own values, or null for a group, which holds none. */
  entry: StudioLayerRecordEntry | null;
  id: string;
  isGroup: boolean;
  name: string;
  parentGroupId: string | null;
  visible: boolean;
}>;

export type StudioStackSnapshot = Readonly<{
  /** What was applied over it, so the restore can name what it undoes. */
  appliedLabel: string;
  /**
   * The stack the application was about to create, so a restore can tell
   * whether it is still undoing that application or something built since.
   *
   * Restoring is "go back to before the apply", which is only honest while the
   * apply is still the last thing that happened. An author who applied and then
   * built three layers on top would lose them to a press meant to undo one
   * action, and would have no way to get them back -- the snapshot holds the
   * stack from *before*, not the one they had just made.
   */
  appliedLayerIds: readonly string[];
  layers: readonly StudioStackSnapshotLayer[];
  selectedLayerId: string | null;
}>;

/**
 * Which layers the pointer moves.
 *
 * A stack-level question rather than a per-layer one, which is why it is not a
 * second switch beside the per-layer `engineCursor`. "Every layer" is not a
 * value any one layer can hold -- a layer only knows about itself -- and writing
 * the per-layer switch onto all of them instead would put N edits on the undo
 * stack for one decision, and lose which of them the author had set by hand.
 *
 * Folded in at projection instead: a layer follows the pointer if its own
 * switch says so *or* the stack says every layer does. The per-layer switch
 * keeps its meaning and the stack-level choice overrides nothing permanently.
 */
export const STUDIO_POINTER_SUBJECT_TARGET = "stack.pointerSubject";

/**
 * How far the pointer pushes the field, as a stack-level amount.
 *
 * Stack-level for the same reason the subject is: a gesture is one thing, and
 * an author setting how hard it pushes is not setting it per layer. Projected
 * onto every layer so the shader still reads it as an ordinary per-layer
 * uniform.
 */
export const STUDIO_POINTER_PUSH_TARGET = "stack.pointerPush";

export function readStudioPointerPush(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0;
}

export const STUDIO_POINTER_PER_LAYER = "per-layer";
export const STUDIO_POINTER_EVERY_LAYER = "every-layer";

export function readStudioPointerSubject(value: unknown): string {
  return value === STUDIO_POINTER_EVERY_LAYER
    ? STUDIO_POINTER_EVERY_LAYER
    : STUDIO_POINTER_PER_LAYER;
}

export const STUDIO_SNAPSHOT_TARGET = "stack.applySnapshot";

/**
 * What an application is aimed at.
 *
 * A rendered control, because it is the author's choice rather than a derived
 * fact, and because the two action controls beside it are gated on it: the
 * canvas target is a replacement and asks first, every narrower target adds to
 * the work and does not. Splitting the presses that way is what keeps a
 * destructive press from sitting one pixel from an additive one.
 */
export const STUDIO_APPLY_TARGET_TARGET = "gallery.target";

export const STUDIO_APPLY_TO_CANVAS = "canvas";
export const STUDIO_APPLY_TO_LAYER = "layer";
export const STUDIO_APPLY_TO_GROUP = "group";
export const STUDIO_APPLY_TO_IMAGE = "image";

export type StudioApplyTarget =
  | typeof STUDIO_APPLY_TO_CANVAS
  | typeof STUDIO_APPLY_TO_LAYER
  | typeof STUDIO_APPLY_TO_GROUP
  | typeof STUDIO_APPLY_TO_IMAGE;

/**
 * What an application is aimed at, read from the selection rather than asked.
 *
 * The author has already answered this by selecting something. A group selected
 * means the group; a layer selected means that layer. A separate "apply to"
 * control asked the same question a second time, in different words, and could
 * disagree with the selection on screen -- an author looking at a highlighted
 * group could press Apply and have it land on a layer, because a select they had
 * set once and forgotten still said "layer".
 *
 * Nothing selected returns null, which is not "the canvas": there is no
 * composition-wide application any more (7.3), so an aim with no subject is an
 * operation that should not be offered at all.
 */
export function studioApplyTargetFromSelection({
  layers,
  selectedLayerId,
}: {
  readonly layers: readonly StudioRuntimeLayer[];
  readonly selectedLayerId: string | null;
}): StudioApplyTarget | null {
  const selected = layers.find((layer) => layer.id === selectedLayerId) ?? null;
  if (!selected) return null;

  // A member of a group selects the member, not the group. The reverse -- that a
  // selection inside a group counts as the group -- is what the old explicit
  // "the selected group" meant, and it stays available by selecting the group
  // row itself, which is the surface saying so rather than a control claiming it.
  return selected.kind === "group" ? STUDIO_APPLY_TO_GROUP : STUDIO_APPLY_TO_LAYER;
}

export function readStudioApplyTarget(value: unknown): StudioApplyTarget {
  return value === STUDIO_APPLY_TO_LAYER ||
    value === STUDIO_APPLY_TO_GROUP ||
    value === STUDIO_APPLY_TO_IMAGE
    ? value
    : STUDIO_APPLY_TO_CANVAS;
}

/**
 * The technique a press has offered to change to and not yet been allowed to.
 *
 * Uncontrolled product state, like the snapshot: nothing edits it but the two
 * presses that set and clear it. Holding the *entry id* rather than a boolean is
 * what makes the confirmation specific — an author who arms a change, browses
 * the thumbnails, and then confirms is confirming the entry they armed, not
 * whichever one they happen to be looking at.
 */
export const STUDIO_PENDING_TECHNIQUE_TARGET = "stack.pendingTechnique";

export function readStudioPendingTechnique(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * The technique the canvas was last set to.
 *
 * Not a claim that the canvas still looks like it — an author edits freely
 * afterwards, and R58 is right that the gallery stores nothing about the stack.
 * This records only what happened: which construction the canvas was started
 * from. Declining a change has to leave "the previously chosen technique still
 * the current one", and there is nothing else that could answer that.
 */
export const STUDIO_TECHNIQUE_TARGET = "stack.technique";

export function readStudioTechniqueId(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * The layers an application aimed at something narrower than the canvas names.
 *
 * Pure, and separate from the plan that acts on it, because "which layers does
 * *the selected group* mean" is the part with the edge cases: a group is not
 * next to its members in the array, a group can hold groups, and a selection
 * inside a group is a reasonable way to mean that group.
 *
 * Groups themselves are never returned. A group organises and does not render,
 * so writing values onto one would store an entry nothing ever reads.
 *
 * An empty result is the honest answer for a target nothing eligible is
 * selected for, and the caller emits nothing rather than falling back to a
 * target the author did not choose.
 */
export function studioApplicationLayerIds({
  layers,
  mediaLayerIds = [],
  selectedLayerId,
  target,
}: {
  readonly layers: readonly StudioRuntimeLayer[];
  readonly mediaLayerIds?: readonly string[];
  readonly selectedLayerId: string | null;
  readonly target: StudioApplyTarget;
}): readonly string[] {
  const selected = layers.find((layer) => layer.id === selectedLayerId) ?? null;

  if (target === STUDIO_APPLY_TO_LAYER) {
    return selected && selected.kind !== "group" ? [selected.id] : [];
  }

  if (target === STUDIO_APPLY_TO_IMAGE) {
    const carried = new Set(mediaLayerIds);
    return layers
      .filter((layer) => layer.kind !== "group" && carried.has(layer.id))
      .map((layer) => layer.id);
  }

  if (target !== STUDIO_APPLY_TO_GROUP) return [];

  // A selection inside a group means that group: an author who clicked a member
  // and asked for "the selected group" has named exactly one group, and
  // refusing them would be pedantry rather than safety.
  const groupId =
    selected?.kind === "group" ? selected.id : (selected?.parentGroupId ?? null);
  if (!groupId) return [];

  const inGroup = new Set<string>([groupId]);
  // Repeated to a fixed point rather than recursively, because the array makes
  // no promise that a nested group appears before the members hanging off it.
  let grew = true;
  while (grew) {
    grew = false;
    for (const layer of layers) {
      if (inGroup.has(layer.id)) continue;
      if (layer.parentGroupId && inGroup.has(layer.parentGroupId)) {
        inGroup.add(layer.id);
        grew = true;
      }
    }
  }

  return layers
    .filter((layer) => layer.kind !== "group" && inGroup.has(layer.id))
    .map((layer) => layer.id);
}

/**
 * Captures the stack as it stands, before anything is removed.
 *
 * Groups are carried with their members' parentage because a restore that
 * flattened them would return the layers without the arrangement, which is not
 * the stack the author had.
 */
export function captureStudioStackSnapshot({
  appliedLabel,
  appliedLayerIds,
  layers,
  record,
  selectedLayerId,
}: {
  readonly appliedLabel: string;
  readonly appliedLayerIds: readonly string[];
  readonly layers: readonly StudioRuntimeLayer[];
  readonly record: StudioLayerRecord;
  readonly selectedLayerId: string | null;
}): StudioStackSnapshot {
  return {
    appliedLabel,
    appliedLayerIds,
    layers: layers.map((layer) => ({
      collapsed: false,
      entry: record[layer.id] ?? null,
      id: layer.id,
      isGroup: layer.kind === "group",
      name: layer.displayName ?? layer.name ?? layer.id,
      parentGroupId: layer.parentGroupId ?? null,
      visible: layer.visible,
    })),
    selectedLayerId,
  };
}

/** Reads a snapshot out of raw state, discarding anything malformed. */
export function readStudioStackSnapshot(value: unknown): StudioStackSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as {
    appliedLabel?: unknown;
    appliedLayerIds?: unknown;
    layers?: unknown;
    selectedLayerId?: unknown;
  };
  if (!Array.isArray(candidate.layers)) return null;

  const layers: StudioStackSnapshotLayer[] = [];
  for (const raw of candidate.layers) {
    if (typeof raw !== "object" || raw === null) continue;
    const layer = raw as Record<string, unknown>;
    if (typeof layer.id !== "string" || layer.id === "") continue;

    layers.push({
      collapsed: layer.collapsed === true,
      entry: isLayerTypeId((layer.entry as { typeId?: unknown } | null)?.typeId)
        ? (layer.entry as StudioLayerRecordEntry)
        : null,
      id: layer.id,
      isGroup: layer.isGroup === true,
      name: typeof layer.name === "string" ? layer.name : layer.id,
      parentGroupId:
        typeof layer.parentGroupId === "string" ? layer.parentGroupId : null,
      visible: layer.visible !== false,
    });
  }
  if (layers.length === 0) return null;

  return {
    appliedLabel:
      typeof candidate.appliedLabel === "string" ? candidate.appliedLabel : "",
    appliedLayerIds: Array.isArray(candidate.appliedLayerIds)
      ? candidate.appliedLayerIds.filter(
          (id): id is string => typeof id === "string",
        )
      : [],
    layers,
    selectedLayerId:
      typeof candidate.selectedLayerId === "string" ? candidate.selectedLayerId : null,
  };
}

/**
 * The commands that put a snapshot back.
 *
 * Parentage is restored by a second pass rather than on the draft, because a
 * member added before its group exists would carry a parent id that names
 * nothing. Adding every layer flat and then moving them is order-independent,
 * which matters when the array the snapshot came from made no promise about
 * where a group sits relative to its members.
 *
 * The record is written whole for exactly the restored ids: merging would leave
 * the applied stack's values behind, to be picked up by any later layer that
 * happened to reuse an id.
 */
export function studioSnapshotStillUndoesItsApplication({
  currentLayerIds,
  snapshot,
}: {
  readonly currentLayerIds: readonly string[];
  readonly snapshot: StudioStackSnapshot;
}): boolean {
  // Layer for layer, in order. A stack that has gained, lost, or reordered a
  // layer since the application is no longer that application's result, and
  // restoring over it would discard work the snapshot cannot give back.
  //
  // Value edits to the applied layers are deliberately not counted. Those are
  // edits *to* the thing being undone -- an author who applies, nudges a slider,
  // and then decides against the whole composition still means "undo the apply".
  return (
    currentLayerIds.length === snapshot.appliedLayerIds.length &&
    currentLayerIds.every((id, index) => id === snapshot.appliedLayerIds[index])
  );
}

export function planStudioStackRestoration({
  currentLayerIds,
  snapshot,
}: {
  readonly currentLayerIds: readonly string[];
  readonly snapshot: StudioStackSnapshot;
}): readonly Readonly<Record<string, unknown>>[] {
  // A snapshot whose application has been built on top of is spent: it is
  // dropped rather than acted on, so the button stops claiming to undo
  // something it would in fact overwrite.
  if (!studioSnapshotStillUndoesItsApplication({ currentLayerIds, snapshot })) {
    return [
      {
        label: "Discard a snapshot the stack has moved past",
        target: STUDIO_SNAPSHOT_TARGET,
        type: "controls.setValue",
        value: null,
      },
    ];
  }

  const commands: Readonly<Record<string, unknown>>[] = [];

  for (const layerId of currentLayerIds) {
    commands.push({ layerId, type: "layers.delete" });
  }

  const record: Record<string, StudioLayerRecordEntry> = {};
  snapshot.layers.forEach((layer, index) => {
    if (layer.entry) record[layer.id] = layer.entry;
    commands.push({
      insertIndex: index,
      layer: {
        collapsed: layer.collapsed,
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        ...(layer.isGroup ? { kind: "group" as const } : {}),
      },
      type: "layers.add",
    });
  });

  const byParent = new Map<string, string[]>();
  for (const layer of snapshot.layers) {
    if (!layer.parentGroupId) continue;
    const members = byParent.get(layer.parentGroupId) ?? [];
    members.push(layer.id);
    byParent.set(layer.parentGroupId, members);
  }
  for (const [parentGroupId, layerIds] of byParent) {
    commands.push({ layerIds, parentGroupId, type: "layers.moveToGroup" });
  }

  commands.push({
    label: `Restore the stack before ${snapshot.appliedLabel || "the last apply"}`,
    target: STUDIO_LAYER_RECORD_TARGET,
    type: "controls.setValue",
    value: record as StudioLayerRecord,
  });

  // Cleared, because a snapshot that survived its own restore would offer to
  // restore the stack the user just came back to.
  commands.push({
    label: "Clear the apply snapshot",
    target: STUDIO_SNAPSHOT_TARGET,
    type: "controls.setValue",
    value: null,
  });

  if (snapshot.selectedLayerId) {
    commands.push({ layerId: snapshot.selectedLayerId, type: "layers.select" });
  }

  return commands;
}
