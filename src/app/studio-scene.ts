import {
  buildStudioStack,
  readStudioPointerPush,
  readStudioPointerSubject,
  STUDIO_POINTER_PUSH_TARGET,
  STUDIO_POINTER_SUBJECT_TARGET,
  pruneStudioLayerRecord,
  readStudioLayerRecord,
  readStudioCursor,
  readStudioVertexPaths,
  type StudioLayerMedia,
  STUDIO_CURSOR_TARGET,
  STUDIO_VERTEX_PATH_TARGET,
  STUDIO_LAYER_RECORD_TARGET,
  type StudioRuntimeLayer,
} from "./studio-stack-state";
import {
  getToolcraftTimelineLoopProgress,
  type ToolcraftTimelineLoopOptions,
} from "@/toolcraft/runtime";

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
    ...(layer.image ? { image: layer.image } : {}),
    ...(layer.vertices ? { vertices: layer.vertices } : {}),
  };
}

/**
 * How far through the loop the timeline currently is.
 *
 * A fraction rather than a time, because that is what a whole-cycle drift needs
 * and it keeps the shader ignorant of how long a loop is. Zero whenever there is
 * no timeline or no duration, which is also what makes a composition with no
 * drift render exactly as it did before any of this existed.
 *
 * The wrapping is `getToolcraftTimelineLoopProgress` rather than a local `%`,
 * because `component-contracts.runtime.ts:334` says so: a hand-rolled phase is
 * how mirror, yoyo and reverse playback get invented by accident, and this
 * product's loop is forward-only. The runtime owns what a loop *is*; this only
 * asks it where we are in one.
 */
export function readStudioLoopProgress(state: StudioSceneStateSlice): number {
  const timeline = (state as { timeline?: ToolcraftTimelineLoopOptions }).timeline;
  if (!timeline) return 0;

  return getToolcraftTimelineLoopProgress(timeline);
}

/**
 * Whether anything in this composition actually moves.
 *
 * Asked before the loop position is read, and the reason is not a
 * micro-optimisation. The runtime starts its timeline playing, so the clock runs
 * from the moment the app opens whether or not the work responds to it. If the
 * loop position reached the scene regardless, every composition would rebuild
 * its scene sixty times a second, the canvas memo would miss on every frame, and
 * the whole stack would redraw continuously to produce the identical picture.
 *
 * That is not a hypothetical. Enabling the timeline did exactly this, and the
 * cost was not visible in any single proof -- each one passed on its own. It
 * showed up as eighty-seven timeouts in a full browser suite that had five,
 * which is the shape a performance regression takes when the tests that would
 * have caught it are the ones it slows down.
 *
 * So an undrifted composition is pinned to loop zero, which is byte-identical
 * from frame to frame, which lets the memo hold and the renderer sleep. A
 * composition that does drift pays for what it asked for.
 */
function hasStudioDrift(layers: readonly StudioLayerValues[]): boolean {
  return layers.some(
    (layer) =>
      (typeof layer.values.driftPhase === "number" && layer.values.driftPhase !== 0) ||
      (typeof layer.values.driftAngle === "number" && layer.values.driftAngle !== 0),
  );
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
  images: ReadonlyMap<string, StudioLayerMedia> = new Map(),
  /**
   * Where the pointer is for *this* scene, when that is not where it is now.
   *
   * The export frame passes the at-rest position. An artifact must not depend
   * on where the mouse happened to be resting when the button was pressed --
   * two exports of one composition would then differ, and neither would be the
   * composition. A pointer effect is something the *viewer* drives, so what an
   * exported still can honestly carry is the field with nobody pointing at it.
   *
   * This is not the same claim as "the cursor is committed to state", which is
   * about determinism *within* a render (R68) and stays true either way. The
   * delivered shader is unaffected in the other direction: there the cursor is
   * a live uniform rather than a baked value, so the recipient drives it and
   * the position this scene carries never reaches the source.
   */
  cursor?: readonly [number, number],
  /**
   * Where the loop has got to, when the caller knows better than the timeline.
   *
   * The export path knows: the runtime drives a fixed schedule and hands each
   * frame its own `timelineProgress`, so a video is a series of scenes rather
   * than one scene rendered repeatedly. The preview does not pass it and reads
   * the timeline directly.
   */
  loop?: number,
): StudioStackSceneParameters {
  const record = readStudioLayerRecord(state.values[STUDIO_LAYER_RECORD_TARGET]);
  const pruned = pruneStudioLayerRecord(
    record,
    state.layers.map((layer) => layer.id),
  );
  const stack = buildStudioStack(
    pruned,
    state.layers,
    readStudioVertexPaths(state.values[STUDIO_VERTEX_PATH_TARGET]),
    images,
    readStudioPointerSubject(state.values[STUDIO_POINTER_SUBJECT_TARGET]),
    readStudioPointerPush(state.values[STUDIO_POINTER_PUSH_TARGET]),
  );

  return {
    backgroundColor:
      studioColorToLinear(state.values[BACKGROUND_COLOR_TARGET]) ?? FALLBACK_COLOR,
    // Read from committed state rather than from a pointer event, which is what
    // lets the export frame build the same scene as the preview (R68) -- unless
    // the caller names a position, which the export path does.
    cursor: cursor ?? readStudioCursor(state.values[STUDIO_CURSOR_TARGET]),
    // An explicit position always wins -- the export path names the moment it is
    // drawing, and a still export passes zero. Otherwise the clock only reaches
    // the scene if something in the stack responds to it.
    loop: loop ?? (hasStudioDrift(stack) ? readStudioLoopProgress(state) : 0),
    // Passed in rather than read from `export.includeBackground`, because the
    // two are different questions. The switch says whether an exported artifact
    // carries the background; whether the *preview* shows it is the runtime's
    // call, which is what `backgroundOutputCoverage: "preview-hidden"` declares.
    // Reading the export switch here would tie them together and make one of the
    // two coverage claims false.
    includeBackground,
    layers: stack.map(toLinearLayerValues),
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
