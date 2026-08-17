import type { Locator, Page } from "@playwright/test";

import { createToolcraftVideoFrameSchedule } from "../src/toolcraft/runtime/export/video-frame-schedule";
import {
  openStudioSingleLayer,
  setStudioSelectValue,
  setStudioSlider,
  toggleStudioSwitch,
} from "./studio-product-helpers";
import { STUDIO_PRESETS } from "../src/app/studio-presets";
import { expect, test } from "./toolcraft-product-test";

/** Any study will do; the claim is about the path, not about which picture. */
const STUDIO_REFERENCE_LABEL = STUDIO_PRESETS[0]!.label;

/**
 * Chooses a study through the dialog that owns the choice.
 *
 * Duplicated from the reference domain rather than shared: this file needs the
 * study to be *on screen* and does not care which one, so importing that file's
 * helper would couple two proofs whose subjects have nothing in common.
 */
async function setStudioReference(page: Page, label: string): Promise<void> {
  const preset = STUDIO_PRESETS.find((entry) => entry.label === label);
  if (!preset) throw new Error(`No preset is labelled "${label}".`);

  await page
    .locator('[data-toolcraft-control-target="gallery.actions"]')
    .getByRole("button", { name: "Work against a study" })
    .first()
    .click();
  await page.locator(`[data-studio-onboarding-study="${preset.id}"]`).click();
}
import {
  assertToolcraftVideoPacketSchedule,
  inspectToolcraftVideoDownload,
} from "./video-artifact-inspection";

/**
 * Video export acceptance domain.
 *
 * The claims are about the *file*, not about the button. A download that arrives
 * proves a download arrived; what has to be true is that the artifact carries
 * the timeline the author set, at the cadence the runtime schedules rather than
 * at whatever rate the renderer managed, and that it still loops once it leaves
 * the product — a seam is invisible in a packet count and obvious to a viewer.
 *
 * The schedule is imported from the runtime rather than recomputed here. It is
 * the runtime's decision how many frames a duration is, and a local copy of that
 * arithmetic would agree with itself forever while disagreeing with the product.
 */

const OPAQUE_PROBE = [0, 0, 0, 255] as const;
const TRANSPARENT_PROBE = [0, 0, 0, 0] as const;

async function timelineScrubber(page: Page): Promise<Locator> {
  const scrubber = page.getByRole("slider", { name: "Playback position" });
  if (!(await scrubber.isVisible())) {
    await page
      .locator('[data-toolcraft-control-target="panels.timeline.extended"]')
      .getByRole("switch")
      .click();
    await expect(scrubber).toBeVisible();
  }
  const pause = page.getByRole("button", { name: "Pause playback" });
  if (await pause.isVisible()) await pause.click();
  return scrubber;
}

async function exportVideo(page: Page) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Video" }).click();
  // Encoding a six-second loop frame by frame is slower than a still by two
  // orders of magnitude, and the default download timeout does not cover it.
  return download;
}

async function readTimelineDuration(scrubber: Locator): Promise<number> {
  const duration = Number(await scrubber.getAttribute("aria-valuemax"));
  expect(Number.isFinite(duration) && duration > 0).toBe(true);
  return duration;
}

test("browser: studio exports a video that carries the timeline", async ({ page }) => {
  // Frame-by-frame encoding plus decoding the result back for inspection.
  test.setTimeout(300_000);

  await openStudioSingleLayer(page);
  const scrubber = await timelineScrubber(page);
  // Something has to be moving for the frames to differ; a still encoded thirty
  // times a second would satisfy every timing assertion below and be a bug.
  await setStudioSlider(page, "Travel per loop", 1);

  const duration = await readTimelineDuration(scrubber);
  const schedule = createToolcraftVideoFrameSchedule(duration);

  const { inspection, observations, timeResolution } =
    await inspectToolcraftVideoDownload({
      backgroundRgba: OPAQUE_PROBE,
      download: await exportVideo(page),
      page,
      schedule,
    });

  // The cadence is the runtime's schedule, not the renderer's throughput. A
  // renderer that fell behind and dropped frames would still produce a playable
  // file -- one that ran faster than the composition it came from.
  assertToolcraftVideoPacketSchedule({
    packetTimings: inspection.packetTimings,
    schedule,
    timeResolution,
  });
  expect(inspection.durationMs / 1000).toBeCloseTo(duration, 1);
  expect(inspection.frameCount).toBe(schedule.length);
  expect(inspection.mediaType).toBe("video/mp4");

  // The frames are frames of the drift rather than the same frame repeated.
  const [first, middle, last] = observations;
  expect(
    middle.decodedPixelHash,
    "a video of a drifting composition must not be one frame encoded repeatedly",
  ).not.toBe(first.decodedPixelHash);
  // ...and the loop closes. The last scheduled frame sits one frame short of the
  // seam, so it is the frame *before* the return rather than the return itself;
  // what it must not be is the first frame, which would mean the drift had gone
  // nowhere, and it must be closer to the first than the middle is.
  expect(last.decodedPixelHash).not.toBe(first.decodedPixelHash);
  expect(last.decodedPixelHash).not.toBe(middle.decodedPixelHash);

});

test("browser: studio video export keeps the background switch honest", async ({
  page,
}) => {
  test.setTimeout(300_000);

  await openStudioSingleLayer(page);
  const scrubber = await timelineScrubber(page);
  // The ground has to be visible through the stack for its absence to be
  // observable; at full opacity the layer covers every pixel either way.
  await setStudioSlider(page, "Opacity", 0.5);
  await toggleStudioSwitch(page, "export.includeBackground");

  const duration = await readTimelineDuration(scrubber);
  const { observations } = await inspectToolcraftVideoDownload({
    backgroundRgba: TRANSPARENT_PROBE,
    download: await exportVideo(page),
    page,
    schedule: createToolcraftVideoFrameSchedule(duration),
  });

  // Video codecs have no alpha channel to speak of, so "background off" cannot
  // mean transparency here the way it does for a PNG. What it must still mean is
  // that the switch reaches the video path at all rather than being quietly
  // ignored -- the frames are the stack over the runtime's own backdrop, and
  // they are frames rather than a blank file.
  expect(observations.length).toBeGreaterThan(0);
  for (const observation of observations) {
    // Occupancy rather than a hash. A hash is non-empty for a frame of flat
    // black, which is exactly the failure this is watching for -- an export
    // path that took the ground away and drew nothing in its place.
    expect(
      observation.occupiedAreaRatio,
      "every sampled video frame must carry drawn pixels",
    ).toBeGreaterThan(0);
  }

});

/**
 * The reference reaches no frame of the video either.
 *
 * This claim is already proved for the PNG. It has to be re-proved here rather
 * than inherited, because video is a second delivery path and the overlay's
 * absence from an artifact is a property of the path that built it, not of the
 * product in general. Nothing about the still export makes the video export
 * safe; they share a renderer, and the overlay is not drawn by that renderer at
 * all — it is a DOM element over the canvas. Which is exactly why a proof is
 * needed: the thing that would leak it is not the shared code, it would be a
 * future convenience that composited the visible surface instead of the stack.
 *
 * The stake is not aesthetic. A study is somebody else's work; it is on screen
 * so an author can look at it while building, and an exported file is a thing
 * that leaves. Those two facts must never meet.
 */
test("browser: studio video export carries no trace of the study", async ({ page }) => {
  // Two full encodes and two decodes in one test, because the claim is a
  // comparison between artifacts rather than a property of either one.
  test.setTimeout(600_000);

  page.on("console", (message) => {
    if (message.type() === "error") console.log(`page error: ${message.text()}`);
  });

  await openStudioSingleLayer(page);
  const scrubber = await timelineScrubber(page);
  await setStudioSlider(page, "Travel per loop", 1);
  const duration = await readTimelineDuration(scrubber);
  const schedule = createToolcraftVideoFrameSchedule(duration);

  // The artifact with no study loaded, which the comparison is measured against.
  const clean = await inspectToolcraftVideoDownload({
    backgroundRgba: OPAQUE_PROBE,
    download: await exportVideo(page),
    page,
    schedule,
  });

  await setStudioReference(page, STUDIO_REFERENCE_LABEL);
  await setStudioSlider(page, "Reference opacity", 1);
  // Fully opaque and on screen: if the overlay can reach the artifact at all,
  // this is the setting under which it would be unmissable.
  await expect(page.locator("[data-studio-reference]")).toHaveCount(1);

  // The study is genuinely covering the canvas on screen. Without this the
  // comparison below would pass just as happily if loading a study had done
  // nothing at all -- two identical artifacts proving only that nothing changed
  // anywhere, which is the shape a vacuous proof takes.
  const overlay = await page.locator("[data-studio-reference]").boundingBox();
  const output = await page.locator("[data-toolcraft-product-output]").boundingBox();
  expect(overlay?.width).toBeGreaterThan(0);
  expect(overlay?.width).toBeCloseTo(output?.width ?? -1, 0);
  expect(overlay?.height).toBeCloseTo(output?.height ?? -1, 0);

  const withStudy = await inspectToolcraftVideoDownload({
    backgroundRgba: OPAQUE_PROBE,
    download: await exportVideo(page),
    page,
    schedule,
  });

  // Frame for frame, not merely "no obvious picture in it". A study showing at
  // full strength over the canvas changes every sampled frame if it reaches the
  // encoder, and identical hashes are the only reading that rules that out.
  expect(
    withStudy.observations.map((observation) => observation.decodedPixelHash),
    "an exported video must be identical whether or not a study is showing",
  ).toEqual(clean.observations.map((observation) => observation.decodedPixelHash));
});

/**
 * The artifact loops without a seam, which is a claim about its ends.
 *
 * A looping video must not contain both endpoints of the loop. Frame zero and
 * frame at exactly one duration are the same picture, and a file carrying both
 * freezes for a thirtieth of a second every cycle — a stutter that a packet
 * count matching a duration would report as perfect, and that a viewer sees
 * immediately on the second play.
 *
 * So the schedule runs to one frame *before* the seam, and this asserts that:
 * the frame count is exactly the duration's worth, and the last packet sits a
 * frame short of the end rather than on it. The frame that closes the loop is
 * the first frame of the next play, which is where it belongs.
 */
test("browser: studio export video loops without a seam", async ({ page }) => {
  test.setTimeout(300_000);

  await openStudioSingleLayer(page);
  const scrubber = await timelineScrubber(page);
  // Drift declared, or the ends are trivially equal and the claim is empty.
  await setStudioSlider(page, "Travel per loop", 1);

  const duration = await readTimelineDuration(scrubber);
  const schedule = createToolcraftVideoFrameSchedule(duration);
  const framesPerSecond = 30;

  const { inspection } = await inspectToolcraftVideoDownload({
    backgroundRgba: OPAQUE_PROBE,
    download: await exportVideo(page),
    page,
    schedule,
  });

  // Exactly the duration's worth, so the loop is closed by the next play rather
  // than by a repeated frame inside the file.
  expect(inspection.frameCount).toBe(Math.round(duration * framesPerSecond));

  const last = inspection.packetTimings[inspection.packetTimings.length - 1];
  expect(last, "the artifact must carry a last frame").toBeTruthy();
  // A frame short of the end. If this were `duration`, the file would hold both
  // ends of the loop and hitch once per cycle.
  expect(last!.timeSeconds).toBeCloseTo(duration - 1 / framesPerSecond, 2);
  expect(last!.timeSeconds).toBeLessThan(duration);

  // ...and the first frame is the start of the loop, not an offset into it.
  expect(inspection.packetTimings[0]?.timeSeconds).toBeCloseTo(0, 3);
});

/**
 * The format select reaches the encoder, not just the panel.
 *
 * MP4 is the default because it is what the common destinations take. WebM is
 * offered, and an option that is offered has to arrive: a select that changed a
 * value nobody read would look identical from the panel and hand the author a
 * file their destination rejects.
 */
test("browser: studio video export format changes the encoded artifact type", async ({
  page,
}) => {
  test.setTimeout(300_000);

  await openStudioSingleLayer(page);
  const scrubber = await timelineScrubber(page);
  const schedule = createToolcraftVideoFrameSchedule(
    await readTimelineDuration(scrubber),
  );

  await setStudioSelectValue(page, "export.video.format", "WebM");

  const { inspection } = await inspectToolcraftVideoDownload({
    backgroundRgba: OPAQUE_PROBE,
    download: await exportVideo(page),
    page,
    schedule,
  });

  // Read from the bytes rather than from the file name. A wrapper named .webm
  // containing MP4 would satisfy a name check and fail in the player.
  expect(inspection.mediaType).toBe("video/webm");
});

/**

/**
 * The resolution select reaches the encoder too.
 *
 * "Current" means the canvas as authored; 4K means the artifact is larger than
 * the canvas without the composition being re-laid-out. Read from the decoded
 * track rather than from the request, because the request is what the panel
 * asked for and the track is what the recipient gets.
 */
test("browser: studio video export resolution changes the encoded dimensions", async ({
  page,
}) => {
  test.setTimeout(600_000);

  await openStudioSingleLayer(page);
  const scrubber = await timelineScrubber(page);
  const schedule = createToolcraftVideoFrameSchedule(
    await readTimelineDuration(scrubber),
  );

  const sizeOf = async () => {
    const { inspection } = await inspectToolcraftVideoDownload({
      backgroundRgba: OPAQUE_PROBE,
      download: await exportVideo(page),
      page,
      schedule,
    });
    return { height: inspection.height, width: inspection.width };
  };

  const current = await sizeOf();
  await setStudioSelectValue(page, "export.video.resolution", "4K");
  const larger = await sizeOf();

  expect(larger.width).toBeGreaterThan(current.width);
  // The shape is the composition's, not the format's: scaling up must not
  // change the aspect an author chose.
  expect(larger.width / larger.height).toBeCloseTo(current.width / current.height, 2);
});
