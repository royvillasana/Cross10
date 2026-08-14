import { expect, type Page } from "@playwright/test";

import {
  expectToolcraftProductObservableToChange,
  getToolcraftProductObservableSnapshot,
} from "./product-observable-helpers";
import {
  addStudioLayer,
  openStudioSingleLayer,
  readStudioLayerIds,
  selectStudioLayer,
  setStudioSlider,
} from "./studio-product-helpers";
import { test } from "./toolcraft-product-test";

/**
 * History acceptance domain.
 *
 * The runtime owns undo; what this product has to prove is that it has not
 * broken it, which for most of this app's life it had. The stack is shared:
 * every value the product writes lands on it, so a write that is a consequence
 * rather than an edit -- the per-layer record following the controls, the
 * pointer position following the pointer -- puts a patch between the author and
 * the thing they wanted back. Undo did nothing at all here until that was
 * fixed, for any edit, and the button was never even disabled.
 *
 * So the proofs are the three shapes an author actually undoes: a value, a
 * layer that arrived, and a layer that went. The last one is the sharpest,
 * because a layer can come back as an empty shell -- the runtime restores the
 * row and the values it had are already gone -- and that reads as working right
 * up until you look at what was restored.
 */

async function readStudioSliderValue(page: Page, label: string): Promise<number> {
  return Number(
    (await page.getByRole("slider", { name: label }).first().getAttribute("aria-valuenow")) ??
      Number.NaN,
  );
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

function studioUndo(page: Page) {
  return page.getByRole("button", { name: "Undo" }).first();
}

test("browser: studio undo reverts an edit, a layer, and a layer's values", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const { session } = await openStudioSingleLayer(page);

  // One edit, one undo. Not "eventually": the count is the claim, because the
  // failure being guarded against was a second patch per edit, and a proof that
  // clicked until something happened would have passed against it.
  await setStudioSlider(page, "Angle", 90);
  await expect
    .poll(async () => readStudioSliderValue(page, "Angle"), { timeout: 10_000 })
    .toBe(90);

  await settleStudioOutput(page);
  await expectToolcraftProductObservableToChange(
    session,
    session.targetAction("history.undo", async () => {
      await studioUndo(page).click();
    }),
    { requirementId: "history.undo" },
  );
  // Polled rather than read once: the undo is a state update and the control is
  // rendered from it, so a bare read races the frame that carries it. What is
  // being claimed is still "one undo", which the single press above is.
  await expect
    .poll(async () => readStudioSliderValue(page, "Angle"), { timeout: 10_000 })
    .toBe(0);

  // A layer that arrived.
  const before = await readStudioLayerIds(page);
  await addStudioLayer(page);
  await expect
    .poll(async () => readStudioLayerIds(page), { timeout: 10_000 })
    .not.toEqual(before);
  await studioUndo(page).click();
  await expect
    .poll(async () => readStudioLayerIds(page), { timeout: 10_000 })
    .toEqual(before);

  // A layer that went, and the half that is easy to miss: it comes back as
  // itself. The record kept its entry through the delete, so the restored layer
  // is the one the author had rather than a fresh one wearing its name.
  await addStudioLayer(page);
  const ids = await readStudioLayerIds(page);
  const restored = ids.at(-1) ?? "";
  await selectStudioLayer(page, restored);
  await setStudioSlider(page, "Angle", 75);

  const row = page.locator(`[data-layer-id="${restored}"]`);
  await row.hover();
  await row
    .locator('button[aria-label^="Delete"], button[aria-label^="Remove"]')
    .first()
    .click();
  await expect
    .poll(async () => readStudioLayerIds(page), { timeout: 10_000 })
    .not.toContain(restored);

  await studioUndo(page).click();
  await expect
    .poll(async () => readStudioLayerIds(page), { timeout: 10_000 })
    .toEqual(ids);

  await selectStudioLayer(page, restored);
  await expect
    .poll(async () => readStudioSliderValue(page, "Angle"), { timeout: 10_000 })
    .toBe(75);
});
