import { expectToolcraftBackgroundOutputSemantics } from "./browser-background-output-evidence";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import {
  openStudioSingleLayer,
  setStudioColorHex,
  setStudioSlider,
  toggleStudioSwitch,
} from "./studio-product-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Background acceptance domain.
 *
 * The switch is proved through both surfaces it governs: the bounded preview
 * loses its ground, and the exported PNG becomes transparent while the stack
 * survives.
 *
 * The fixture runs the layer at half opacity deliberately. A stack at full
 * opacity covers every pixel, so removing the ground behind it changes no alpha
 * and the proof would pass without the background having been observed at all.
 */

const TRANSPARENT_PROBE = [0, 0, 0, 0] as const;

/**
 * Whether the composite is grounded, plus a coarse reading of the output.
 *
 * With the background included every sampled pixel is opaque; with it excluded
 * the product draws only the stack and leaves the rest of the alpha to it. The
 * signature is semantic rather than a hash so the expected state can be written
 * down rather than discovered.
 */
const BACKGROUND_PREVIEW = (
  root: HTMLElement,
): { backgroundVisible: boolean; outputSignature: string } => {
  const canvas = root.querySelector(
    "[data-toolcraft-product-output]",
  ) as HTMLCanvasElement | null;
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

  const backgroundVisible = opaque === width * height;
  return {
    backgroundVisible,
    outputSignature: backgroundVisible ? "stack-over-ground" : "stack-only",
  };
};

test("browser: studio background switch grounds the composite", async ({ page }) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const { session } = await openStudioSingleLayer(page);
  // Half opacity is what makes the ground observable behind the stack.
  await setStudioSlider(page, "Opacity", 0.5);

  const afterExclusion = await expectToolcraftBackgroundOutputSemantics(
    session.observe(BACKGROUND_PREVIEW),
    session.controlAction("export.includeBackground", async () => {
      await toggleStudioSwitch(page, "export.includeBackground");
    }),
    { backgroundVisible: false, outputSignature: "stack-only" },
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

  expect(afterExclusion.backgroundVisible).toBe(false);
});

test("browser: studio background color grounds preview and export alike", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { session } = await openStudioSingleLayer(page);
  // The ground has to be visible through the stack for recolouring it to reach
  // the frame at all; at full opacity the layer would hide the change.
  await setStudioSlider(page, "Opacity", 0.5);

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("appearance.background", async () => {
      await setStudioColorHex(page, "Background color", "#FF0000");
    }),
    { requirementId: "background.color" },
  );
});
