import { expect, type Locator, type Page } from "@playwright/test";

import { createToolcraftBrowserProofSession } from "./browser-proof-session";
import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import {
  STUDIO_PRESETS,
  studioPresetPickerLabel,
} from "../src/app/studio-presets";

/**
 * Shared setup for Croix10 browser proofs.
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
/**
 * Closes the onboarding flow if it opened.
 *
 * Every fixture below starts from an empty app, and an empty app is exactly what
 * the flow exists to greet — so without this each of them builds its stack
 * behind a modal and every panel click times out. Dismissing rather than
 * completing it, because these fixtures are about the editor: what the flow does
 * has its own proofs.
 */
export async function dismissStudioOnboarding(page: Page): Promise<void> {
  const dialog = page.locator("[data-studio-onboarding]");
  // It arrives a frame or two after the canvas, so wait for it rather than
  // racing it — a fixture that checked once and moved on would be flaky in
  // exactly the way that is hardest to read.
  await expect
    .poll(async () => dialog.count(), { timeout: 10_000 })
    .toBeGreaterThan(0)
    .catch(() => undefined);

  if ((await dialog.count()) === 0) return;
  await page.keyboard.press("Escape");
  await expect.poll(async () => dialog.count(), { timeout: 10_000 }).toBe(0);
}

export async function setStudioLayerKind(
  page: Page,
  kind: "Gradient" | "Stripes",
): Promise<void> {
  await setStudioSelectValue(page, "selectedLayer.type", kind);
}

/**
 * Chooses an option on any schema select, located by target.
 *
 * By target rather than by accessible name: a runtime select exposes its current
 * value as its own name, so a name-based query matches whichever option happens
 * to be selected rather than the control being driven.
 */
export async function setStudioSelectValue(
  page: Page,
  target: string,
  optionLabel: string,
): Promise<void> {
  const field = await getToolcraftControlFieldByTarget(page, target);
  await field.getByRole("combobox").first().click();

  // The select's items are not exposed as options — the popup content sits under
  // a `role="presentation"` positioner, the same shape as the add-layer menu — so
  // the item is matched by text inside the open popup. Scoping to the popup
  // matters: once the value changes, the closed trigger carries that same text.
  await page
    .locator("[data-open]")
    .getByText(optionLabel, { exact: true })
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
  // Matched exactly. Accessible-name matching is substring by default, so a
  // query for "Opacity" also finds "Reference opacity" -- and finds it first,
  // because the reference sits above the layer sections in the panel. The
  // failure that produced is worth recording: the layer's opacity silently
  // stayed where it was, a lens meant to paint nothing painted its gradient,
  // and four treatment proofs reported the wrong colour with nothing in their
  // own subject having changed.
  const slider = page.getByRole("slider", { exact: true, name: label }).first();
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

/**
 * A switch, located by the target it writes.
 *
 * The switches carry no accessible name of their own — the label sits beside
 * them in the field — so they are reached through their control boundary. There
 * are two on the page and a name-based query matches neither.
 */
export function studioSwitch(page: Page, target: string) {
  return page
    .locator(`[data-toolcraft-control-target="${target}"]`)
    .getByRole("switch")
    .first();
}

export async function toggleStudioSwitch(page: Page, target: string): Promise<void> {
  const control = studioSwitch(page, target);
  const before = await control.getAttribute("aria-checked");
  await control.click();
  await expect
    .poll(async () => control.getAttribute("aria-checked"), { timeout: 5000 })
    .not.toBe(before);
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

/**
 * How many distinct colours a patch of the composite carries.
 *
 * Read from the middle of the frame rather than from its corner. A layer is a
 * shape (R64), so it arrives confined to a region centred on the frame and the
 * corner is bare ground until something is put there — a corner reading would
 * report one colour for a stack that is drawing perfectly well, which is
 * exactly what "has the composite painted yet" must not do.
 */
export async function readStudioColorCount(page: Page): Promise<number> {
  return page.locator(STUDIO_PRODUCT_OUTPUT).evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) return 0;
    const width = Math.min(canvas.width, 256);
    const height = Math.min(canvas.height, 64);
    if (width === 0 || height === 0) return 0;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(
      Math.floor((canvas.width - width) / 2),
      Math.floor((canvas.height - height) / 2),
      width,
      height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
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
  await dismissStudioOnboarding(page);

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
  await dismissStudioOnboarding(page);

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
  await dismissStudioOnboarding(page);

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

/**
 * Chooses which composition a narrow application will push.
 *
 * The panel's picker, which is a different act from changing the technique: this
 * names what gets pushed onto layers that already exist and applies nothing, and
 * the canvas is untouched until the press beside it.
 */
export async function chooseStudioComposition(
  page: Page,
  label: string,
): Promise<void> {
  const preset = STUDIO_PRESETS.find((entry) => entry.label === label);
  if (!preset) throw new Error(`No preset is labelled "${label}".`);

  await page
    .locator('[data-toolcraft-control-target="gallery.entry"]')
    .getByRole("button", { name: studioPresetPickerLabel(preset), exact: true })
    .first()
    .click();
}

/**
 * Changes the technique the canvas is working in, through the dialog.
 *
 * The panel's picker is gone: choosing what the canvas is working in is a
 * decision taken before there is work, so it moved into the onboarding flow with
 * the rest of that decision. Opening the flow is a press in the panel; the cards
 * are inside it.
 *
 * Over existing work the flow asks before replacing, which is the whole reason
 * it moved -- so this answers that question too, and callers keep meaning "make
 * this the technique" by one call.
 */
export async function setStudioTechnique(
  page: Page,
  label: string,
): Promise<void> {
  const preset = STUDIO_PRESETS.find((entry) => entry.label === label);
  if (!preset) throw new Error(`No preset is labelled "${label}".`);

  if ((await page.locator("[data-studio-onboarding]").count()) === 0) {
    await page
      .locator('[data-toolcraft-control-target="gallery.actions"]')
      .getByRole("button", { name: "Change the technique" })
      .first()
      .click();
  }

  await page.locator(`[data-studio-onboarding-card="${preset.id}"]`).click();

  // Over existing work the next step is the question; over an empty canvas it is
  // the size. Both are answered here so the helper means one thing either way.
  const replace = page.locator("[data-studio-onboarding-replace]");
  if ((await replace.count()) > 0) {
    await replace.click();
    return;
  }

  await page.locator("[data-studio-onboarding-confirm]").click();
}

/** The technique the flow currently shows as chosen. */
export async function readStudioTechnique(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      document
        .querySelector('[data-studio-onboarding-card][aria-pressed="true"]')
        ?.getAttribute("aria-label") ?? "",
  );
}


/**
 * The composite along a centred row, as a signature.
 *
 * `readStudioOutputSignature` samples nine points spread across the frame, which
 * is right for asking "did the frame change" and wrong for asking about a layer:
 * a layer is a shape confined to the middle of the frame (R65), so most of those
 * points land on bare ground and a real change to the layer's own pixels reads
 * as no change at all. That is not hypothetical — three proofs written against
 * the spread reader failed while the controls they exercised were working.
 *
 * This reads a row through the middle instead, wide enough to cross several
 * bands and narrow enough to stay inside the shape.
 */
export async function readStudioCentreSignature(
  page: Page,
  /**
   * Which way the strip runs. A row is invariant under a vertical fold and a
   * column under a horizontal one, so a flip proof that reads the wrong axis
   * sees nothing and blames the control.
   */
  axis: "column" | "row" = "row",
): Promise<string> {
  return page.locator(STUDIO_PRODUCT_OUTPUT).evaluate((element, stripAxis) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl || canvas.width === 0 || canvas.height === 0) return "absent";

    const along = Math.max(
      1,
      Math.min(
        stripAxis === "row" ? canvas.width : canvas.height,
        Math.floor((stripAxis === "row" ? canvas.height : canvas.width) * 0.4),
      ),
    );
    const pixels = new Uint8Array(along * 4);
    gl.readPixels(
      stripAxis === "row"
        ? Math.floor((canvas.width - along) / 2)
        : Math.floor(canvas.width / 2),
      stripAxis === "row"
        ? Math.floor(canvas.height / 2)
        : Math.floor((canvas.height - along) / 2),
      stripAxis === "row" ? along : 1,
      stripAxis === "row" ? 1 : along,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );

    // Quantised, so an antialiased edge landing a third of a pixel differently
    // is not reported as a change of colour.
    const steps: string[] = [];
    for (let index = 0; index < pixels.length; index += 4) {
      steps.push(
        [0, 1, 2].map((offset) => Math.round(pixels[index + offset] / 8)).join(","),
      );
    }
    return steps.join("|");
  }, axis);
}

/**
 * Opens one of the composition doors and leaves the dialog on that step.
 *
 * The panel keeps exactly one section now — three presses that open a surface
 * and decide nothing. Everything that decides happens in the dialog those
 * presses open.
 */
export async function openStudioCompositionDoor(
  page: Page,
  label: "Change the technique" | "Apply to the selection" | "Work against a study",
): Promise<void> {
  await page
    .locator('[data-toolcraft-control-target="gallery.actions"]')
    .getByRole("button", { name: label })
    .first()
    .click();
}

/**
 * Sets how strongly the study shows, through the dialog that now owns it.
 *
 * Opens, sets, closes — because the surface is modal, the value cannot be
 * adjusted against the work the way a panel slider could. That is a real cost
 * of moving it and is recorded here rather than smoothed over.
 */
export async function setStudioReferenceStrength(
  page: Page,
  value: number,
): Promise<void> {
  // Named stops rather than a slider: the dialog offers Hidden, Faint, Half and
  // Full, because a continuous scale set over a covered canvas is a scale
  // nobody can judge -- and because product source may not recreate a built-in
  // control, which an `input type="range"` is.
  const label =
    value <= 0 ? "Hidden" : value < 0.4 ? "Faint" : value < 0.75 ? "Half" : "Full";

  await openStudioCompositionDoor(page, "Work against a study");
  await page.getByRole("button", { exact: true, name: label }).first().click();
  await dismissStudioOnboarding(page);

  // Waits for the overlay to actually be in the mode that was asked for. The
  // change lands after the dialog closes, so a caller that sampled the frame
  // the moment this returned read the *previous* mode and reported that nothing
  // had happened -- which is what a modal costs a surface that used to be a
  // panel control adjusted in place.
  //
  // "Absent" is a valid answer, not a failure: at zero strength there is no
  // overlay to be in any mode, and a study nobody has turned up is a study
  // nobody is comparing against.
  const expected = label === "Their difference" ? "difference" : "overlay";
  await expect
    .poll(
      async () => {
        const overlay = page.locator("[data-studio-reference]");
        if ((await overlay.count()) === 0) return "absent";
        return overlay.getAttribute("data-studio-reference");
      },
      { timeout: 10_000 },
    )
    .toMatch(new RegExp(`^(absent|${expected})$`, "u"));
}

/** Chooses how the study is read against the work, through the same dialog. */
export async function setStudioReferenceCompare(
  page: Page,
  label: "Laying it over" | "Their difference",
): Promise<void> {
  await openStudioCompositionDoor(page, "Work against a study");
  await page.getByRole("button", { exact: true, name: label }).first().click();
  await dismissStudioOnboarding(page);

  // Waits for the overlay to actually be in the mode that was asked for. The
  // change lands after the dialog closes, so a caller that sampled the frame
  // the moment this returned read the *previous* mode and reported that nothing
  // had happened -- which is what a modal costs a surface that used to be a
  // panel control adjusted in place.
  //
  // "Absent" is a valid answer, not a failure: at zero strength there is no
  // overlay to be in any mode, and a study nobody has turned up is a study
  // nobody is comparing against.
  const expected = label === "Their difference" ? "difference" : "overlay";
  await expect
    .poll(
      async () => {
        const overlay = page.locator("[data-studio-reference]");
        if ((await overlay.count()) === 0) return "absent";
        return overlay.getAttribute("data-studio-reference");
      },
      { timeout: 10_000 },
    )
    .toMatch(new RegExp(`^(absent|${expected})$`, "u"));
}

/** Lays a composition onto the current selection, through the apply dialog. */
export async function applyStudioCompositionToSelection(
  page: Page,
  presetId: string,
): Promise<void> {
  await openStudioCompositionDoor(page, "Apply to the selection");
  await page.locator(`[data-studio-onboarding-apply="${presetId}"]`).click();
  await page.locator("[data-studio-onboarding-apply-confirm]").click();
}
