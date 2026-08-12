import { readFile } from "node:fs/promises";

import type { Page } from "@playwright/test";

import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import {
  chooseCroix10Engine,
  jumpCroix10Slider,
  openCroix10,
  readCroix10FieldColorCount,
} from "./croix10-product-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Settings Transfer round trip.
 *
 * Runtime owns Export Settings and Import Settings, so this carries no acceptance row
 * of its own — the acceptance model only has a slot for opting *out*. What it checks
 * is the product's side of the bargain: every value that defines a Croix10 scene is a
 * schema target, so a runtime settings file is a complete scene and the product needs
 * no save or load control. If some part of the scene lived in product-owned state
 * instead, this round trip is where that would show up as a value that did not come
 * back.
 */

const SCENE_TARGETS = [
  "stripe.count",
  "stripe.angle",
  "induction.frequency",
  "induction.fringeWidth",
  "palette.slots",
] as const;

async function readSceneValues(
  page: Page,
): Promise<Readonly<Record<string, string>>> {
  const values: Record<string, string> = {};
  for (const target of SCENE_TARGETS) {
    try {
      const field = await getToolcraftControlFieldByTarget(page, target);
      const sliders = await field
        .getByRole("slider")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("aria-valuenow")).join("|"),
        );
      const inputs = await field
        .getByRole("textbox")
        .evaluateAll((nodes) =>
          nodes.map((node) => (node as HTMLInputElement).value).join("|"),
        );
      values[target] = `${sliders}/${inputs}`;
    } catch {
      values[target] = "";
    }
  }
  return values;
}

function engineTrigger(page: Page) {
  return page
    .locator('[data-slot="field"]')
    .filter({ hasText: "Engine" })
    .first()
    .getByRole("combobox");
}

test("browser: croix10 settings transfer round-trips the whole scene", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await openCroix10(page);

  // A scene that is nothing like the defaults, across three different sections and
  // two value shapes, so a partial round trip cannot pass by accident.
  await chooseCroix10Engine(page, "Induction Chromatique");
  await jumpCroix10Slider(
    await getToolcraftControlFieldByTarget(page, "induction.frequency"),
    "End",
  );
  const paletteField = await getToolcraftControlFieldByTarget(
    page,
    "palette.slots",
  );
  const firstHex = paletteField.getByRole("textbox").first();
  await firstHex.fill("FF00FF");
  await firstHex.press("Enter");

  const authored = await readSceneValues(page);
  expect(authored["induction.frequency"]).not.toBe("");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Settings" }).click();
  const settingsPath = await (await download).path();
  expect(settingsPath).toBeTruthy();

  // The artifact is a real scene, not a stub: the engine and the edited values are
  // in the bytes.
  const settings = JSON.parse(await readFile(settingsPath, "utf8")) as {
    values?: Record<string, unknown>;
  };
  expect(settings.values?.["engine.active"]).toBe("induction");

  // Reset first, so the import has something to restore rather than confirming a
  // state that never left.
  await page.getByRole("button", { name: "Reset controls" }).click();
  await expect(engineTrigger(page)).toContainText("Couleur Additive");
  const reset = await readSceneValues(page);
  expect(reset["induction.frequency"]).not.toBe(
    authored["induction.frequency"],
  );

  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import Settings" }).click();
  await (await chooser).setFiles(settingsPath);

  await expect(engineTrigger(page)).toContainText("Induction Chromatique");
  await expect
    .poll(() => readSceneValues(page), { timeout: 15_000 })
    .toEqual(authored);

  // And the restored scene actually renders.
  expect(await readCroix10FieldColorCount(page)).toBeGreaterThan(1);
});
