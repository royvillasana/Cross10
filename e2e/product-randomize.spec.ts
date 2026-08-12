import { CROIX10_STRIPE_COUNT } from "../src/app/croix10-parameters";
import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { proveCroix10ApplicabilityCases } from "./croix10-applicability-harness";
import {
  chooseEngineForLocks,
  openCroix10Randomize,
  pressRandomize,
  readRandomizeState,
  setLocks,
} from "./croix10-randomize-helpers";
import {
  openCroix10,
  readCroix10FieldColorCount,
} from "./croix10-product-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Randomize acceptance domain.
 *
 * A lock is a claim about something *not* changing, which nothing happening also
 * satisfies. So each lock proof reads one observation covering both halves at once:
 * the locked group's own control values, which must come back identical, and the
 * rendered field, which must not — the protected helper only accepts an outcome that
 * really changed, and the returned observation carries the values the lock protected.
 *
 * Every lock is then reproved with each other lock in both positions, because a lock
 * that only held while its neighbours were open would not be a lock.
 */

test("browser: croix10 randomize assigns new in-range values as one undo step", async ({
  page,
}) => {
  // Eight lock branches after the plain proof, each with its own stability window.
  test.setTimeout(420_000);

  const session = await openCroix10(page);

  const bands = page.getByRole("slider", { name: "Bands" });
  const before = await bands.getAttribute("aria-valuenow");

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("randomize.actions", async () => {
      await pressRandomize(page);
    }),
    { requirementId: "randomize.action" },
  );

  // In range, read from the control's own declared bounds rather than from a
  // number this test repeats.
  const value = Number(await bands.getAttribute("aria-valuenow"));
  expect(value).toBeGreaterThanOrEqual(CROIX10_STRIPE_COUNT.min);
  expect(value).toBeLessThanOrEqual(CROIX10_STRIPE_COUNT.max);

  // Not degenerate: a randomized field still has a field in it.
  expect(await readCroix10FieldColorCount(page)).toBeGreaterThan(1);

  // One undo for the whole roll, not one per parameter. Asserted before the branch
  // sweep below, because that sweep is many more rolls and undo only reaches the
  // most recent one.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(bands).toHaveAttribute("aria-valuenow", before ?? "");

  // Then the command is reproved in every lock branch: a Randomize that did nothing
  // whenever some particular lock was on would otherwise pass on the open case alone.
  await proveCroix10ApplicabilityCases({
    act: () => pressRandomize(page),
    evidence: "product-output",
    page,
    prepare: async (applicabilityCase) => {
      await setLocks(page, []);
      await chooseEngineForLocks(
        page,
        applicabilityCase.selectorValue === true
          ? [applicabilityCase.selectorTarget]
          : [],
      );
    },
    requirementId: "randomize.action",
    session,
    target: "randomize.actions",
  });
});

test("browser: croix10 stripe field lock survives randomize", async ({ page }) => {
  test.setTimeout(180_000);

  const session = await openCroix10Randomize(
    page,
    "Couleur Additive",
    "stripe.randomizeLock",
  );

  const before = await readRandomizeState(page);
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("stripe.randomizeLock", async () => {
      await pressRandomize(page);
    }),
    { requirementId: "randomize.lock-stripe" },
  );
  const after = await readRandomizeState(page);

  expect(after["stripe.count"]).toBe(before["stripe.count"]);
  expect(after["stripe.angle"]).toBe(before["stripe.angle"]);
  expect(after["stripe.widthRatio"]).toBe(before["stripe.widthRatio"]);
  // The locked values are real values, not an empty read.
  expect(before["stripe.count"]).not.toBe("");
  // The change the helper insisted on came from the unlocked palette.
  expect(after["palette.slots"]).not.toBe(before["palette.slots"]);

  // And the lock is reproved with every other lock in both positions, because a lock
  // that only held while its neighbours were open would not be a lock.
  await proveCroix10ApplicabilityCases({
    act: () => pressRandomize(page),
    evidence: "product-output",
    page,
    prepare: async (applicabilityCase) => {
      await setLocks(page, ["stripe.randomizeLock"]);
      await chooseEngineForLocks(
        page,
        applicabilityCase.selectorValue === true
          ? ["stripe.randomizeLock", applicabilityCase.selectorTarget]
          : ["stripe.randomizeLock"],
      );
    },
    requirementId: "randomize.lock-stripe",
    session,
    target: "stripe.randomizeLock",
  });
});

test("browser: croix10 palette lock survives randomize", async ({ page }) => {
  test.setTimeout(180_000);

  const session = await openCroix10Randomize(
    page,
    "Couleur Additive",
    "palette.randomizeLock",
  );

  const before = await readRandomizeState(page);
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("palette.randomizeLock", async () => {
      await pressRandomize(page);
    }),
    { requirementId: "randomize.lock-palette" },
  );
  const after = await readRandomizeState(page);

  expect(after["palette.slots"]).toBe(before["palette.slots"]);
  expect(before["palette.slots"]).not.toBe("");
  expect(after["stripe.count"]).not.toBe(before["stripe.count"]);

  // And the lock is reproved with every other lock in both positions, because a lock
  // that only held while its neighbours were open would not be a lock.
  await proveCroix10ApplicabilityCases({
    act: () => pressRandomize(page),
    evidence: "product-output",
    page,
    prepare: async (applicabilityCase) => {
      await setLocks(page, ["palette.randomizeLock"]);
      await chooseEngineForLocks(
        page,
        applicabilityCase.selectorValue === true
          ? ["palette.randomizeLock", applicabilityCase.selectorTarget]
          : ["palette.randomizeLock"],
      );
    },
    requirementId: "randomize.lock-palette",
    session,
    target: "palette.randomizeLock",
  });
});

test("browser: croix10 immersive field lock survives randomize", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const session = await openCroix10Randomize(
    page,
    "Chromosaturation",
    "immersion.randomizeLock",
  );

  const before = await readRandomizeState(page);
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("immersion.randomizeLock", async () => {
      await pressRandomize(page);
    }),
    { requirementId: "randomize.lock-immersion" },
  );
  const after = await readRandomizeState(page);

  expect(after["immersion.spread"]).toBe(before["immersion.spread"]);
  expect(after["immersion.balance"]).toBe(before["immersion.balance"]);
  expect(before["immersion.spread"]).not.toBe("");
  expect(after["palette.slots"]).not.toBe(before["palette.slots"]);

  // And the lock is reproved with every other lock in both positions, because a lock
  // that only held while its neighbours were open would not be a lock.
  await proveCroix10ApplicabilityCases({
    act: () => pressRandomize(page),
    evidence: "product-output",
    page,
    prepare: async (applicabilityCase) => {
      await setLocks(page, ["immersion.randomizeLock"]);
      await chooseEngineForLocks(
        page,
        applicabilityCase.selectorValue === true
          ? ["immersion.randomizeLock", applicabilityCase.selectorTarget]
          : ["immersion.randomizeLock"],
      );
    },
    requirementId: "randomize.lock-immersion",
    session,
    target: "immersion.randomizeLock",
  });
});

test("browser: croix10 plane lock survives randomize", async ({ page }) => {
  test.setTimeout(180_000);

  const session = await openCroix10Randomize(
    page,
    "Transchromie",
    "transchromie.randomizeLock",
  );

  const before = await readRandomizeState(page);
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("transchromie.randomizeLock", async () => {
      await pressRandomize(page);
    }),
    { requirementId: "randomize.lock-planes" },
  );
  const after = await readRandomizeState(page);

  expect(after["transchromie.planes"]).toBe(before["transchromie.planes"]);
  expect(before["transchromie.planes"]).not.toBe("");
  expect(after["palette.slots"]).not.toBe(before["palette.slots"]);

  // And the lock is reproved with every other lock in both positions, because a lock
  // that only held while its neighbours were open would not be a lock.
  await proveCroix10ApplicabilityCases({
    act: () => pressRandomize(page),
    evidence: "product-output",
    page,
    prepare: async (applicabilityCase) => {
      await setLocks(page, ["transchromie.randomizeLock"]);
      await chooseEngineForLocks(
        page,
        applicabilityCase.selectorValue === true
          ? ["transchromie.randomizeLock", applicabilityCase.selectorTarget]
          : ["transchromie.randomizeLock"],
      );
    },
    requirementId: "randomize.lock-planes",
    session,
    target: "transchromie.randomizeLock",
  });
});

test("browser: croix10 the R key randomizes and is suppressed while typing", async ({
  page,
}) => {
  // Eight lock branches after the plain proof, each with its own stability window.
  test.setTimeout(420_000);

  const session = await openCroix10(page);

  const before = await readRandomizeState(page);
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("randomize.actions", async () => {
      await page.keyboard.press("r");
    }),
    { requirementId: "randomize.shortcut" },
  );
  const after = await readRandomizeState(page);
  expect(after["stripe.count"]).not.toBe(before["stripe.count"]);

  // Suppressed while typing. R is a letter, so inside a hex field it belongs to the
  // field: the composition must be untouched.
  const paletteField = await getToolcraftControlFieldByTarget(
    page,
    "palette.slots",
  );
  const hex = paletteField.getByRole("textbox").first();
  await hex.click();
  await expect(hex).toBeFocused();

  const beforeTyping = await readRandomizeState(page);
  await page.keyboard.press("r");
  await expect(hex).toBeFocused();
  const afterTyping = await readRandomizeState(page);
  expect(afterTyping["stripe.count"]).toBe(beforeTyping["stripe.count"]);
  expect(afterTyping["stripe.angle"]).toBe(beforeTyping["stripe.angle"]);
  expect(afterTyping["stripe.widthRatio"]).toBe(beforeTyping["stripe.widthRatio"]);

  // Blur the field, then reprove the shortcut in every lock branch: the keyboard path
  // has to honour the locks exactly as the button does.
  await proveCroix10ApplicabilityCases({
    act: async () => {
      // Driving a selector leaves focus on its combobox trigger, and the shortcut is
      // suppressed there by design — a letter belongs to a select that has focus. A
      // user reaching for a global shortcut is not inside that control, so focus
      // leaves it first.
      await page.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
      });
      await page.keyboard.press("r");
    },
    evidence: "product-output",
    page,
    prepare: async (applicabilityCase) => {
      await setLocks(page, []);
      await chooseEngineForLocks(
        page,
        applicabilityCase.selectorValue === true
          ? [applicabilityCase.selectorTarget]
          : [],
      );
    },
    requirementId: "randomize.shortcut",
    session,
    target: "randomize.actions",
  });
});
