import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import {
  chooseCroix10Engine as chooseEngine,
  dragCroix10Slider,
  jumpCroix10Slider,
  openCroix10,
} from "./croix10-product-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Afterimage fringe acceptance domain: the high-frequency line pairs of Induction
 * Chromatique and the complementary fringe along each boundary.
 */

test("browser: croix10 line pair frequency changes the induced field density", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const session = await openCroix10(page);
  await chooseEngine(page, "Induction Chromatique");

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("induction.frequency", async (control) => {
      await jumpCroix10Slider(control, "End");
    }),
    { requirementId: "induction.frequency" },
  );
});

test("browser: croix10 fringe width changes the complementary edge band", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const session = await openCroix10(page);
  await chooseEngine(page, "Induction Chromatique");

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("induction.fringeWidth", async (control) => {
      await jumpCroix10Slider(control, "End");
    }),
    { requirementId: "induction.fringe-width" },
  );
});

test("browser: croix10 fringe strength changes the induced complementary colour", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const session = await openCroix10(page);
  await chooseEngine(page, "Induction Chromatique");

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("induction.fringeIntensity", async (control) => {
      await jumpCroix10Slider(control, "Home");
    }),
    { requirementId: "induction.fringe-intensity" },
  );
});
