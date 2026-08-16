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
    const offenders = readProductSources()
      .filter(({ source }) => /download\s*[:=]|\.click\(\)/.test(source))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it("allocates exactly one canvas, and only to obtain a GL context", () => {
    // Named rather than counted globally: the point is not that the number is
    // one but that the one is this one, drawn from and discarded. A second
    // allocation anywhere else is a product building its own artifact.
    const allocations = readProductSources().flatMap(({ path, source }) =>
      source.includes('createElement("canvas")') ? [path] : [],
    );

    expect(allocations).toEqual(["app-composition.tsx"]);
  });
});
