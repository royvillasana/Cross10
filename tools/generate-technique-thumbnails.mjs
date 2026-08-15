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
  await page
    .locator('[data-toolcraft-control-target="gallery.actions"]')
    .getByRole("button", { name: "Apply" })
    .first()
    .click();
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

async function capture(page) {
  return page.evaluate(
    ([width, height]) => {
      const canvas = document.querySelector("[data-toolcraft-product-output]");
      if (!(canvas instanceof HTMLCanvasElement)) return "";
      const off = document.createElement("canvas");
      off.width = width;
      off.height = height;
      const context = off.getContext("2d");
      if (!context) return "";
      // Cover rather than stretch: a technique read at the wrong aspect is a
      // different rhythm, and the rhythm is the thing being shown.
      const scale = Math.max(width / canvas.width, height / canvas.height);
      const drawWidth = canvas.width * scale;
      const drawHeight = canvas.height * scale;
      context.drawImage(
        canvas,
        (width - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
      return off.toDataURL("image/webp", 0.72);
    },
    [WIDTH, HEIGHT],
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
  const body = source.slice(source.indexOf("export const STUDIO_PRESETS"));
  const entries = [...body.matchAll(/\bid: "([^"]+)",\s*\n\s*label: "([^"]+)"/gu)];
  return entries.map(([, id, label]) => ({ id, label }));
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
  await chooseEntry(page, preset.label);
  await settle(page);
  const src = await capture(page);
  if (!src.startsWith("data:image/")) {
    throw new Error(`Captured nothing for ${preset.id}.`);
  }
  thumbnails[preset.id] = src;
  process.stdout.write(`${preset.id}: ${Math.round(src.length / 1024)}kB\n`);
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
