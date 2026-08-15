import { expect, type Page } from "@playwright/test";

import { readStudioLayerIds, STUDIO_PRODUCT_OUTPUT } from "./studio-product-helpers";
import { STUDIO_PRESETS } from "../src/app/studio-presets";
import { test } from "./toolcraft-product-test";

/**
 * Onboarding acceptance domain.
 *
 * The flow is a product-authored modal, which no decision contract permits and
 * which the product owner asked for regardless; the reasoning is in
 * `studio-onboarding.ts`. Because no framework gate covers it, these proofs are
 * the only thing standing between the flow and a regression — so they read the
 * rendered page rather than product state wherever the two could disagree.
 *
 * The claim that matters most is the negative one: leaving the flow without
 * finishing must be indistinguishable from never having started it. A flow that
 * half-configured a canvas on the way out would leave a state nobody chose.
 */

const DIALOG = "[data-studio-onboarding]";

async function openFresh(page: Page, size = { height: 900, width: 1280 }): Promise<void> {
  await page.setViewportSize(size);
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();
}

async function readCanvasSize(page: Page): Promise<readonly [number, number]> {
  return page.locator(STUDIO_PRODUCT_OUTPUT).evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    return [canvas.width, canvas.height] as const;
  });
}

test("browser: studio opens on the flow and starts from a technique", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await openFresh(page);

  // The first thing met is what can be made, not a column of inputs.
  await expect(page.locator(DIALOG)).toHaveAttribute(
    "data-studio-onboarding",
    "choosing",
  );

  // Every entry is offered as a card, plus the blank start beside them.
  const cards = page.locator("[data-studio-onboarding-card]");
  await expect(cards).toHaveCount(STUDIO_PRESETS.length + 1);
  await expect(page.locator('[data-studio-onboarding-card="blank"]')).toBeVisible();

  const entry = STUDIO_PRESETS.find((preset) => preset.layers.length > 1);
  if (!entry) throw new Error("the library needs an entry of more than one layer");

  await page.locator(`[data-studio-onboarding-card="${entry.id}"]`).click();

  // Choosing moves the flow on and applies nothing yet: the canvas is still
  // empty, because sizing comes before building.
  await expect(page.locator(DIALOG)).toHaveAttribute("data-studio-onboarding", "sizing");
  expect(await readStudioLayerIds(page), "nothing is built until it is confirmed")
    .toHaveLength(0);

  await page.locator('[data-studio-onboarding-shape="portrait"]').click();
  await page.locator("[data-studio-onboarding-confirm]").click();

  // The canvas exists at the chosen size and renders the chosen construction.
  await expect(page.locator(DIALOG)).toHaveCount(0);
  await expect
    .poll(async () => readStudioLayerIds(page), { timeout: 15_000 })
    .toHaveLength(entry.layers.length);

  // 1080x1350 has no runtime aspect preset, so this also proves the shape landed
  // as real dimensions rather than being snapped to the nearest ratio.
  await expect
    .poll(async () => (await readCanvasSize(page))[0] / (await readCanvasSize(page))[1], {
      timeout: 15_000,
    })
    .toBeCloseTo(1080 / 1350, 2);
});

test("browser: studio starts from nothing when asked to", async ({ page }) => {
  test.setTimeout(180_000);

  await openFresh(page);
  await page.locator('[data-studio-onboarding-card="blank"]').click();
  await page.locator('[data-studio-onboarding-shape="square"]').click();
  await page.locator("[data-studio-onboarding-confirm]").click();

  await expect(page.locator(DIALOG)).toHaveCount(0);

  // A blank start builds nothing. Sizing it is the whole of what it does, which
  // is what "start from nothing" has to mean.
  expect(await readStudioLayerIds(page)).toHaveLength(0);
  const [width, height] = await readCanvasSize(page);
  expect(width / height).toBeCloseTo(1, 2);
});

test("browser: studio leaves the flow having created nothing", async ({ page }) => {
  test.setTimeout(180_000);

  await openFresh(page);
  const sizeBefore = await readCanvasSize(page);

  // Part-way through, then out. The negative claim: this must be
  // indistinguishable from never having opened it.
  await page.locator(`[data-studio-onboarding-card="${STUDIO_PRESETS[0]?.id}"]`).click();
  await expect(page.locator(DIALOG)).toHaveAttribute("data-studio-onboarding", "sizing");
  await page.keyboard.press("Escape");

  await expect(page.locator(DIALOG)).toHaveCount(0);
  expect(await readStudioLayerIds(page), "abandoning creates no layer").toHaveLength(0);
  expect(await readCanvasSize(page), "abandoning resizes nothing").toEqual(sizeBefore);

  // And the product is usable rather than blocked — the canvas is there and the
  // panels are reachable, which is the point of the flow being dismissable.
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();
  await expect(page.locator('[data-panel-type="controls"]')).toBeVisible();
});

test("browser: studio does not interrupt work already in progress", async ({ page }) => {
  test.setTimeout(180_000);

  await openFresh(page);
  await page.locator('[data-studio-onboarding-card="blank"]').click();
  await page.locator("[data-studio-onboarding-confirm]").click();
  await expect(page.locator(DIALOG)).toHaveCount(0);

  // Build something, then come back.
  await page.getByRole("button", { name: "Add layer" }).first().click();
  const trigger = page.getByRole("button", { name: "Add layer" }).first();
  if ((await trigger.getAttribute("aria-expanded")) === "true") {
    await page.getByText("Layer", { exact: true }).first().click();
  }
  await expect
    .poll(async () => (await readStudioLayerIds(page)).length, { timeout: 15_000 })
    .toBeGreaterThan(0);

  await page.reload();
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();
  await page.waitForTimeout(1500);

  // A returning author lands on their composition. The flow keys off whether
  // there is work rather than off a "seen it" marker, so this is the same rule
  // that opens it for someone who has not started.
  await expect(page.locator(DIALOG)).toHaveCount(0);
  expect(await readStudioLayerIds(page)).not.toHaveLength(0);
});
