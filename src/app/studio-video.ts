/**
 * A clip as a moving source, and the one decision that makes it one.
 *
 * A video in this product is not played. It is *read*, at the loop position,
 * exactly as everything else in a composition is — which is what the scoping
 * asked for when it said a clip runs endlessly the way a GIF does. Nothing here
 * starts, stops, or paces anything: given where the loop is, this says which
 * instant of the clip belongs there, and the canvas seeks to it.
 *
 * That inversion is what makes a clip exportable. A video playing at its own
 * rate beside a loop that closes produces an artifact whose last frame does not
 * meet its first, and no amount of care at the encoder end can repair a seam
 * that was created upstream of it. Reading by position instead means the frame
 * at loop 1 *is* the frame at loop 0, by construction rather than by rounding,
 * and two clips of different lengths can sit in one composition without either
 * one stuttering where the loop closes.
 */

/**
 * How many times the clip runs inside one turn of the loop.
 *
 * The open question this answers is what to do when the clip and the loop are
 * not the same length, and the two obvious answers are both wrong on their own.
 * *Fit* — stretch the clip across exactly one loop — always closes the seam and
 * will run a thirty-second clip at eight times speed inside a four-second loop.
 * *Repeat* — run at the natural rate and wrap — keeps the motion honest and
 * closes the seam only when the lengths happen to divide.
 *
 * So: repeat a whole number of times, chosen as the nearest whole number to the
 * natural rate. The seam closes by construction, because a whole number of clip
 * cycles ends where it began; and the speed error is at worst the distance to
 * the nearest integer, which for any clip shorter than the loop is small and for
 * a long clip is the difference between one pass and two.
 *
 * This is the same argument the drift controls already make — periodic motion
 * that cannot break the seam because of its shape rather than because something
 * quantized it behind the author's back.
 */
export function studioVideoRepeatCount(
  clipSeconds: number,
  loopSeconds: number,
): number {
  if (!Number.isFinite(clipSeconds) || clipSeconds <= 0) return 1;
  if (!Number.isFinite(loopSeconds) || loopSeconds <= 0) return 1;

  return Math.max(1, Math.round(loopSeconds / clipSeconds));
}

/**
 * Where in the clip the given loop position lands, in seconds.
 *
 * Never returns the clip's own duration: the phase is taken modulo one, so the
 * end of the loop maps to the start of the clip rather than to a frame past its
 * last. Seeking to exactly the duration is the one seek browsers disagree
 * about — some clamp, some stall — and it is also the frame that would make the
 * loop close one frame late.
 */
export function studioVideoLoopTime(
  clipSeconds: number,
  loopSeconds: number,
  loopProgress: number,
): number {
  if (!Number.isFinite(clipSeconds) || clipSeconds <= 0) return 0;
  if (!Number.isFinite(loopProgress)) return 0;

  const repeats = studioVideoRepeatCount(clipSeconds, loopSeconds);
  // Twice, because a negative progress modulo one is still negative in JS and a
  // loop position behind zero is a scrub, not an error.
  const phase = (((loopProgress * repeats) % 1) + 1) % 1;

  return phase * clipSeconds;
}

/**
 * Whether an imported asset is a clip rather than a still.
 *
 * Asked of the mime type the importer recorded, not of the file name: the
 * runtime's file importer is the one that takes a video — its picture importer
 * matches only files that decode as pictures — and what it records is the
 * browser's own type for the file. A `file` asset with no video type is some
 * other upload and is not this product's business.
 */
export function isStudioVideoAsset(
  asset: Readonly<{ assetKind?: string; mimeType?: string }>,
): boolean {
  return asset.assetKind === "file" && (asset.mimeType ?? "").startsWith("video/");
}
