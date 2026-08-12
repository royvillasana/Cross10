import { expect, type Page } from "@playwright/test";

import type {
  ToolcraftPerformanceCanvasBacking,
  ToolcraftPerformancePathAdapter,
} from "./performance-path-adapter-contract";

/**
 * Product performance path adapters.
 *
 * Each adapter drives one canonical derived path through the real UI: it applies
 * the compiled fixture values, performs the measured operation, and observes a
 * product outcome the protected reporter can bind evidence to.
 *
 * The composited stack is the observable in every case. A canvas hash alone
 * would be weak evidence, so `observeOutcome` reads back the distinct colour
 * count of the rendered composite — an empty canvas has one colour, and a
 * stripes layer has several.
 *
 * The load-bearing difference from Croix10 is `stack-depth`. It is a
 * runtime-state dimension with no control behind it, so applying it means
 * building a stack of exactly that many layers through the runtime layers panel:
 * real rows and real buttons, never `layers.*` command dispatch. The app opens
 * with an empty stack, so every path starts by seeding one layer.
 */

const PRODUCT_OUTPUT = "[data-toolcraft-product-output]";
const BAND_COUNT_LABEL = "Band count";
const LAYER_LIMIT = 16;

export const appPerformanceCanvasBacking: ToolcraftPerformanceCanvasBacking = {
  canvasSelector: PRODUCT_OUTPUT,
};

function layerRows(page: Page) {
  return page.getByRole("listbox", { name: "Layers" }).getByRole("option");
}

async function countLayers(page: Page): Promise<number> {
  return layerRows(page).count();
}

/**
 * Adds one layer through the panel header.
 *
 * The affordance has two shapes. With group creation enabled — which this
 * product has, because it declares layer grouping — "Add layer" is a popover
 * trigger whose menu offers "Layer" and "Group"; without it the same label is a
 * direct button. The menu items are matched by text rather than by role: the
 * popover positioner is `role="presentation"`, so the items are not reachable as
 * buttons in the accessibility tree.
 */
async function addLayer(page: Page): Promise<void> {
  const before = await countLayers(page);
  const trigger = page.getByRole("button", { name: "Add layer" }).first();
  await trigger.click();

  if ((await trigger.getAttribute("aria-expanded")) === "true") {
    await page.getByText("Layer", { exact: true }).first().click();
  }

  await expect.poll(async () => countLayers(page), { timeout: 5000 })
    .toBe(before + 1);
}

async function removeLastLayer(page: Page): Promise<void> {
  const before = await countLayers(page);
  const last = layerRows(page).last();
  const name = (await last.getAttribute("aria-label")) ?? "";
  await last.click();
  // The row's delete control is revealed by pointer focus on the row.
  await last.hover();
  await page.getByRole("button", { name: `Delete ${name}` }).first().click();

  await expect.poll(async () => countLayers(page), { timeout: 5000 })
    .toBe(before - 1);
}

/** Drives the stack to exactly `target` layers through the panel. */
async function setLayerCount(page: Page, target: number): Promise<void> {
  const bounded = Math.max(0, Math.min(Math.round(target), LAYER_LIMIT));

  for (let count = await countLayers(page); count < bounded; count += 1) {
    await addLayer(page);
  }
  for (let count = await countLayers(page); count > bounded; count -= 1) {
    await removeLastLayer(page);
  }
}

/**
 * Reads the rendered composite's distinct colour count out of the WebGL backing.
 * A product observable rather than a DOM signature: it changes only when the
 * composite itself changes.
 */
async function observeStackColorCount(page: Page): Promise<number> {
  return page.locator(PRODUCT_OUTPUT).evaluate((element) => {
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

function bandSlider(page: Page) {
  return page.getByRole("slider", { name: BAND_COUNT_LABEL });
}

/**
 * Where the product scene sits in the viewport, rounded to whole pixels.
 *
 * The viewport paths need an observable that changes when the gesture works,
 * and the composite's own pixels are the wrong one: this product's scene is the
 * authored output rectangle, so panning moves the surface without changing what
 * is drawn on it, and a colour readback is identical before and after. That is
 * the behaviour `mustNotInvalidate` claims, so measuring it as the outcome would
 * assert the opposite of the declaration.
 *
 * The frame's position and size is the honest outcome instead: a pan moves it,
 * a zoom resizes it, and neither re-resolves the stack.
 */
async function observeSceneFrame(page: Page): Promise<string> {
  return page.locator(PRODUCT_OUTPUT).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return [rect.x, rect.y, rect.width, rect.height]
      .map((value) => Math.round(value))
      .join(",");
  });
}

/**
 * Opens the app and seeds one stripes layer.
 *
 * The seed is what makes the rest reachable: with an empty stack there is no
 * selected layer, so no `selectedLayer.*` control is rendered and the band-count
 * slider does not exist.
 */
async function openApp(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator(PRODUCT_OUTPUT)).toBeVisible();
  await setLayerCount(page, 1);
  await expect(bandSlider(page)).toBeVisible();
  await expect
    .poll(async () => observeStackColorCount(page), { timeout: 15000 })
    .toBeGreaterThan(1);
}

/**
 * Applies the compiled workload values through the real UI.
 *
 * Both dimensions belong to the same pass, so a compiled fixture supplies both
 * and each must be applied and observed exactly. Stack depth is applied first:
 * band count lives on the selected layer, so it is only reachable once the stack
 * is non-empty.
 */
function stackApplications(page: Page) {
  return {
    "band-count": {
      applyValue: async (value: unknown) => {
        const slider = bandSlider(page);
        if ((await slider.count()) === 0) return;
        await slider.first().focus();
        await slider.first().evaluate((element, next) => {
          const input = element as HTMLInputElement;
          // Through the prototype setter, not a plain assignment: React tracks a
          // controlled input's value with its own setter and swallows a direct
          // write, so the compiled fixture value would never reach the product
          // and the observation would read back the old one.
          const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          )?.set;
          setter?.call(input, String(next));
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }, value);
      },
      observeValue: async () => {
        const slider = bandSlider(page);
        if ((await slider.count()) === 0) return 0;
        return Number(await slider.first().getAttribute("aria-valuenow"));
      },
    },
    "stack-depth": {
      applyValue: async (value: unknown) => {
        await setLayerCount(page, Number(value));
      },
      observeValue: async () => countLayers(page),
    },
  };
}

export const appPerformancePathAdapters = [
  {
    fixtureApplications: stackApplications,
    observeOutcome: ({ page }) => observeStackColorCount(page),
    pathId:
      "performance-path:%5B%22initial-render%22%2C%22initial-render%22%2C%5B%22layer-stack%22%5D%2C%5B%22gpu%22%5D%2C%5B%22band-count%22%2C%22stack-depth%22%5D%5D",
    prepare: openApp,
    action: async ({ page }) => {
      // Initial render is measured by reloading into a fresh mount. The stack is
      // persisted, so the reloaded app rebuilds the same composite.
      await page.reload();
      await expect(page.locator(PRODUCT_OUTPUT)).toBeVisible();
    },
  },
  {
    fixtureApplications: stackApplications,
    observeOutcome: ({ page }) => observeStackColorCount(page),
    pathId:
      "performance-path:%5B%22interactive-discrete%22%2C%22control-change%22%2C%5B%22layer-stack%22%5D%2C%5B%22gpu%22%5D%2C%5B%22band-count%22%2C%22stack-depth%22%5D%5D",
    prepare: openApp,
    action: async ({ page }) => {
      // A committed discrete edit: nudge the band count by one keyboard step.
      const slider = bandSlider(page);
      await slider.focus();
      await slider.press("ArrowRight");
    },
  },
  {
    fixtureApplications: stackApplications,
    observeOutcome: ({ page }) => observeStackColorCount(page),
    pathId:
      "performance-path:%5B%22interactive-continuous%22%2C%22control-drag%22%2C%5B%22layer-stack%22%5D%2C%5B%22gpu%22%5D%2C%5B%22band-count%22%2C%22stack-depth%22%5D%5D",
    prepare: openApp,
    action: async ({ page }) => {
      // A real pointer drag across the thumb, so liveness is measured during the
      // gesture rather than after release.
      const slider = bandSlider(page);
      const box = await slider.boundingBox();
      if (!box) throw new Error("Band count slider has no bounding box.");
      await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
      await page.mouse.down();
      for (const fraction of [0.5, 0.6, 0.7, 0.8]) {
        await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
      }
      await page.mouse.up();
    },
  },
  {
    observeOutcome: ({ page }) => observeSceneFrame(page),
    pathId:
      "performance-path:%5B%22interactive-continuous%22%2C%22viewport-drag%22%2C%5B%5D%2C%5B%5D%2C%5B%5D%5D",
    prepare: openApp,
    action: async ({ page }) => {
      // Panning is a viewport transform; the composite must stay resident.
      const viewport = page.getByRole("application", { name: "Canvas viewport" });
      const box = await viewport.boundingBox();
      if (!box) throw new Error("Canvas viewport has no bounding box.");
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      for (const offset of [24, 48, 72]) {
        await page.mouse.move(centerX + offset, centerY + offset);
      }
      await page.mouse.up();
    },
  },
  {
    observeOutcome: ({ page }) => observeSceneFrame(page),
    pathId:
      "performance-path:%5B%22interactive-continuous%22%2C%22viewport-zoom%22%2C%5B%5D%2C%5B%5D%2C%5B%5D%5D",
    prepare: openApp,
    action: async ({ page }) => {
      // Zoom magnifies the presented frame; the composite must stay resident.
      const viewport = page.getByRole("application", { name: "Canvas viewport" });
      const box = await viewport.boundingBox();
      if (!box) throw new Error("Canvas viewport has no bounding box.");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      for (const delta of [-120, -120, -120]) {
        await page.mouse.wheel(0, delta);
      }
    },
  },
  {
    fixtureApplications: stackApplications,
    output: {
      kind: "download",
      label: "Export PNG",
      verify: async (download) => {
        const stream = await download.createReadStream();
        expect(stream).toBeTruthy();
      },
    },
    pathId:
      "performance-path:%5B%22batch-responsive%22%2C%22export%22%2C%5B%22layer-stack%22%5D%2C%5B%22gpu%22%5D%2C%5B%22band-count%22%2C%22stack-depth%22%5D%5D",
    prepare: openApp,
  },
] as const satisfies readonly ToolcraftPerformancePathAdapter[];
