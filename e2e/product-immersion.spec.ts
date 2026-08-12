import { expectToolcraftDiscreteSliderMarkers } from "./performance-control-layout-helpers";
import {
  chooseCroix10Engine as chooseEngine,
  dragCroix10Slider,
  jumpCroix10Slider,
  openCroix10,
  readCroix10FieldSignature,
  scrubCroix10Timeline,
  settleCroix10Field,
  showCroix10ExtendedTimeline,
} from "./croix10-product-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Field immersion acceptance domain: the full-field Chromosaturation wash, its
 * reach across the canvas, and where the transition sits.
 */

test("browser: croix10 spread changes the immersive field transition", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const session = await openCroix10(page);
  await chooseEngine(page, "Chromosaturation");

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("immersion.spread", async (control) => {
      await jumpCroix10Slider(control, "Home");
    }),
    { requirementId: "immersion.spread" },
  );
});

test("browser: croix10 balance moves the immersive field transition across the canvas", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const session = await openCroix10(page);
  await chooseEngine(page, "Chromosaturation");

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("immersion.balance", async (control) => {
      await jumpCroix10Slider(control, "End");
    }),
    { requirementId: "immersion.balance" },
  );
});

test("browser: croix10 immersion drift sweeps the chromosaturation wash", async ({
  page,
}) => {
  // Full-buffer readbacks at several timeline positions do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(240_000);

  const session = await openCroix10(page);
  await showCroix10ExtendedTimeline(page);
  await chooseEngine(page, "Chromosaturation");

  // Zero drift is genuinely static: the wash is the same wash at every instant of
  // the loop, byte for byte. Proved first, so the change below is attributable to
  // the drift rate rather than to the timeline having moved.
  await scrubCroix10Timeline(page, "Home");
  const stillAtStart = await readCroix10FieldSignature(page);
  expect(stillAtStart).not.toBe("no-webgl2");
  await scrubCroix10Timeline(page, "ArrowRight");
  expect(await readCroix10FieldSignature(page)).toBe(stillAtStart);

  // The rate's own outcome is proved here, away from the loop origin, because at
  // t=0 every rate renders the same phase by construction: a rate change read at
  // Home would be invisible for reasons that have nothing to do with the control.
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("immersion.driftCycles", async (control) => {
      await jumpCroix10Slider(control, "End");
    }),
    { requirementId: "immersion.driftCycles" },
  );
  await expectToolcraftDiscreteSliderMarkers(page, "immersion.driftCycles");

  // With a rate set, the same scrub moves the transition across the field.
  await scrubCroix10Timeline(page, "Home");
  await settleCroix10Field(page);
  const drivenAtStart = await readCroix10FieldSignature(page);
  await scrubCroix10Timeline(page, "ArrowRight");
  expect(await readCroix10FieldSignature(page)).not.toBe(drivenAtStart);

  // And the sweep closes: the loop's last instant is its first.
  await scrubCroix10Timeline(page, "End");
  expect(await readCroix10FieldSignature(page)).toBe(drivenAtStart);
});
