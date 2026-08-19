import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

import { type Page } from "@playwright/test";

import { STUDIO_PRODUCT_OUTPUT } from "./studio-product-helpers";

/**
 * A four-quadrant fixture, written to a real file so a real input can take it.
 *
 * Sixty-four pixels square rather than two: the sampler filters linearly, so a
 * tiny picture is all gradient and has no interior to read. Flat quadrants are
 * what make the readings unambiguous -- a picture that arrived mirrored,
 * rotated or stretched puts different colours at the sampled points, and a
 * layer drawing its default stripes puts white and black at both.
 */
const IMPORT_FIXTURE = path.join(os.tmpdir(), "studio-quadrants.png");

function writeImportFixture(): void {
  const size = 64;
  const half = size / 2;
  const quadrant = (x: number, y: number): readonly [number, number, number] =>
    y < half
      ? x < half
        ? [255, 40, 40]
        : [40, 90, 255]
      : x < half
        ? [250, 230, 40]
        : [255, 255, 255];

  const raw = Buffer.alloc(size * (size * 3 + 1));
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const [red, green, blue] = quadrant(x, y);
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
      offset += 3;
    }
  }

  const crc32 = (buffer: Buffer): number => {
    let crc = ~0;
    for (const byte of buffer) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return ~crc;
  };
  const chunk = (tag: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(tag, "ascii"), data]);
    const crcValue = Buffer.alloc(4);
    crcValue.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([length, body, crcValue]);
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;

  fs.writeFileSync(
    IMPORT_FIXTURE,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk("IDAT", zlib.deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

/** Two corners of the picture, named rather than measured, for a legible expectation. */
export async function readStudioImageCorners(page: Page): Promise<string> {
  return page.locator(STUDIO_PRODUCT_OUTPUT).evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) return "nogl";
    const at = (fx: number, fy: number): string => {
      const pixel = new Uint8Array(4);
      gl.readPixels(
        Math.round(canvas.width * fx),
        Math.round(canvas.height * fy),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel,
      );
      const [red, green, blue] = [pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0];
      if (red > 180 && green < 120 && blue < 120) return "red";
      if (blue > 180 && red < 120) return "blue";
      if (red > 180 && green > 180 && blue < 120) return "yellow";
      if (red > 180 && green > 180 && blue > 180) return "white";
      return "other";
    };
    // Read inside the shape the layer arrives with (R65) -- a sample outside it
    // finds bare ground -- and remember readPixels counts from the bottom, so
    // the picture's top row is the larger y fraction.
    return `topLeft=${at(0.45, 0.6)} topRight=${at(0.55, 0.6)}`;
  });
}

/**
 * A two-second clip whose halves are flat and unmistakable: red, then blue.
 *
 * Committed rather than generated, unlike the picture beside it. A PNG can be
 * written by hand in fifty lines; a video container cannot, and generating one
 * at test time would make the suite depend on an encoder being installed. Flat
 * halves for the same reason the picture has flat quadrants -- what is read back
 * has to say which frame it came from with no interpretation.
 */
const VIDEO_FIXTURE = path.join(
  // `fileURLToPath` rather than the URL's own pathname: this repository lives
  // under a directory with a space in its name, and a pathname keeps that space
  // percent-encoded, which is a path no file exists at.
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "studio-halves.webm",
);

/** The colour at the middle of the frame, named rather than measured. */
export async function readStudioFrameColour(page: Page): Promise<string> {
  return page.locator(STUDIO_PRODUCT_OUTPUT).evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) return "nogl";
    const pixel = new Uint8Array(4);
    gl.readPixels(
      Math.round(canvas.width * 0.5),
      Math.round(canvas.height * 0.5),
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixel,
    );
    const [red, green, blue] = [pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0];
    if (red > 150 && green < 120 && blue < 120) return "red";
    if (blue > 150 && red < 120) return "blue";
    return `other(${red},${green},${blue})`;
  });
}

export async function importStudioVideo(page: Page): Promise<void> {
  await page
    .locator('[data-toolcraft-control-target="media.video"]')
    .locator('input[type="file"]')
    .first()
    .setInputFiles(VIDEO_FIXTURE);
}

export async function importStudioImage(page: Page): Promise<void> {
  await page
    .locator('[data-toolcraft-control-target="media.image"]')
    .locator('input[type="file"]')
    .first()
    .setInputFiles(IMPORT_FIXTURE);
}

export { IMPORT_FIXTURE, VIDEO_FIXTURE, writeImportFixture };
