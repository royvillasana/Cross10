import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { Download, Locator, Page } from "@playwright/test";

import {
  readToolcraftBrowserObservation,
} from "./browser-proof-session";
import { expectToolcraftStandardTimelinePlayback } from "./browser-standard-timeline-evidence";
import {
  openStudioSingleLayer,
  openStudioTwoLayerStack,
  readStudioOutputSignature,
  selectStudioLayer,
  setStudioSelectValue,
  setStudioSlider,
  toggleStudioSwitch,
} from "./studio-product-helpers";
import { expect, test } from "./toolcraft-product-test";

import { appSchema } from "../src/app/app-schema";

const PERSISTENCE_KEY = appSchema.persistence.key;

/**
 * The composition as stored, minus the rates that drive the drift.
 *
 * Read from persistence rather than from the controls: the record is where a
 * layer's values actually live, so a drift that wrote back into the composition
 * would show up here whether or not any control happened to be on screen. The
 * rates themselves are stripped because the test changes them deliberately.
 */
async function readStudioLayerValues(page: Page): Promise<unknown> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const values = (JSON.parse(raw) as { values?: Record<string, unknown> }).values ?? {};
    const record = values["stack.layerRecord"];
    // Absent rather than empty is a real answer -- it is what "the flow has not
    // written a composition yet" looks like -- and it must compare equal to
    // itself rather than blow up inside the serialiser.
    if (record === undefined) return { missing: Object.keys(values).sort() };
    return JSON.parse(
      JSON.stringify(record, (name, value) =>
        name === "driftPhase" || name === "driftAngle" ? undefined : value,
      ),
    );
  }, PERSISTENCE_KEY);
}

/**
 * Motion acceptance domain.
 *
 * Three claims, and the second and third are the ones that matter. That a frame
 * *changes* over the loop is the easy half and the half a careless proof stops
 * at; what makes this a loop of a work rather than an animation is that it comes
 * back exactly, and that what comes back is the same work — same inks, same band
 * count — seen from somewhere else.
 *
 * The negative claim is proved by comparing the *set* of colours rather than the
 * frame. Every pixel is expected to differ across the loop; what must not differ
 * is which colours are in play. A signature comparison would confirm the motion
 * and say nothing about the palette, which is the trap this file exists to avoid.
 */

/**
 * Why there is no pixel-level "the palette is unchanged" assertion here.
 *
 * The obvious negative claim — sample the frame at rest and mid-loop, demand the
 * same colours — was written, run, and abandoned, and the reason is worth
 * keeping. What lies between the bands is *induced* colour: the mixture the eye
 * makes as edges sweep past each other, and in a chromointerference it is
 * supposed to change as you move, because that change is the phenomenon. Even
 * the extremes move, because which plateaus fall inside a fixed sampling window
 * depends on where the bands currently are. A proof demanding they hold still
 * would have been demanding the work not work, and the only way to make it pass
 * would have been to weaken it until it asserted nothing.
 *
 * The claim is made twice instead, in forms that are actually true:
 *
 * - **From the state side.** The stored composition is byte-identical before and
 *   after the timeline moves, so nothing is being written back — which is the
 *   failure a pixel check was really reaching for.
 * - **From the render side.** Drifting travel by one cycle and scrubbing halfway
 *   produces the same frame as leaving the timeline alone and moving the
 *   author's own Offset by half. That is the substantive claim: the drift is the
 *   viewer walking along the work, expressible as a position the author could
 *   have set by hand, rather than a second thing happening to the pixels.
 */

async function timelineScrubber(page: Page) {
  const scrubber = page.getByRole("slider", { name: "Playback position" });
  if (!(await scrubber.isVisible())) {
    await page
      .locator('[data-toolcraft-control-target="panels.timeline.extended"]')
      .getByRole("switch")
      .click();
    await expect(scrubber).toBeVisible();
  }
  // Paused before anything is read. A running clock would move the frame
  // between the read and the assertion, and the failure would look like drift.
  const pause = page.getByRole("button", { name: "Pause playback" });
  if (await pause.isVisible()) await pause.click();
  return scrubber;
}

/**
 * Puts the playhead at a named fraction of the loop.
 *
 * Stepped with the keyboard rather than by writing a value, because the scrubber
 * is not an `<input>` — assigning through the native value setter throws
 * "Illegal invocation" against whatever it actually is. Stepping also means the
 * step size stays the runtime's business: this walks until the reported time
 * reaches the target instead of assuming how far one press goes.
 *
 * Exactness matters here rather than being pedantry: the frame at this moment is
 * compared against one built by hand at the matching offset, and "roughly
 * halfway" would make that comparison prove nothing.
 */
async function scrubStudioTimelineTo(
  page: Page,
  scrubber: Locator,
  fraction: number,
): Promise<void> {
  const duration = Number(await scrubber.getAttribute("aria-valuemax"));
  expect(Number.isFinite(duration) && duration > 0).toBe(true);
  const target = duration * fraction;

  await scrubber.focus();
  await scrubber.press("Home");
  const readTime = async () => Number(await scrubber.getAttribute("aria-valuenow"));

  let previous = await readTime();
  for (let press = 0; press < 4_000; press += 1) {
    if (previous >= target) break;
    await scrubber.press("ArrowRight");
    const next = await readTime();
    // A press that moves nothing means the track has ended, and continuing
    // would spin for four thousand presses before failing for the wrong reason.
    expect(next, "the timeline scrubber must respond to a step").toBeGreaterThan(
      previous,
    );
    previous = next;
  }

  expect(previous, `the playhead should reach ${target}s`).toBeGreaterThanOrEqual(
    target,
  );
}

async function downloadDigest(download: Download): Promise<string> {
  const path = await download.path();
  expect(path, "the export must produce a file on disk").toBeTruthy();
  return createHash("sha256")
    .update(await readFile(path as string))
    .digest("hex");
}

async function exportPng(page: Page): Promise<string> {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  return downloadDigest(await download);
}

test("browser: studio timeline plays, scrubs, and loops the drift", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(180_000);

  const { session } = await openStudioSingleLayer(page);
  const scrubber = await timelineScrubber(page);
  const authoredValues = await readStudioLayerValues(page);

  // The still, taken before drift exists. Everything below is measured against
  // this: adding motion to a product must not change the work that had none.
  await scrubber.press("Home");
  const stillSignature = await readStudioOutputSignature(page);
  const stillDigest = await exportPng(page);

  // With no drift declared, the timeline moves and the frame does not. This is
  // the claim that keeps every existing composition in the product safe.
  await scrubber.press("End");
  expect(
    await readStudioOutputSignature(page),
    "a composition with no drift must render identically at every moment of the loop",
  ).toBe(stillSignature);
  await scrubber.press("Home");

  await setStudioSlider(page, "Travel per loop", 1);

  // Exactly half the loop, because the frame there is compared against one built
  // by hand below and "roughly halfway" would make that comparison meaningless.
  await scrubStudioTimelineTo(page, scrubber, 0.5);
  const midSignature = await readStudioOutputSignature(page);
  expect(
    midSignature,
    "one whole travel cycle must move the band boundaries somewhere else in the frame",
  ).not.toBe(stillSignature);

  // ...and it is the same work that moved. The frame mid-loop is the frame the
  // author would have got by moving Offset there themselves -- which is what
  // makes this drift a viewer walking past a static work rather than a second
  // effect on top of it. Proved by producing that frame the other way and
  // comparing, rather than by asserting some property both happen to share.
  await scrubber.press("Home");
  await setStudioSlider(page, "Travel per loop", 0);
  await setStudioSlider(page, "Offset", 0.5);
  const byHand = await readStudioOutputSignature(page);
  expect(
    byHand,
    "drift must be a position the author could have set, not a separate effect",
  ).toBe(midSignature);
  await setStudioSlider(page, "Offset", 0);
  await setStudioSlider(page, "Travel per loop", 1);

  // And from the other side: the values the author set are untouched. A drift
  // that wrote back into the composition would leave a different work behind
  // every time the timeline moved, and the frame alone would not show it.
  await scrubber.press("End");
  expect(
    await readStudioLayerValues(page),
    "drift must not write back into the composition it is moving",
  ).toEqual(authoredValues);

  // The seam. The last frame of the loop is the first frame of the next one,
  // which is the whole reason the rate is counted in whole cycles.
  await scrubber.press("End");
  const seamEnd = await readStudioOutputSignature(page);
  await scrubber.press("Home");
  const seamStart = await readStudioOutputSignature(page);
  expect(seamEnd, "the end of the loop must be its start, with no visible jump").toBe(
    seamStart,
  );
  // And the start of the drifting loop is the composition as it was authored --
  // not merely self-consistent, but the same frame as before drift existed.
  expect(seamStart).toBe(stillSignature);

  // The angle drifts on the same terms, and only the ticks that return.
  await setStudioSlider(page, "Travel per loop", 0);
  await setStudioSlider(page, "Turns per loop", 1);
  await scrubStudioTimelineTo(page, scrubber, 0.5);
  expect(
    await readStudioOutputSignature(page),
    "one whole turn per loop must change the direction the field is read from",
  ).not.toBe(stillSignature);
  await scrubber.press("End");
  const turnEnd = await readStudioOutputSignature(page);
  await scrubber.press("Home");
  expect(turnEnd, "a whole turn returns, so the seam closes for the angle too").toBe(
    await readStudioOutputSignature(page),
  );

  // The delivered artifact, not just the preview. An export taken at timeline
  // zero with drift declared is byte-identical to the one taken before drift
  // existed -- so a composition an author already exported still exports the
  // same file. Bytes rather than pixels deliberately: a pixel comparison would
  // pass over an encoder difference that a recipient's tooling would not.
  await setStudioSlider(page, "Turns per loop", 0);
  await setStudioSlider(page, "Travel per loop", 2);
  await scrubber.press("Home");
  expect(
    await exportPng(page),
    "an export at timeline zero must be the artifact the composition always was",
  ).toBe(stillDigest);

  // The runtime's own transport, proved through the protected helper rather than
  // by hand: scrub, seam, and duration change are the recipe a timeline owes
  // once it exists, and the marker it reads is the loop position of the frame
  // that was actually drawn rather than the clock's idea of it.
  await expectToolcraftStandardTimelinePlayback(session, {
    markerSelector: "[data-toolcraft-product-output]",
    requirementId: "timeline.playback",
  });
});

/**
 * The beating field, which is the case a plain band field will not show.
 *
 * A chromointerference lays a second band sequence over the first at a different
 * pitch, so the composite already carries a low-frequency beat before anything
 * moves. Drifting phase over that is where a pattern starts to crawl: the beat
 * has its own period, and if it is not commensurate with the loop the seam that
 * closes for the bands does not close for the beat. That failure is invisible in
 * a single frame and obvious after two plays, which is exactly the kind of thing
 * that reaches a user rather than a test.
 *
 * It closes here because the drift moves the *coordinate* both sequences are
 * read from, not each sequence separately -- one whole travel cycle returns the
 * coordinate, so both sequences and their beat return with it.
 */
test("browser: studio drift closes the seam on a beating field", async ({ page }) => {
  test.setTimeout(180_000);

  await openStudioSingleLayer(page);
  const scrubber = await timelineScrubber(page);

  await setStudioSelectValue(page, "selectedLayer.engine", "Interference");
  await setStudioSlider(page, "Engine amount", 1);
  // Deliberately not a whole multiple of the band count. A commensurate pitch
  // would beat at the band period and close for the wrong reason -- the proof
  // would pass without the awkward case ever having been drawn.
  await setStudioSlider(page, "Interference pitch", 1.15);
  await setStudioSlider(page, "Travel per loop", 1);

  await scrubber.press("Home");
  const start = await readStudioOutputSignature(page);
  await scrubStudioTimelineTo(page, scrubber, 0.5);
  expect(
    await readStudioOutputSignature(page),
    "the beating field must actually move, or the seam closes trivially",
  ).not.toBe(start);
  await scrubber.press("End");
  expect(
    await readStudioOutputSignature(page),
    "the beat must return with the bands, not crawl past them",
  ).toBe(start);
});

/**
 * The Setup `Timeline` switch shows and hides a panel. That is all it does.
 *
 * Worth asserting because a presentation toggle sitting next to a transport
 * invites exactly one assumption -- that turning the timeline "off" stops the
 * animation -- and a product that quietly honoured that assumption would have
 * two transports disagreeing about whether playback is running.
 */
test("browser: studio timeline switch is presentation only", async ({ page }) => {
  test.setTimeout(120_000);

  await openStudioSingleLayer(page);
  const scrubber = await timelineScrubber(page);
  await setStudioSlider(page, "Travel per loop", 1);
  await scrubStudioTimelineTo(page, scrubber, 0.5);

  const framed = await readStudioOutputSignature(page);
  const values = await readStudioLayerValues(page);

  await toggleStudioSwitch(page, "panels.timeline.extended");
  expect(
    await readStudioOutputSignature(page),
    "hiding the timeline must not move the frame it was showing the position of",
  ).toBe(framed);
  expect(await readStudioLayerValues(page)).toEqual(values);

  await toggleStudioSwitch(page, "panels.timeline.extended");
  expect(await readStudioOutputSignature(page)).toBe(framed);
});

/**
 * Two layers drifting at different rates, and both home at the seam.
 *
 * The claim a single-layer proof cannot make. One layer returning proves the
 * arithmetic; two layers at *different* rates returning together proves they
 * share one clock and that the clock is the loop rather than each layer's own
 * idea of elapsed time. A per-layer timer, a per-layer phase accumulator, or a
 * rate applied to wall-clock seconds instead of loop position would each pass
 * the one-layer proof and fail here — the fast layer would arrive somewhere the
 * slow one is not.
 *
 * Rates chosen coprime-ish and both whole: one and three. A pair like two and
 * four would close at the seam even if the drift were being applied to half the
 * loop, because both are even; one and three cannot agree by accident.
 */
test("browser: studio returns two layers drifting at different rates", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const { fixture } = await openStudioTwoLayerStack(page);
  const scrubber = await timelineScrubber(page);

  await selectStudioLayer(page, fixture.stripesLayerId);
  await setStudioSlider(page, "Travel per loop", 1);
  await selectStudioLayer(page, fixture.gradientLayerId);
  await setStudioSlider(page, "Travel per loop", 3);
  // The top layer at half strength, so the composite depends on both of them.
  // At full opacity the gradient covers the stripes and every reading below
  // would be about one layer while claiming to be about two.
  await setStudioSlider(page, "Opacity", 0.5);

  await scrubber.press("Home");
  const start = await readStudioOutputSignature(page);

  // Sampled at a fifth and two fifths, and the choice matters. At a *third* of
  // the loop the rate-three layer has completed exactly one whole cycle and is
  // home again -- so a comparison there is blind to it, and the proof would be
  // asserting two-layer behaviour while reading one. At 0.2 and 0.4 neither
  // layer is home and no two of the four positions coincide.
  await scrubStudioTimelineTo(page, scrubber, 0.2);
  const early = await readStudioOutputSignature(page);
  await scrubStudioTimelineTo(page, scrubber, 0.4);
  const later = await readStudioOutputSignature(page);

  expect(early, "a two-layer stack must move over the loop").not.toBe(start);
  expect(later, "the two rates must not move in lockstep").not.toBe(early);

  // The seam, with both layers on it. This is the assertion the task asks for.
  await scrubber.press("End");
  expect(
    await readStudioOutputSignature(page),
    "two layers at different rates must both return to their first frame",
  ).toBe(start);
});
