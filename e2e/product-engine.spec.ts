import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import {
  chooseCroix10Engine as chooseEngine,
  dragCroix10Slider,
  jumpCroix10Slider,
  openCroix10,
} from "./croix10-product-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Engine acceptance domain.
 *
 * The engine selector is the deliberate cross-entity applicability exception: it
 * gates controls in other sections, so the harness derives no presence or absence
 * cases for it and this named test is the proof instead.
 */

test("browser: croix10 engine selection switches the rendered chromatic grammar", async ({
  page,
}) => {
  // Four option proofs plus the absence checks, each with its own stability
  // window, do not fit the default per-test budget.
  test.setTimeout(300_000);

  const session = await openCroix10(page);

  for (const label of [
    "Physichromie",
    "Induction Chromatique",
    "Chromosaturation",
    "Chromointerférence",
    "Transchromie",
    "Couleur Additive",
  ]) {
    await expectToolcraftProductObservableToChange(
      session,
      session.controlAction("engine.active", async () => {
        await chooseEngine(page, label);
      }),
      { requirementId: "engine.active" },
    );
  }

  // Absence proof for the cross-entity gate: Chromosaturation has no stripe
  // structure, so every stripe control must be gone rather than inert.
  await chooseEngine(page, "Chromosaturation");
  await expect(page.getByText("Stripe Field", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Band Sequence", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Field Immersion", { exact: true })).toBeVisible();

  // Transchromie has no band structure either: it is a stack of sheets, so the
  // stripe sections must be absent under it and its own sections present.
  await chooseEngine(page, "Transchromie");
  await expect(page.getByText("Stripe Field", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Translucent Planes", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Plane Stacking", { exact: true })).toBeVisible();

  // And they return when a stripe engine is selected again.
  await chooseEngine(page, "Couleur Additive");
  await expect(page.getByText("Stripe Field", { exact: true })).toBeVisible();
  await expect(page.getByText("Field Immersion", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Translucent Planes", { exact: true }),
  ).toHaveCount(0);
});
