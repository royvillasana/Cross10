import { expect, type Download, type Page } from "@playwright/test";

import { getToolcraftApplicabilityRequirementId } from "../src/app/app-acceptance";
import { expectToolcraftAcceptanceOutcome } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftControlApplicabilityState } from "./browser-control-applicability-evidence";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import {
  openStudioSingleLayer,
  readStudioLayerIds,
  readStudioOutputSignature,
  setStudioReferenceStrength,
  setStudioReferenceCompare,
  setStudioSlider,
  STUDIO_PRODUCT_OUTPUT,
} from "./studio-product-helpers";
import { STUDIO_PRESETS, studioPresetPickerLabel } from "../src/app/studio-presets";
import {
  expectToolcraftProductObservableToChange,
  getToolcraftProductObservableSnapshot,
} from "./product-observable-helpers";
import { test } from "./toolcraft-product-test";

/**
 * Reference acceptance domain.
 *
 * Two kinds of claim, and they pull in opposite directions, which is what makes
 * the domain worth its own file. The reference has to be *visible* — an author
 * cannot work against something they cannot see — and it has to be *absent from
 * every artifact*, because a guide that can be published is not a guide.
 *
 * Every proof below therefore reads two different surfaces: the editor, where
 * the reference must appear, and the artifact, where it must not. A proof that
 * only read one would pass over exactly the failure that matters.
 */

const REFERENCE_OVERLAY = "[data-studio-reference]";

/** The overlay element, which is absent from the DOM when nothing is shown. */
function studioReference(page: Page) {
  return page.locator(REFERENCE_OVERLAY);
}

/**
 * Chooses a study, through the dialog that now owns the choice.
 *
 * Which study to work against is decided before building and revisited
 * occasionally, so it moved into the flow with the rest of that kind of
 * decision. How hard it shows and how it is read against the work stayed in the
 * panel, because those are adjusted while looking at the canvas.
 */
async function setStudioReference(page: Page, label: string): Promise<void> {
  const preset = STUDIO_PRESETS.find((entry) => entry.label === label);
  if (!preset) throw new Error(`No preset is labelled "${label}".`);
  void studioPresetPickerLabel;

  await page
    .locator('[data-toolcraft-control-target="gallery.actions"]')
    .getByRole("button", { name: "Work against a study" })
    .first()
    .click();
  await page.locator(`[data-studio-onboarding-study="${preset.id}"]`).click();
}

/** The study the overlay is currently showing, or an empty string for none. */
async function readStudioReferenceSource(page: Page): Promise<string> {
  return page.evaluate((selector) => {
    const image = document.querySelector(`${selector} img`);
    return image?.getAttribute("src")?.slice(0, 96) ?? "";
  }, REFERENCE_OVERLAY);
}

/**
 * The reference sits exactly on the canvas, to the pixel.
 *
 * Measured from both boxes rather than read out of the style that was written,
 * because the whole failure this guards is a style that is written correctly
 * and drawn somewhere else.
 */
async function expectStudioReferenceOnCanvas(page: Page): Promise<void> {
  const boxes = await page.evaluate((selector) => {
    const canvas = document.querySelector("[data-toolcraft-product-output]");
    const overlay = document.querySelector(selector);
    if (!canvas || !overlay) return null;
    const a = canvas.getBoundingClientRect();
    const b = overlay.getBoundingClientRect();
    return {
      canvas: [a.left, a.top, a.width, a.height],
      overlay: [b.left, b.top, b.width, b.height],
    };
  }, REFERENCE_OVERLAY);

  expect(boxes, "both the canvas and the reference must be on the page").not.toBeNull();
  for (const [index, name] of ["left", "top", "width", "height"].entries()) {
    expect(
      Math.abs((boxes?.overlay[index] ?? 0) - (boxes?.canvas[index] ?? 0)),
      `the reference's ${name} must match the canvas's`,
    ).toBeLessThan(1.5);
  }
}

/** The composite once it has stopped moving, so two frames can be compared. */
async function settleStudioFrame(page: Page): Promise<string> {
  const recent: string[] = [];
  await expect
    .poll(
      async () => {
        recent.push(await readStudioOutputSignature(page));
        if (recent.length > 3) recent.shift();
        return recent.length === 3 && new Set(recent).size === 1;
      },
      { intervals: [200], timeout: 30_000 },
    )
    .toBe(true);
  return recent[recent.length - 1] ?? "";
}

async function settleStudioObservable(page: Page): Promise<void> {
  const recent: string[] = [];
  await expect
    .poll(
      async () => {
        recent.push(await getToolcraftProductObservableSnapshot(page));
        if (recent.length > 3) recent.shift();
        return recent.length === 3 && new Set(recent).size === 1;
      },
      { intervals: [300], timeout: 30_000 },
    )
    .toBe(true);
}

/**
 * The pixels of a real exported artifact.
 *
 * Dispatched rather than clicked so the pointer never leaves the canvas, which
 * keeps the export comparable with the one taken beside it: pressing the button
 * with a real pointer commits the cursor away and changes the composition's own
 * at-rest state.
 */
async function exportedPixels(page: Page): Promise<string> {
  const download: Promise<Download> = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).dispatchEvent("click");
  const { inspection } = await inspectToolcraftImageDownload({
    backgroundRgba: [0, 0, 0, 255],
    download: await download,
    page,
  });
  return inspection.decodedPixelHash;
}

test("browser: studio reference shows behind the work and reaches no artifact", async ({
  page,
}) => {
  test.setTimeout(300_000);

  const { session } = await openStudioSingleLayer(page);

  const layersBefore = await readStudioLayerIds(page);
  const canvasBefore = await page.locator(STUDIO_PRODUCT_OUTPUT).boundingBox();
  const compositionBefore = await settleStudioFrame(page);

  // Nothing is shown until the author asks for it, and "nothing" means absent
  // from the tree rather than present at zero opacity. An element that exists
  // and cannot be seen is the shape a leak takes.
  await expect(studioReference(page)).toHaveCount(0);

  // The artifact with no reference at all, which every comparison below is
  // measured against.
  const exportedWithout = await exportedPixels(page);

  // Both readings, because a study is read two ways and each has to work. No
  // longer an applicability pair: these were peer controls in one panel section
  // and are now two affordances in the dialog that chooses the study, so what
  // is proved is the rendered result rather than one control gating another.
  for (const mode of [
    { label: "Laying it over", value: "overlay" },
    { label: "Their difference", value: "difference" },
  ] as const) {
    // Back to nothing shown first, so the change below is a change.
    await setStudioReferenceStrength(page, 0);
    await expect(studioReference(page)).toHaveCount(0);

    await setStudioReferenceCompare(page, mode.label);

    await settleStudioObservable(page);
    await expectToolcraftProductObservableToChange(
      session,
      session.targetAction("reference.opacity", async () => {
        await setStudioReferenceStrength(page, 0.8);
      }),
      { requirementId: "reference.opacity" },
    );

    await expect(studioReference(page)).toHaveCount(1);
  }

  // It lands on the picture, measured rather than assumed.
  //
  // This is the assertion the feature shipped without and needed. The overlay
  // is fixed to the viewport and one of the shell's wrappers is transformed, so
  // writing the canvas's measured rect straight into a style applies the offset
  // twice and draws every length at length x zoom. A count of one, an
  // attribute, and a changed screenshot were all true while the reference sat a
  // few hundred pixels from the composition at a third of its size -- because
  // at the default zoom the arithmetic degenerates and the bug is invisible.
  await expectStudioReferenceOnCanvas(page);

  // And at another zoom, which is where the two coordinate systems come apart.
  await page.getByRole("button", { name: "Zoom out" }).first().click();
  await expectStudioReferenceOnCanvas(page);
  await page.getByRole("button", { name: "Zoom in" }).first().click();
  await expectStudioReferenceOnCanvas(page);

  // It is not a layer. The list is exactly what it was, and there is no row to
  // select that corresponds to the reference.
  expect(
    await readStudioLayerIds(page),
    "a reference must not appear in the layer list",
  ).toEqual(layersBefore);

  // And it did not resize anything. A study of another proportion is contained
  // rather than fitted, so the canvas keeps the dimensions the author chose.
  expect(
    await page.locator(STUDIO_PRODUCT_OUTPUT).boundingBox(),
    "loading a reference must not resize the canvas",
  ).toEqual(canvasBefore);

  // Every study is reachable and each one shows its own picture. The picker's
  // coverage obligation is per item, and a study that silently showed the
  // previous one would look exactly like one nobody had proved.
  const seen = new Set<string>();
  for (const preset of STUDIO_PRESETS) {
    await setStudioReference(page, preset.label);
    await expect
      .poll(async () => readStudioReferenceSource(page), { timeout: 15_000 })
      .not.toBe("");
    seen.add(await readStudioReferenceSource(page));
  }
  expect(
    seen.size,
    "each study must show its own render rather than the one before it",
  ).toBe(STUDIO_PRESETS.length);

  // Choosing a study is a change to the editor and to nothing else: the outcome
  // reads what is shown behind the work, and the composition beside it is
  // asserted to have held still.
  const first = STUDIO_PRESETS[0];
  const second = STUDIO_PRESETS[1];
  if (!first || !second) throw new Error("the library needs at least two entries");

  await setStudioReference(page, first.label);
  await expectToolcraftAcceptanceOutcome(
    async () => ({
      composition: await readStudioOutputSignature(page),
      shown: await readStudioReferenceSource(page),
    }),
    async () => {
      await setStudioReference(page, second.label);
    },
    { evidenceType: "command-side-effect", requirementId: "reference.entry" },
  );

  expect(
    await readStudioLayerIds(page),
    "choosing a study must not touch the layer list",
  ).toEqual(layersBefore);

  // The artifact is unchanged by all of it. Not "the export looks right" --
  // identity against the export taken before any reference existed, because the
  // failure being guarded is a leak and a leaked artifact looks perfectly fine.
  expect(
    await exportedPixels(page),
    "an exported image must be identical whether or not a reference is showing",
  ).toBe(exportedWithout);

  // Dismissed by returning the strength to zero, which leaves the composition
  // exactly as it was.
  await setStudioReferenceStrength(page, 0);
  await expect(studioReference(page)).toHaveCount(0);
  expect(await readStudioLayerIds(page)).toEqual(layersBefore);
  await expect
    .poll(async () => readStudioOutputSignature(page), { timeout: 15_000 })
    .toBe(compositionBefore);
});

test("browser: studio reference compares by difference and exports neither", async ({
  page,
}) => {
  test.setTimeout(300_000);

  const { session } = await openStudioSingleLayer(page);

  const layersBefore = await readStudioLayerIds(page);
  const compositionBefore = await settleStudioFrame(page);
  const exportedWithout = await exportedPixels(page);

  await setStudioReferenceStrength(page, 1);
  await expect(studioReference(page)).toHaveAttribute("data-studio-reference", "overlay");

  // Difference rather than a second opacity, because at fifty percent every
  // mismatch looks like a mismatch -- including one that is only a difference
  // in brightness.
  //
  // Read as the mode the overlay is in, and *not* as a change to the product's
  // output, which is a distinction this proof used to blur. The blending is the
  // browser's: `mix-blend-mode` on an element sitting over the canvas. The
  // product's own pixels are identical either way, and they have to be —
  // a study that changed them would be a study reaching the artifact, which is
  // exactly what the rest of this file exists to forbid.
  //
  // While the mode was a panel select there was a control value to watch change.
  // There is no control any more, so what is asserted is the thing that does
  // change: the overlay's mode, before and after.
  await settleStudioObservable(page);
  const beforeCompare = await readStudioOutputSignature(page);

  await setStudioReferenceCompare(page, "Their difference");

  await expect(studioReference(page)).toHaveAttribute(
    "data-studio-reference",
    "difference",
  );
  expect(
    await readStudioOutputSignature(page),
    "the study's comparison mode must not reach the product's own pixels",
  ).toBe(beforeCompare);

  // Comparing writes nothing. The layer list, and the composition's own pixels,
  // are what they were before the mode was entered.
  expect(await readStudioLayerIds(page)).toEqual(layersBefore);
  expect(
    await readStudioOutputSignature(page),
    "entering a comparison must not change the composition",
  ).toBe(compositionBefore);

  // And exporting while it is active carries the composition alone.
  expect(
    await exportedPixels(page),
    "an export taken while comparing must show the composition alone",
  ).toBe(exportedWithout);

  // Leaving it changes nothing either, which is the other half of the claim: a
  // display mode that had written a value would show it on the way out.
  await setStudioReferenceCompare(page, "Laying it over");
  await expect(studioReference(page)).toHaveAttribute("data-studio-reference", "overlay");
  expect(await readStudioLayerIds(page)).toEqual(layersBefore);
  await expect
    .poll(async () => readStudioOutputSignature(page), { timeout: 15_000 })
    .toBe(compositionBefore);
});
