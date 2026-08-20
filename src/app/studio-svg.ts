import { studioLinearToHex } from "./studio-color";
import { STUDIO_PALETTE_MAX } from "./studio-layers";

/**
 * A layer as vector geometry, for the states that genuinely are some.
 *
 * **Most of this product is not expressible as vector geometry, and pretending
 * otherwise is the failure this is written to avoid.** A jittered field, a
 * tapered band, an induced fringe and a chromointerference are all defined by
 * what a shader computes per pixel; the nearest SVG could come is a picture of
 * the result, which is a raster wearing a vector extension. An action that
 * silently dropped the parts it could not draw would hand an author a file that
 * looked like their work and was not.
 *
 * So the rule below is a gate rather than a best effort: a layer is either
 * expressible as rectangles or it is not offered. The control disappears rather
 * than degrading, which is the shape the requirement itself asks for and the
 * only one that keeps the output trustworthy.
 *
 * **Scoped to the selected layer, not the composition**, and that is a
 * deviation worth naming. Applicability predicates can only read rendered
 * controls, so a gate can see the selected layer and cannot see whether the
 * *other* layers in a stack happen to be expressible. Scoping the output to
 * what the gate can see keeps presence and capability the same thing; scoping
 * it to the composition would mean an action that is offered and then refuses,
 * which is the pattern this product has been removing everywhere else.
 */

/** As much of a layer as vector output needs. */
export type StudioSvgLayer = Readonly<{
  typeId: string;
  values: Readonly<Record<string, number | readonly [number, number, number]>>;
}>;

/**
 * Why a layer cannot be drawn as vectors, or `null` when it can.
 *
 * A reason rather than a boolean, because the reason is what the panel needs to
 * say. "This is unavailable" with no explanation is the most annoying possible
 * form of a correct decision.
 */
export function studioSvgObstacle(layer: StudioSvgLayer | undefined): string | null {
  if (!layer) return "no layer is selected";
  if (layer.typeId !== "stripes") return "only a band field is vector geometry";

  const value = (name: string): number => {
    const raw = layer.values[name];
    return typeof raw === "number" ? raw : 0;
  };

  if (value("engine") !== 0) return "a chromatic engine is computed per pixel";
  if (value("mirror") !== 0) return "a mirrored field folds its coordinate";
  // Jitter and taper are *not* refusals, and that is forced rather than
  // generous: applicability can only read discrete controls, so a gate cannot
  // see a continuous slider at all. Refusing them here would mean an action
  // that is offered and then fails -- so they are drawn instead. A jittered
  // band is a rectangle somewhere else, and a tapered one is a quadrilateral.
  // Rectangle and ellipse are clip shapes SVG has. A drawn path is one too, but
  // it lives in a mask the renderer rasterizes rather than in the record, so it
  // is left out until there is a reason to carry it.
  if (value("maskShape") > 1.5) return "this region shape has no clip equivalent";

  return null;
}

/** Whether the copy action should be offered at all. */
export function canStudioExpressAsSvg(layer: StudioSvgLayer | undefined): boolean {
  return studioSvgObstacle(layer) === null;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"]/gu, (character) =>
    character === "&"
      ? "&amp;"
      : character === "<"
        ? "&lt;"
        : character === ">"
          ? "&gt;"
          : "&quot;",
  );
}

/**
 * The layer's bands as SVG markup.
 *
 * Emitted in the same terms the shader reads them so the two describe one
 * field: the coordinate runs along the layer's angle, `count` bands span the
 * frame's height, `widthRatio` decides where each band's ink gives way, the
 * separator opens a gap to what sits beneath, and the palette cycles by band.
 *
 * Sized in the artifact's own pixels rather than in field units, because an SVG
 * is delivered to something that will place it -- a document, a cutter, a print
 * -- and every one of those wants real dimensions.
 */
export function studioLayerToSvg({
  height,
  layer,
  width,
}: {
  readonly height: number;
  readonly layer: StudioSvgLayer;
  readonly width: number;
}): string {
  const obstacle = studioSvgObstacle(layer);
  if (obstacle) throw new Error(`This layer is not vector geometry: ${obstacle}.`);

  const value = (name: string, fallback = 0): number => {
    const raw = layer.values[name];
    return typeof raw === "number" ? raw : fallback;
  };
  const ink = (index: number): string => {
    const slots = Math.max(2, Math.min(STUDIO_PALETTE_MAX, Math.round(value("paletteSlots", 2))));
    const name = `color${String.fromCharCode(65 + (index % slots))}`;
    const raw = layer.values[name];
    return Array.isArray(raw) ? studioLinearToHex(raw as readonly [number, number, number]) : "#000000";
  };

  const count = Math.max(1, Math.round(value("count", 12)));
  const split = Math.min(1, Math.max(0, value("widthRatio", 0.5)));
  const separator = Math.min(1, Math.max(0, value("separator")));
  const phase = value("phase");
  const angle = value("angle");

  // The band pitch is measured against height, which is the unit the field and
  // the shape share, and the run is long enough that a rotated field still
  // covers the corners of the frame.
  const pitch = height / count;
  const run = Math.hypot(width, height);
  const bands = Math.ceil(run / pitch) + 2;
  const start = -run / 2 - (phase % 1) * pitch;

  const jitterAmount = value("jitterAmount");
  const jitterVariation = Math.max(1e-4, value("jitterVariation", 12));
  const taper = value("taper");

  /**
   * The displacement one band carries, in band units.
   *
   * The same expression the shader uses, evaluated in single precision to stay
   * near it. It will not be bit-identical: a shader computes this in 32-bit
   * float where JavaScript has 64, and `sin` of a large argument is exactly
   * where the two diverge. What that costs is sub-pixel at the band counts and
   * variations the control offers, and it is stated rather than hidden --
   * silently drawing a *different* scatter would be the failure this whole file
   * exists to avoid.
   */
  const displacement = (index: number): number => {
    if (jitterAmount === 0) return 0;
    const hashed = Math.fround(Math.sin(Math.fround(index * jitterVariation)) * 43758.5453);
    return jitterAmount * (hashed - Math.floor(hashed) - 0.5);
  };

  const rects: string[] = [];
  for (let index = 0; index < bands; index += 1) {
    const offset = start + index * pitch - displacement(index) * pitch;
    // Taper drifts the split along the band's own length, so the two ends of a
    // band do not share a width: what that draws is a wedge, and a rectangle
    // would be the average of it rather than the shape.
    const half = run / 2;
    const splitLeft = Math.min(1, Math.max(0, split + taper * -half));
    const splitRight = Math.min(1, Math.max(0, split + taper * half));
    const inkedLeft = pitch * splitLeft * (1 - separator);
    const inkedRight = pitch * splitRight * (1 - separator);
    if (inkedLeft <= 0 && inkedRight <= 0) continue;

    const fill = escapeXml(ink(index));
    rects.push(
      taper === 0
        ? `      <rect x="${(-half).toFixed(3)}" y="${offset.toFixed(3)}" ` +
            `width="${run.toFixed(3)}" height="${inkedLeft.toFixed(3)}" fill="${fill}"/>`
        : `      <polygon points="${(-half).toFixed(3)},${offset.toFixed(3)} ` +
            `${half.toFixed(3)},${offset.toFixed(3)} ` +
            `${half.toFixed(3)},${(offset + inkedRight).toFixed(3)} ` +
            `${(-half).toFixed(3)},${(offset + inkedLeft).toFixed(3)}" fill="${fill}"/>`,
    );
  }

  const size = Math.max(0, value("maskSize"));
  const aspect = Math.max(0.01, value("maskAspect", 1));
  const shape = value("maskShape");
  // Region units are measured against half the frame's height, which is how the
  // canvas turns a size into pixels.
  const half = height / 2;
  const regionWidth = size * aspect * half * 2;
  const regionHeight = size * half * 2;
  const centerX = width / 2 + value("maskCenterX") * half;
  const centerY = height / 2 - value("maskCenterY") * half;

  // A size of zero is the vocabulary's "the whole frame", which is what the
  // presets use, so it clips to nothing rather than to an empty rectangle.
  const clip =
    size <= 0
      ? ""
      : shape < 0.5
        ? `  <clipPath id="region"><rect x="${(centerX - regionWidth / 2).toFixed(3)}" y="${(
            centerY - regionHeight / 2
          ).toFixed(3)}" width="${regionWidth.toFixed(3)}" height="${regionHeight.toFixed(
            3,
          )}"/></clipPath>\n`
        : `  <clipPath id="region"><ellipse cx="${centerX.toFixed(3)}" cy="${centerY.toFixed(
            3,
          )}" rx="${(regionWidth / 2).toFixed(3)}" ry="${(regionHeight / 2).toFixed(
            3,
          )}"/></clipPath>\n`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    clip,
    // The clip and the rotation are on separate groups deliberately. A
    // `clip-path` on the same element as a `transform` is resolved in the space
    // that transform establishes, so a rotated group would carry a rotated
    // clip -- the region would turn with the field instead of confining it,
    // which is the opposite of what a region does.
    clip ? '  <g clip-path="url(#region)">' : "  <g>",
    `    <g transform="translate(${(width / 2).toFixed(3)} ${(height / 2).toFixed(3)}) rotate(${(
      -angle
    ).toFixed(3)})">`,
    ...rects,
    "    </g>",
    "  </g>",
    "</svg>",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
