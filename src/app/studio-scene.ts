import {
  buildStudioStack,
  pruneStudioLayerRecord,
  readStudioLayerRecord,
  STUDIO_LAYER_RECORD_TARGET,
} from "./studio-stack-state";
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
  layers: ReadonlyArray<Readonly<{ id: string; kind?: string; visible: boolean }>>;
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

/**
 * sRGB transfer function, inverse of `studioLinearToSrgb` in the shader.
 *
 * The two must stay inverses: the shader encodes on the way out, so a colour
 * that is decoded here and encoded there has to survive the round trip, or a
 * flat single-layer stack would not match the colour the user picked.
 */
function srgbChannelToLinear(channel: number): number {
  const normalized = Math.min(Math.max(channel, 0), 1);

  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/**
 * `#rgb` and `#rrggbb`, with or without the hash.
 *
 * Anything else returns undefined rather than a guess: a malformed colour is
 * persisted state that should degrade to the fallback, not silently become a
 * different colour the user never chose.
 */
function readHexColor(value: string): readonly [number, number, number] | undefined {
  const hex = value.trim().replace(/^#/u, "");
  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((channel) => `${channel}${channel}`)
          .join("")
      : hex;

  if (expanded.length !== 6 || !/^[0-9a-f]{6}$/iu.test(expanded)) return undefined;

  const channels = [0, 2, 4].map((offset) =>
    Number.parseInt(expanded.slice(offset, offset + 2), 16) / 255,
  );

  return [
    srgbChannelToLinear(channels[0] ?? 0),
    srgbChannelToLinear(channels[1] ?? 0),
    srgbChannelToLinear(channels[2] ?? 0),
  ];
}

function isNumericTriple(value: unknown): value is readonly [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((channel) => typeof channel === "number" && Number.isFinite(channel))
  );
}

/**
 * A colour in whichever representation it is stored in, as linear light.
 *
 * Both are accepted because both exist in the product today: the schema colour
 * controls carry sRGB hex, while the layer-type registry declares its vec3
 * defaults as numeric triples. A numeric triple is taken to be linear already —
 * it comes from the registry rather than from a picker — so it passes through
 * untouched.
 */
export function studioColorToLinear(
  value: unknown,
): readonly [number, number, number] | undefined {
  if (typeof value === "string") return readHexColor(value);
  if (isNumericTriple(value)) return value;
  return undefined;
}

function toLinearLayerValues(layer: StudioLayerValues): StudioLayerValues {
  const values: Record<string, number | readonly [number, number, number]> = {};

  for (const [name, value] of Object.entries(layer.values)) {
    if (typeof value === "number") {
      values[name] = value;
      continue;
    }
    values[name] = studioColorToLinear(value) ?? FALLBACK_COLOR;
  }

  return { typeId: layer.typeId, values };
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
    // Passed in rather than read from `export.includeBackground`, because the
    // two are different questions. The switch says whether an exported artifact
    // carries the background; whether the *preview* shows it is the runtime's
    // call, which is what `backgroundOutputCoverage: "preview-hidden"` declares.
    // Reading the export switch here would tie them together and make one of the
    // two coverage claims false.
    includeBackground,
    layers: buildStudioStack(pruned, state.layers).map(toLinearLayerValues),
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
