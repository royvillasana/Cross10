import { appSchema } from "../src/app/app-schema";
import { expect, type Page } from "@playwright/test";

import {
  expectToolcraftProductObservableToChange,
  getToolcraftProductObservableSnapshot,
} from "./product-observable-helpers";
import {
  addStudioLayer,
  openStudioSingleLayer,
  readStudioLayerIds,
  openStudioTwoLayerStack,
  toggleStudioLayerVisibility,
  readStudioOutputSignature,
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

/**
 * The composite with every other layer hidden, so the reading is one layer.
 *
 * Rendered rather than stored, and that was the second attempt. Reading the
 * persisted record looked cleaner and was useless here: persistence trails the
 * edit far enough that the values slice was still empty, so both readings came
 * back null and compared equal -- a proof of "nothing was corrupted" that could
 * not have noticed corruption. Pixels are what an author would see anyway.
 */
async function readStudioLayerAlone(
  page: Page,
  layerId: string,
  otherLayerId: string,
): Promise<string> {
  await toggleStudioLayerVisibility(page, otherLayerId);
  const signature = await readStudioOutputSignature(page);
  await toggleStudioLayerVisibility(page, otherLayerId);
  void layerId;
  return signature;
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

/**
 * Undo must not write into a layer the edit never belonged to.
 *
 * The controls are one editing surface pointed at whichever layer is selected
 * (R56), so an undo restores *control values* rather than a layer's values. If
 * the author has selected a different layer since making the edit, the reverted
 * values arrive while the wrong layer is selected — and the sync, which cannot
 * tell an undo from an edit, folds them straight into it.
 *
 * The damage is silent and to a layer the author was not touching: they undo
 * something on A and B changes. This asserts the layer that was not named keeps
 * its own values, which is the same claim the aimed-application proofs make and
 * for the same reason.
 */
test("browser: studio undo leaves a layer it was never aimed at alone", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const { fixture } = await openStudioTwoLayerStack(page);

  // Two layers that differ, so folding one into the other is observable.
  await selectStudioLayer(page, fixture.gradientLayerId);
  await setStudioSlider(page, "Angle", 70);
  const gradientBefore = await readStudioLayerAlone(
    page,
    fixture.gradientLayerId,
    fixture.stripesLayerId,
  );
  // Vacuity guard: a reading that came back blank for both would compare equal
  // and prove nothing, which is exactly how a proof of "nothing was corrupted"
  // fails to notice corruption.
  expect(gradientBefore).not.toBe("");
  expect(gradientBefore).not.toContain("nogl");

  // The edit, on the other layer.
  await selectStudioLayer(page, fixture.stripesLayerId);
  await setStudioSlider(page, "Angle", 20);

  // ...and the author moves on before undoing it.
  await selectStudioLayer(page, fixture.gradientLayerId);
  await studioUndo(page).click();

  await expect
    .poll(
      async () =>
        readStudioLayerAlone(page, fixture.gradientLayerId, fixture.stripesLayerId),
      { timeout: 15_000 },
    )
    .toBe(gradientBefore);
});
