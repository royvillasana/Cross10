/**
 * Colour representation for the layer stack.
 *
 * One representation lives in the layer record: a linear-light numeric triple,
 * which is what the layer-type registry already declares its `vec3` defaults as
 * and what the shader composites in. Conversion happens at the two edges — a
 * colour control carries sRGB hex because that is what a picker edits, so an
 * edit decodes on the way in and projects back to hex on the way out.
 *
 * Storing hex instead was the alternative, and it was rejected: the record would
 * then hold two shapes for one uniform kind, every reader would have to handle
 * both, and the registry defaults would disagree with the stored values.
 *
 * This module is separate from both `studio-scene.ts` and `studio-stack-state.ts`
 * because both need it and product modules must form an acyclic graph — the
 * scene already imports the state, so the conversion cannot live in either.
 */

/** A linear-light colour, the representation the record and the shader share. */
export type StudioLinearColor = readonly [number, number, number];

function srgbChannelToLinear(channel: number): number {
  const normalized = Math.min(Math.max(channel, 0), 1);

  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function linearChannelToSrgb(channel: number): number {
  const normalized = Math.min(Math.max(channel, 0), 1);

  return normalized <= 0.0031308
    ? normalized * 12.92
    : 1.055 * Math.pow(normalized, 1 / 2.4) - 0.055;
}

export function isStudioLinearColor(value: unknown): value is StudioLinearColor {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((channel) => typeof channel === "number" && Number.isFinite(channel))
  );
}

/**
 * `#rgb` and `#rrggbb`, with or without the hash, decoded to linear light.
 *
 * Anything else returns undefined rather than a guess: a malformed colour is
 * persisted state that should degrade to a default, not silently become a
 * different colour the author never chose.
 */
export function studioHexToLinear(value: string): StudioLinearColor | undefined {
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

/**
 * Linear light back to the `#rrggbb` a colour control holds.
 *
 * The inverse of `studioHexToLinear` at 8-bit precision, so a colour picked,
 * stored, and projected back into the control comes back as the same hex the
 * author chose rather than drifting by a step on every selection change.
 */
export function studioLinearToHex(value: StudioLinearColor): string {
  return `#${value
    .map((channel) => {
      const byte = Math.round(linearChannelToSrgb(channel) * 255);
      return Math.min(Math.max(byte, 0), 255)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

/**
 * A colour in whichever representation it arrives in, as linear light.
 *
 * Both are accepted because both can reach a reader: the record holds triples,
 * while a control value — or a record written before this conversion existed —
 * carries hex.
 */
export function studioColorToLinear(value: unknown): StudioLinearColor | undefined {
  if (typeof value === "string") return studioHexToLinear(value);
  if (isStudioLinearColor(value)) return value;

  // A colour control holds a bare hex string until it is edited, and an
  // `{ hex, opacity? }` object afterwards. Handling only the string reads as a
  // renderer that ignores colour: the control shows the new value, the record
  // never receives it, and the composite keeps the old one.
  //
  // `opacity` is deliberately not consumed here. These uniforms are vec3, and
  // the layer carries its own opacity control that already folds into the
  // composite weight; taking a second opacity from the colour would apply it
  // twice.
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { hex?: unknown }).hex === "string"
  ) {
    return studioHexToLinear((value as { hex: string }).hex);
  }

  return undefined;
}
