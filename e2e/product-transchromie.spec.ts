import type { Page } from "@playwright/test";

import { expectToolcraftCompoundControlPartOutcome } from "./browser-state-evidence-helpers";
import {
  CROIX10_PRODUCT_OUTPUT,
  chooseCroix10Engine,
  chooseCroix10Option,
  openCroix10,
} from "./croix10-product-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Transchromie acceptance domain.
 *
 * A plane is a sheet of transparent colour, so it can only be proved through what
 * the light does after passing it: an opaque black sheet drives everything under it
 * to exactly zero, which is the one outcome no combination of other filters can
 * fake. Each part proof therefore turns one sheet black and reads whether specific
 * quadrants of the composition went to pure black.
 *
 * Selecting the engine swaps whole sections in the panel, so every proof selects it,
 * lets persistence commit, and reloads, leaving the layout settled before any
 * measurement.
 */

const RUNTIME_APP = '[data-slot="toolcraft-runtime-app"]';

/**
 * Pure black at each quadrant centre.
 *
 * Written with literal fractions and thresholds because the reader is serialised
 * into the page and cannot close over test variables. Single-pixel reads rather
 * than a whole-buffer scan: the claim is about which regions a sheet covers, and
 * the backing buffer is 3840x2160.
 */
const QUADRANT_BLACKNESS = (
  root: HTMLElement,
): { bl: boolean; br: boolean; tl: boolean; tr: boolean } => {
  const canvas = root.querySelector<HTMLCanvasElement>(
    "[data-toolcraft-product-output]",
  );
  const blank = { bl: false, br: false, tl: false, tr: false };
  if (!canvas) return blank;
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!gl) return blank;
  const isBlack = (fractionX: number, fractionY: number): boolean => {
    const pixel = new Uint8Array(4);
    gl.readPixels(
      Math.floor(canvas.width * fractionX),
      Math.floor(canvas.height * fractionY),
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixel,
    );
    return pixel[0] < 8 && pixel[1] < 8 && pixel[2] < 8;
  };
  return {
    bl: isBlack(0.25, 0.25),
    br: isBlack(0.75, 0.25),
    tl: isBlack(0.25, 0.75),
    tr: isBlack(0.75, 0.75),
  };
};

async function openCroix10WithPlanes(
  page: Page,
): Promise<Awaited<ReturnType<typeof openCroix10>>> {
  await page.goto("/");
  await expect(page.locator(CROIX10_PRODUCT_OUTPUT)).toBeVisible();
  await chooseCroix10Engine(page, "Transchromie");
  await expect(page.locator(RUNTIME_APP)).toHaveAttribute(
    "data-toolcraft-persistence-status",
    "success",
  );
  return openCroix10(page);
}

/**
 * Addresses one plane's fields. `exact` matters: the runtime's own background
 * colour field is named "Background color hex", which a substring match on
 * "Color hex" would also select.
 */
function planeHex(page: Page, index: number) {
  return page
    .getByRole("textbox", { name: "Color hex", exact: true })
    .nth(index);
}

function planeSlider(page: Page, name: "Opacity" | "Rotation", index: number) {
  return page.getByRole("slider", { name, exact: true }).nth(index);
}

/** Turns one sheet into an opaque black filter, which zeroes whatever it covers. */
async function blackenPlane(page: Page, index: number): Promise<void> {
  const hex = planeHex(page, index);
  await hex.fill("000000");
  await hex.press("Enter");
  const opacity = planeSlider(page, "Opacity", index);
  await opacity.focus();
  await opacity.press("End");
}

/**
 * Luminance where the sheets overlap most, against the average where they overlap
 * least.
 *
 * Whole-field mean luminance cannot tell the two stacking modes apart, and it was
 * wrong to expect it to: additive clips its overlaps towards white while leaving
 * uncovered ground black, and subtractive does the reverse, so the two averages come
 * out within a couple of counts of each other. The claim that actually distinguishes
 * them is local — an overlap is darker than the sheets crossing it under
 * subtractive, and brighter under additive — so that is what this measures. The
 * centre is where all three default sheets cross.
 */
async function readCroix10OverlapContrast(
  page: Page,
): Promise<{ overlap: number; surroundings: number }> {
  return page.locator(CROIX10_PRODUCT_OUTPUT).evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) return { overlap: -1, surroundings: -1 };
    const luminanceAt = (fractionX: number, fractionY: number): number => {
      const pixel = new Uint8Array(4);
      gl.readPixels(
        Math.floor(canvas.width * fractionX),
        Math.floor(canvas.height * fractionY),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel,
      );
      return pixel[0] * 0.2126 + pixel[1] * 0.7152 + pixel[2] * 0.0722;
    };
    const quadrants = [
      luminanceAt(0.25, 0.25),
      luminanceAt(0.75, 0.25),
      luminanceAt(0.25, 0.75),
      luminanceAt(0.75, 0.75),
    ];
    return {
      overlap: luminanceAt(0.5, 0.5),
      surroundings:
        quadrants.reduce((total, value) => total + value, 0) / quadrants.length,
    };
  });
}

test("browser: croix10 plane collection adds, edits, and removes translucent planes", async ({
  page,
}) => {
  // Three compound-part proofs, each with its own stability window.
  test.setTimeout(180_000);

  const session = await openCroix10WithPlanes(page);

  // items: turning the first sheet into an opaque black filter drives the half of
  // the composition it covers to exactly zero, and leaves the rest alone.
  await expectToolcraftCompoundControlPartOutcome(
    session.observe(QUADRANT_BLACKNESS),
    session.controlAction("transchromie.planes", async () => {
      await blackenPlane(page, 0);
    }),
    { bl: true, br: false, tl: true, tr: false },
    { part: "collectionActions.items", requirementId: "transchromie.planes" },
  );

  // add: a fourth sheet, turned face down, blacks out the upper half as well —
  // a region no existing sheet reaches, so only the new record can explain it.
  await expectToolcraftCompoundControlPartOutcome(
    session.observe(QUADRANT_BLACKNESS),
    session.controlAction("transchromie.planes", async () => {
      await page.getByRole("button", { name: "Add plane" }).click();
      await blackenPlane(page, 3);
      const rotation = planeSlider(page, "Rotation", 3);
      await rotation.focus();
      await rotation.press("End");
    }),
    { bl: true, br: false, tl: true, tr: true },
    { part: "collectionActions.add", requirementId: "transchromie.planes" },
  );

  // remove: dropping the last sheet restores the upper right while the sheet
  // edited earlier stays black, so one transition proves both the removal and
  // that siblings were preserved rather than reset.
  await expectToolcraftCompoundControlPartOutcome(
    session.observe(QUADRANT_BLACKNESS),
    session.controlAction("transchromie.planes", async () => {
      await page.getByRole("button", { name: "Remove Plane" }).click();
    }),
    { bl: true, br: false, tl: true, tr: false },
    { part: "collectionActions.remove", requirementId: "transchromie.planes" },
  );

  // And the row's plain claim: editing the collection changes the composite. The part
  // attachments prove add, edit, and remove; they do not stand in for this.
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("transchromie.planes", async () => {
      const rotation = planeSlider(page, "Rotation", 1);
      await rotation.focus();
      await rotation.press("End");
    }),
    { requirementId: "transchromie.planes" },
  );
});

test("browser: croix10 plane stacking switches between subtractive and additive light", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const session = await openCroix10WithPlanes(page);

  const beforeSwitch = await readCroix10OverlapContrast(page);

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("transchromie.blendMode", async () => {
      await chooseCroix10Option(page, "transchromie.blendMode", "Additive");
    }),
    { requirementId: "transchromie.blend-mode" },
  );
  const additive = await readCroix10OverlapContrast(page);

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("transchromie.blendMode", async () => {
      await chooseCroix10Option(page, "transchromie.blendMode", "Subtractive");
    }),
    { requirementId: "transchromie.blend-mode" },
  );
  const subtractive = await readCroix10OverlapContrast(page);

  // Subtractive: each sheet is a filter, so three of them crossing transmit less
  // than any one of them does.
  expect(subtractive.overlap).toBeLessThan(subtractive.surroundings);
  // Additive: each sheet contributes its own light, so the same crossing is the
  // brightest place in the composition.
  expect(additive.overlap).toBeGreaterThan(additive.surroundings);
  // And the mode is a property of the stack, not a one-way door.
  expect(subtractive.overlap).toBeCloseTo(beforeSwitch.overlap, 0);
});
