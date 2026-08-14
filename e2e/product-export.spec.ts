import type { Download, Page } from "@playwright/test";

import { expectToolcraftExportedArtifact } from "./browser-acceptance-outcome-helpers";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import {
  openStudioSingleLayer,
  setStudioSelectValue,
} from "./studio-product-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Image export acceptance domain.
 *
 * Every proof decodes the real artifact: media type and pixel dimensions come
 * from the downloaded file rather than from the export UI, and the decoded
 * pixels must contain the stack rather than an empty frame.
 */

const OPAQUE_BLACK = [0, 0, 0, 255] as const;

async function exportImage(page: Page): Promise<Download> {
  const download = page.waitForEvent("download");
  // Matched exactly. A prefix match also catches "Export Settings" in the setup
  // section, which downloads a settings file — the artifact then fails to decode
  // as an image, which reads like a broken exporter rather than a mis-aimed
  // click. The action keeps this label whichever format is selected.
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
    "The exported artifact must contain the layer stack, not an empty frame.",
  ).not.toBeNull();
  return inspection;
}

test("browser: studio export png produces a decodable layer stack artifact", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const { session } = await openStudioSingleLayer(page);

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

  // The sticky footer is one surface and this row covers every action in it, so
  // the clipboard action is proved here rather than in a row of its own. What
  // lands has to be runnable source, not a description of one.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy shader source" }).click();

  const copied = await page.evaluate(() => navigator.clipboard.readText());

  expect(copied).toContain("void main()");
  expect(copied).toContain("uniform vec2 uResolution;");
  // Baked, so the recipient wires one uniform rather than fifty.
  expect(copied).toMatch(/const float uLayer0_count = [\d.]+;/u);
  // The artifact has to compile elsewhere, so it can carry nothing of ours.
  expect(copied).not.toContain("Croix10");
  expect(copied).not.toContain("Shader Studio");
  expect(copied).not.toContain("Toolcraft");
});

test("browser: studio image export format changes the decoded artifact type", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const { session } = await openStudioSingleLayer(page);

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

  await setStudioSelectValue(page, "export.image.format", "JPG");

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
});

test("browser: studio image export resolution changes decoded pixel dimensions", async ({
  page,
}) => {
  test.setTimeout(300_000);

  const { session } = await openStudioSingleLayer(page);

  // Every option in turn, because the resolution decides the backing the frame
  // is rendered into: one that produced the right long edge at 4K while
  // ignoring 2K would otherwise pass on the default alone.
  for (const [option, longEdge] of [
    ["2K", 2048],
    ["4K", 4096],
    ["8K", 8192],
  ] as const) {
    await setStudioSelectValue(page, "export.image.resolution", option);

    await expectToolcraftExportedArtifact(
      session.controlAction(
        "export.image.resolution",
        async (_control, currentPage) => exportImage(currentPage),
      ),
      async (download) => {
        const inspection = await inspectDownload(download, page);
        expect(
          Math.max(inspection.width, inspection.height),
          `${option} must decode to a ${longEdge}px long edge`,
        ).toBe(longEdge);
        return inspection;
      },
      { requirementId: "export.image-resolution" },
    );
  }
});
