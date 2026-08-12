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
    assignments.push({
      target: studioSelectedLayerTarget(uniform.name),
      value: entry.values[uniform.name] ?? uniform.defaultValue,
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
    } else if (
      uniform.type === "vec3" &&
      Array.isArray(raw) &&
      raw.length === 3 &&
      raw.every((channel) => typeof channel === "number")
    ) {
      next[uniform.name] = raw as unknown as readonly [number, number, number];
    }
  }

  return { typeId: entry.typeId, values: next };
}

/**
 * The ordered stack the renderer draws.
 *
 * Order comes from the runtime's `layers` array, which is what makes reordering
 * a runtime concern the product never reimplements. Groups are skipped: a group
 * is an organising container in the panel, not something that renders.
 */
export function buildStudioStack(
  record: StudioLayerRecord,
  layers: ReadonlyArray<Readonly<{ id: string; kind?: string; visible: boolean }>>,
): readonly StudioLayerValues[] {
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
          visible: layer.visible ? 1 : 0,
        },
      };
    });
}
