import type { Download, Page } from "@playwright/test";

import {
  dragCanvasHandle,
  expectExportExcludesCanvasHandles,
  getCanvasHandle,
} from "./canvas-handle-helpers";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { openStudioSingleLayer, setStudioSlider } from "./studio-product-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Canvas handle acceptance domain.
 *
 * The region is editable in two places — the Layer Region sliders and these
 * handles — and they are one region, not two. Every proof here reads both: the
 * pixels, because a handle that moved nothing would be a decoration, and the
 * sliders, because a handle that moved pixels without writing the schema target
 * would have forked the region into a second copy the exported script knows
 * nothing about (R44).
 */

const OPAQUE_BLACK = [0, 0, 0, 255] as const;

/**
 * Where the layer reaches across the frame, and how tall it is.
 *
 * Five places, because the three gestures change different subsets of them: a
 * move trades one side for the other, a corner drag gains both, and a side drag
 * gains width while the caps stay exactly as they were. A reading of one place
 * could not tell the three apart.
 */
async function readRegionReach(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.querySelector(
      "[data-toolcraft-product-output]",
    ) as HTMLCanvasElement | null;
    const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!canvas || !gl) return "absent";

    const at = (fx: number, fy: number): string => {
      const width = 24;
      const height = 4;
      const x = Math.min(
        Math.max(Math.round(canvas.width * fx) - width / 2, 0),
        canvas.width - width,
      );
      const y = Math.min(
        Math.max(Math.round(canvas.height * fy) - height / 2, 0),
        canvas.height - height,
      );
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const colours = new Set<string>();
      for (let index = 0; index < pixels.length; index += 4) {
        colours.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
      }
      // The bands run across the frame, so a patch crosses several of them
      // where the layer draws and sees one flat colour where it does not.
      return colours.size > 1 ? "field" : "ground";
    };

    return [
      `L=${at(0.15, 0.5)}`,
      `C=${at(0.5, 0.5)}`,
      `R=${at(0.85, 0.5)}`,
      `T=${at(0.5, 0.15)}`,
      `B=${at(0.5, 0.85)}`,
    ].join(" ");
  });
}

async function readRegionSliders(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const read = (label: string): number => {
      const slider = document.querySelector(`input[aria-label="${label}"]`);
      return Number(slider?.getAttribute("aria-valuenow") ?? Number.NaN);
    };
    return {
      across: read("Region across"),
      aspect: read("Region aspect"),
      down: read("Region down"),
      size: read("Region size"),
    };
  });
}

/**
 * A small centred region, so every edge of the frame starts out of reach and a
 * gesture has somewhere to move it to.
 */
async function openStudioHandleFixture(page: Page) {
  const fixture = await openStudioSingleLayer(page);
  await setStudioSlider(page, "Region size", 0.2);

  await expect
    .poll(async () => readRegionReach(page), { timeout: 15_000 })
    .toBe("L=ground C=field R=ground T=ground B=ground");

  return fixture;
}

test("browser: studio region body drags the layer across the canvas", async ({ page }) => {
  test.setTimeout(120_000);

  await openStudioHandleFixture(page);
  const canvas = await page.locator("[data-toolcraft-product-output]").boundingBox();
  if (!canvas) throw new Error("Could not measure the product canvas.");

  await dragCanvasHandle(
    page,
    "studio-region-move",
    { x: -canvas.width * 0.35, y: 0 },
    {
      requirementId: "selectedLayer.regionHandle.move",
      target: "selectedLayer.maskCenterX",
    },
  );

  // One side for the other: the region left the centre and arrived at the left,
  // which a resize could not have done.
  await expect.poll(async () => readRegionReach(page), { timeout: 15_000 }).toBe(
    "L=field C=ground R=ground T=ground B=ground",
  );

  // And it moved by writing the slider's own target, not beside it.
  const sliders = await readRegionSliders(page);
  expect(sliders.across).toBeLessThan(-0.2);
  expect(sliders.size).toBeCloseTo(0.2, 2);
});

test("browser: studio region corner node resizes the layer on the canvas", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await openStudioHandleFixture(page);
  const canvas = await page.locator("[data-toolcraft-product-output]").boundingBox();
  if (!canvas) throw new Error("Could not measure the product canvas.");

  await dragCanvasHandle(
    page,
    "studio-region-node-southEast",
    { x: canvas.width * 0.3, y: canvas.height * 0.3 },
    {
      requirementId: "selectedLayer.regionHandle.corner",
      target: "selectedLayer.maskSize",
    },
  );

  // Both axes grew: the region now reaches a side and a cap it did not.
  await expect.poll(async () => readRegionReach(page), { timeout: 15_000 }).toBe(
    "L=ground C=field R=field T=ground B=field",
  );

  const sliders = await readRegionSliders(page);
  expect(sliders.size).toBeGreaterThan(0.2);
});

test("browser: studio region side node widens the layer without heightening it", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await openStudioHandleFixture(page);
  const canvas = await page.locator("[data-toolcraft-product-output]").boundingBox();
  if (!canvas) throw new Error("Could not measure the product canvas.");

  await dragCanvasHandle(
    page,
    "studio-region-node-east",
    { x: canvas.width * 0.3, y: 0 },
    {
      requirementId: "selectedLayer.regionHandle.side",
      target: "selectedLayer.maskAspect",
    },
  );

  // The right side comes within reach and the caps stay exactly where they
  // were, which is what separates widening from growing.
  await expect.poll(async () => readRegionReach(page), { timeout: 15_000 }).toBe(
    "L=ground C=field R=field T=ground B=ground",
  );

  const sliders = await readRegionSliders(page);
  expect(sliders.aspect).toBeGreaterThan(1);
  expect(sliders.size).toBeCloseTo(0.2, 2);
});

test("browser: studio region handles stay out of the exported artifact", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await openStudioHandleFixture(page);
  await expect(getCanvasHandle(page, "studio-region-move")).toBeVisible();

  // The helper exports once as the handles are, then again with every handle
  // forced to a colour nothing in the stack uses, and requires the two
  // artifacts to be indistinguishable. That is a differential claim rather than
  // an eyeball: if the overlay reached the canvas at all, the second export
  // would carry it.
  await expectExportExcludesCanvasHandles(
    page,
    async (): Promise<Download> => {
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export PNG" }).click();
      return download;
    },
    async (download) => {
      const { inspection } = await inspectToolcraftImageDownload({
        backgroundRgba: OPAQUE_BLACK,
        download,
        page,
      });
      return inspection;
    },
    {
      requirementId: "selectedLayer.regionHandle.move",
      target: "selectedLayer.maskCenterX",
    },
  );
});
