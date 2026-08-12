import type { Locator, Page } from "@playwright/test";

import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { proveCroix10ApplicabilityCases } from "./croix10-applicability-harness";
import {
  chooseCroix10Option,
  jumpCroix10Slider,
  openCroix10,
  readCroix10FieldSignature,
  scrubCroix10Timeline,
  setCroix10TimelineDuration,
  settleCroix10Field,
  showCroix10ExtendedTimeline,
} from "./croix10-product-helpers";
import { expectToolcraftCompoundControlPartOutcome } from "./browser-state-evidence-helpers";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { expectToolcraftDiscreteSliderMarkers } from "./performance-control-layout-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Chromatic ramp acceptance domain.
 *
 * The ramp is a second colour source for the same stripe field, so every proof
 * here reads the backing buffer rather than the control: the claim is always that
 * the rendered bands changed, never that a value was accepted.
 *
 * The ramp takes its geometry from the gradient control's own type and angle
 * rather than from sibling controls (R23), which is why the gradient row covers
 * five parts and each of them is driven here.
 */


type Croix10SignatureWindow = { croix10Signature: () => string };

/**
 * Installs a page-side field readback and a marker the observations compare against.
 *
 * A proof observation is serialised into the browser and cannot close over a
 * Node-side value, so "did the field change" is expressed as "does the current
 * signature differ from the one stashed on the app root". The stash is a data
 * attribute rather than a closure for exactly that reason.
 */
async function installRampSignatureProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as Croix10SignatureWindow).croix10Signature = (): string => {
      const canvas = document.querySelector(
        "[data-toolcraft-product-output]",
      ) as HTMLCanvasElement | null;
      if (!canvas) return "no-canvas";
      const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
      if (!gl) return "no-webgl2";
      const { height, width } = canvas;
      if (width === 0 || height === 0) return "empty";
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let hash = 0;
      const sampled = Math.min(pixels.length, 400_000);
      for (let index = 0; index < sampled; index += 1) {
        hash = (hash * 31 + pixels[index]) >>> 0;
      }
      return `${width}x${height}:${hash}`;
    };
  });
}

/** Stashes the current field so the next part proof can say what changed. */
async function markRampField(page: Page): Promise<void> {
  await settleCroix10Field(page);
  await page.evaluate(() => {
    const root = document.querySelector('[data-slot="toolcraft-runtime-app"]');
    root?.setAttribute(
      "data-croix10-mark",
      (window as unknown as Croix10SignatureWindow).croix10Signature(),
    );
  });
}

/** Opens Croix10 with the ramp as the band colour source. */
async function openCroix10WithRamp(page: Page) {
  const session = await openCroix10(page);
  await chooseCroix10Option(page, "ramp.source", "Continuous");
  await settleCroix10Field(page);
  return session;
}

/** The gradient control's own field, which scopes every part below. */
async function rampField(page: Page): Promise<Locator> {
  return getToolcraftControlFieldByTarget(page, "ramp.gradient");
}

/**
 * Chooses the gradient's own type.
 *
 * The gradient renders its type as an internal select with no schema target of
 * its own, so this mirrors what `chooseCroix10Option` does for targeted selects:
 * scroll the trigger in, then wait for a *visible* option. Matching options by
 * accessible name alone picks up the closed selects still mounted in the DOM and
 * waits forever on one that will never be shown.
 */
async function setRampType(page: Page, label: string): Promise<void> {
  const trigger = (await rampField(page)).getByRole("combobox").first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const option = page
    .locator('[role="option"]')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .first();
  await option.waitFor({ state: "visible" });
  await option.click();
  await option.waitFor({ state: "hidden" });
  await settleCroix10Field(page);
}

/** Commits a text part of the ramp — angle, a stop position, a stop opacity, a hex. */
async function setRampText(
  page: Page,
  name: string,
  value: string,
): Promise<void> {
  const input = (await rampField(page)).getByRole("textbox", { name });
  await input.fill(value);
  await input.press("Enter");
  await settleCroix10Field(page);
}

test("browser: croix10 band colour source switches between palette and ramp", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const session = await openCroix10(page);

  // The palette composition is captured first and compared again at the end: the
  // claim is not merely that switching changed something, but that the palette
  // path is intact underneath and the ramp is genuinely opt-in.
  const withPalette = await readCroix10FieldSignature(page);
  expect(withPalette).not.toBe("no-webgl2");

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("ramp.source", async () => {
      await chooseCroix10Option(page, "ramp.source", "Continuous");
    }),
    { requirementId: "ramp.source" },
  );

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("ramp.source", async () => {
      await chooseCroix10Option(page, "ramp.source", "Palette");
    }),
    { requirementId: "ramp.source" },
  );

  await settleCroix10Field(page);
  expect(await readCroix10FieldSignature(page)).toBe(withPalette);

  // The gate is itself gated: the mixing-space selector is a peer in this section,
  // so the harness derives a case per mixing space and the source has to stay live
  // in each. Each case leaves the ramp active again, or the next case would have no
  // mixing-space selector to drive.
  await chooseCroix10Option(page, "ramp.source", "Continuous");
  await settleCroix10Field(page);

  await proveCroix10ApplicabilityCases({
    act: () => chooseCroix10Option(page, "ramp.source", "Palette"),
    evidence: "rendered-pixels",
    page,
    requirementId: "ramp.source",
    restore: async () => {
      await chooseCroix10Option(page, "ramp.source", "Continuous");
      await settleCroix10Field(page);
    },
    session,
    target: "ramp.source",
  });
});

test("browser: croix10 ramp type, angle, and stops recolour the bands", async ({
  page,
}) => {
  // Six part transitions in each of the branches the section gates derive.
  test.setTimeout(900_000);

  const session = await openCroix10WithRamp(page);
  await installRampSignatureProbe(page);

  // Every part the gradient owns, reproved in every branch the section's gates
  // derive. The parts are the reason the ramp consumes the gradient's own type
  // and angle instead of reproducing them as sibling controls: a part the
  // renderer ignored could not be proved here, and the control cannot be
  // declared without proving all of them (R23, R43).
  const PARTS = [
    {
      name: "gradient.gradientType",
      reset: () => setRampType(page, "Linear"),
      run: () => setRampType(page, "Radial"),
    },
    {
      name: "gradient.angle",
      reset: () => setRampText(page, "Gradient angle", "0"),
      run: () => setRampText(page, "Gradient angle", "45"),
    },
    {
      name: "gradient.stops.position",
      reset: () => setRampText(page, "Stop 2 position", "20"),
      run: () => setRampText(page, "Stop 2 position", "70"),
    },
    {
      name: "gradient.stops.color",
      reset: () => setRampText(page, "Stop 2 hex", "#DC7A3F"),
      run: () => setRampText(page, "Stop 2 hex", "#FF0000"),
    },
    {
      name: "gradient.stops.opacity",
      reset: () => setRampText(page, "Stop 2 opacity", "100"),
      run: () => setRampText(page, "Stop 2 opacity", "0"),
    },
  ] as const;

  await proveCroix10ApplicabilityCases({
    act: async () => {},
    page,
    proveVisible: async (requirementId) => {
      // The part id carries the branch: the derived requirement is
      // row#part#applicability, so the suffix is taken from the harness's own id
      // rather than formatted by hand.
      const suffix = requirementId.slice("ramp.gradient".length);
      for (const part of PARTS) {
        // The mark is taken before the action and the action runs inside the
        // helper: the transition has to be measured across it, not established
        // beforehand and then asserted.
        await markRampField(page);
        await expectToolcraftCompoundControlPartOutcome(
          session.observe(
            (root) =>
              (window as unknown as Croix10SignatureWindow).croix10Signature() !==
              root.getAttribute("data-croix10-mark"),
          ),
          session.controlAction("ramp.gradient", async () => {
            await part.run();
          }),
          true,
          { part: `${part.name}${suffix}`, requirementId: "ramp.gradient" },
        );
        // Back to the branch's starting ramp, so each part is measured against
        // the same transition rather than against the previous part's result.
        await part.reset();
      }

      // The control's own outcome in this branch, alongside its parts: the parts
      // say each field reaches the renderer, this says the control as a whole is
      // still live here.
      await expectToolcraftProductObservableToChange(
        session,
        session.controlAction("ramp.gradient", async () => {
          await setRampType(page, "Radial");
        }),
        { requirementId },
      );
      await setRampType(page, "Linear");
    },
    requirementId: "ramp.gradient",
    session,
    target: "ramp.gradient",
  });
});

test("browser: croix10 ramp mixing space changes the midtones", async ({ page }) => {
  // Every branch the ramp's own gate derives, each with a settle window.
  test.setTimeout(300_000);

  const session = await openCroix10WithRamp(page);

  await proveCroix10ApplicabilityCases({
    act: (index) =>
      chooseCroix10Option(
        page,
        "ramp.interpolationSpace",
        index % 2 === 0 ? "sRGB" : "Linear light",
      ),
    evidence: "rendered-pixels",
    page,
    requirementId: "ramp.interpolationSpace",
    session,
    target: "ramp.interpolationSpace",
  });
});

test("browser: croix10 ramp offset slides the transition", async ({ page }) => {
  // Every branch the ramp's own gate derives, each with a settle window.
  test.setTimeout(300_000);

  const session = await openCroix10WithRamp(page);

  await proveCroix10ApplicabilityCases({
    act: async (index) => {
      await jumpCroix10Slider(
        await getToolcraftControlFieldByTarget(page, "ramp.phase"),
        index % 2 === 0 ? "End" : "Home",
      );
    },
    evidence: "rendered-pixels",
    page,
    requirementId: "ramp.phase",
    session,
    target: "ramp.phase",
  });
});

test("browser: croix10 ramp drift travels the transition across the loop", async ({
  page,
}) => {
  // Seven applicability branches, each with a readback and a stability window.
  test.setTimeout(420_000);

  const session = await openCroix10WithRamp(page);
  await showCroix10ExtendedTimeline(page);

  // Zero drift is genuinely static: the ramp sits where it sits at every instant
  // of the loop. Proved first, so the change below belongs to the rate rather
  // than to the timeline having moved.
  await scrubCroix10Timeline(page, "Home");
  const stillAtStart = await readCroix10FieldSignature(page);
  expect(stillAtStart).not.toBe("no-webgl2");
  await scrubCroix10Timeline(page, "ArrowRight");
  expect(await readCroix10FieldSignature(page)).toBe(stillAtStart);

  await jumpCroix10Slider(
    await getToolcraftControlFieldByTarget(page, "ramp.driftCycles"),
    "End",
  );
  await settleCroix10Field(page);

  // With a rate set the same scrub slides the ramp through the bands, and the
  // loop's last instant renders its first — the seam R41 buys by keeping the
  // domain whole cycles.
  await scrubCroix10Timeline(page, "Home");
  const drivenAtStart = await readCroix10FieldSignature(page);
  await scrubCroix10Timeline(page, "ArrowRight");
  expect(await readCroix10FieldSignature(page)).not.toBe(drivenAtStart);
  await scrubCroix10Timeline(page, "End");
  expect(await readCroix10FieldSignature(page)).toBe(drivenAtStart);

  // Duration is loop length, not scene design: after editing it the ramp sits
  // where it sat at the start of the loop, and the seam still stitches. That is
  // what makes whole-cycle drift a property of the ramp rather than of the clock
  // it happens to be running against.
  await setCroix10TimelineDuration(page, 4);
  await scrubCroix10Timeline(page, "Home");
  expect(await readCroix10FieldSignature(page)).toBe(drivenAtStart);
  await scrubCroix10Timeline(page, "End");
  expect(await readCroix10FieldSignature(page)).toBe(drivenAtStart);

  // The rate is reproved in every branch that renders it, measured away from the
  // loop origin: at t=0 every rate renders the same phase, so a rate change read
  // at Home would be invisible for reasons unrelated to the control.
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
        session.controlAction("ramp.driftCycles", async (control) => {
          await jumpCroix10Slider(control, index % 2 === 0 ? "End" : "Home");
        }),
        { requirementId },
      );
      await expectToolcraftDiscreteSliderMarkers(
        page,
        "ramp.driftCycles",
        requirementId,
      );
    },
    requirementId: "ramp.driftCycles",
    session,
    target: "ramp.driftCycles",
  });
});

/**
 * App-owned rather than acceptance-derived.
 *
 * The ramp's own controls are covered by the rows above; what this adds is that
 * the ramp survives the export path, which is a property of the shared
 * `renderFrame` callback rather than of any one control. There is no acceptance
 * `kind` that fits "the export path agrees with preview about a colour source",
 * so it takes the same route the keyboard accelerator did (0.18a): a named
 * product test rather than a row that would have to misdescribe itself.
 */
test("browser: croix10 ramp reaches the exported artifact at every resolution", async ({
  page,
}) => {
  test.setTimeout(300_000);

  await openCroix10(page);

  async function exportAndInspect() {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PNG" }).click();
    const { inspection } = await inspectToolcraftImageDownload({
      backgroundRgba: [0, 0, 0, 255],
      download: await pending,
      page,
    });
    expect(
      inspection.nonBackgroundBounds,
      "The exported artifact must contain the chromatic field, not an empty frame.",
    ).not.toBeNull();
    return inspection;
  }

  await chooseCroix10Option(page, "export.image.resolution", "2K");
  const palette2k = await exportAndInspect();
  expect(Math.max(palette2k.width, palette2k.height)).toBe(2048);

  await chooseCroix10Option(page, "ramp.source", "Continuous");
  await settleCroix10Field(page);
  const ramp2k = await exportAndInspect();
  expect(Math.max(ramp2k.width, ramp2k.height)).toBe(2048);
  // The artifact itself changed, so the export path read the ramp rather than
  // rendering the palette composition the preview had replaced.
  expect(ramp2k.decodedPixelHash).not.toBe(palette2k.decodedPixelHash);

  // The same composition at a larger backing, not more bands: the aspect is
  // unchanged, so the ramp scaled with the field instead of being resampled into
  // a different picture.
  await chooseCroix10Option(page, "export.image.resolution", "4K");
  const ramp4k = await exportAndInspect();
  expect(Math.max(ramp4k.width, ramp4k.height)).toBe(4096);
  expect(ramp4k.width / ramp4k.height).toBeCloseTo(ramp2k.width / ramp2k.height, 3);
});
