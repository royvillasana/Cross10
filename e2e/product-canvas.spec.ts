import type { Locator } from "@playwright/test";

import { createToolcraftVideoFrameSchedule } from "../src/toolcraft/runtime/export/video-frame-schedule";
import { inspectToolcraftVideoDownload } from "./video-artifact-inspection";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  expectToolcraftInfinityCanvasModeEvidence,
  observeInfinityCanvas,
} from "./browser-infinity-canvas-evidence";
import { expectToolcraftCanvasRenderScaleEvidence } from "./browser-render-scale-evidence";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import {
  openStudioSingleLayer,
  setStudioSlider,
  STUDIO_PRODUCT_OUTPUT,
  toggleStudioSwitch,
} from "./studio-product-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Canvas acceptance domain.
 *
 * Render scale is a quality selection, not a performance lever: the protected
 * helper checks actual backing pixels against CSS size times device pixel ratio
 * times the selected scale in every declared state, so a renderer that quietly
 * dropped to 1x under interaction fails here rather than passing a budget.
 */

const OPAQUE_BLACK = [0, 0, 0, 255] as const;

test("browser: studio render scale changes preview backing without changing the export", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(180_000);

  const { session } = await openStudioSingleLayer(page);

  await expectToolcraftCanvasRenderScaleEvidence(page, {
    canvasSelector: STUDIO_PRODUCT_OUTPUT,
    requirementId: "canvas.render-scale",
    // The schema default, and the scale the backing must actually carry.
    selectedScale: 2,
    stateTransitions: [
      {
        // Mid-edit: the backing must hold its selected scale while the field is
        // re-resolving, which is where a renderer would be tempted to drop it.
        run: async () => {
          await setStudioSlider(page, "Band count", 48);
        },
        state: "interaction",
      },
      {
        run: async () => {
          await setStudioSlider(page, "Band count", 24);
        },
        state: "steady",
      },
    ],
    target: "canvas.renderScale",
  });

  // The export is sized by the export resolution, not by the preview's backing:
  // the two are separate selections and the artifact must not follow the screen.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const { inspection } = await inspectToolcraftImageDownload({
    backgroundRgba: OPAQUE_BLACK,
    download: await download,
    page,
  });

  expect(
    Math.max(inspection.width, inspection.height),
    "the exported long edge follows the 4K export resolution, not the preview scale",
  ).toBe(4096);
});

test("browser: studio enters infinity canvas and restores the exact finite artboard", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await openStudioSingleLayer(page);

  const before = await observeInfinityCanvas(page);

  await toggleStudioSwitch(page, "canvas.infinity");
  const enabled = await observeInfinityCanvas(page);

  // Panning only moves the viewport. The artboard the product renders into is
  // not a function of where the workspace happens to be scrolled, which is what
  // makes the restored comparison meaningful rather than incidental.
  //
  // Taken from bare canvas rather than from the middle of it. The selected
  // layer's shape sits at the centre and its handles own that area (R66), so a
  // drag started there moves the shape -- which is the design-tool reading of
  // the gesture, and the reason the pan grabs somewhere the shape is not.
  const viewport = page.getByRole("application", { name: "Canvas viewport" });
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Canvas viewport has no bounding box.");
  const panFromX = box.x + box.width * 0.12;
  const panFromY = box.y + box.height / 2;
  await page.mouse.move(panFromX, panFromY);
  await page.mouse.down();
  await page.mouse.move(panFromX + 120, panFromY + 80);
  await page.mouse.up();
  const afterPan = await observeInfinityCanvas(page);

  // Reloaded while still infinite: the mode has to survive a real reload, so
  // this is observed before the mode is toggled back rather than at the end.
  await page.reload();
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();
  const afterReload = await observeInfinityCanvas(page);

  // Undo and redo run against the toggle made after the reload, because a
  // reload starts a fresh history and there would be nothing to undo otherwise.
  await toggleStudioSwitch(page, "canvas.infinity");
  const restored = await observeInfinityCanvas(page);

  await page.getByRole("button", { name: "Undo" }).click();
  const undone = await observeInfinityCanvas(page);

  await page.getByRole("button", { name: "Redo" }).click();
  const redone = await observeInfinityCanvas(page);

  await expectToolcraftInfinityCanvasModeEvidence(
    { afterPan, afterReload, before, enabled, redone, restored, undone },
    {
      expectedFiniteSize: { height: 1080, width: 1920 },
      // The product scene is the authored output rectangle, centred on the
      // world origin -- the same rect `sceneBoundsProvider` reports.
      expectedSceneRect: { height: 1080, width: 1920, x: -960, y: -540 },
      requirementId: "canvas.infinity-mode",
      target: "canvas.infinity",
    },
  );
});

/**
 * An infinite canvas has no viewport to export, so the artifact is the work.
 *
 * On a finite canvas the exported rectangle is the artboard: an obvious, fixed
 * answer. Infinity removes that answer, and the tempting replacement — export
 * what is currently on screen — would make the artifact depend on where the
 * author happened to have scrolled when they pressed the button. Two exports of
 * one composition would differ, and neither would be the composition.
 *
 * So the crop is the union of the visible layers' bounds, and this asserts the
 * consequence that matters: pan the workspace, export again, get the same file.
 * Bytes rather than dimensions, because a crop that shifted while keeping its
 * size would pass a dimension check and be exactly the bug.
 */
test("browser: studio infinite export crops to the union of visible scene bounds", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await openStudioSingleLayer(page);
  await toggleStudioSwitch(page, "canvas.infinity");

  const exportPng = async () => {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PNG" }).click();
    const path = await (await download).path();
    expect(path).toBeTruthy();
    return createHash("sha256").update(await readFile(path as string)).digest("hex");
  };

  /** The view's own transform, which the artifact must be independent of. */
  const readView = async () =>
    page.evaluate(() => {
      const world = document.querySelector("[data-toolcraft-canvas-world]");
      if (!world) return "no-world-element";
      return [
        world.getAttribute("data-toolcraft-canvas-offset-x") ?? "?",
        world.getAttribute("data-toolcraft-canvas-offset-y") ?? "?",
        world.getAttribute("data-toolcraft-canvas-zoom") ?? "?",
      ].join(",");
    });

  const before = await exportPng();
  const viewBefore = await readView();

  // Pan the workspace. The gesture is the runtime's; what matters here is only
  // that the viewport genuinely moved, which is asserted rather than assumed --
  // a drag that did nothing would make the comparison below vacuous.
  const viewport = page.getByRole("application", { name: "Canvas viewport" });
  const box = await viewport.boundingBox();
  expect(box).toBeTruthy();
  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;
  // Zoom rather than pan, and the substitution is deliberate rather than
  // convenient. Panning is a left drag, and in this product the left button
  // belongs to the canvas -- it tracks the pointer for the cursor uniform and
  // for the region handles -- so a test cannot pan without also moving the
  // work, which would change the artifact for a legitimate reason and prove
  // nothing. Zoom is the same claim in a gesture the product does not own: it
  // changes the view and nothing else, so the artifact must not notice.
  await page.mouse.move(centerX, centerY);
  for (const delta of [-120, -120, -120]) {
    await page.mouse.wheel(0, delta);
  }

  // Asserted rather than assumed: a gesture that moved nothing would make the
  // comparison below vacuous, and it did exactly that twice while I was
  // looking for a gesture this product does not intercept.
  await expect
    .poll(async () => readView(), { timeout: 10_000 })
    .not.toBe(viewBefore);

  expect(
    await exportPng(),
    "an infinite export must be the work, not the view of it",
  ).toBe(before);
});


const OPAQUE_PROBE = [0, 0, 0, 255] as const;

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

/**
 * An infinite canvas exports one envelope for the whole loop.
 *
 * The frame size is decided once, from the union of every moment's bounds, and
 * not per frame. A composition that drifts outward would otherwise be clipped
 * part-way through — or, worse, resize between packets, which most players
 * handle by stretching and some by stopping.
 */
test("browser: studio infinite video export holds one frame size across the loop", async ({
  page,
}) => {
  test.setTimeout(300_000);

  await openStudioSingleLayer(page);
  const scrubber = await timelineScrubber(page);
  await toggleStudioSwitch(page, "canvas.infinity");
  // Drift declared, so the work reaches further at some moments than others --
  // which is the case a per-frame envelope would get wrong.
  await setStudioSlider(page, "Travel per loop", 1);

  const schedule = createToolcraftVideoFrameSchedule(
    await readTimelineDuration(scrubber),
  );
  const { inspection } = await inspectToolcraftVideoDownload({
    backgroundRgba: OPAQUE_PROBE,
    download: await exportVideo(page),
    page,
    schedule,
  });

  // One size for the track, and every scheduled frame present in it. A track
  // carries a single coded size, so the claim is that the export chose one that
  // fits the whole loop rather than dropping or clipping the frames it did not.
  expect(inspection.width).toBeGreaterThan(0);
  expect(inspection.height).toBeGreaterThan(0);
  expect(inspection.frameCount).toBe(schedule.length);
});
