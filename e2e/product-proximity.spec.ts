import type { Page } from "@playwright/test";

import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { proveCroix10ApplicabilityCases } from "./croix10-applicability-harness";
import {
  CROIX10_PRODUCT_OUTPUT,
  chooseCroix10Option,
  jumpCroix10Slider,
  openCroix10,
  readCroix10FieldSignature,
  settleCroix10Field,
} from "./croix10-product-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Cursor field acceptance domain.
 *
 * The hotspot is committed state written only by the canvas (R44), so every proof
 * places it the way a person does — a pointer gesture over the product surface,
 * ending in a release — rather than by writing a value. There is no panel control
 * to drive, and that absence is the point of the design.
 */

/** Places the hotspot at a fraction of the canvas, gesture and all. */
async function placeCroix10Hotspot(
  page: Page,
  fractionX: number,
  fractionY: number,
): Promise<void> {
  const canvas = page.locator(CROIX10_PRODUCT_OUTPUT);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("The product canvas must be visible to place a hotspot.");
  const x = box.x + box.width * fractionX;
  const y = box.y + box.height * fractionY;
  await page.mouse.move(x, y);
  await page.mouse.move(x, y);
  await page.mouse.up();
  await settleCroix10Field(page);
}

/** Drives the cursor field switch to a known state. */
async function setCursorField(page: Page, on: boolean): Promise<void> {
  const field = await getToolcraftControlFieldByTarget(page, "proximity.enabled");
  const toggle = field.getByRole("switch");
  if ((await toggle.getAttribute("aria-checked")) !== String(on)) await toggle.click();
  await settleCroix10Field(page);
}

/** Opens Croix10 with the ramp active and the cursor field switched on. */
async function openCroix10WithCursorField(page: Page) {
  const session = await openCroix10(page);
  await chooseCroix10Option(page, "ramp.source", "Continuous");
  await setCursorField(page, true);
  return session;
}

test("browser: croix10 cursor field switch reveals its shape controls", async ({
  page,
}) => {
  test.setTimeout(300_000);

  const session = await openCroix10(page);
  await chooseCroix10Option(page, "ramp.source", "Continuous");

  // Off is not merely "no controls": with the switch off the strength collapses
  // to zero, so the field must be the same render a placed hotspot cannot touch.
  const beforeEnable = await readCroix10FieldSignature(page);
  expect(beforeEnable).not.toBe("no-webgl2");
  await placeCroix10Hotspot(page, 0.25, 0.5);
  expect(await readCroix10FieldSignature(page)).toBe(beforeEnable);

  // The switch has to be left on between cases: its own peer selectors — the
  // shape controls it gates — only exist while it is, and a case that had to
  // drive a control the previous case removed could not run at all.
  await setCursorField(page, true);
  await jumpCroix10Slider(
    await getToolcraftControlFieldByTarget(page, "proximity.strength"),
    "End",
  );
  await placeCroix10Hotspot(page, 0.25, 0.5);

  await proveCroix10ApplicabilityCases({
    act: () => setCursorField(page, false),
    evidence: "rendered-pixels",
    page,
    requirementId: "proximity.enabled",
    restore: () => setCursorField(page, true),
    session,
    target: "proximity.enabled",
  });
});

const SHAPE_ROWS = [
  {
    act: async (page: Page, index: number) => {
      await jumpCroix10Slider(
        await getToolcraftControlFieldByTarget(page, "proximity.radius"),
        index % 2 === 0 ? "End" : "Home",
      );
    },
    name: "browser: croix10 cursor field reach bounds the disturbance",
    target: "proximity.radius",
  },
  {
    act: async (page: Page, index: number) => {
      await jumpCroix10Slider(
        await getToolcraftControlFieldByTarget(page, "proximity.strength"),
        index % 2 === 0 ? "End" : "Home",
      );
    },
    name: "browser: croix10 cursor field push displaces the ramp",
    target: "proximity.strength",
  },
  {
    act: async (page: Page, index: number) => {
      await chooseCroix10Option(
        page,
        "proximity.falloff",
        index % 2 === 0 ? "Sharply" : "Gently",
      );
    },
    name: "browser: croix10 cursor field falloff shapes the disturbance",
    target: "proximity.falloff",
  },
] as const;

for (const row of SHAPE_ROWS) {
  test(row.name, async ({ page }) => {
    test.setTimeout(300_000);

    const session = await openCroix10WithCursorField(page);
    // A hotspot away from the centre, so the disturbance is somewhere the
    // undisturbed ramp is not already changing fastest.
    await placeCroix10Hotspot(page, 0.25, 0.5);

    await proveCroix10ApplicabilityCases({
      act: (index) => row.act(page, index),
      evidence: "rendered-pixels",
      page,
      requirementId: row.target,
      session,
      target: row.target,
    });
  });
}

/**
 * App-owned rather than acceptance-derived.
 *
 * What this proves is the commit contract itself — that the gesture writes state
 * and the artifact renders what state holds — which is a property of the hotspot
 * rather than of any control, and there is no acceptance `kind` for it. Same
 * route the keyboard accelerator took (0.18a).
 */
test("browser: croix10 committed hotspot survives reload and reaches the export", async ({
  page,
}) => {
  test.setTimeout(300_000);

  await openCroix10WithCursorField(page);
  await jumpCroix10Slider(
    await getToolcraftControlFieldByTarget(page, "proximity.strength"),
    "End",
  );
  await settleCroix10Field(page);

  const undisturbed = await readCroix10FieldSignature(page);
  await placeCroix10Hotspot(page, 0.2, 0.5);
  const disturbed = await readCroix10FieldSignature(page);
  expect(disturbed).not.toBe(undisturbed);

  // The gesture wrote state rather than a live pointer read: after a reload, with
  // no pointer anywhere near the canvas, the composition is the one the gesture
  // committed. A transient hotspot would come back undisturbed here.
  await page.reload();
  await settleCroix10Field(page);
  expect(await readCroix10FieldSignature(page)).toBe(disturbed);
});
