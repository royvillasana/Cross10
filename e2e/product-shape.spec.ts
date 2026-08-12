import type { Page } from "@playwright/test";

import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { proveCroix10ApplicabilityCases } from "./croix10-applicability-harness";
import {
  CROIX10_PRODUCT_OUTPUT,
  chooseCroix10Option,
  jumpCroix10Slider,
  openCroix10,
  prepareCroix10Slider,
  readCroix10FieldSignature,
} from "./croix10-product-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Embedded shape acceptance domain.
 *
 * The shape has no fill of its own — it is a perturbation of the band field — so
 * every proof needs wide bands to displace and a non-zero strength before the
 * outline is legible at all.
 *
 * Fixture setup happens before a reload, not before a measurement. Revealing the
 * shape controls grows the control panel, which shifts the canvas element by a
 * fraction of a pixel, and an element screenshot resamples across that shift. Doing
 * the reveal, letting persistence commit, and then reloading means the panel is
 * already at its final size on the first paint the proof ever sees.
 *
 * Each control is then reproved in every branch of its peers — each outline, and each
 * perturbation mode — because the branches are what applicability claims, and a
 * control that is present but inert in one branch is exactly the defect that claim is
 * meant to exclude.
 */

const RUNTIME_APP = '[data-slot="toolcraft-runtime-app"]';

/**
 * Applies a fixture, waits for it to be persisted, then reloads into it.
 *
 * The returned session is created after the reload, so its baseline is sampled
 * against a settled layout rather than one the setup is still reflowing.
 */
async function openCroix10WithShapeFixture(
  page: Page,
  setup: () => Promise<void>,
): Promise<Awaited<ReturnType<typeof openCroix10>>> {
  await page.goto("/");
  await expect(page.locator(CROIX10_PRODUCT_OUTPUT)).toBeVisible();

  // Very few, very wide bands: a displacement of half a band is then obvious.
  await prepareCroix10Slider(page, "stripe.count", 0.02);
  await setup();

  await expect(page.locator(RUNTIME_APP)).toHaveAttribute(
    "data-toolcraft-persistence-status",
    "success",
  );

  return openCroix10(page);
}

async function chooseOutline(page: Page, label: string): Promise<void> {
  await chooseCroix10Option(page, "shape.kind", label);
}

/** A visible shape: an outline, and enough strength to displace the bands. */
async function revealShape(page: Page): Promise<void> {
  await chooseOutline(page, "Circle");
  await jumpCroix10Slider(
    await getToolcraftControlFieldByTarget(page, "shape.strength"),
    "End",
  );
}

async function sweep(page: Page, target: string, index: number): Promise<void> {
  await jumpCroix10Slider(
    await getToolcraftControlFieldByTarget(page, target),
    index % 2 === 0 ? "End" : "Home",
  );
}

test("browser: croix10 shape outline selection reveals the perturbation controls", async ({
  page,
}) => {
  test.setTimeout(240_000);

  const session = await openCroix10WithShapeFixture(page, () =>
    revealShape(page),
  );

  // Presence case for the gate: the outline's own controls are here.
  await expect(
    page.getByRole("slider", { name: "Shape strength" }),
  ).toBeVisible();

  await proveCroix10ApplicabilityCases({
    // Each outline is a different distance function, so alternating between two of
    // them moves the bands differently every time.
    act: (index) => chooseOutline(page, index % 2 === 0 ? "Ellipse" : "Circle"),
    evidence: "product-output",
    page,
    requirementId: "shape.kind",
    session,
    target: "shape.kind",
  });

  // Absence proof for the whole surface: choosing None removes the shape entirely.
  await chooseOutline(page, "None");
  await expect(page.getByRole("slider", { name: "Shape strength" })).toHaveCount(
    0,
  );
  await expect(page.getByText("Perturbs", { exact: true })).toHaveCount(0);
});

test("browser: croix10 shape strength reveals the shape and zero restores the plain field", async ({
  page,
}) => {
  test.setTimeout(300_000);

  const session = await openCroix10WithShapeFixture(page, () =>
    chooseOutline(page, "Circle"),
  );

  // The unperturbed field, in backing bytes, from a layout that has not moved
  // since first paint.
  const unperturbed = await readCroix10FieldSignature(page);
  expect(unperturbed).not.toBe("no-webgl2");

  await proveCroix10ApplicabilityCases({
    act: (index) => sweep(page, "shape.strength", index),
    evidence: "rendered-pixels",
    page,
    requirementId: "shape.strength",
    session,
    target: "shape.strength",
  });

  // And back at zero it is not there at all: the shape has no fill of its own, so
  // the render is the same render, byte for byte. Checked with the outline the
  // fixture started from, so the comparison is against the same field.
  await chooseOutline(page, "Circle");
  await jumpCroix10Slider(
    await getToolcraftControlFieldByTarget(page, "shape.strength"),
    "Home",
  );
  await expect
    .poll(() => readCroix10FieldSignature(page), { timeout: 15_000 })
    .toBe(unperturbed);
});

test("browser: croix10 shape perturbation mode switches between phase and width", async ({
  page,
}) => {
  test.setTimeout(240_000);

  const session = await openCroix10WithShapeFixture(page, () =>
    revealShape(page),
  );

  await proveCroix10ApplicabilityCases({
    act: (index) =>
      chooseCroix10Option(page, "shape.mode", index % 2 === 0 ? "Width" : "Phase"),
    evidence: "product-output",
    page,
    requirementId: "shape.mode",
    session,
    target: "shape.mode",
  });
});

test("browser: croix10 shape size changes how much of the field is perturbed", async ({
  page,
}) => {
  test.setTimeout(300_000);

  const session = await openCroix10WithShapeFixture(page, () =>
    revealShape(page),
  );

  await proveCroix10ApplicabilityCases({
    act: (index) => sweep(page, "shape.size", index),
    evidence: "product-output",
    page,
    requirementId: "shape.size",
    session,
    target: "shape.size",
  });
});
