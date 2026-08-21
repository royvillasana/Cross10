import { expect, type Page } from "@playwright/test";

import {
  openStudioSingleLayer,
  setStudioSelectValue,
  setStudioSlider,
  toggleStudioSwitch,
  STUDIO_PRODUCT_OUTPUT,
} from "./studio-product-helpers";
import { test } from "./toolcraft-product-test";

/**
 * Layer Print acceptance domain: the reprographic half of the subject.
 *
 * A screen decides how much of a mark is there, a grain decides how coarsely
 * the field is sampled, and quantization decides which of the layer's own inks
 * a colour becomes. None of them changes what the layer *is*, which is what
 * separates them from the treatment above and the engine below -- and is also
 * the property most of these proofs are really asserting.
 */

/** A row across the middle of the layer, finely enough sampled to count marks. */
async function readStudioPrintRow(page: Page): Promise<string[]> {
  return page.locator(STUDIO_PRODUCT_OUTPUT).evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl || canvas.width === 0) return [];
    const span = Math.floor(canvas.height * 0.4);
    const pixels = new Uint8Array(span * 4);
    gl.readPixels(
      Math.floor((canvas.width - span) / 2),
      Math.floor(canvas.height / 2),
      span,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    const row: string[] = [];
    for (let index = 0; index < span; index += 1) {
      const offset = index * 4;
      row.push(
        `${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]},${pixels[offset + 3]}`,
      );
    }
    return row;
  });
}

/** How many times the row changes colour, which is how many marks crossed it. */
function studioRunCount(row: readonly string[]): number {
  let runs = 0;
  for (let index = 1; index < row.length; index += 1) {
    if (row[index] !== row[index - 1]) runs += 1;
  }
  return runs;
}

test("browser: studio screen turns a tone into marks that let the stack through", async ({
  page,
}) => {
  test.setTimeout(240_000);

  await openStudioSingleLayer(page);
  /**
   * A ramp rather than the default band field, and the reason is the whole
   * technique.
   *
   * A screen turns *tone* into area. A two-ink black and white field has no
   * tone between its inks: white is fully covered and black is not covered at
   * all, so a screen over it produces the field back -- correctly, and
   * uselessly as evidence. It took a failing proof to notice, which is the
   * right way round.
   */
  await setStudioSelectValue(page, "selectedLayer.type", "Gradient");
  const plain = await readStudioPrintRow(page);
  expect(plain.length).toBeGreaterThan(10);

  /**
   * Turned off the axis being read, and that is a property of screens rather
   * than a convenience.
   *
   * A line screen at zero degrees runs *along* a horizontal row, so a row
   * sampled across the middle lies inside one band and comes back flat --
   * correctly, and saying nothing. It read as "line does nothing" until the
   * geometry was drawn out. Forty-five crosses the row for all three modes, so
   * one reading sees all of them.
   */
  // Set after a screen is chosen, because the angle only exists while there is
  // a screen to turn -- which is the applicability doing its job and was worth
  // one failed run to be reminded of.
  await setStudioSelectValue(page, "selectedLayer.halftone", "Dot");
  await setStudioSlider(page, "Screen angle", 45);

  const seen = new Map<string, string[]>();
  for (const mode of ["Dot", "Line", "Cross"]) {
    await setStudioSelectValue(page, "selectedLayer.halftone", mode);
    await expect
      .poll(async () => (await readStudioPrintRow(page)).join("|"), { timeout: 15_000 })
      .not.toBe(plain.join("|"));
    seen.set(mode, await readStudioPrintRow(page));
  }

  // Three screens, three different fields: each names its own way of cutting a
  // tone into marks rather than two of them being one screen relabelled.
  expect(
    new Set([...seen.values()].map((row) => row.join("|"))).size,
    "each screen must cut the tone differently",
  ).toBe(3);

  /**
   * The space between marks carries nothing, so what sits beneath shows
   * through.
   *
   * Read as the *ground* appearing rather than as transparency: the frame is
   * composited over an opaque background, so a gap is not an alpha of zero in
   * the readback, it is the background's own colour arriving where the layer
   * used to be. Asserting transparency here would have been asserting something
   * about a buffer rather than about the picture.
   */
  const ground = (row: readonly string[]): number =>
    row.filter((pixel) => pixel.startsWith("0,0,0,")).length;
  expect(ground(plain), "the layer covers the ground before it is screened").toBe(0);
  expect(
    ground(seen.get("Dot") ?? []),
    "a screen must let the ground back between its marks",
  ).toBeGreaterThan(0);

  // And None is the layer as it was, rather than a fourth screen.
  await setStudioSelectValue(page, "selectedLayer.halftone", "None");
  await expect
    .poll(async () => (await readStudioPrintRow(page)).join("|"), { timeout: 15_000 })
    .toBe(plain.join("|"));
});

test("browser: studio screen cell changes how many marks cover the layer", async ({
  page,
}) => {
  test.setTimeout(240_000);

  await openStudioSingleLayer(page);
  await setStudioSelectValue(page, "selectedLayer.halftone", "Dot");

  await setStudioSlider(page, "Screen cell", 40);
  const coarse = studioRunCount(await readStudioPrintRow(page));

  await setStudioSlider(page, "Screen cell", 6);
  await expect
    .poll(async () => studioRunCount(await readStudioPrintRow(page)), {
      timeout: 15_000,
    })
    .toBeGreaterThan(coarse);
});

test("browser: studio screen angle turns the screen without turning the layer", async ({
  page,
}) => {
  test.setTimeout(240_000);

  await openStudioSingleLayer(page);
  await setStudioSelectValue(page, "selectedLayer.halftone", "Line");
  await setStudioSlider(page, "Screen cell", 24);

  // A line screen at zero runs across the row being read, so the row crosses
  // many marks; turned a quarter turn it runs along it, and the row crosses
  // few. That difference is the screen turning rather than the layer.
  const across = studioRunCount(await readStudioPrintRow(page));
  await setStudioSlider(page, "Screen angle", 90);

  await expect
    .poll(async () => studioRunCount(await readStudioPrintRow(page)), {
      timeout: 15_000,
    })
    .not.toBe(across);
});

test("browser: studio sample grain reads the field in blocks", async ({ page }) => {
  test.setTimeout(240_000);

  await openStudioSingleLayer(page);
  // Enough bands that a coarse grain has something to lose.
  await setStudioSlider(page, "Band count", 48);
  const fine = await readStudioPrintRow(page);

  await setStudioSlider(page, "Sample grain", 32);
  const blocked = await readStudioPrintRow(page);
  expect(blocked.join("|")).not.toBe(fine.join("|"));

  // Blocks rather than a smear: the row is made of long identical runs, which
  // is what sampling once per block produces and what averaging the output
  // would not.
  expect(
    studioRunCount(blocked),
    "a coarse grain must produce fewer, longer runs than the field it read",
  ).toBeLessThan(studioRunCount(fine));

  // At zero it is the field again, so the control has an off rather than a
  // smallest setting.
  await setStudioSlider(page, "Sample grain", 0);
  await expect
    .poll(async () => (await readStudioPrintRow(page)).join("|"), { timeout: 15_000 })
    .toBe(fine.join("|"));
});

test("browser: studio quantization keeps only the inks the layer carries", async ({
  page,
}) => {
  test.setTimeout(240_000);

  await openStudioSingleLayer(page);
  // A ramp, because a band field is already flat inks and would satisfy this
  // without quantization doing anything -- the vacuous shape of this proof.
  await setStudioSelectValue(page, "selectedLayer.type", "Gradient");
  await setStudioSlider(page, "Colour slots", 3);

  const blended = new Set((await readStudioPrintRow(page)).map((pixel) => pixel));
  expect(
    blended.size,
    "a ramp must carry more colours than its slots before it is quantized",
  ).toBeGreaterThan(8);

  await toggleStudioSwitch(page, "selectedLayer.quantize");

  await expect
    .poll(
      async () => {
        const row = await readStudioPrintRow(page);
        // Ignore the ground the shape does not cover; the claim is about what
        // the layer draws.
        return new Set(row.filter((pixel) => !pixel.endsWith(",0"))).size;
      },
      { timeout: 15_000 },
    )
    .toBeLessThanOrEqual(3);
});

/**
 * Misregistration, which is a condition these techniques exploit rather than an
 * effect laid over them.
 *
 * The claim that matters is *how* the primaries separate. A blur of the colour
 * already computed would produce a fringe no plate could make; what a plate
 * out of register does is print the same image somewhere else, so the red
 * channel has to show the field genuinely displaced. That is why the layer is
 * read again at two positions rather than smeared, and why this proof checks
 * the direction follows the layer's own angle -- a fringe that ignored the
 * reading axis would be a filter rather than a misprint.
 */
test("browser: studio plate offset separates the primaries along the reading axis", async ({
  page,
}) => {
  test.setTimeout(240_000);

  await openStudioSingleLayer(page);
  const plain = await readStudioPrintRow(page);

  /** How far the row's channels disagree, which is what a split produces. */
  const fringe = (row: readonly string[]): number =>
    row.filter((pixel) => {
      const [red = 0, green = 0, blue = 0] = pixel.split(",").map(Number);
      return Math.max(red, green, blue) - Math.min(red, green, blue) > 30;
    }).length;

  // A grey field has no coloured pixels at all until the plates come apart.
  expect(fringe(plain), "the layer is unsplit before the offset is raised").toBe(0);

  await setStudioSlider(page, "Plate offset", 0.5);
  await expect
    .poll(async () => fringe(await readStudioPrintRow(page)), { timeout: 15_000 })
    .toBeGreaterThan(0);

  // The separation follows the axis the field is read on: turned a quarter
  // turn, the displacement runs along the sampled row rather than across it,
  // so the amount of fringe the row crosses changes.
  const across = fringe(await readStudioPrintRow(page));
  await setStudioSlider(page, "Angle", 90);
  await expect
    .poll(async () => fringe(await readStudioPrintRow(page)), { timeout: 15_000 })
    .not.toBe(across);

  // And zero is off rather than a smallest setting.
  await setStudioSlider(page, "Angle", 0);
  await setStudioSlider(page, "Plate offset", 0);
  await expect
    .poll(async () => (await readStudioPrintRow(page)).join("|"), { timeout: 15_000 })
    .toBe(plain.join("|"));
});
