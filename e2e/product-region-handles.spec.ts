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

    // fy is a fraction from the top of the frame, as a reader would mean it.
    // `readPixels` counts from the bottom, so it is flipped here rather than in
    // every call site -- a reader whose "top" samples the bottom is invisible in
    // any fixture that happens to be symmetric, and wrong in every other.
    const at = (fx: number, fyFromTop: number): string => {
      const fy = 1 - fyFromTop;
      // Narrow and tall, against a field whose bands run across the frame. Both
      // halves matter: tall so the strip always crosses several bands where the
      // layer draws, and narrow so it cannot straddle the shape's own edge and
      // report the two sides of it as one covered place.
      const width = 16;
      const height = 200;
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
      // Sample points outside the shape a layer now arrives with (R65), so
      // "out of reach" still means the shape has not got there rather than the
      // sampling being too close in.
      `L=${at(0.3, 0.5)}`,
      `C=${at(0.5, 0.5)}`,
      `R=${at(0.7, 0.5)}`,
      `T=${at(0.5, 0.18)}`,
      `B=${at(0.5, 0.82)}`,
    ].join(" ");
  });
}

/**
 * The handle box itself, in the same units the field is measured in: fractions
 * of the frame's height, from its centre.
 *
 * Read from the overlay rather than from sliders. The Layer Region sliders were
 * the previous witness that a drag had written the geometry, and 14.1 retired
 * them precisely because the canvas owns this now — so the witness is the thing
 * the canvas draws. It is also the stronger claim: a slider could move while
 * the shape stayed put, and the box cannot.
 */
async function readRegionBox(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const handle = document.querySelector('[data-testid="studio-region-move"]');
    const output = document.querySelector("[data-toolcraft-product-output]");
    if (!handle || !output) return { centerX: NaN, centerY: NaN, halfHeight: NaN, halfWidth: NaN };

    const box = handle.getBoundingClientRect();
    const frame = output.getBoundingClientRect();
    return {
      centerX: (box.left + box.width / 2 - (frame.left + frame.width / 2)) / frame.height,
      centerY: (box.top + box.height / 2 - (frame.top + frame.height / 2)) / frame.height,
      halfHeight: box.height / 2 / frame.height,
      halfWidth: box.width / 2 / frame.height,
    };
  });
}

/**
 * The layer exactly as it arrives: a centred shape with every sample point out
 * of reach, so a gesture has somewhere to move it to.
 *
 * No setup at all since 14.2 gave a layer a real default size — which is what
 * that task was for. The fixture used to size the shape with a slider that no
 * longer exists, and could not have been written any other way in a viewport
 * where the frame's own corners fall outside the window.
 */
async function openStudioHandleFixture(page: Page) {
  const fixture = await openStudioSingleLayer(page);
  // Bands across the frame, so the sampling strips always cross them.
  await setStudioSlider(page, "Angle", 90);

  await expect
    .poll(async () => readRegionReach(page), { timeout: 15_000 })
    .toBe("L=ground C=field R=ground T=ground B=ground");

  return fixture;
}

test("browser: studio region body drags the layer across the canvas", async ({ page }) => {
  test.setTimeout(120_000);

  await openStudioHandleFixture(page);

  // Measured: the frame lays out at 1920x1080 CSS pixels and a drag maps one
  // for one, so 1080px is one unit of the field. 350px carries a shape of this size clear of the centre and onto the left sample, and still lands
  // inside the window.
  await dragCanvasHandle(
    page,
    "studio-region-move",
    { x: -350, y: 0 },
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

  // And it moved rather than resized: the box travelled left and kept its size.
  const box = await readRegionBox(page);
  expect(box.centerX).toBeLessThan(-0.2);
  expect(box.halfHeight).toBeCloseTo(0.25, 2);
});

test("browser: studio region corner node resizes the layer on the canvas", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await openStudioHandleFixture(page);

  await dragCanvasHandle(
    page,
    // A corner drag grows the half-extent by half the distance and carries the
    // centre by the other half, so 260px puts the far side past the sample.
    "studio-region-node-southEast",
    { x: 260, y: 80 },
    {
      requirementId: "selectedLayer.regionHandle.corner",
      target: "selectedLayer.maskSize",
    },
  );

  // Both axes grew: the region now reaches a side and a cap it did not.
  await expect.poll(async () => readRegionReach(page), { timeout: 15_000 }).toBe(
    "L=ground C=field R=field T=ground B=field",
  );

  const box = await readRegionBox(page);
  expect(box.halfHeight).toBeGreaterThan(0.25);
});

test("browser: studio region side node widens the layer without heightening it", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await openStudioHandleFixture(page);

  await dragCanvasHandle(
    page,
    "studio-region-node-east",
    { x: 260, y: 0 },
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

  const box = await readRegionBox(page);
  expect(box.halfWidth).toBeGreaterThan(box.halfHeight);
  expect(box.halfHeight).toBeCloseTo(0.25, 2);
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
