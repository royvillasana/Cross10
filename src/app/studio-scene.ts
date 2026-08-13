import {
  buildStudioStack,
  pruneStudioLayerRecord,
  readStudioLayerRecord,
  readStudioCursor,
  readStudioVertexPaths,
  STUDIO_CURSOR_TARGET,
  STUDIO_VERTEX_PATH_TARGET,
  STUDIO_LAYER_RECORD_TARGET,
  type StudioRuntimeLayer,
} from "./studio-stack-state";
import { studioColorToLinear } from "./studio-color";
import type { StudioLayerValues, StudioStackSceneParameters } from "./studio-stack-render";

/**
 * Runtime state to renderer scene parameters.
 *
 * This is the one boundary where the product's stored representation becomes
 * the renderer's. Two conversions happen here and nowhere else:
 *
 * - **Pruning.** The layer record is keyed by layer id and the runtime owns the
 *   layer list, so a record read straight from persistence can name layers that
 *   no longer exist. Pruning is done against the live array on the way to the
 *   renderer rather than on delete, for the reason `pruneStudioLayerRecord`
 *   records: undo can bring a layer back, and a prune-on-delete would have made
 *   that unrecoverable.
 * - **Colour space.** Controls carry sRGB hex because that is what a colour
 *   picker edits; the shader composites in linear light because that is what
 *   makes overlap correct. The transfer function belongs at this boundary, so
 *   neither the control surface nor the shader has to know about the other.
 *
 * The scene is a plain value with no renderer or React dependency, which is what
 * lets preview and the export frame build it identically and lets it be tested
 * without a GL context.
 */

/**
 * The slice of runtime state the scene reads.
 *
 * Structural rather than the full runtime state type: this function needs the
 * layer array and the value bag, and naming only those keeps the renderer
 * boundary from depending on the shape of everything else in the store.
 */
export type StudioSceneStateSlice = Readonly<{
  layers: readonly StudioRuntimeLayer[];
  values: Readonly<Record<string, unknown>>;
}>;

/** The slice the scene rectangle reads. Separate: bounds need no layer values. */
export type StudioCanvasStateSlice = Readonly<{
  canvas: Readonly<{ size: Readonly<{ height: number; width: number }> }>;
}>;

const BACKGROUND_COLOR_TARGET = "appearance.background";
const RENDER_SCALE_TARGET = "canvas.renderScale";

/** Opaque black, used when a colour cannot be read rather than failing the draw. */
const FALLBACK_COLOR: readonly [number, number, number] = [0, 0, 0];

function toLinearLayerValues(layer: StudioLayerValues): StudioLayerValues {
  const values: Record<string, number | readonly [number, number, number]> = {};

  for (const [name, value] of Object.entries(layer.values)) {
    if (typeof value === "number") {
      values[name] = value;
      continue;
    }
    values[name] = studioColorToLinear(value) ?? FALLBACK_COLOR;
  }

  // The path passes through untouched: it is geometry in field units, not a
  // colour, and dropping it here would have left every drawn shape unfilled
  // while every other value arrived intact.
  return {
    typeId: layer.typeId,
    values,
    ...(layer.vertices ? { vertices: layer.vertices } : {}),
  };
}

/**
 * Builds the scene the renderer draws from committed runtime state.
 *
 * Reads rather than writes: this runs on the way to the renderer, so it must not
 * mutate the record or dispatch. The write direction is `useStudioLayerSync`.
 */
export function buildStudioSceneParameters(
  state: StudioSceneStateSlice,
  includeBackground: boolean,
): StudioStackSceneParameters {
  const record = readStudioLayerRecord(state.values[STUDIO_LAYER_RECORD_TARGET]);
  const pruned = pruneStudioLayerRecord(
    record,
    state.layers.map((layer) => layer.id),
  );

  return {
    backgroundColor:
      studioColorToLinear(state.values[BACKGROUND_COLOR_TARGET]) ?? FALLBACK_COLOR,
    // Read from committed state rather than from a pointer event, which is what
    // lets the export frame build the same scene as the preview (R68).
    cursor: readStudioCursor(state.values[STUDIO_CURSOR_TARGET]),
    // Passed in rather than read from `export.includeBackground`, because the
    // two are different questions. The switch says whether an exported artifact
    // carries the background; whether the *preview* shows it is the runtime's
    // call, which is what `backgroundOutputCoverage: "preview-hidden"` declares.
    // Reading the export switch here would tie them together and make one of the
    // two coverage claims false.
    includeBackground,
    layers: buildStudioStack(
      pruned,
      state.layers,
      readStudioVertexPaths(state.values[STUDIO_VERTEX_PATH_TARGET]),
    ).map(toLinearLayerValues),
  };
}

/**
 * The product's world-space rectangle.
 *
 * Derived from `canvas.size` rather than a constant, because this product's
 * sizing mode is `editable-output`: the author sets the output dimensions, so
 * the scene is whatever they chose. Croix10 can hold a fixed rect because its
 * output size is not an authored property; here a constant would detach the
 * infinite-canvas frame and the exported artifact from the size control.
 *
 * Centred on the origin so the scene sits at the world centre in Infinity mode.
 */
export function studioSceneRect(
  state: StudioCanvasStateSlice,
): Readonly<{ height: number; width: number; x: number; y: number }> {
  const width = Math.max(1, Math.round(state.canvas.size.width));
  const height = Math.max(1, Math.round(state.canvas.size.height));

  return { height, width, x: -width / 2, y: -height / 2 };
}

/**
 * Selected render scale, defaulting to 1.
 *
 * Runtime-owned, and read here because the backing size is part of the pass
 * cache key: a scale change alters backing pixels and must re-resolve the stack.
 */
export function readStudioRenderScale(state: StudioSceneStateSlice): number {
  const value = state.values[RENDER_SCALE_TARGET];

  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
}
