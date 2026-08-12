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
  Readonly<{ target: string; value: number | readonly [number, number, number] | string }>
> {
  const assignments: Array<{
    target: string;
    value: number | readonly [number, number, number] | string;
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

/** One entry of the runtime layer list, as much of it as the stack reads. */
export type StudioRuntimeLayer = Readonly<{
  id: string;
  kind?: string;
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
): readonly StudioLayerValues[] {
  const byId = new Map(layers.map((layer) => [layer.id, layer]));

  return layers
    .filter((layer) => layer.kind !== "group")
    .map((layer) => {
      const entry = readStudioLayerEntry(record, layer.id);
      return {
        typeId: entry.typeId,
        values: {
          ...studioLayerDefaults(entry.typeId),
          ...entry.values,
          // Runtime-owned, so it always wins over anything the record holds.
          visible: isEffectivelyVisible(layer, byId) ? 1 : 0,
        },
      };
    });
}
