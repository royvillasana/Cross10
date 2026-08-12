import type { Download, Page } from "@playwright/test";

import { expectToolcraftExportedArtifact } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftImageExportArtifact } from "./browser-media-export-evidence";
import { proveCroix10ApplicabilityCases } from "./croix10-applicability-harness";
import {
  chooseCroix10Option as chooseOption,
  openCroix10,
  prepareCroix10Slider,
} from "./croix10-product-helpers";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { expect, test } from "./toolcraft-product-test";

/**
 * Image export acceptance domain.
 *
 * Every proof decodes the real artifact: byte length, media type, and pixel
 * dimensions come from the downloaded file rather than from the export UI, and
 * the decoded pixels must contain the chromatic field rather than an empty frame.
 */

const OPAQUE_BLACK = [0, 0, 0, 255] as const;

async function exportImage(page: Page): Promise<Download> {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  return download;
}

async function inspectDownload(download: Download, page: Page) {
  const { inspection } = await inspectToolcraftImageDownload({
    backgroundRgba: OPAQUE_BLACK,
    download,
    page,
  });
  // A decodable artifact is not enough: it must actually contain product pixels.
  expect(
    inspection.nonBackgroundBounds,
    "The exported artifact must contain the chromatic field, not an empty frame.",
  ).not.toBeNull();
  return inspection;
}

test("browser: croix10 export png produces a decodable chromatic field artifact", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const session = await openCroix10(page);

  await expectToolcraftExportedArtifact(
    session.targetAction("export.actions", async (currentPage) =>
      exportImage(currentPage),
    ),
    async (download) => {
      const inspection = await inspectDownload(download, page);
      expect(inspection.mediaType).toBe("image/png");
      // 4K is the schema default, so the long edge must be 4096.
      expect(Math.max(inspection.width, inspection.height)).toBe(4096);
      return inspection;
    },
    { requirementId: "export.image-action" },
  );

  // The row also carries the protected image-export claim, which is stricter than
  // "decodable": exact dimensions, exact media type, the field filling the frame, and
  // named colours where the composition puts them. Two wide bands make those colours
  // predictable rather than incidental.
  await prepareCroix10Slider(page, "stripe.count", 0);
  await expectToolcraftImageExportArtifact(
    session.targetAction("export.actions", async (currentPage) =>
      exportImage(currentPage),
    ),
    {
      backgroundRgba: OPAQUE_BLACK,
      // The field is full bleed, so every pixel is product output.
      expectedBounds: { height: 1, width: 1, x: 0, y: 0 },
      // Long edge 4096 at the default 4K resolution, at the artboard's 16:9.
      expectedHeight: 2304,
      expectedMediaType: "image/png",
      expectedPixels: [
        // The first palette slot, and the slot the sequence wraps onto: both are
        // exact in a lossless PNG because the shader converts to sRGB once.
        { rgba: [11, 122, 59, 255], xRatio: 0.25, yRatio: 0.5 },
        { rgba: [11, 60, 138, 255], xRatio: 0.75, yRatio: 0.5 },
      ],
      expectedWidth: 4096,
      page,
      requirementId: "export.image-action",
    },
  );
});

test("browser: croix10 image export format changes the decoded artifact type", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const session = await openCroix10(page);

  const png = await expectToolcraftExportedArtifact(
    session.controlAction("export.image.format", async (_control, currentPage) =>
      exportImage(currentPage),
    ),
    async (download) => {
      const inspection = await inspectDownload(download, page);
      expect(inspection.mediaType).toBe("image/png");
      return inspection;
    },
    { requirementId: "export.image-format" },
  );

  await chooseOption(page, "export.image.format", "JPG");

  await expectToolcraftExportedArtifact(
    session.controlAction("export.image.format", async (_control, currentPage) =>
      exportImage(currentPage),
    ),
    async (download) => {
      const inspection = await inspectDownload(download, page);
      // The decoded media type must follow the selection, which is what proves
      // the option changed the artifact rather than only the select label.
      expect(inspection.mediaType).toBe("image/jpeg");
      expect(inspection.decodedPixelHash).not.toEqual(png.decodedPixelHash);
      return inspection;
    },
    { requirementId: "export.image-format" },
  );

  // And reproved at every resolution the export offers, because the format decides
  // the codec and the resolution decides the backing: a format that produced the
  // wrong media type at one resolution would otherwise hide behind another.
  await proveCroix10ApplicabilityCases({
    act: async (index) => {
      await chooseOption(
        page,
        "export.image.format",
        index % 2 === 0 ? "JPG" : "PNG",
      );
    },
    page,
    proveVisible: async (requirementId) => {
      await expectToolcraftExportedArtifact(
        session.controlAction(
          "export.image.format",
          async (_control, currentPage) => exportImage(currentPage),
        ),
        async (download) => inspectDownload(download, page),
        { requirementId },
      );
    },
    requirementId: "export.image-format",
    session,
    target: "export.image.format",
  });
});

test("browser: croix10 image export resolution changes decoded pixel dimensions", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const session = await openCroix10(page);

  await chooseOption(page, "export.image.resolution", "2K");

  // The helper resolves to the artifact, not the inspection, so the 2K aspect is
  // captured here for comparison against the 4K export.
  let twoKAspect = Number.NaN;

  await expectToolcraftExportedArtifact(
    session.controlAction(
      "export.image.resolution",
      async (_control, currentPage) => exportImage(currentPage),
    ),
    async (download) => {
      const inspection = await inspectDownload(download, page);
      expect(Math.max(inspection.width, inspection.height)).toBe(2048);
      twoKAspect = inspection.width / inspection.height;
      return inspection;
    },
    { requirementId: "export.image-resolution" },
  );

  await chooseOption(page, "export.image.resolution", "4K");

  await expectToolcraftExportedArtifact(
    session.controlAction(
      "export.image.resolution",
      async (_control, currentPage) => exportImage(currentPage),
    ),
    async (download) => {
      const inspection = await inspectDownload(download, page);
      expect(Math.max(inspection.width, inspection.height)).toBe(4096);
      // The composition must scale rather than gain bands: a 4K export of the
      // same scene is not the 2K export with more stripes in it.
      expect(inspection.width / inspection.height).toBeCloseTo(twoKAspect, 2);
      return inspection;
    },
    { requirementId: "export.image-resolution" },
  );

  await proveCroix10ApplicabilityCases({
    act: async (index) => {
      await chooseOption(
        page,
        "export.image.resolution",
        index % 2 === 0 ? "8K" : "2K",
      );
    },
    page,
    proveVisible: async (requirementId) => {
      await expectToolcraftExportedArtifact(
        session.controlAction(
          "export.image.resolution",
          async (_control, currentPage) => exportImage(currentPage),
        ),
        async (download) => inspectDownload(download, page),
        { requirementId },
      );
    },
    requirementId: "export.image-resolution",
    session,
    target: "export.image.resolution",
  });
});
