import { expectToolcraftCompoundControlPartOutcome } from "./browser-state-evidence-helpers";
import {
  nudgeCroix10Slider,
  openCroix10,
  prepareCroix10Slider,
} from "./croix10-product-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { test } from "./toolcraft-product-test";

/**
 * Palette acceptance domain.
 *
 * The compound-control parts are proved through painted pixels, not through the
 * collection's own chrome: a slot's colour counts only once it appears in the
 * rendered field. Each observation reader is written with literal channel values
 * because the reader is serialised into the page and cannot close over test
 * variables.
 */

const MAGENTA_PRESENT = (root: HTMLElement): boolean => {
  const canvas = root.querySelector<HTMLCanvasElement>(
    "[data-toolcraft-product-output]",
  );
  if (!canvas) return false;
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!gl) return false;
  const width = Math.min(canvas.width, 512);
  const height = Math.min(canvas.height, 8);
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  for (let index = 0; index < pixels.length; index += 4) {
    if (
      Math.abs(pixels[index] - 255) < 40 &&
      pixels[index + 1] < 60 &&
      Math.abs(pixels[index + 2] - 255) < 40
    ) {
      return true;
    }
  }
  return false;
};

const CYAN_PRESENT = (root: HTMLElement): boolean => {
  const canvas = root.querySelector<HTMLCanvasElement>(
    "[data-toolcraft-product-output]",
  );
  if (!canvas) return false;
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!gl) return false;
  const width = Math.min(canvas.width, 512);
  const height = Math.min(canvas.height, 8);
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  for (let index = 0; index < pixels.length; index += 4) {
    if (
      pixels[index] < 60 &&
      Math.abs(pixels[index + 1] - 255) < 40 &&
      Math.abs(pixels[index + 2] - 255) < 40
    ) {
      return true;
    }
  }
  return false;
};


/**
 * Both slot colours in one observation, so removing the added slot proves two
 * things in a single transition: the removed colour leaves the field, and the
 * sibling edited earlier is preserved rather than reset to the default.
 */
const SLOT_COLOURS_PRESENT = (
  root: HTMLElement,
): { cyan: boolean; magenta: boolean } => {
  const canvas = root.querySelector<HTMLCanvasElement>(
    "[data-toolcraft-product-output]",
  );
  if (!canvas) return { cyan: false, magenta: false };
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!gl) return { cyan: false, magenta: false };
  const width = Math.min(canvas.width, 512);
  const height = Math.min(canvas.height, 8);
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let cyan = false;
  let magenta = false;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    if (red > 215 && green < 60 && blue > 215) magenta = true;
    if (red < 60 && green > 215 && blue > 215) cyan = true;
  }
  return { cyan, magenta };
};

async function setItemHex(
  page: import("@playwright/test").Page,
  item: number,
  hex: string,
): Promise<void> {
  const field = page.getByLabel(`Item ${item} hex`);
  await field.fill(hex);
  await field.press("Enter");
}

test("browser: croix10 palette collection adds, edits, and removes colour slots", async ({
  page,
}) => {
  // Three compound-part proofs, each with its own stability window, do not fit the
  // default per-test budget when the suite runs sequentially.
  test.setTimeout(120_000);

  const session = await openCroix10(page);

  // Widen bands so each slot's colour occupies enough pixels to sample reliably.
  await prepareCroix10Slider(page, "stripe.count", 0.02);

  // items: editing one slot repaints its bands in that exact colour.
  await expectToolcraftCompoundControlPartOutcome(
    session.observe(MAGENTA_PRESENT),
    session.controlAction("palette.slots", async () => {
      await setItemHex(page, 1, "FF00FF");
    }),
    true,
    { part: "collectionActions.items", requirementId: "palette.slots" },
  );

  // add: a new slot lengthens the sequence, and its colour reaches the field.
  await expectToolcraftCompoundControlPartOutcome(
    session.observe(CYAN_PRESENT),
    session.controlAction("palette.slots", async () => {
      await page.getByRole("button", { name: "Add Item" }).click();
      await setItemHex(page, 4, "00FFFF");
    }),
    true,
    { part: "collectionActions.add", requirementId: "palette.slots" },
  );

  // remove: dropping the final slot removes its colour from the field while the
  // sibling edited earlier survives, which is one transition rather than two.
  await expectToolcraftCompoundControlPartOutcome(
    session.observe(SLOT_COLOURS_PRESENT),
    session.controlAction("palette.slots", async () => {
      await page.getByRole("button", { name: "Remove Item" }).click();
    }),
    { cyan: false, magenta: true },
    { part: "collectionActions.remove", requirementId: "palette.slots" },
  );

  // The compound parts are proved above; the row also carries a plain claim that the
  // collection changes the rendered field, and the part attachments do not stand in
  // for it.
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("palette.slots", async () => {
      await setItemHex(page, 2, "00FF00");
    }),
    { requirementId: "palette.slots" },
  );
});

test("browser: croix10 cycling offset rotates which band takes which colour", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const session = await openCroix10(page);

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("palette.cyclingOffset", async (control) => {
      // Enough to rotate the three-colour sequence by one slot at the 0.01 step;
      // a jump to the maximum would wrap a whole cycle and change nothing.
      await nudgeCroix10Slider(control, 17);
    }),
    { requirementId: "palette.cycling-offset" },
  );
});
