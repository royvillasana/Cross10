import { expect, type Page } from "@playwright/test";

import { STUDIO_HOOK_DEFAULT } from "../src/app/studio-hook";
import {
  openStudioSingleLayer,
  readStudioOutputSignature,
  STUDIO_PRODUCT_OUTPUT,
} from "./studio-product-helpers";
import { test } from "./toolcraft-product-test";

/**
 * The author's own chunk, which is the one value in this product that can be
 * *wrong*.
 *
 * Every other control has a domain the schema guarantees; a slider cannot be
 * set to something that fails to compile. So the claims here are as much about
 * what happens when the code is bad as about what happens when it is good --
 * an editor that blanks the canvas on a missing semicolon is a trapdoor rather
 * than an editor.
 */
const EDITOR = '[data-toolcraft-control-target="stack.hookSource"] textarea';

/** Types a chunk into the editor, replacing whatever was there. */
async function writeStudioHook(page: Page, source: string): Promise<void> {
  const editor = page.locator(EDITOR).first();
  await editor.click();
  await editor.press("ControlOrMeta+a");
  await editor.fill(source);
  // The control applies while typing, so the blur is not what commits it --
  // it is here so the next assertion is not racing the last keystroke.
  await editor.blur();
}

test("browser: studio hook compiles onto the canvas and survives being wrong", async ({
  page,
}) => {
  test.setTimeout(240_000);

  await openStudioSingleLayer(page);
  const shipped = await readStudioOutputSignature(page);
  expect(shipped).not.toBe("nogl");

  /**
   * A chunk that compiles changes the frame, which is the whole claim: the
   * author's code is part of the program the stack assembles rather than a
   * note beside it.
   *
   * Inversion rather than a channel swap, and that took a failing run to
   * notice: the default stack is a black and white band field, and swapping
   * the channels of a grey is the same grey. The edit has to be one the fixture
   * can actually show.
   */
  await writeStudioHook(
    page,
    `vec3 hook(vec3 colour, vec2 uv, float loop) {
  return 1.0 - colour;
}`,
  );
  await expect
    .poll(async () => readStudioOutputSignature(page), { timeout: 20_000 })
    .not.toBe(shipped);
  const swapped = await readStudioOutputSignature(page);

  // Broken code keeps the last good program on screen rather than blanking the
  // canvas, and says what is wrong.
  await writeStudioHook(
    page,
    `vec3 hook(vec3 colour, vec2 uv, float loop) {
  return colour
}`,
  );

  const message = page.locator("[data-studio-hook-error]");
  await expect(message).toBeVisible({ timeout: 20_000 });
  expect(
    await readStudioOutputSignature(page),
    "a chunk that will not compile must leave the last good program drawing",
  ).toBe(swapped);

  // The line number is counted from the first line of the editor rather than
  // from the assembled program, which is several hundred lines the author never
  // wrote. A message pointing into those tells them the error is somewhere they
  // cannot look.
  const text = (await message.textContent()) ?? "";
  const reported = /line (\d+):/u.exec(text);
  expect(reported, `the message should locate the error: ${text}`).not.toBeNull();
  expect(Number(reported?.[1])).toBeLessThanOrEqual(4);

  // Fixing it takes over again, and the message goes.
  await writeStudioHook(
    page,
    `vec3 hook(vec3 colour, vec2 uv, float loop) {
  return 1.0 - colour;
}`,
  );
  await expect(message).toHaveCount(0, { timeout: 20_000 });
  expect(await readStudioOutputSignature(page)).toBe(swapped);
});

test("browser: studio hook reset returns the shipped code and the frame with it", async ({
  page,
}) => {
  test.setTimeout(240_000);

  await openStudioSingleLayer(page);
  const shipped = await readStudioOutputSignature(page);

  await writeStudioHook(
    page,
    `vec3 hook(vec3 colour, vec2 uv, float loop) {
  return 1.0 - colour;
}`,
  );
  await expect
    .poll(async () => readStudioOutputSignature(page), { timeout: 20_000 })
    .not.toBe(shipped);

  await page
    .locator('[data-toolcraft-control-target="stack.hookReset"]')
    .getByRole("button", { name: "Restore the shipped code" })
    .first()
    .click();

  // The frame comes back, and so does the shipped source -- the editor holds
  // the pass-through rather than being emptied, because an empty editor says
  // "type something" and nothing about what.
  await expect
    .poll(async () => readStudioOutputSignature(page), { timeout: 20_000 })
    .toBe(shipped);
  expect(await page.locator(EDITOR).first().inputValue()).toBe(STUDIO_HOOK_DEFAULT);
});
