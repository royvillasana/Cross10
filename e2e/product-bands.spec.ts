import { jumpCroix10Slider, openCroix10 } from "./croix10-product-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { test } from "./toolcraft-product-test";

/**
 * Band sequence acceptance domain: the thin separator dividing the colour bands.
 * It is a window onto the support, so its colour comes from Background rather
 * than from a control of its own.
 */

test("browser: croix10 separator width changes the rendered divider thickness", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const session = await openCroix10(page);

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("bands.separatorWidth", async (control) => {
      // One keystroke to the maximum: a pointer drag can land on the value it
      // started from on this short range, and dozens of arrow presses are slow
      // enough to outrun the stability window under load.
      await jumpCroix10Slider(control, "End");
    }),
    { requirementId: "bands.separator-width" },
  );
});
