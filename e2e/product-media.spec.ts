import { expect } from "@playwright/test";

import { createToolcraftBrowserProofSession } from "./browser-proof-session";
import { TOOLCRAFT_DECODED_OBSERVATION_SIZE } from "./decoded-pixel-observation";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import {
  IMPORT_FIXTURE,
  importStudioImage,
  importStudioVideo,
  readStudioFrameColour,
  readStudioImageCorners,
  writeImportFixture,
} from "./studio-import-fixture";
import {
  dismissStudioOnboarding,
  setStudioSelectValue,
  readStudioLayerIds,
  readStudioStackSignature,
  STUDIO_PRODUCT_OUTPUT,
} from "./studio-product-helpers";
import { test } from "./toolcraft-product-test";

/**
 * Media acceptance domain: importing a picture, and what the layer does with it.
 *
 * Separate file from `product-layers.spec.ts` because the delivery catalog
 * requires one acceptance domain per spec file, and these two rows are `media.*`
 * while that file's are `layers.*`. The distinction survives the rule: these are
 * about a picture arriving and being drawn, while the proofs left behind are
 * about what a layer does — order, visibility, grouping, region — with the
 * picture incidental to them.
 */

test("browser: studio image import creates a layer that draws it", async ({ page }) => {
  test.setTimeout(120_000);
  writeImportFixture();

  // From an empty stack: anything already there would composite over the
  // imported picture and be read instead of it.
  // Cleared after the first load and then reloaded, rather than through an
  // init script. An init script runs on *every* navigation in the context, so a
  // later reload wipes storage again -- including the record that the flow has
  // been answered, which brings the dialog back over a test that dismissed it
  // long ago. That is what happened here: "Add layer" was never found because a
  // study picker had reappeared on top of it.
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();
  // The flow is answered before anything is touched. These fixtures clear
  // storage to start from an empty stack, which is a first visit, so the
  // dialog opens over the shell and its backdrop intercepts every pointer
  // event afterwards -- which surfaced as a hover timing out on a layer row
  // that Playwright had just reported visible and stable.
  await dismissStudioOnboarding(page);
  const before = await readStudioLayerIds(page);

  await importStudioImage(page);

  // Upload: the runtime made a layer for the picture, and the product draws it.
  await expect
    .poll(async () => (await readStudioLayerIds(page)).length, { timeout: 15_000 })
    .toBe(before.length + 1);
  await expect
    .poll(async () => readStudioStackSignature(page), { timeout: 15_000 })
    .toContain("image");
  await expect
    .poll(async () => readStudioImageCorners(page), { timeout: 15_000 })
    .toBe("topLeft=red topRight=blue");

  // Remove: deleting the layer takes the picture with it.
  const imported = (await readStudioLayerIds(page)).find((id) => !before.includes(id));
  const row = page.locator(`[data-layer-id="${imported}"]`);
  await row.hover();
  await row
    .locator('button[aria-label^="Delete"], button[aria-label^="Remove"]')
    .first()
    .click();
  await expect
    .poll(async () => (await readStudioLayerIds(page)).length, { timeout: 15_000 })
    .toBe(before.length);
  await expect
    .poll(async () => readStudioImageCorners(page), { timeout: 15_000 })
    .not.toContain("red");
});

test("browser: studio image transform turns what the layer draws", async ({ page }) => {
  test.setTimeout(120_000);
  writeImportFixture();

  // Cleared after the first load and then reloaded, rather than through an
  // init script. An init script runs on *every* navigation in the context, so a
  // later reload wipes storage again -- including the record that the flow has
  // been answered, which brings the dialog back over a test that dismissed it
  // long ago. That is what happened here: "Add layer" was never found because a
  // study picker had reappeared on top of it.
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();
  // The flow is answered before anything is touched. These fixtures clear
  // storage to start from an empty stack, which is a first visit, so the
  // dialog opens over the shell and its backdrop intercepts every pointer
  // event afterwards -- which surfaced as a hover timing out on a layer row
  // that Playwright had just reported visible and stable.
  await dismissStudioOnboarding(page);
  await importStudioImage(page);

  await expect
    .poll(async () => readStudioImageCorners(page), { timeout: 15_000 })
    .toBe("topLeft=red topRight=blue");

  const mediaControl = page.locator('[data-toolcraft-control-target="media.image"]');

  // Rotate: the runtime's own button dispatching its own command. Nothing
  // product-authored drives this -- the claim is that it reaches the frame.
  await mediaControl.getByRole("button", { name: "90° Right" }).first().click();
  await expect
    .poll(async () => readStudioImageCorners(page), { timeout: 15_000 })
    .toBe("topLeft=yellow topRight=red");

  // Flip: mirrored about the *picture's* own left-right, not the screen's. With
  // the picture already turned a quarter, its own horizontal runs down the
  // screen, so the mirror reads vertical here.
  //
  // That is the asset-property reading and it is deliberate: the transform is
  // stored on the asset, so it has to mean the same thing to everything that
  // draws it. A renderer mirroring in screen space would disagree with every
  // other consumer of the same metadata the moment a rotation was on.
  await mediaControl.getByRole("button", { name: "Flip horizontal" }).first().click();
  await expect
    .poll(async () => readStudioImageCorners(page), { timeout: 15_000 })
    .toBe("topLeft=white topRight=blue");
});

test("browser: studio video import creates a layer that draws it", async ({
  page,
}) => {
  test.setTimeout(120_000);

  // Same empty-stack preparation as the picture proof above, and for the same
  // reason: anything already in the stack composites over the clip and is what
  // the centre sample would read.
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();
  await dismissStudioOnboarding(page);
  const before = await readStudioLayerIds(page);

  await importStudioVideo(page);

  // Upload: the runtime made a layer for the clip, and the product draws it as
  // a picture -- which is the claim that video is a source rather than a second
  // renderer. A frame of a clip is a picture, so the body that draws a picture
  // draws it, and the stack signature says so.
  await expect
    .poll(async () => (await readStudioLayerIds(page)).length, { timeout: 20_000 })
    .toBe(before.length + 1);
  await expect
    .poll(async () => readStudioStackSignature(page), { timeout: 20_000 })
    .toContain("image");
  await expect
    .poll(async () => readStudioFrameColour(page), { timeout: 20_000 })
    .toMatch(/^(red|blue)$/);

  // The clip runs, and it runs from the loop rather than from a player. The
  // fixture is red for its first second and blue for its second, so a frame
  // that follows the loop shows both within one turn of it and a frame that is
  // stuck on whatever decoded first shows only one.
  //
  // Collected by sampling rather than by waiting for a particular colour,
  // because which one is on screen at any instant depends on where the loop
  // happens to be -- the claim is that both occur, not that either occurs now.
  const seen = new Set<string>();
  await expect
    .poll(
      async () => {
        seen.add(await readStudioFrameColour(page));
        return seen.size;
      },
      { intervals: [200], timeout: 30_000 },
    )
    .toBeGreaterThan(1);
  expect([...seen].sort()).toEqual(["blue", "red"]);

  // And the clip reaches the artifact, not only the screen.
  //
  // This is the half that was quietly missing for pictures too: the export
  // frame was built with an empty media map, so an imported source drew nothing
  // into a file. Invisible while a picture was decoration; not invisible once a
  // picture is the composition. Proved on the still export because it is the
  // cheapest artifact that can carry the claim -- the video export walks the
  // same frame renderer, one moment at a time.
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const { observation } = await inspectToolcraftImageDownload({
    backgroundRgba: [0, 0, 0, 0],
    download: await pending,
    page,
  });
  const size = TOOLCRAFT_DECODED_OBSERVATION_SIZE;
  const middle = (Math.floor(size / 2) * size + Math.floor(size / 2)) * 4;
  const [exportedRed, exportedGreen, exportedBlue] = [
    observation.normalizedPixels[middle] ?? 0,
    observation.normalizedPixels[middle + 1] ?? 0,
    observation.normalizedPixels[middle + 2] ?? 0,
  ];
  // One of the fixture's two flat halves, whichever the loop was on: the claim
  // is that a frame of the clip is in the file, not which frame.
  const exported =
    exportedRed > 150 && exportedGreen < 120 && exportedBlue < 120
      ? "red"
      : exportedBlue > 150 && exportedRed < 120
        ? "blue"
        : `other(${exportedRed},${exportedGreen},${exportedBlue})`;
  expect(exported).toMatch(/^(red|blue)$/);

  // Remove: deleting the layer takes the clip with it.
  const imported = (await readStudioLayerIds(page)).find(
    (id) => !before.includes(id),
  );
  const row = page.locator(`[data-layer-id="${imported}"]`);
  await row.hover();
  await row
    .locator('button[aria-label^="Delete"], button[aria-label^="Remove"]')
    .first()
    .click();
  await expect
    .poll(async () => (await readStudioLayerIds(page)).length, { timeout: 15_000 })
    .toBe(before.length);
  await expect
    .poll(async () => readStudioFrameColour(page), { timeout: 15_000 })
    .not.toMatch(/^(red|blue)$/);
});
