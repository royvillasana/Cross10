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

/**
 * Adds a group through the same header menu.
 *
 * The new group becomes the selection, and the panel inserts a subsequent layer
 * into the selected group — which is how the grouped fixture is built without
 * simulating a drag into the group.
 */
export async function addStudioGroup(page: Page): Promise<void> {
  const before = await studioLayerRows(page).count();
  const trigger = page.getByRole("button", { name: "Add layer" }).first();
  await trigger.click();
  await page.getByText("Group", { exact: true }).first().click();

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

/**
 * Drags one row onto another to reorder the stack.
 *
 * A real pointer drag, because that is the only reorder affordance the panel
 * has: the row's keyboard handler selects and does nothing else, so a
 * keyboard-driven proof would be proving selection twice. The move is stepped
 * rather than a single jump so the controller sees intermediate pointer moves
 * and settles a drop indicator, and it finishes just inside the target row's
 * top edge so the insert lands above it rather than ambiguously between.
 */
export async function dragStudioLayerRow(
  page: Page,
  sourceLayerId: string,
  targetLayerId: string,
): Promise<void> {
  const from = await studioLayerRow(page, sourceLayerId).boundingBox();
  const to = await studioLayerRow(page, targetLayerId).boundingBox();
  if (!from || !to) throw new Error("Layer rows need bounding boxes to drag.");

  const startX = from.x + from.width / 2;
  const startY = from.y + from.height / 2;
  const endY = to.y + 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(startX, startY + ((endY - startY) * step) / 8);
  }
  await page.mouse.up();
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

/**
 * Sets a colour through its hex field.
 *
 * The colour controls expose a labelled hex text input directly, so the value
 * can be typed rather than chased around a picker surface. `label` is the
 * control's own label, e.g. "First colour".
 */
export async function setStudioColorHex(
  page: Page,
  label: string,
  hex: string,
): Promise<void> {
  // The hex field lives inside the picker. It is present in the DOM either way,
  // so filling it without opening the picker updates the input and commits
  // nothing — the control value moves while the render stays put, which reads
  // exactly like a broken renderer rather than a test driving the wrong surface.
  await page.getByRole("button", { name: `Pick ${label}` }).first().click();

  const field = page.getByRole("textbox", { name: `${label} hex` });
  await field.fill(hex);
  await field.press("Enter");
  await page.keyboard.press("Escape");
}

/**
 * Sets a slider to an exact value through its range input.
 *
 * The value goes through `HTMLInputElement`'s prototype setter rather than a
 * plain assignment. React tracks a controlled input's value with its own setter
 * and swallows a direct write, so `input.value = x` followed by an `input` event
 * moves nothing: the thumb, `aria-valuenow`, and runtime state all keep the old
 * value while the test believes it applied a new one.
 *
 * Dispatching input and change together is what commits the edit. Input alone
 * reads as a drag in progress, which is a different interaction on a different
 * invalidation path.
 */
export async function setStudioSlider(
  page: Page,
  label: string,
  value: number,
): Promise<void> {
  const slider = page.getByRole("slider", { name: label }).first();
  await slider.focus();
  await slider.evaluate((element, next) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, String(next));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);

  await expect
    .poll(async () => Number(await slider.getAttribute("aria-valuenow")), {
      timeout: 5000,
    })
    .toBe(value);
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

/**
 * One stripes layer, selected.
 *
 * The fixture for `selectedLayer.*` proofs: with a single layer every edit is
 * directly visible in the composite. A layer under an opaque one would be edited
 * without changing a pixel, and the proof would fail for the wrong reason.
 */
export async function openStudioSingleLayer(
  page: Page,
): Promise<{
  layerId: string;
  session: Awaited<ReturnType<typeof createToolcraftBrowserProofSession>>;
}> {
  await page.goto("/");
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();

  await addStudioLayer(page);
  const layerId = (await readStudioLayerIds(page))[0] ?? "";

  await expect
    .poll(async () => readStudioStackSignature(page), { timeout: 5000 })
    .toBe("stripes");
  await expect
    .poll(async () => readStudioColorCount(page), { timeout: 15000 })
    .toBeGreaterThan(1);

  return { layerId, session: await createToolcraftBrowserProofSession(page) };
}

export type StudioGroupedFixture = {
  /** The gradient layer, inside the group. */
  groupedLayerId: string;
  /** The group holding the gradient layer. */
  groupId: string;
  /** The stripes layer, outside the group and below it. */
  looseLayerId: string;
};

/**
 * Builds a stripes layer at the root with a gradient layer inside a group above
 * it.
 *
 * One layer stays outside the group deliberately. Hiding a group that held every
 * layer would leave nothing drawn, and the evidence helper requires a non-empty
 * output signature — so the proof would have no observable left to name.
 */
export async function openStudioGroupedStack(
  page: Page,
): Promise<{
  fixture: StudioGroupedFixture;
  session: Awaited<ReturnType<typeof createToolcraftBrowserProofSession>>;
}> {
  await page.goto("/");
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();

  await addStudioLayer(page);
  const looseLayerId = (await readStudioLayerIds(page))[0] ?? "";

  // The group becomes the selection, so the next added layer lands inside it.
  await addStudioGroup(page);
  const groupId =
    (await readStudioLayerIds(page)).find((id) => id !== looseLayerId) ?? "";

  await addStudioLayer(page);
  const groupedLayerId =
    (await readStudioLayerIds(page)).find(
      (id) => id !== looseLayerId && id !== groupId,
    ) ?? "";

  await selectStudioLayer(page, groupedLayerId);
  await setStudioLayerKind(page, "Gradient");

  await expect
    .poll(async () => readStudioStackSignature(page), { timeout: 5000 })
    .toBe("stripes>gradient");

  return {
    fixture: { groupedLayerId, groupId, looseLayerId },
    session: await createToolcraftBrowserProofSession(page),
  };
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
