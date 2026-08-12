import type { Page } from "@playwright/test";

import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { proveCroix10ApplicabilityCases } from "./croix10-applicability-harness";
import { expectToolcraftDiscreteSliderMarkers } from "./performance-control-layout-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import {
  CROIX10_PRODUCT_OUTPUT,
  chooseCroix10Engine,
  chooseCroix10Option,
  jumpCroix10Slider,
  openCroix10,
  readCroix10FieldSignature,
  scrubCroix10Timeline,
  settleCroix10Field,
  showCroix10ExtendedTimeline,
} from "./croix10-product-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Interference layer acceptance domain.
 *
 * Chromointerférence is the one engine whose subject is a relationship: nothing in
 * the output is a mark either layer made on its own, so every proof here works on
 * the composite of two superimposed stripe structures.
 *
 * Selecting the engine reveals six controls and so reflows the panel. Every proof
 * therefore selects the engine, lets persistence commit, and reloads into it, so
 * the panel is already at its final size on the first paint the proof measures.
 *
 * Each control is then reproved with the layer on and under every blend mode. That
 * matters more here than elsewhere: the blend decides how the two layers combine, and
 * a geometry control that moved the second layer without changing the composite under
 * some blend would be a real defect.
 */

const RUNTIME_APP = '[data-slot="toolcraft-runtime-app"]';

async function openCroix10WithInterference(
  page: Page,
): Promise<Awaited<ReturnType<typeof openCroix10>>> {
  await page.goto("/");
  await expect(page.locator(CROIX10_PRODUCT_OUTPUT)).toBeVisible();
  await chooseCroix10Engine(page, "Chromointerférence");
  await expect(page.locator(RUNTIME_APP)).toHaveAttribute(
    "data-toolcraft-persistence-status",
    "success",
  );
  return openCroix10(page);
}

async function interferenceSwitch(page: Page) {
  const control = await getToolcraftControlFieldByTarget(
    page,
    "interference.enabled",
  );
  return control.getByRole("switch").first();
}

async function sweep(page: Page, target: string, index: number): Promise<void> {
  await jumpCroix10Slider(
    await getToolcraftControlFieldByTarget(page, target),
    index % 2 === 0 ? "End" : "Home",
  );
}

/**
 * Mean luminance and near-black share of the backing buffer.
 *
 * Read from the GPU rather than from a screenshot, because the blend claims are
 * claims about arithmetic and a change hash cannot tell one blend from another.
 * Two statistics, because the two modes make different claims: additive sums the
 * layers, so the whole field brightens, while difference makes the field black
 * exactly where the layers agree, which is a claim about a population of pixels
 * rather than about the average.
 */
async function readCroix10FieldStats(
  page: Page,
): Promise<{ meanLuminance: number; nearBlackShare: number }> {
  return page.locator(CROIX10_PRODUCT_OUTPUT).evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) return { meanLuminance: -1, nearBlackShare: -1 };
    const width = Math.min(canvas.width, 512);
    const height = Math.min(canvas.height, 256);
    if (width === 0 || height === 0) {
      return { meanLuminance: -1, nearBlackShare: -1 };
    }
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let total = 0;
    let nearBlack = 0;
    const samples = width * height;
    for (let index = 0; index < pixels.length; index += 4) {
      const luminance =
        pixels[index] * 0.2126 +
        pixels[index + 1] * 0.7152 +
        pixels[index + 2] * 0.0722;
      total += luminance;
      if (luminance < 6) nearBlack += 1;
    }
    return { meanLuminance: total / samples, nearBlackShare: nearBlack / samples };
  });
}

/** Puts the layer back on, so the next case's blend selector still exists. */
async function restoreLayer(page: Page): Promise<void> {
  const toggle = await interferenceSwitch(page);
  if ((await toggle.getAttribute("aria-checked")) !== "true") {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-checked", "true");
}

test("browser: croix10 second layer switch adds the interfering structure and removes its controls", async ({
  page,
}) => {
  test.setTimeout(300_000);

  const session = await openCroix10WithInterference(page);

  // Presence case for the gate: the layer is on by default under this engine,
  // because the engine's whole grammar is the composite.
  await expect(page.getByRole("slider", { name: "Pitch ratio" })).toBeVisible();

  await proveCroix10ApplicabilityCases({
    // Toggling the layer off is the change; restoring it afterwards keeps the blend
    // selector the next case needs.
    act: async () => {
      await (await interferenceSwitch(page)).click();
    },
    evidence: "product-output",
    page,
    requirementId: "interference.enabled",
    restore: () => restoreLayer(page),
    session,
    target: "interference.enabled",
  });

  // Absence proof: with the layer off, the second structure's controls are gone
  // rather than inert.
  await (await interferenceSwitch(page)).click();
  await expect(page.getByRole("slider", { name: "Pitch ratio" })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Angle offset" })).toHaveCount(0);
});

const GEOMETRY_ROWS = [
  {
    name: "browser: croix10 interference pitch ratio changes the moire beat period",
    requirementId: "interference.pitch-ratio",
    target: "interference.pitchRatio",
  },
  {
    name: "browser: croix10 interference angle offset rotates the beat across the field",
    requirementId: "interference.angle-offset",
    target: "interference.angleOffset",
  },
  {
    name: "browser: croix10 interference phase offset translates the beat without changing its period",
    requirementId: "interference.phase-offset",
    target: "interference.phaseOffset",
  },
  {
    name: "browser: croix10 interference layer coverage changes how much of the base shows through",
    requirementId: "interference.width-ratio",
    target: "interference.widthRatio",
  },
] as const;

for (const row of GEOMETRY_ROWS) {
  test(row.name, async ({ page }) => {
    // Six branches, each with a stability window and an applicability poll.
    test.setTimeout(300_000);

    const session = await openCroix10WithInterference(page);

    await proveCroix10ApplicabilityCases({
      act: (index) => sweep(page, row.target, index),
      evidence: "product-output",
      page,
      requirementId: row.requirementId,
      session,
      target: row.target,
    });
  });
}

test("browser: croix10 interference blend modes composite the two layers in linear light", async ({
  page,
}) => {
  test.setTimeout(300_000);

  const session = await openCroix10WithInterference(page);

  await proveCroix10ApplicabilityCases({
    act: (index) =>
      chooseCroix10Option(
        page,
        "interference.blendMode",
        index % 2 === 0 ? "Difference" : "Normal",
      ),
    evidence: "rendered-pixels",
    page,
    requirementId: "interference.blend-mode",
    session,
    target: "interference.blendMode",
  });

  // Every mode changes the composite, and two of them make claims a change hash
  // cannot check. Measured after the applicability cases, with the layer on.
  const stats: Record<string, Awaited<ReturnType<typeof readCroix10FieldStats>>> =
    {};
  for (const label of ["Normal", "Multiply", "Screen", "Additive", "Difference"]) {
    await chooseCroix10Option(page, "interference.blendMode", label);
    stats[label] = await readCroix10FieldStats(page);
  }

  // Additive sums the two layers in linear light, so the whole field brightens, and
  // multiplying must sit below screening.
  expect(stats.Additive.meanLuminance).toBeGreaterThan(stats.Normal.meanLuminance);
  expect(stats.Multiply.meanLuminance).toBeLessThan(stats.Screen.meanLuminance);

  // Difference is not simply darker — the absolute difference of two saturated
  // inks is often brighter than either. Its claim is about where the layers
  // agree: there, and only there, the composite is black.
  expect(stats.Difference.nearBlackShare).toBeGreaterThan(
    stats.Normal.nearBlackShare,
  );
});

test("browser: croix10 interference drift travels the moire across the loop", async ({
  page,
}) => {
  // Full-buffer readbacks at several timeline positions, then seven applicability
  // branches each with a stability window, do not fit the default per-test budget
  // when the whole suite runs on one worker.
  test.setTimeout(420_000);

  const session = await openCroix10WithInterference(page);
  await showCroix10ExtendedTimeline(page);

  // At zero the beat is fixed: scrubbing the timeline cannot reach it.
  await scrubCroix10Timeline(page, "Home");
  const stillAtStart = await readCroix10FieldSignature(page);
  expect(stillAtStart).not.toBe("no-webgl2");
  await scrubCroix10Timeline(page, "ArrowRight");
  expect(await readCroix10FieldSignature(page)).toBe(stillAtStart);

  // With a rate set, the same scrub translates the moire. The beat period is set
  // by the pitch ratio and does not move with it, which is why this reads as one
  // pattern travelling rather than as the whole field being redrawn.
  await scrubCroix10Timeline(page, "Home");
  await jumpCroix10Slider(
    await getToolcraftControlFieldByTarget(page, "interference.driftCycles"),
    "End",
  );
  await settleCroix10Field(page);
  const drivenAtStart = await readCroix10FieldSignature(page);
  await scrubCroix10Timeline(page, "ArrowRight");
  expect(await readCroix10FieldSignature(page)).not.toBe(drivenAtStart);

  // A whole number of sequence periods brings the layer back onto itself.
  await scrubCroix10Timeline(page, "End");
  expect(await readCroix10FieldSignature(page)).toBe(drivenAtStart);

  // The rate is reproved in every branch that renders it, for the same reason the
  // geometry rows are: a control that is visible but inert under some blend mode
  // is a bug only a per-branch outcome can catch. Each branch is measured away
  // from the loop origin, because at t=0 every rate renders the same phase and a
  // rate change there would be invisible for reasons unrelated to the control.
  await proveCroix10ApplicabilityCases({
    act: async () => {},
    page,
    prepare: async () => {
      await scrubCroix10Timeline(page, "Home");
      await scrubCroix10Timeline(page, "ArrowRight");
    },
    proveVisible: async (requirementId, index) => {
      await expectToolcraftProductObservableToChange(
        session,
        session.controlAction("interference.driftCycles", async (control) => {
          await jumpCroix10Slider(control, index % 2 === 0 ? "End" : "Home");
        }),
        { requirementId },
      );
      await expectToolcraftDiscreteSliderMarkers(
        page,
        "interference.driftCycles",
        requirementId,
      );
    },
    requirementId: "interference.driftCycles",
    session,
    target: "interference.driftCycles",
  });
});
