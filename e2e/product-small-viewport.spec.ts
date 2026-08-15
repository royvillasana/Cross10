import { expect, type Page } from "@playwright/test";

import { isStudioBoxReachable } from "../src/app/studio-small-viewport";
import { STUDIO_PRODUCT_OUTPUT } from "./studio-product-helpers";
import { test } from "./toolcraft-product-test";

/**
 * Small-viewport acceptance domain.
 *
 * The failure these proofs guard is not that the product is cramped on a phone.
 * It is that the control surface is **unreachable**: the shell carries
 * `minWidth: 1024` with `overflow-hidden`, so below that width everything past
 * the viewport edge is clipped with no scroll to reach it, and the Controls
 * panel sits at `left: 714` inside a shell the screen only shows 390px of.
 *
 * So every reading here is about *reachability* rather than about layout. A
 * panel whose box lies outside the viewport is gone, whatever its state says,
 * and a proof that asserted state rather than geometry would pass over exactly
 * that.
 *
 * **What these proofs deliberately do not claim.** The canvas will not occupy
 * more than half the screen with a panel open, because a panel is 300x780 and a
 * phone viewport is not. That layout needs runtime constants the product cannot
 * reach, recorded as upstream issue 11. What is claimed is that everything can
 * be got to.
 */

/** A phone, and a width where two panels plus a canvas plainly cannot coexist. */
const PHONE = { height: 800, width: 390 } as const;

/** Comfortably above the threshold, where nothing here should apply. */
const DESKTOP = { height: 800, width: 1280 } as const;

type Box = readonly [number, number, number, number];

async function readBoxes(page: Page): Promise<{
  canvas: Box | null;
  controls: Box | null;
  layers: Box | null;
  viewport: readonly [number, number];
}> {
  return page.evaluate((output) => {
    const box = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return [
        Math.round(rect.left),
        Math.round(rect.top),
        Math.round(rect.width),
        Math.round(rect.height),
      ] as const;
    };
    return {
      canvas: box(output),
      controls: box('[data-panel-type="controls"]'),
      layers: box('[data-panel-type="layers"]'),
      viewport: [window.innerWidth, window.innerHeight] as const,
    };
  }, STUDIO_PRODUCT_OUTPUT);
}

/**
 * Reachability, as the product itself defines it.
 *
 * Imported rather than restated. A copy of the rule lived here for one round and
 * had already drifted: it demanded 40 visible pixels in both axes, which reports
 * a collapsed 38px panel header — a perfectly usable one — as unreachable, and
 * passes a 300px panel showing a 53px sliver. The definition is unit-tested on
 * its own; what this file proves is that a real panel on a real phone-sized
 * screen ends up satisfying it.
 */
function isReachable(box: Box | null, viewport: readonly [number, number]): boolean {
  return isStudioBoxReachable(
    box ? { height: box[3], left: box[0], top: box[1], width: box[2] } : null,
    { height: viewport[1], width: viewport[0] },
  );
}

async function openStudioAt(
  page: Page,
  size: { height: number; width: number },
  clearStorage = true,
): Promise<void> {
  await page.setViewportSize(size);
  await page.goto("/");

  // Cleared once and reloaded, rather than through an init script. An init
  // script runs on *every* navigation in the context, so it would also wipe
  // storage on the reload a persistence proof depends on -- which is what it did
  // here, and it read exactly like the product failing to persist.
  if (clearStorage) {
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.reload();
  }
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();
  // The arrangement runs once on load and dispatches through the runtime, so it
  // lands a frame or two after the canvas appears rather than with it.
  await page.waitForTimeout(1200);
}

test("browser: studio panels are reachable on a phone-sized viewport", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await openStudioAt(page, PHONE);
  const boxes = await readBoxes(page);

  // The measurement that motivated the whole change: before it, this reads
  // `left: 714` on a 390px screen, with no scroll to reach it.
  expect(
    isReachable(boxes.controls, boxes.viewport),
    `the controls panel must be reachable; it measured ${JSON.stringify(boxes.controls)} in a ${boxes.viewport[0]}px viewport`,
  ).toBe(true);

  expect(
    isReachable(boxes.layers, boxes.viewport),
    `the layers panel must be reachable; it measured ${JSON.stringify(boxes.layers)} in a ${boxes.viewport[0]}px viewport`,
  ).toBe(true);

  // And the work itself. A reachable panel over an invisible canvas is a tool
  // for editing something you cannot see.
  expect(
    isReachable(boxes.canvas, boxes.viewport),
    `the canvas must be reachable; it measured ${JSON.stringify(boxes.canvas)} in a ${boxes.viewport[0]}px viewport`,
  ).toBe(true);

  // Neither panel is buried under the other, which a box reading alone cannot
  // see. This shipped once: both panels measured correctly at (10,10) and the
  // Layers panel was entirely covered by Controls. Asked of the *rendered* page
  // rather than of the geometry — what is at the point, not what is near it.
  const headerHits = await page.evaluate(() => {
    const at = (selector: string) => {
      const panel = document.querySelector(selector);
      if (!panel) return "absent";
      const rect = panel.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + 24, rect.top + 12);
      return hit && panel.contains(hit) ? "on top" : "covered";
    };
    return {
      controls: at('[data-panel-type="controls"]'),
      layers: at('[data-panel-type="layers"]'),
    };
  });

  expect(headerHits.controls, "the controls header is not covered").toBe("on top");
  expect(headerHits.layers, "the layers header is not covered").toBe("on top");
});

test("browser: studio leaves a desktop viewport arranged as it was", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await openStudioAt(page, DESKTOP);
  const boxes = await readBoxes(page);

  // Nothing above the threshold should have moved, and the way to say that
  // without pinning exact pixels is that the panels are where the runtime puts
  // them: layers at the left edge, controls at the right.
  expect(boxes.layers?.[0], "layers stays at the left edge").toBeLessThan(60);
  expect(
    (boxes.controls?.[0] ?? 0) + (boxes.controls?.[2] ?? 0),
    "controls stays at the right edge",
  ).toBeGreaterThan(boxes.viewport[0] - 60);

  // Both visible at once, which is the whole difference from the phone case.
  expect(isReachable(boxes.controls, boxes.viewport)).toBe(true);
  expect(isReachable(boxes.layers, boxes.viewport)).toBe(true);
});

/** A panel is collapsed when its box is a header rather than a body. */
async function readPanelHeights(page: Page): Promise<{ controls: number; layers: number }> {
  return page.evaluate(() => {
    const height = (selector: string) =>
      Math.round(document.querySelector(selector)?.getBoundingClientRect().height ?? 0);
    return {
      controls: height('[data-panel-type="controls"]'),
      layers: height('[data-panel-type="layers"]'),
    };
  });
}

test("browser: studio starts a phone-sized viewport collapsed", async ({ page }) => {
  test.setTimeout(180_000);

  await openStudioAt(page, PHONE);

  // Collapsed, so the surface a user meets is a pair of headers and the canvas
  // between them rather than a column of inputs covering the work. Read as the
  // rendered height rather than as panel state: a panel marked collapsed that
  // still painted its body would pass a state check and fail the user.
  const heights = await readPanelHeights(page);
  expect(heights.controls, "the controls panel starts collapsed").toBeLessThan(120);
  expect(heights.layers, "the layers panel starts collapsed").toBeLessThan(120);

  // And the canvas is visible with both closed, which is the point of collapsing
  // them rather than hiding one.
  const boxes = await readBoxes(page);
  expect(isReachable(boxes.canvas, boxes.viewport)).toBe(true);
});

test("browser: studio leaves a phone arrangement the user made", async ({ page }) => {
  test.setTimeout(180_000);

  await openStudioAt(page, PHONE);

  // The user opens a panel, which is the arrangement decision this must not
  // undo. Expanding is done through the runtime's own header control, because
  // that is what a user has.
  const controls = page.locator('[data-panel-type="controls"]');
  await controls.getByRole("button").first().click();
  await page.waitForTimeout(600);

  const opened = await readPanelHeights(page);
  expect(opened.controls, "the panel opened").toBeGreaterThan(120);

  // A reload finds it as they left it. The failure this guards is the one that
  // makes opinionated layouts hated: a product that re-collapses on every load
  // takes the choice away every time the user comes back, and they have no way
  // to make it stop.
  await page.reload();
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();
  await page.waitForTimeout(1500);

  expect(
    (await readPanelHeights(page)).controls,
    "an expanded panel survives a reload",
  ).toBeGreaterThan(120);

  // And it is still reachable, because the rescue keeps running even though the
  // collapse does not.
  const boxes = await readBoxes(page);
  expect(isReachable(boxes.controls, boxes.viewport)).toBe(true);
});
