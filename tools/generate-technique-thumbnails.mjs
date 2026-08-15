/**
 * Renders one thumbnail per technique, from the product's own renderer.
 *
 * The thumbnails have to be *true*: the picker sells a technique on what it
 * looks like, so an image showing something the app would not actually produce
 * misdescribes the thing it selects. That rules out drawing them by hand and it
 * rules out approximating the field in SVG, which would be a second renderer
 * free to drift from the real one the moment either changed.
 *
 * So this drives the built app the way an author would -- choose the entry,
 * press Apply, wait for the frame to settle -- and captures the canvas. What
 * ships is what the press produces.
 *
 * Output is a generated module of data URIs rather than files on disk, because
 * the schema needs every `src` at module-load time and the picker is declared
 * statically. Re-run with `npm run thumbnails` after changing a preset, a
 * palette, or the renderer.
 */

import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = join(root, "dist");

const TYPES = {
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/**
 * Wide enough to read a band field, small enough to sit in a grid of ten.
 *
 * Four by three because that is the picker tile's own aspect, and it covers
 * rather than fits -- a sixteen-by-nine capture would have its ends cropped
 * off, which for a composition built on a region inset is exactly the part
 * worth seeing.
 */
const WIDTH = 320;
const HEIGHT = 240;

function serveDist() {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const asFile = join(dist, decodeURIComponent(url.pathname));
    const path = extname(asFile) ? asFile : join(dist, "index.html");

    response.setHeader(
      "content-type",
      TYPES[extname(path)] ?? "application/octet-stream",
    );
    createReadStream(path)
      .on("error", () => {
        response.statusCode = 404;
        response.end("not found");
      })
      .pipe(response);
  });

  return new Promise((done) => {
    server.listen(0, "127.0.0.1", () => done(server));
  });
}

async function chooseEntry(page, label) {
  // Matched as a button: each picker item is a button carrying the entry's
  // label, wrapping an image whose own alt is empty. Note this still works on a
  // checkout whose thumbnails have never been generated -- the items come from
  // the preset list, so they exist and are clickable with an empty `src`, which
  // is what keeps the generator from depending on its own output.
  await page
    .locator('[data-toolcraft-control-target="gallery.entry"]')
    .getByRole("button", { name: label, exact: true })
    .first()
    .click();
  // Both presses. Changing the technique replaces the composition, so it asks
  // first: over an empty canvas the first press applies and leaves the second
  // with nothing to confirm, and over the previous entry's stack -- which is
  // every capture after the first -- the second press is the one that lands.
  const press = (name) =>
    page
      .locator('[data-toolcraft-control-target="gallery.actions"]')
      .getByRole("button", { name })
      .first()
      .click();

  await press("Change the technique");
  await press("replace my work");
}

/**
 * Waits until two consecutive frames agree.
 *
 * A shot taken while the stack is still compiling catches a blank or a partial
 * field, and a blank thumbnail is worse than none: it says the technique draws
 * nothing.
 */
async function settle(page) {
  let previous = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current = await page.evaluate(() => {
      const canvas = document.querySelector("[data-toolcraft-product-output]");
      if (!(canvas instanceof HTMLCanvasElement)) return "absent";
      const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
      if (!gl) return "absent";
      const pixels = new Uint8Array(64 * 4);
      gl.readPixels(
        Math.floor(canvas.width / 2) - 32,
        Math.floor(canvas.height / 2),
        64,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      return Array.from(pixels).join(",");
    });
    if (current !== "absent" && current === previous) return;
    previous = current;
    await page.waitForTimeout(250);
  }
}

/**
 * How many bands a thumbnail should show.
 *
 * The picker lays ten items out in four columns, so a tile is well under a
 * hundred pixels wide. A two-hundred-band field drawn across it averages to a
 * flat grey -- faithful, and a picture of nothing. Fourteen bands is enough to
 * read a rhythm, a taper and a separator at that size.
 */
const TARGET_BANDS = 14;

async function capture(page, count) {
  return page.evaluate(
    ([width, height, bands, TARGET]) => {
      const canvas = document.querySelector("[data-toolcraft-product-output]");
      if (!(canvas instanceof HTMLCanvasElement)) return "";
      const off = document.createElement("canvas");
      off.width = width;
      off.height = height;
      const context = off.getContext("2d");
      if (!context) return "";
      // A detail rather than the whole frame, when the whole frame would not
      // survive the tile. These are still the product's own pixels -- nothing
      // is redrawn or approximated -- but read close enough that the technique
      // is visible, the way a swatch shows a weave.
      //
      // Sized from the entry's own band count, so a sparse field still shows
      // its whole composition and only a dense one is cropped into.
      const fraction = bands > 0 ? Math.min(1, TARGET / bands) : 1;
      const sourceWidth = Math.max(32, Math.round(canvas.width * fraction));
      const sourceHeight = Math.min(
        canvas.height,
        Math.round(sourceWidth * (height / width)),
      );
      context.drawImage(
        canvas,
        Math.round((canvas.width - sourceWidth) / 2),
        Math.round((canvas.height - sourceHeight) / 2),
        sourceWidth,
        sourceHeight,
        0,
        0,
        width,
        height,
      );
      return off.toDataURL("image/webp", 0.72);
    },
    [WIDTH, HEIGHT, count, TARGET_BANDS],
  );
}

/**
 * The library, read out of its own source.
 *
 * Parsed rather than imported because plain node cannot load the TypeScript
 * module, and rather than copied because a copy would keep generating nine
 * thumbnails after a tenth technique was added -- and the missing one would
 * look like a technique nobody had drawn rather than one nobody had captured.
 */
async function readPresets() {
  const source = await readFile(join(root, "src/app/studio-presets.ts"), "utf8");

  // The series table, so the picker name can be composed exactly the way the
  // product composes it. Matching by the bare label stopped working the moment
  // the series joined the name, and the failure was silent: the locator found
  // nothing and every capture would have been of whichever entry was already
  // selected.
  const seriesBlock = source.slice(
    source.indexOf("export const STUDIO_SERIES"),
    source.indexOf("export type StudioSeriesId"),
  );
  const series = new Map(
    [...seriesBlock.matchAll(
      /"?([\w-]+)"?:\s*\{\s*carriage: "(carry|evoke)",\s*label: "([^"]+)"/gu,
    )].map(([, id, carriage, label]) => [id, { carriage, label }]),
  );

  const body = source.slice(source.indexOf("export const STUDIO_PRESETS"));
  const starts = [...body.matchAll(/\bid: "([^"]+)",/gu)];

  return starts.map((match, index) => {
    const from = match.index ?? 0;
    const to = starts[index + 1]?.index ?? body.length;
    const entry = body.slice(from, to);
    // The densest field the entry draws. It decides how much of the frame the
    // thumbnail can show and still be a picture of anything.
    const counts = [...entry.matchAll(/\bcount: (\d+)/gu)].map(([, value]) =>
      Number(value),
    );
    const label = entry.match(/\blabel: "([^"]+)"/u)?.[1] ?? "";
    const seriesId = entry.match(/\bseries: "([^"]+)"/u)?.[1] ?? "";
    const palette = entry.match(/\bpalette: "([^"]+)"/u)?.[1] ?? "";
    const carried = series.get(seriesId);
    if (!carried) throw new Error(`Unknown series "${seriesId}" for preset ${match[1]}.`);

    const provenance = palette === "verified" ? ", verified palette" : "";
    return {
      count: counts.length > 0 ? Math.max(...counts) : 0,
      id: match[1],
      label,
      pickerLabel:
        carried.carriage === "evoke"
          ? `${label} — evoking ${carried.label}${provenance}`
          : `${label} — ${carried.label}${provenance}`,
    };
  });
}

const presets = await readPresets();
if (presets.length === 0) throw new Error("No presets found in studio-presets.ts.");
process.stdout.write(`capturing ${presets.length} techniques\n`);

const server = await serveDist();
const { port } = server.address();
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { height: 900, width: 1600 },
});

await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForSelector("[data-toolcraft-product-output]");

const thumbnails = {};
for (const preset of presets) {
  await chooseEntry(page, preset.pickerLabel);
  await settle(page);
  const src = await capture(page, preset.count);
  if (!src.startsWith("data:image/")) {
    throw new Error(`Captured nothing for ${preset.id}.`);
  }
  thumbnails[preset.id] = src;
  process.stdout.write(
    `${preset.id}: ${Math.round(src.length / 1024)}kB (${preset.count || "no"} bands)\n`,
  );
}

await browser.close();
server.close();

const module = `// Generated by \`npm run thumbnails\`. Do not edit by hand.
//
// One render per technique, produced by the product's own renderer from the
// preset it selects, so the picker shows what pressing Apply actually gives.
// Re-run after changing a preset, a palette, or the renderer.

export const STUDIO_TECHNIQUE_THUMBNAILS: Readonly<Record<string, string>> = {
${Object.entries(thumbnails)
  .map(([id, src]) => `  "${id}": "${src}",`)
  .join("\n")}
};
`;

await mkdir(join(root, "src/app"), { recursive: true });
await writeFile(join(root, "src/app/studio-technique-thumbnails.ts"), module);
process.stdout.write("wrote src/app/studio-technique-thumbnails.ts\n");
