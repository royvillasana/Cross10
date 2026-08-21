import { expect, type Page } from "@playwright/test";

import { STUDIO_HOOK_DEFAULT } from "../src/app/studio-hook";
import {
  openStudioSingleLayer,
  readStudioOutputSignature,
  setStudioSlider,
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

/**
 * The knobs, which are what became of "a declared uniform registers itself as a
 * control".
 *
 * That could not be built: the runtime takes its schema once at mount, so a
 * control nobody declared would have to be added by editing signed source, and
 * it would arrive with neither an inventory entry nor an acceptance row. A
 * fixed pool inverts the problem -- the controls exist and are proved, and what
 * an author writes is which of them their code reads.
 *
 * Four claims rather than four copies of one, because a pool can fail in four
 * ways: a knob that does nothing, knobs that move together, a knob that does
 * not survive being saved, and a knob that does not travel with the delivered
 * source.
 */
const READS_A = `vec3 hook(vec3 colour, vec2 uv, float loop) {
  return mix(colour, vec3(1.0, 0.0, 0.0), uHookA);
}`;

test("browser: studio hook parameter drives the frame from the author's code", async ({
  page,
}) => {
  test.setTimeout(240_000);

  await openStudioSingleLayer(page);
  await writeStudioHook(page, READS_A);
  const atZero = await readStudioOutputSignature(page);

  // The knob does whatever the chunk says it does. Nothing in the schema knows
  // that this one tints toward red -- that is the point of the pool.
  await setStudioSlider(page, "Your parameter A", 1);
  await expect
    .poll(async () => readStudioOutputSignature(page), { timeout: 20_000 })
    .not.toBe(atZero);
});

test("browser: studio hook parameters move independently of one another", async ({
  page,
}) => {
  test.setTimeout(240_000);

  await openStudioSingleLayer(page);
  await writeStudioHook(page, READS_A);
  const atZero = await readStudioOutputSignature(page);

  // B is not read by this chunk, so moving it must change nothing. A pool whose
  // knobs were one value would fail here rather than in the proof above.
  await setStudioSlider(page, "Your parameter B", 1);
  await expect
    .poll(async () => readStudioOutputSignature(page), { timeout: 20_000 })
    .toBe(atZero);

  await setStudioSlider(page, "Your parameter A", 1);
  await expect
    .poll(async () => readStudioOutputSignature(page), { timeout: 20_000 })
    .not.toBe(atZero);
});

test("browser: studio hook parameters survive a reload with the composition", async ({
  page,
}) => {
  test.setTimeout(240_000);

  await openStudioSingleLayer(page);
  await writeStudioHook(page, READS_A);
  await setStudioSlider(page, "Your parameter A", 1);
  const tinted = await readStudioOutputSignature(page);

  await page.reload();
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();

  // Both halves have to come back: the chunk and the value it reads. Either one
  // alone gives a frame the author did not leave.
  await expect
    .poll(async () => readStudioOutputSignature(page), { timeout: 20_000 })
    .toBe(tinted);
});

test("browser: studio hook parameters are baked into the delivered source", async ({
  page,
}) => {
  test.setTimeout(240_000);

  await openStudioSingleLayer(page);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await writeStudioHook(page, READS_A);
  await setStudioSlider(page, "Your parameter A", 0.5);

  await page.getByRole("button", { name: "Copy shader source" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());

  // The chunk travels, which is what makes a hand-editable shader and one-way
  // delivery complements rather than alternatives.
  expect(copied).toContain("vec3 hook(vec3 colour");
  // And so does the knob's value, baked like every other: a recipient supplies
  // nothing.
  expect(copied).toMatch(/const float uHookA = 0\.5/u);
  expect(copied).not.toContain("uniform float uHookA;");
});
