import { expect, type Page } from "@playwright/test";

import {
  openStudioSingleLayer,
  readStudioLayerIds,
  readStudioStackSignature,
  setStudioSelectValue,
  setStudioSlider,
  STUDIO_PRODUCT_OUTPUT,
} from "./studio-product-helpers";
import { STUDIO_PRESETS } from "../src/app/studio-presets";
import { expectToolcraftAcceptanceOutcome } from "./browser-acceptance-outcome-helpers";
import {
  expectToolcraftProductObservableToChange,
  getToolcraftProductObservableSnapshot,
} from "./product-observable-helpers";
import { test } from "./toolcraft-product-test";

/**
 * Gallery acceptance domain.
 *
 * The library is the one place in this product where ten separate compositions
 * claim to be compositions, so the proof walks all of them rather than sampling
 * two. A preset that failed to render would look exactly like one nobody had
 * proved, and the reading below is chosen to catch precisely that: the stack the
 * renderer assembled, the rows the panel shows, and whether the frame carries
 * more than one colour.
 */

/** The names the panel is showing, top row first. */
async function readStudioLayerNames(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-layer-id]")).map((row) =>
      (row.textContent ?? "").trim(),
    ),
  );
}

/** How many distinct colours the middle row carries, which is what "drew" means. */
async function readStudioColourVariety(page: Page): Promise<number> {
  return page.locator(STUDIO_PRODUCT_OUTPUT).evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) return 0;
    const width = Math.min(canvas.width, 600);
    const pixels = new Uint8Array(width * 4);
    gl.readPixels(
      Math.floor((canvas.width - width) / 2),
      Math.floor(canvas.height / 2),
      width,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    const seen = new Set<string>();
    for (let index = 0; index < pixels.length; index += 4) {
      seen.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
    }
    return seen.size;
  });
}

/**
 * Waits until the frame stops changing.
 *
 * The evidence helper requires a baseline that holds still before the action --
 * rightly, since a canvas that was already moving could produce a "change" that
 * had nothing to do with the press. Under a loaded suite the first frames after
 * a fixture is built are still settling, so the wait is explicit rather than
 * assumed: two consecutive reads that agree.
 */
async function settleStudioOutput(page: Page): Promise<void> {
  const recent: string[] = [];
  await expect
    .poll(
      async () => {
        recent.push(await getToolcraftProductObservableSnapshot(page));
        if (recent.length > 3) recent.shift();
        // Three in a row rather than two, and over a window rather than back to
        // back: the frames that move under a loaded suite are the ones a
        // resize or a first draw is still catching up with, and two adjacent
        // reads can agree in the gap between them.
        return recent.length === 3 && new Set(recent).size === 1;
      },
      { intervals: [300], timeout: 30_000 },
    )
    .toBe(true);
}

async function applyStudioPreset(page: Page, label: string): Promise<void> {
  await setStudioSelectValue(page, "gallery.entry", label);
  await page
    .locator('[data-toolcraft-control-target="gallery.actions"]')
    .getByRole("button", { name: "Apply" })
    .first()
    .click();
}

test("browser: studio gallery applies a composition and leaves every control live", async ({
  page,
}) => {
  test.setTimeout(300_000);

  const { session } = await openStudioSingleLayer(page);
  const before = await readStudioLayerIds(page);
  expect(before, "the fixture starts from one layer of the author's own").toHaveLength(1);

  // The library as the product declares it rather than a copy of the list: a
  // test carrying its own would keep passing after an entry was added and never
  // covered, which is the failure `optionCoverage: "each-visible-item"` exists
  // to prevent.
  const entries = STUDIO_PRESETS;
  expect(entries.length, "the library should offer every built-in composition").toBeGreaterThan(1);

  // **Undo is not asserted here, and the reason is a defect rather than a
  // choice.** Applying a preset is several runtime layer commands, and layer
  // commands are not effectively undoable in this app at all: adding a single
  // layer by hand and pressing the toolbar's own Undo ten times leaves it in
  // place. That is pre-existing and independent of the gallery -- measured on a
  // plain `Add layer` with nothing of this feature involved -- so this proof
  // claims what it can see and the defect is recorded in the change's tasks
  // rather than papered over with an assertion that would pass by not looking.

  // The first application carries the row's evidence: choosing an entry is one
  // claim and applying it is another, so each is made through the recipe that
  // fits it -- a command side effect for the picker, a change in the product's
  // own output for the action.
  const first = STUDIO_PRESETS[0];
  const second = STUDIO_PRESETS[1];
  if (!first || !second) throw new Error("the library needs at least two entries");

  // What the picker changes is what Apply will bring in, and the stack it will
  // replace is untouched until then -- so the outcome reads both: the entry the
  // gallery now names, and the layers still standing.
  await expectToolcraftAcceptanceOutcome(
    async () => ({
      entry: (
        await page
          .locator('[data-toolcraft-control-target="gallery.entry"]')
          .getByRole("combobox")
          .first()
          .innerText()
      ).trim(),
      layers: (await readStudioLayerIds(page)).join(","),
    }),
    async () => {
      await setStudioSelectValue(page, "gallery.entry", second.label);
    },
    { evidenceType: "command-side-effect", requirementId: "gallery.entry" },
  );

  // Naming an entry drew nothing: the stack is still the author's own.
  expect(await readStudioLayerIds(page)).toEqual(before);

  await setStudioSelectValue(page, "gallery.entry", first.label);

  await settleStudioOutput(page);
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("gallery.actions", async () => {
      await page
        .locator('[data-toolcraft-control-target="gallery.actions"]')
        .getByRole("button", { name: "Apply" })
        .first()
        .click();
    }),
    { requirementId: "gallery.apply" },
  );

  // Every entry, applied in turn. Each one has to replace the stack with rows
  // of its own and draw something: a preset whose layers arrived but rendered
  // one flat colour would pass a row count and fail here.
  for (const entry of entries) {
    await applyStudioPreset(page, entry.label);

    await expect
      .poll(async () => (await readStudioLayerNames(page)).length, { timeout: 15_000 })
      .toBeGreaterThan(0);

    // The rows the preset names. Measured rather than assumed: this panel lists
    // them in draw order, so the first row is the bottom of the stack.
    await expect
      .poll(async () => readStudioLayerNames(page), { timeout: 15_000 })
      .toEqual(entry.layers.map((layer) => layer.name));
    expect(
      await readStudioStackSignature(page),
      `${entry.label} should assemble the stack it names`,
    ).toBe(entry.layers.map((layer) => layer.typeId).join(">"));
    await expect
      .poll(async () => readStudioColourVariety(page), { timeout: 15_000 })
      .toBeGreaterThan(2);
  }

  // Live, not loaded: a preset is a starting point, so a control moves the
  // picture it just set rather than being overridden by it. Proved on a band
  // field and with the band count, because the reading is the number of
  // distinct colours across a row and cutting forty-eight bands to four has to
  // move it -- an edit that merely turned the field could leave it where it was.
  await applyStudioPreset(page, "Additive Bands");
  const beforeEdit = await readStudioColourVariety(page);
  await setStudioSlider(page, "Band count", 4);
  await expect
    .poll(async () => readStudioColourVariety(page), { timeout: 15_000 })
    .toBeLessThan(beforeEdit);

});
