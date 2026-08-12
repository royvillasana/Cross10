import { expect, test } from "./toolcraft-product-test";

test("browser: croix10 opens with the chromatic field and its product sections", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator('[data-slot="toolcraft-runtime-app"]')).toBeVisible();
  await expect(
    page.getByRole("application", { name: "Canvas viewport" }),
  ).toBeVisible();

  // Product output is present and is a real canvas, not placeholder chrome.
  const output = page.locator("[data-toolcraft-product-output]");
  await expect(output).toBeVisible();
  await expect(output).toHaveJSProperty("tagName", "CANVAS");

  // Section titles name the entity edited, never the branch that reveals them.
  // "Palette" is both a section title and the collection control label, so the
  // assertion allows the duplicate rather than pretending it is unique.
  for (const title of ["Stripe Field", "Band Sequence", "Image Export"]) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
  await expect(
    page.getByText("Palette", { exact: true }).first(),
  ).toBeVisible();
});

test("browser: croix10 renders a non-empty chromatic field on first paint", async ({
  page,
}) => {
  await page.goto("/");

  const output = page.locator("[data-toolcraft-product-output]");
  await expect(output).toBeVisible();

  // The field must actually be drawn: a backing buffer alone is not evidence.
  await expect
    .poll(
      async () =>
        output.evaluate((element) => {
          const canvas = element as HTMLCanvasElement;
          const gl = canvas.getContext("webgl2", {
            preserveDrawingBuffer: true,
          });
          if (!gl) return 0;
          const pixels = new Uint8Array(canvas.width * canvas.height * 4);
          gl.readPixels(
            0,
            0,
            canvas.width,
            canvas.height,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixels,
          );
          const seen = new Set<string>();
          for (let index = 0; index < pixels.length; index += 4) {
            seen.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
          }
          return seen.size;
        }),
      { timeout: 15000 },
    )
    // Couleur Additive renders three palette colours plus a separator, so a
    // drawn field has several distinct colours; a blank canvas has one.
    .toBeGreaterThan(2);
});

test("browser: croix10 does not place app chrome on the canvas", async ({
  page,
}) => {
  await page.goto("/");

  const canvas = page.getByRole("application", { name: "Canvas viewport" });
  await expect(canvas.getByRole("button", { name: /upload|choose file/i })).toHaveCount(
    0,
  );
  await expect(canvas.getByText(/drag and drop|click to upload/i)).toHaveCount(0);
});
