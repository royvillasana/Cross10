import { type StudioLayerMedia } from "./studio-stack-state";
import { studioVideoLoopTime } from "./studio-video";

/**
 * The decoded sources, shared between the preview and the export frame.
 *
 * **Why a module-level box rather than a prop.** The export frame is not
 * rendered by React: the runtime calls it, with the state and the moment it
 * wants, from outside any tree the canvas is part of. The decoded sources live
 * where the decoding happens, which is the canvas — so the two need a meeting
 * point, and this is the smallest one that does not invent a second decode.
 *
 * A second decode is exactly what the alternative would be, and it is worse
 * than it sounds. Decoding a clip again for the export would mean two elements
 * seeking the same file at two positions, twice the memory, and an artifact
 * built from pixels the author never saw — which is the one thing the export
 * path exists to avoid.
 *
 * **What this fixes beyond video.** The export frame was passing an empty map,
 * so an imported picture drew nothing into an artifact: a composition an author
 * could see on screen exported without it. That was invisible while a picture
 * was decoration; reading a picture as a band field made it the composition,
 * and a composition that does not export is not a composition.
 */
let studioMedia: ReadonlyMap<string, StudioLayerMedia> = new Map();

export function setStudioMediaRegistry(
  media: ReadonlyMap<string, StudioLayerMedia>,
): void {
  studioMedia = media;
}

export function readStudioMediaRegistry(): ReadonlyMap<string, StudioLayerMedia> {
  return studioMedia;
}

/**
 * Moves every clip to the frame this loop position asks for, and waits.
 *
 * The preview writes `currentTime` and does not wait, because at sixty frames a
 * second a frame that is one behind is invisible and a frame that stalls is
 * not. An artifact has the opposite priority: nobody is watching it being made,
 * and a frame drawn before the decoder arrived is wrong in a file that will
 * outlive the session. So this one waits.
 *
 * Resolves rather than rejects when a seek does not report back. A clip that
 * will not seek should cost the artifact one repeated frame, not the whole
 * export -- and the timeout is what keeps a decoder that never fires `seeked`
 * from hanging the encode forever.
 */
export async function seekStudioMediaToLoop(
  media: ReadonlyMap<string, StudioLayerMedia>,
  loopSeconds: number,
  loopProgress: number,
): Promise<void> {
  const waits: Promise<void>[] = [];

  for (const entry of media.values()) {
    if (!entry.moving) continue;
    const element = entry.image;
    if (!(element instanceof HTMLVideoElement)) continue;
    const clipSeconds = element.duration;
    if (!Number.isFinite(clipSeconds) || clipSeconds <= 0) continue;

    const wanted = studioVideoLoopTime(clipSeconds, loopSeconds, loopProgress);
    // A seek to where the element already is fires no event at all, which is
    // the case a naive await hangs on: a still composition exported at one
    // moment, or two frames close enough to land on the same decoded frame.
    if (Math.abs(element.currentTime - wanted) < 1e-4) continue;

    waits.push(
      new Promise<void>((resolve) => {
        const done = (): void => {
          element.removeEventListener("seeked", done);
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(done, 2_000);
        element.addEventListener("seeked", done);
        element.currentTime = wanted;
      }),
    );
  }

  await Promise.all(waits);
}
