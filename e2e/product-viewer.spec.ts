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
 * Viewer parallax acceptance domain: the simulated viewing angle that walks the
 * Physichromie composition through its colour states, and the depth that scales
 * how strongly it does so.
 */

test("browser: croix10 viewing angle sweeps the physichromie colour state", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const session = await openCroix10(page);
  await chooseEngine(page, "Physichromie");

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("viewer.angle", async (control) => {
      await jumpCroix10Slider(control, "End");
    }),
    { requirementId: "viewer.angle" },
  );
});

test("browser: croix10 depth scales how strongly the viewing angle shifts colour", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const session = await openCroix10(page);
  await chooseEngine(page, "Physichromie");

  // Hold the angle off centre, otherwise depth scales a zero shear and nothing
  // could change no matter how the control moved.
  const angle = await getToolcraftControlFieldByTarget(page, "viewer.angle");
  await dragCroix10Slider(angle, page, 0.8);

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("viewer.parallax", async (control) => {
      await jumpCroix10Slider(control, "End");
    }),
    { requirementId: "viewer.parallax" },
  );
});
