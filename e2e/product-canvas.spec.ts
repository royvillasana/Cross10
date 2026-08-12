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
  const viewport = page.getByRole("application", { name: "Canvas viewport" });
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Canvas viewport has no bounding box.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 80);
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
