import { expectToolcraftExportedArtifact } from "./browser-acceptance-outcome-helpers";
import {
  expectToolcraftInfinityCanvasImageExportEvidence,
  expectToolcraftInfinityCanvasModeEvidence,
  observeInfinityCanvas,
} from "./browser-infinity-canvas-evidence";
import { expectToolcraftDiscreteSliderMarkers } from "./performance-control-layout-helpers";
import { expectToolcraftCanvasRenderScaleEvidence } from "./browser-render-scale-evidence";
import {
  CROIX10_PRODUCT_OUTPUT,
  croix10SetupSwitch,
  openCroix10,
  playCroix10Timeline,
} from "./croix10-product-helpers";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { CROIX10_SCENE_RECT } from "../src/app/croix10-scene";
import { appSchema } from "../src/app/app-schema";
import { expect, test } from "./toolcraft-product-test";

/**
 * Canvas acceptance domain: selected render-scale backing, Infinity canvas mode
 * with exact finite restoration, and the infinite export crop.
 */

const OPAQUE_BLACK = [0, 0, 0, 255] as const;

async function exportArtifact(currentPage: import("@playwright/test").Page) {
  const download = currentPage.waitForEvent("download");
  await currentPage.getByRole("button", { name: "Export PNG" }).click();
  return download;
}

/** Decodes one export through the protected artifact recipe and returns it. */
async function inspectArtifact(
  page: import("@playwright/test").Page,
  action: Parameters<typeof expectToolcraftExportedArtifact>[0],
) {
  let decoded: Awaited<
    ReturnType<typeof inspectToolcraftImageDownload>
  >["inspection"] | null = null;
  await expectToolcraftExportedArtifact(
    action,
    async (download) => {
      const { inspection } = await inspectToolcraftImageDownload({
        backgroundRgba: OPAQUE_BLACK,
        download,
        page,
      });
      decoded = inspection;
      return inspection;
    },
    { requirementId: "canvas.infinity-image-export" },
  );
  if (!decoded) throw new Error("The export produced no decodable artifact.");
  return decoded;
}

async function toggleInfinity(
  page: import("@playwright/test").Page,
): Promise<void> {
  await croix10SetupSwitch(page, "Infinity canvas").click();
}

test("browser: croix10 keeps selected render scale backing pixels in every state", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  await openCroix10(page);

  const viewport = page.getByRole("application", { name: "Canvas viewport" });

  await expectToolcraftCanvasRenderScaleEvidence(page, {
    canvasSelector: CROIX10_PRODUCT_OUTPUT,
    requirementId: "canvas.render-scale",
    // Runtime resolves the enabled scale to a default and maximum of 2.
    selectedScale: 2,
    stateTransitions: [
      {
        run: async () => {
          // Interaction: a real canvas drag, during which backing must hold.
          const box = await viewport.boundingBox();
          if (!box) throw new Error("Canvas viewport has no bounds.");
          const x = box.x + box.width / 2;
          const y = box.y + box.height / 2;
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x + 40, y + 24, { steps: 4 });
        },
        state: "interaction",
      },
      {
        run: async () => {
          await page.mouse.up();
        },
        state: "steady",
      },
      {
        run: async () => {
          // Playback: the field is redrawing every frame, and the selected scale
          // must survive that rather than being traded away for frame rate.
          await playCroix10Timeline(page);
        },
        state: "playback",
      },
    ],
    target: "canvas.renderScale",
  });

  // The scale is a discrete choice, not a continuum: quarter steps with markers, so
  // the user picks a scale rather than landing between two of them.
  await expectToolcraftDiscreteSliderMarkers(
    page,
    "canvas.renderScale",
    "canvas.render-scale",
  );
});

test("browser: croix10 enters infinity canvas and restores the exact finite artboard", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  await openCroix10(page);

  const expectedFiniteSize = {
    height: appSchema.canvas.size.height,
    width: appSchema.canvas.size.width,
  };

  const before = await observeInfinityCanvas(page);
  await toggleInfinity(page);
  const enabled = await observeInfinityCanvas(page);

  // Pan while infinite: the product scene surface must stay at provider bounds.
  const viewport = page.getByRole("application", { name: "Canvas viewport" });
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Canvas viewport has no bounds.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 64, box.y + box.height / 2 + 32, {
    steps: 4,
  });
  await page.mouse.up();
  const afterPan = await observeInfinityCanvas(page);

  // Wait for the workspace to persist before reloading, otherwise the reload can
  // restore the state from before the mode change.
  await expect(
    page.locator('[data-slot="toolcraft-runtime-app"]'),
  ).toHaveAttribute("data-toolcraft-persistence-status", "success");
  await page.reload();
  await expect(page.locator(CROIX10_PRODUCT_OUTPUT)).toBeVisible();
  const afterReload = await observeInfinityCanvas(page);

  // Disable, then undo and redo that disable: undo returns to infinite and redo
  // returns to finite, which is the order the evidence contract requires.
  await toggleInfinity(page);
  const restored = await observeInfinityCanvas(page);

  await page.getByRole("button", { name: "Undo" }).click();
  const undone = await observeInfinityCanvas(page);
  await page.getByRole("button", { name: "Redo" }).click();
  const redone = await observeInfinityCanvas(page);

  await expectToolcraftInfinityCanvasModeEvidence(
    { afterPan, afterReload, before, enabled, redone, restored, undone },
    {
      expectedFiniteSize,
      expectedSceneRect: CROIX10_SCENE_RECT,
      requirementId: "canvas.infinity-mode",
      target: "canvas.infinity",
    },
  );
});

test("browser: croix10 infinite image export crops to the product scene bounds", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const session = await openCroix10(page);

  // The finite artboard first, so the two artifacts can be compared rather than
  // described. Long edge 4096 at the default 4K resolution; the aspect is the
  // artboard's, 16:9.
  const finite = await inspectArtifact(
    page,
    session.targetAction("canvas.infinity", exportArtifact),
  );

  await toggleInfinity(page);

  const infinite = await inspectArtifact(
    page,
    session.targetAction("canvas.infinity", exportArtifact),
  );

  // Infinite export crops to the product scene rect, which is wider than the
  // artboard, so the artifact keeps the world's aspect instead of the artboard's.
  expect(infinite.width / infinite.height).toBeCloseTo(
    CROIX10_SCENE_RECT.width / CROIX10_SCENE_RECT.height,
    2,
  );
  expect(
    infinite.nonBackgroundBounds,
    "The infinite export must contain the chromatic field.",
  ).not.toBeNull();

  await expectToolcraftInfinityCanvasImageExportEvidence(
    {
      finite: {
        byteLength: finite.byteLength,
        height: finite.height,
        width: finite.width,
      },
      infinite: {
        byteLength: infinite.byteLength,
        height: infinite.height,
        width: infinite.width,
      },
    },
    {
      // Both artifacts fill the same long edge, so their heights are what differ:
      // 4096 by 4096*9/16 for the artboard, 4096 by 4096*1080/2560 for the world.
      expectedFiniteSize: { height: 2304, width: 4096 },
      expectedInfiniteSize: { height: 1728, width: 4096 },
      requirementId: "canvas.infinity-image-export",
      target: "canvas.infinity",
    },
  );
});
