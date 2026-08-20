import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The line between contributing pixels and delivering a file.
 *
 * The product draws. The runtime allocates the artifact backing, composites the
 * background, encodes, names the file, and hands it to the browser. That split
 * is what makes the same composition come out of the still path and the video
 * path identically, and it is the kind of boundary that erodes one convenience
 * at a time — a `toBlob` here to check something, an object URL there to preview
 * it — until the product has a second delivery path that nobody chose.
 *
 * **One allocation is expected and is not a violation.** `renderStudioExportFrame`
 * creates an offscreen canvas to obtain a WebGL2 context, because a GL context is
 * the only way to run the stack's program and the runtime supplies a 2D context.
 * Its pixels are drawn into the runtime's context and it is dropped. That is a
 * rendering surface, not an artifact: it is never encoded, never named, and never
 * reaches the user. Everything below is about what happens *after* pixels exist.
 */

const appDir = dirname(fileURLToPath(import.meta.url));

/**
 * Ways of turning pixels into a file the user receives.
 *
 * Each is a complete delivery step on its own, which is why the list is of
 * capabilities rather than of a single forbidden call: a product that reached
 * only for `createObjectURL` would still be delivering.
 */
const DELIVERY_CALLS = [
  "toBlob",
  "toDataURL",
  "createObjectURL",
  "VideoEncoder",
  "MediaRecorder",
  "showSaveFilePicker",
  "msSaveBlob",
] as const;

/**
 * Strips comments before scanning.
 *
 * These files explain themselves at length, and several explain precisely why
 * they do *not* do the things listed below — a paragraph about why a direct DOM
 * `.click()` was needed in a proof is prose, not a delivery path. Scanning raw
 * text would make this test fail on its own subject matter being discussed.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function readProductSources(): readonly { path: string; source: string }[] {
  return readdirSync(appDir)
    .filter(
      (name) =>
        (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.includes(".test."),
    )
    .map((name) => ({
      path: name,
      source: stripComments(readFileSync(join(appDir, name), "utf8")),
    }));
}

describe("studio delivery boundary", () => {
  it("never encodes, names, or hands over a file", () => {
    const offenders = readProductSources().flatMap(({ path, source }) =>
      DELIVERY_CALLS.filter((call) => source.includes(call)).map(
        (call) => `${path}: ${call}`,
      ),
    );

    expect(offenders, "the runtime owns delivery; the product owns pixels").toEqual(
      [],
    );
  });

  it("triggers no download of its own", () => {
    // A download is the last step of delivery and the easiest to add by
    // accident, because an anchor with a `download` attribute looks like markup
    // rather than like a second export pipeline.
    //
    // `.click()` alone stopped being the signal when the product started
    // pressing the runtime's own file input to open the system *open* dialog.
    // That is bytes coming in; this boundary is about bytes going out. So the
    // check names what leaving actually looks like — an anchor, or a download
    // attribute — and the clicking is constrained by the test below instead.
    const offenders = readProductSources()
      .filter(({ source }) =>
        /download\s*[:=]|createElement\(\s*"a"\s*\)|\.download\b/.test(source),
      )
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it("clicks nothing but the runtime's own import control", () => {
    // The other half. Exactly one product module presses anything, it presses a
    // file input belonging to the runtime, and it does so to open a dialog that
    // brings media in. A second module reaching for `.click()` is a second
    // place to smuggle out a file.
    const clickers = readProductSources()
      .filter(({ source }) => /\.click\(\)/.test(source))
      .map(({ path }) => path);

    expect(clickers).toEqual(["studio-add-media-menu.tsx"]);
  });

  it("allocates exactly one canvas, and only to obtain a GL context", () => {
    // Named rather than counted globally: the point is not that the number is
    // one but that the one is this one, drawn from and discarded. A second
    // allocation anywhere else is a product building its own artifact.
    const allocations = readProductSources().flatMap(({ path, source }) =>
      source.includes('createElement("canvas")') ? [path] : [],
    );

    // Two now, and the second is the same kind of thing as the first: a surface
    // the product draws *into* on its way to pixels, never an artifact.
    //
    // `studio-path-mask.ts` rasterizes a drawn region into a mask that the
    // shader samples. Its canvas is uploaded as a texture and never encoded,
    // never named, and never handed to anyone -- the same argument the export
    // frame's GL surface makes, and it is the reason this test names the files
    // rather than counting them. A third would be a product building its own
    // artifact, which is what this exists to catch.
    expect(allocations.sort()).toEqual([
      "app-composition.tsx",
      "studio-path-mask.ts",
    ]);
  });
});
