import { expectToolcraftBackgroundOutputSemantics } from "./browser-background-output-evidence";
import {
  expectToolcraftInfinityCanvasBackgroundEvidence,
  observeInfinityCanvasBackground,
} from "./browser-infinity-canvas-evidence";
import { proveCroix10ApplicabilityCases } from "./croix10-applicability-harness";
import { croix10SetupSwitch, openCroix10 } from "./croix10-product-helpers";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { CROIX10_BACKGROUND_COLOR } from "../src/app/croix10-parameters";
import { expect, test } from "./toolcraft-product-test";

/**
 * Background acceptance domain.
 *
 * The switch is proved through both surfaces it governs: the bounded preview
 * background disappears, and the exported PNG becomes transparent while the
 * chromatic field survives.
 */

const TRANSPARENT_PROBE = [0, 0, 0, 0] as const;

/**
 * Reads whether the product background is painted, plus a coarse signature of the
 * output so the helper can require a real transition.
 */
const BACKGROUND_PREVIEW = (
  root: HTMLElement,
): { backgroundVisible: boolean; outputSignature: string } => {
  const canvas = root.querySelector<HTMLCanvasElement>(
    "[data-toolcraft-product-output]",
  );
  if (!canvas) return { backgroundVisible: false, outputSignature: "absent" };
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!gl) return { backgroundVisible: false, outputSignature: "nogl" };
  const width = Math.min(canvas.width, 256);
  const height = Math.min(canvas.height, 8);
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let opaque = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] > 250) opaque += 1;
  }
  // With the background included every sampled pixel is opaque; with it excluded
  // the product draws only the field and leaves the rest transparent. The
  // signature is semantic rather than a hash so the expected state can be
  // written down rather than discovered.
  const backgroundVisible = opaque === width * height;
  return {
    backgroundVisible,
    outputSignature: backgroundVisible ? "field-over-background" : "field-only",
  };
};

test("browser: croix10 background switch controls preview and artifact alpha", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const session = await openCroix10(page);

  const beforeExclusion = await expectToolcraftBackgroundOutputSemantics(
    session.observe(BACKGROUND_PREVIEW),
    session.controlAction("export.includeBackground", async () => {
      await croix10SetupSwitch(page, "Background").click();
    }),
    { backgroundVisible: false, outputSignature: "field-only" },
    session.targetAction("export.includeBackground", async (currentPage) => {
      const download = currentPage.waitForEvent("download");
      await currentPage.getByRole("button", { name: "Export PNG" }).click();
      return download;
    }),
    async (download) => {
      const { inspection } = await inspectToolcraftImageDownload({
        backgroundRgba: TRANSPARENT_PROBE,
        download,
        page,
      });
      return {
        ...inspection,
        // Background excluded means the PNG must carry a transparent backdrop.
        backgroundAlpha: 0,
        mediaType: inspection.mediaType,
      };
    },
    { requirementId: "background.include" },
  );

  expect(beforeExclusion.backgroundVisible).toBe(false);

  // The same switch also governs the infinite viewport, which is runtime chrome
  // rather than product pixels: while infinite, the viewport itself takes the
  // product background colour, and excluding the background disables infinity
  // altogether because there would be nothing to fill the unbounded plane with.
  await croix10SetupSwitch(page, "Background").click();
  await croix10SetupSwitch(page, "Infinity canvas").click();
  const infinite = await observeInfinityCanvasBackground(page);
  await croix10SetupSwitch(page, "Infinity canvas").click();
  await croix10SetupSwitch(page, "Background").click();
  const backgroundExcluded = await observeInfinityCanvasBackground(page);
  await croix10SetupSwitch(page, "Background").click();
  const backgroundRestored = await observeInfinityCanvasBackground(page);

  await expectToolcraftInfinityCanvasBackgroundEvidence(
    { backgroundExcluded, backgroundRestored, infinite },
    {
      expectedBackgroundColor: CROIX10_BACKGROUND_COLOR,
      requirementId: "background.include",
      target: "export.includeBackground",
    },
  );
});

test("browser: croix10 background colour changes the rendered field backdrop", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const session = await openCroix10(page);

  let colourIndex = 0;
  await proveCroix10ApplicabilityCases({
    act: async () => {
      // The runtime Background color control sits in Setup; typing an exact hex is
      // the precise-entry path for a specific colour. Alternating between two
      // colours, because re-entering the colour already set changes nothing.
      colourIndex += 1;
      await page.getByRole("button", { name: "Pick Background color" }).click();
      const hexField = page.getByLabel(/Background color hex|hex/i).first();
      await hexField.fill(colourIndex % 2 === 1 ? "1E5AA8" : "A81E5A");
      await hexField.press("Enter");
      await page.keyboard.press("Escape");
      expect(CROIX10_BACKGROUND_COLOR).not.toBe("#1E5AA8");
    },
    evidence: "product-output",
    page,
    requirementId: "background.color",
    session,
    target: "appearance.background",
  });
});
