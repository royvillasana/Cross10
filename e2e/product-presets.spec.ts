import type { Page } from "@playwright/test";

import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { proveCroix10ApplicabilityCases } from "./croix10-applicability-harness";
import {
  chooseCroix10Option,
  openCroix10,
  prepareCroix10Slider,
} from "./croix10-product-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Preset library acceptance domain.
 *
 * A preset is proved twice over: the rendered field has to change, and the panel has
 * to show the values that produced it. Either alone would be too weak — a canvas that
 * changed without the panel following would mean the preset wrote somewhere the user
 * cannot see or edit, which is exactly the parallel scene format the contract forbids.
 */

const PRESET_LABELS = [
  "Additive Bands",
  "Induced Third",
  "Physichromie 500",
  "Lamella Sweep",
  "Induction Grid",
  "Afterimage Rose",
  "Saturation Chamber",
  "Interference Beat",
  "Moiré Wedge",
  "Transchromie Sheets",
] as const;

async function loadPreset(page: Page): Promise<void> {
  const control = await getToolcraftControlFieldByTarget(
    page,
    "presets.actions",
  );
  await control.getByRole("button", { name: "Load" }).click();
}

function engineTrigger(page: Page) {
  return page
    .locator('[data-slot="field"]')
    .filter({ hasText: "Engine" })
    .first()
    .getByRole("combobox");
}

test("browser: croix10 preset library loads a composition from each series", async ({
  page,
}) => {
  // Ten presets, each with its own stability window.
  test.setTimeout(420_000);

  const session = await openCroix10(page);

  for (const label of PRESET_LABELS) {
    await chooseCroix10Option(page, "presets.active", label);
    await expectToolcraftProductObservableToChange(
      session,
      session.controlAction("presets.active", async () => {
        await loadPreset(page);
      }),
      { requirementId: "presets.active" },
    );
  }

  // The last preset is the Transchromie one, so the panel must be showing that
  // engine: the preset wrote a control value, not a hidden scene.
  await expect(engineTrigger(page)).toContainText("Transchromie");
});

test("browser: croix10 loading a preset writes control values and is one undo step", async ({
  page,
}) => {
  // Ten branches, one per preset, each with its own stability window.
  test.setTimeout(420_000);

  const session = await openCroix10(page);

  // An edit of our own first, so undo has something specific to restore.
  await prepareCroix10Slider(page, "stripe.count", 0.9);
  const bands = page.getByRole("slider", { name: "Bands" });
  const editedCount = await bands.getAttribute("aria-valuenow");

  await chooseCroix10Option(page, "presets.active", "Induction Grid");
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("presets.actions", async () => {
      await loadPreset(page);
    }),
    { requirementId: "presets.load" },
  );

  // The panel followed: Induction Grid selects a different engine, and its own
  // frequency control is now on screen with the preset's value.
  await expect(engineTrigger(page)).toContainText("Induction Chromatique");
  await expect(page.getByRole("slider", { name: "Line pairs" })).toHaveAttribute(
    "aria-valuenow",
    "240",
  );

  // One undo, not one per target: the whole preset is a single history step.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(engineTrigger(page)).toContainText("Couleur Additive");
  await expect(page.getByRole("slider", { name: "Bands" })).toHaveAttribute(
    "aria-valuenow",
    editedCount ?? "",
  );

  // And Load is reproved for every preset the selector offers, because the command
  // is only as good as the selection it acts on: a preset that loaded nothing would
  // otherwise hide behind the one that does.
  await proveCroix10ApplicabilityCases({
    act: () => loadPreset(page),
    evidence: "product-output",
    page,
    requirementId: "presets.load",
    session,
    target: "presets.actions",
  });
});
