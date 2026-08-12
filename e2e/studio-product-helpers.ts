import { expect, type Locator, type Page } from "@playwright/test";

import { createToolcraftBrowserProofSession } from "./browser-proof-session";
import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";

/**
 * Shared setup for Shader Studio browser proofs.
 *
 * Every proof opens the app, builds the declared fixture, and waits for the
 * composite to actually be drawn rather than merely mounted. A baseline taken
 * before the stack has painted would let an unrelated first frame masquerade as
 * the action's effect.
 *
 * The stack is built through the real panel — its add control, its rows, its
 * per-row buttons — never through `layers.*` command dispatch. Layer coverage
 * that drove commands directly would prove the reducer works and say nothing
 * about whether the panel does.
 */

export const STUDIO_PRODUCT_OUTPUT = "[data-toolcraft-product-output]";

export function studioLayerRows(page: Page): Locator {
  return page.locator("[data-layer-id]");
}

export function studioLayerRow(page: Page, layerId: string): Locator {
  return page.locator(`[data-layer-id="${layerId}"]`);
}

/** Panel order, top row first. The runtime owns this list and its order. */
export async function readStudioLayerIds(page: Page): Promise<string[]> {
  return studioLayerRows(page).evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-layer-id") ?? ""),
  );
}

export async function readStudioSelectedLayerId(page: Page): Promise<string> {
  const selected = page.locator('[data-layer-id][aria-selected="true"]');
  return (await selected.count()) > 0
    ? ((await selected.first().getAttribute("data-layer-id")) ?? "")
    : "";
}

/**
 * Adds one layer through the panel header.
 *
 * With grouping enabled the control is a popover trigger whose menu items sit
 * under a `role="presentation"` positioner, so "Layer" is matched by text —
 * a role-based query finds nothing and the stack silently stays empty.
 */
export async function addStudioLayer(page: Page): Promise<void> {
  const before = await studioLayerRows(page).count();
  const trigger = page.getByRole("button", { name: "Add layer" }).first();
  await trigger.click();

  if ((await trigger.getAttribute("aria-expanded")) === "true") {
    await page.getByText("Layer", { exact: true }).first().click();
  }

  await expect
    .poll(async () => studioLayerRows(page).count(), { timeout: 5000 })
    .toBe(before + 1);
}

export async function selectStudioLayer(page: Page, layerId: string): Promise<void> {
  await studioLayerRow(page, layerId).click();
  await expect
    .poll(async () => readStudioSelectedLayerId(page), { timeout: 5000 })
    .toBe(layerId);
}

/** Toggles a row's own visibility button, which is revealed by hovering the row. */
export async function toggleStudioLayerVisibility(
  page: Page,
  layerId: string,
): Promise<void> {
  const row = studioLayerRow(page, layerId);
  await row.hover();
  await row
    .locator('button[aria-label^="Hide"], button[aria-label^="Show"]')
    .first()
    .click();
}

export async function readStudioLayerVisible(
  page: Page,
  layerId: string,
): Promise<boolean> {
  const row = studioLayerRow(page, layerId);
  const label = await row
    .locator('button[aria-label^="Hide"], button[aria-label^="Show"]')
    .first()
    .getAttribute("aria-label");

  // The button offers the action, so "Hide" means the layer is currently shown.
  return (label ?? "").startsWith("Hide");
}

/**
 * Sets the selected layer's kind through its schema control.
 *
 * Located by schema target rather than by accessible name: the runtime select
 * exposes its current value as its name, so a name-based query would match
 * whichever option happens to be selected.
 */
export async function setStudioLayerKind(
  page: Page,
  kind: "Gradient" | "Stripes",
): Promise<void> {
  const field = await getToolcraftControlFieldByTarget(page, "selectedLayer.type");
  await field.getByRole("combobox").first().click();

  // The select's items are not exposed as options — the popup content sits under
  // a `role="presentation"` positioner, the same shape as the add-layer menu — so
  // the item is matched by text inside the open popup. Scoping to the popup
  // matters: once the value changes, the closed trigger carries that same text.
  await page
    .locator("[data-open]")
    .getByText(kind, { exact: true })
    .first()
    .click();
}

/** The assembled stack the renderer drew, in draw order, lowest first. */
export async function readStudioStackSignature(page: Page): Promise<string> {
  return (
    (await page.locator(STUDIO_PRODUCT_OUTPUT).getAttribute("data-studio-stack")) ?? ""
  );
}

/**
 * A semantic signature of the rendered composite.
 *
 * Sampled colours rather than a hash, so an expected transition can be written
 * down and a changed composite is distinguishable from an unchanged one. Tiles
 * spread across the backing rather than one corner: a corner can be flat while
 * the composite is fully drawn.
 */
export async function readStudioOutputSignature(page: Page): Promise<string> {
  return page.locator(STUDIO_PRODUCT_OUTPUT).evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) return "nogl";
    if (canvas.width === 0 || canvas.height === 0) return "empty";

    const samples: string[] = [];
    for (const fractionY of [0.25, 0.5, 0.75]) {
      for (const fractionX of [0.25, 0.5, 0.75]) {
        const x = Math.min(
          Math.max(Math.floor(canvas.width * fractionX), 0),
          canvas.width - 1,
        );
        const y = Math.min(
          Math.max(Math.floor(canvas.height * fractionY), 0),
          canvas.height - 1,
        );
        const pixel = new Uint8Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        samples.push(`${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]}`);
      }
    }
    return samples.join("|");
  });
}

export async function readStudioColorCount(page: Page): Promise<number> {
  return page.locator(STUDIO_PRODUCT_OUTPUT).evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) return 0;
    const width = Math.min(canvas.width, 256);
    const height = Math.min(canvas.height, 64);
    if (width === 0 || height === 0) return 0;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const seen = new Set<string>();
    for (let index = 0; index < pixels.length; index += 4) {
      seen.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
    }
    return seen.size;
  });
}

export type StudioTwoLayerFixture = {
  /** The gradient layer, above. */
  gradientLayerId: string;
  /** The stripes layer, below and selected. */
  stripesLayerId: string;
};

/**
 * Builds the declared two-layer fixture: a stripes layer below a gradient layer,
 * with the stripes layer selected.
 *
 * The two layers must render differently for a reorder or a visibility toggle to
 * be observable at all — two identical stripes layers composite to the same
 * pixels in either order, and a proof over them would pass without proving
 * anything.
 */
export async function openStudioTwoLayerStack(
  page: Page,
): Promise<{ fixture: StudioTwoLayerFixture; session: ReturnType<typeof createToolcraftBrowserProofSession> }> {
  await page.goto("/");
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();

  await addStudioLayer(page);
  await addStudioLayer(page);

  const ids = await readStudioLayerIds(page);
  expect(ids.length, "the fixture needs exactly two layers").toBe(2);

  // Which panel row is the bottom of the stack is derived rather than assumed:
  // the panel could render top-first or bottom-first, and the fixture is defined
  // by draw order ("a stripes layer below a gradient layer"), not by row order.
  // Retyping the first row and reading the assembled stack back settles it.
  await selectStudioLayer(page, ids[0] ?? "");
  await setStudioLayerKind(page, "Gradient");
  const firstRowIsBottom = (await readStudioStackSignature(page)).startsWith("gradient");

  const gradientLayerId = (firstRowIsBottom ? ids[1] : ids[0]) ?? "";
  const stripesLayerId = (firstRowIsBottom ? ids[0] : ids[1]) ?? "";

  if (firstRowIsBottom) {
    // The first row is the bottom, so it must be the stripes layer instead.
    await setStudioLayerKind(page, "Stripes");
    await selectStudioLayer(page, gradientLayerId);
    await setStudioLayerKind(page, "Gradient");
  }

  await expect
    .poll(async () => readStudioStackSignature(page), { timeout: 5000 })
    .toBe("stripes>gradient");

  await selectStudioLayer(page, stripesLayerId);

  await expect
    .poll(async () => readStudioColorCount(page), { timeout: 15000 })
    .toBeGreaterThan(1);

  // The browser-side observation readers cannot close over these ids, so they
  // identify the gradient by its panel position instead. This panel renders
  // bottom row first, so the top of the stack is the last row — asserted rather
  // than assumed, because it is exactly the kind of thing that reads either way.
  const panelOrder = await readStudioLayerIds(page);
  expect(
    panelOrder[panelOrder.length - 1],
    "the gradient layer must be the last panel row for the observation readers",
  ).toBe(gradientLayerId);

  return {
    fixture: { gradientLayerId, stripesLayerId },
    session: await createToolcraftBrowserProofSession(page),
  };
}
