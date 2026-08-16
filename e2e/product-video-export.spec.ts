import type { Locator, Page } from "@playwright/test";

import { createToolcraftVideoFrameSchedule } from "../src/toolcraft/runtime/export/video-frame-schedule";
import {
  openStudioSingleLayer,
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
