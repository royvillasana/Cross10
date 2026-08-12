import type { Locator, Page } from "@playwright/test";

import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { proveCroix10ApplicabilityCases } from "./croix10-applicability-harness";
import {
  dragCroix10Slider,
  jumpCroix10Slider,
  openCroix10,
} from "./croix10-product-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { test } from "./toolcraft-product-test";

/**
 * Stripe field acceptance domain.
 *
 * Each proof drives the real control and requires the rendered chromatic field to
 * change and stay changed. A runtime value change alone would not qualify.
 *
 * Every control here is additionally reproved in each branch of its section's own
 * selector — Mirror, for this section — because a control that is present but inert
 * in one branch is a defect a single-branch proof cannot see. The branches are derived
 * from the schema rather than listed here, so a new peer selector extends these proofs
 * instead of quietly leaving them behind.
 */

function control(page: Page, target: string): Promise<Locator> {
  return getToolcraftControlFieldByTarget(page, target);
}

/**
 * Alternates the direction of travel between cases. Re-applying the value a control
 * already holds produces no change, and a case that failed for that reason would say
 * nothing about the branch under test.
 */
async function sweep(page: Page, target: string, index: number): Promise<void> {
  await jumpCroix10Slider(
    await control(page, target),
    index % 2 === 0 ? "End" : "Home",
  );
}

test("browser: croix10 band count drag changes density live during the gesture", async ({
  page,
}) => {
  // Two branches, each with its own stability window and applicability poll.
  test.setTimeout(180_000);

  const session = await openCroix10(page);

  await proveCroix10ApplicabilityCases({
    // A real pointer drag in both branches, so the liveness this row claims is
    // measured during the gesture rather than after a keystroke.
    act: async (index) =>
      dragCroix10Slider(
        await control(page, "stripe.count"),
        page,
        index % 2 === 0 ? 0.85 : 0.15,
      ),
    evidence: "product-output",
    page,
    requirementId: "stripe.count",
    session,
    target: "stripe.count",
  });
});

test("browser: croix10 width ratio narrows alternate bands in the rendered field", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const session = await openCroix10(page);

  await proveCroix10ApplicabilityCases({
    act: (index) => sweep(page, "stripe.widthRatio", index),
    evidence: "product-output",
    page,
    requirementId: "stripe.width-ratio",
    session,
    target: "stripe.widthRatio",
  });
});

test("browser: croix10 angle rotates the rendered stripe field", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const session = await openCroix10(page);

  await proveCroix10ApplicabilityCases({
    act: (index) => sweep(page, "stripe.angle", index),
    evidence: "product-output",
    page,
    requirementId: "stripe.angle",
    session,
    target: "stripe.angle",
  });
});

test("browser: croix10 phase shifts the rendered sequence sideways", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const session = await openCroix10(page);

  await proveCroix10ApplicabilityCases({
    act: (index) => sweep(page, "stripe.phase", index),
    evidence: "product-output",
    page,
    requirementId: "stripe.phase",
    session,
    target: "stripe.phase",
  });
});

test("browser: croix10 wobble bends band boundaries and is straight at zero", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const session = await openCroix10(page);

  await proveCroix10ApplicabilityCases({
    // Alternating to the ends is exactly this row's claim: the maximum bends the
    // boundaries and Home returns them to straight.
    act: (index) => sweep(page, "stripe.jitterAmount", index),
    evidence: "product-output",
    page,
    requirementId: "stripe.jitter-amount",
    session,
    target: "stripe.jitterAmount",
  });
});

test("browser: croix10 wobble rate changes the boundary wobble period", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const session = await openCroix10(page);

  // A rate has nothing to change while the wobble amount is zero.
  await jumpCroix10Slider(await control(page, "stripe.jitterAmount"), "End");

  await proveCroix10ApplicabilityCases({
    act: (index) => sweep(page, "stripe.jitterFrequency", index),
    evidence: "product-output",
    page,
    requirementId: "stripe.jitter-frequency",
    session,
    target: "stripe.jitterFrequency",
  });
});

test("browser: croix10 mirror reflects the rendered field about its axis", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const session = await openCroix10(page);

  // Mirror is this section's selector, not a dependent control, so it derives no
  // applicability cases of its own: it is proved once, on its own terms.
  await jumpCroix10Slider(await control(page, "stripe.angle"), "End");

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("stripe.mirror", async (mirror) => {
      await mirror.getByRole("switch").first().click();
    }),
    { requirementId: "stripe.mirror" },
  );
});
