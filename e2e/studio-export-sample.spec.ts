import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { openStudioSingleLayer, setStudioSlider } from "./studio-product-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Not a proof. A way of getting a file out to look at.
 *
 * The video proofs decode their download in memory and Playwright discards it
 * when the test ends, which is right for a proof and useless for the one check
 * no assertion can make: playing the loop twice and watching the seam. A packet
 * count matching a duration and a loop that does not visibly jump are different
 * claims, and only the first is machine-checkable.
 *
 * Not registered at all unless asked for, so it never runs as part of the suite —
 * it writes into the working tree, and a test that leaves files behind is not a
 * test. Gated by an environment variable rather than by `test.skip`, because the
 * project's `test` export is a wrapper that has no `.skip`, and reaching for one
 * took the whole suite down at collection time rather than skipping anything.
 *
 *     STUDIO_EXPORT_SAMPLE=1 npx playwright test e2e/studio-export-sample.spec.ts
 */
const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "artifacts");

if (process.env.STUDIO_EXPORT_SAMPLE) {
test("sample: export a drifting loop to look at", async ({ page }) => {
  test.setTimeout(600_000);

  await openStudioSingleLayer(page);

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

  // One whole travel cycle: the case where a seam would show if there were one.
  await setStudioSlider(page, "Travel per loop", 1);

  await mkdir(OUTPUT_DIR, { recursive: true });

  const videoDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Video" }).click();
  await (await videoDownload).saveAs(join(OUTPUT_DIR, "croix10-loop.mp4"));

  const imageDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  await (await imageDownload).saveAs(join(OUTPUT_DIR, "croix10-frame.png"));
});
}
