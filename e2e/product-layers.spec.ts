import { expect, type Page } from "@playwright/test";

import { dragCanvasHandle } from "./canvas-handle-helpers";
import {
  expectToolcraftLayerGrouping,
  expectToolcraftLayerReorder,
  expectToolcraftLayerSelection,
  expectToolcraftLayerVisibility,
} from "./browser-layer-evidence-helpers";
import {
  dismissStudioOnboarding,
  addStudioLayer,
  dragStudioLayerRow,
  openStudioGroupedStack,
  openStudioTwoLayerStack,
  readStudioLayerIds,
  readStudioStackSignature,
  selectStudioLayer,
  setStudioColorHex,
  STUDIO_PRODUCT_OUTPUT,
  toggleStudioLayerVisibility,
} from "./studio-product-helpers";
import { createToolcraftBrowserProofSession } from "./browser-proof-session";
import {
  IMPORT_FIXTURE,
  importStudioImage,
  readStudioImageCorners,
  writeImportFixture,
} from "./studio-import-fixture";
import { test } from "./toolcraft-product-test";

/**
 * Layer surface acceptance domain.
 *
 * Every proof drives real LayersPanel rows and buttons. The runtime owns the
 * layer list, so proving these through `layers.*` command dispatch would prove
 * the reducer works and say nothing about whether the panel does — which is the
 * only surface a user touches.
 *
 * The observation readers run inside the page and cannot close over anything, so
 * they identify layers by panel position. The fixture asserts that the gradient
 * is the first row, which is what makes that indirection safe.
 */

const SELECTED_LAYER = (root: HTMLElement): { selectedLayerId: string } => ({
  selectedLayerId:
    root
      .querySelector('[data-layer-id][aria-selected="true"]')
      ?.getAttribute("data-layer-id") ?? "",
});

const TOP_OF_STACK_VISIBILITY = (
  root: HTMLElement,
): { layerId: string; outputSignature: string; visible: boolean } => {
  // The panel renders bottom row first, so the top of the stack is the last row.
  const rows = root.querySelectorAll("[data-layer-id]");
  const row = rows[rows.length - 1];
  const toggle = row?.querySelector(
    'button[aria-label^="Hide"], button[aria-label^="Show"]',
  );
  // The button offers the action, so "Hide" means the layer is currently shown.
  const visible = (toggle?.getAttribute("aria-label") ?? "").startsWith("Hide");

  return {
    layerId: row?.getAttribute("data-layer-id") ?? "",
    // Inlined rather than factored out: this reader is serialized into the
    // page, so it cannot call anything defined out here.
    outputSignature:
      root
        .querySelector("[data-toolcraft-product-output]")
        ?.getAttribute("data-studio-stack") ?? "absent",
    visible,
  };
};

test("browser: studio layer selection loads the selected layer values", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const { fixture, session } = await openStudioTwoLayerStack(page);

  await expectToolcraftLayerSelection(
    session.observe(SELECTED_LAYER),
    session.controlAction("selectedLayer.type", async () => {
      await selectStudioLayer(page, fixture.gradientLayerId);
    }),
    { selectedLayerId: fixture.gradientLayerId },
    { requirementId: "layers.selection", target: "selectedLayer.type" },
  );
});

test("browser: studio layer visibility removes the layer from the composite", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { fixture, session } = await openStudioTwoLayerStack(page);

  // The gradient sits above the stripes at full opacity, so hiding it is the
  // case that actually changes the composite: the stripes below become visible.
  await expectToolcraftLayerVisibility(
    session.observe(TOP_OF_STACK_VISIBILITY),
    session.controlAction("selectedLayer.type", async () => {
      await toggleStudioLayerVisibility(page, fixture.gradientLayerId);
    }),
    {
      layerId: fixture.gradientLayerId,
      outputSignature: "stripes",
      visible: false,
    },
    { requirementId: "layers.visibility", target: "selectedLayer.type" },
  );
});

test("browser: studio layer reorder changes which layer covers which", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { fixture, session } = await openStudioTwoLayerStack(page);

  // Dragging the gradient below the stripes inverts which layer covers which.
  // Both layers stay in the stack, so the id set is unchanged and only the order
  // and the drawn result move -- which is exactly what the helper checks.
  await expectToolcraftLayerReorder(
    session.observe((root: HTMLElement) => ({
      layerIds: Array.from(root.querySelectorAll("[data-layer-id]")).map(
        (row) => row.getAttribute("data-layer-id") ?? "",
      ),
      outputSignature:
        root
          .querySelector("[data-toolcraft-product-output]")
          ?.getAttribute("data-studio-stack") ?? "absent",
    })),
    session.controlAction("selectedLayer.type", async () => {
      await dragStudioLayerRow(page, fixture.gradientLayerId, fixture.stripesLayerId);
    }),
    {
      layerIds: [fixture.gradientLayerId, fixture.stripesLayerId],
      outputSignature: "gradient>stripes",
    },
    { requirementId: "layers.reorder", target: "selectedLayer.type" },
  );
});

test("browser: studio layer group moves and hides its members together", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { fixture, session } = await openStudioGroupedStack(page);

  // Hiding the group must remove its member from the composite. The runtime
  // toggles only the row it is given, so this is the product resolving effective
  // visibility through the parent chain rather than the runtime doing it.
  await expectToolcraftLayerGrouping(
    session.observe((root: HTMLElement) => {
      const rows = Array.from(root.querySelectorAll("[data-layer-id]"));
      return {
        groupSignature: rows
          .map((row) => {
            const toggle = row.querySelector(
              'button[aria-label^="Hide"], button[aria-label^="Show"]',
            );
            const shown = (toggle?.getAttribute("aria-label") ?? "").startsWith("Hide");
            return `${row.getAttribute("data-layer-id") ?? ""}:${shown ? "shown" : "hidden"}`;
          })
          .join("|"),
        layerIds: rows.map((row) => row.getAttribute("data-layer-id") ?? ""),
        outputSignature:
          root
            .querySelector("[data-toolcraft-product-output]")
            ?.getAttribute("data-studio-stack") ?? "absent",
      };
    }),
    session.controlAction("selectedLayer.type", async () => {
      await toggleStudioLayerVisibility(page, fixture.groupId);
    }),
    {
      groupSignature: [
        `${fixture.looseLayerId}:shown`,
        `${fixture.groupId}:hidden`,
        `${fixture.groupedLayerId}:shown`,
      ].join("|"),
      layerIds: [fixture.looseLayerId, fixture.groupId, fixture.groupedLayerId],
      outputSignature: "stripes",
    },
    { requirementId: "layers.grouping", target: "selectedLayer.type" },
  );
});

/**
 * A picture dropped on the canvas becomes a layer that draws it.
 *
 * The runtime owns every part of the import: it reads the file, allocates the
 * asset, and creates the layer the asset belongs to. What this product owns is
 * the last step -- drawing the result -- so the proof reads the stack the
 * renderer assembled and the pixels it produced, not the import machinery.
 *
 * The fixture image is four flat quadrants, which is what makes the reading
 * unambiguous: a picture that arrived upside down, mirrored, or stretched would
 * put different colours at these two points, and a layer that drew its default
 * stripes instead would put white and black at both.
 */
test("browser: studio dropped image becomes a layer that draws it", async ({ page }) => {
  test.setTimeout(120_000);

  // From an empty stack: the app persists its layers, and anything already
  // there would composite over the dropped picture and be read instead of it.
  // Cleared through an init script because the app rewrites storage on every
  // change, so a clear that runs before the reload is undone by the page it
  // was clearing for.
  // Cleared after the first load and then reloaded, rather than through an
  // init script. An init script runs on *every* navigation in the context, so a
  // later reload wipes storage again -- including the record that the flow has
  // been answered, which brings the dialog back over a test that dismissed it
  // long ago. That is what happened here: "Add layer" was never found because a
  // study picker had reappeared on top of it.
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();
  // The flow is answered before anything is touched. These fixtures clear
  // storage to start from an empty stack, which is a first visit, so the
  // dialog opens over the shell and its backdrop intercepts every pointer
  // event afterwards -- which surfaced as a hover timing out on a layer row
  // that Playwright had just reported visible and stable.
  await dismissStudioOnboarding(page);
  const before = await readStudioLayerIds(page);

  // Dropped rather than typed into a file input: canvas upload is a drop
  // surface, and there is no input element to fill.
  await page.locator(STUDIO_PRODUCT_OUTPUT).evaluate(async (node) => {
    const width = 64;
    const height = 64;
    const source = document.createElement("canvas");
    source.width = width;
    source.height = height;
    const context = source.getContext("2d");
    if (!context) throw new Error("The fixture image needs a 2D context.");
    context.fillStyle = "#ff2828";
    context.fillRect(0, 0, width / 2, height / 2);
    context.fillStyle = "#285aff";
    context.fillRect(width / 2, 0, width / 2, height / 2);
    context.fillStyle = "#fae628";
    context.fillRect(0, height / 2, width / 2, height / 2);
    context.fillStyle = "#ffffff";
    context.fillRect(width / 2, height / 2, width / 2, height / 2);

    const blob = await new Promise<Blob | null>((resolve) =>
      source.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("The fixture image did not encode.");

    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "quadrants.png", { type: "image/png" }));
    node.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
  });

  // The runtime made a layer for it.
  await expect
    .poll(async () => (await readStudioLayerIds(page)).length, { timeout: 15_000 })
    .toBe(before.length + 1);

  // And the product draws it: the assembled stack says image, and the frame
  // carries the picture's own colours rather than a stripe field's.
  await expect
    .poll(async () => readStudioStackSignature(page), { timeout: 15_000 })
    .toContain("image");

  await expect
    .poll(
      async () =>
        page.locator(STUDIO_PRODUCT_OUTPUT).evaluate((node) => {
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
            const hue =
              pixel[0] > 180 && pixel[1] < 120 && pixel[2] < 120
                ? "red"
                : pixel[2] > 180 && pixel[0] < 120
                  ? "blue"
                  : pixel[0] > 180 && pixel[1] > 180 && pixel[2] < 120
                    ? "yellow"
                    : pixel[0] > 180 && pixel[1] > 180 && pixel[2] > 180
                      ? "white"
                      : "other";
            return hue;
          };
          // Read well inside the shape the layer arrives with: a layer is a
          // shape (R65), so an imported picture is confined to that extent like
          // any other field, and a sample outside it reads bare ground rather
          // than the picture.
          //
          // readPixels counts from the bottom, so the image's top-left quadrant
          // is at the larger y fraction.
          return `topLeft=${at(0.45, 0.6)} bottomRight=${at(0.55, 0.4)}`;
        }),
      { timeout: 15_000 },
    )
    .toBe("topLeft=red bottomRight=white");
});


test("browser: studio image moves and grows with its layer, not under it", async ({
  page,
}) => {
  test.setTimeout(120_000);
  writeImportFixture();

  // Cleared after the first load and then reloaded, rather than through an
  // init script. An init script runs on *every* navigation in the context, so a
  // later reload wipes storage again -- including the record that the flow has
  // been answered, which brings the dialog back over a test that dismissed it
  // long ago. That is what happened here: "Add layer" was never found because a
  // study picker had reappeared on top of it.
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();
  // The flow is answered before anything is touched. These fixtures clear
  // storage to start from an empty stack, which is a first visit, so the
  // dialog opens over the shell and its backdrop intercepts every pointer
  // event afterwards -- which surfaced as a hover timing out on a layer row
  // that Playwright had just reported visible and stable.
  await dismissStudioOnboarding(page);
  await importStudioImage(page);

  await expect
    .poll(async () => readStudioImageCorners(page), { timeout: 15_000 })
    .toBe("topLeft=red topRight=blue");

  // Drag the layer by its body. The picture belongs to the layer, so it goes
  // with it: the same two points now read bare ground, and the picture's own
  // quadrants are found where the layer was dragged to.
  //
  // A picture mapped to the frame instead would have stayed exactly where it
  // was while a window slid over it -- which is what this proves against.
  const canvas = page.locator(STUDIO_PRODUCT_OUTPUT);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("The canvas needs a bounding box to drag on.");
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const shift = Math.round(box.height * 0.22);

  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(centre.x + (shift * step) / 8, centre.y);
  }
  await page.mouse.up();

  // The picture travelled with the layer, and the reading says so precisely:
  // the right-hand sample was the picture's *blue* quadrant and is now its
  // *red* one, because the picture's left half was carried into that point.
  // The left-hand sample fell off the picture entirely.
  //
  // A picture mapped to the frame would have done neither: the mask would have
  // slid right over a stationary image, leaving blue where blue was and ground
  // where the mask no longer reached.
  await expect
    .poll(async () => readStudioImageCorners(page), { timeout: 15_000 })
    .toBe("topLeft=other topRight=red");
});


/**
 * The order the frame is in, read at three places that tell it apart.
 *
 * Each layer in the fixture below is a flat colour of its own -- a stripes
 * layer with both inks set the same -- so a sample says which layer reached
 * that pixel rather than merely that something did. The picture keeps its own
 * four colours and is reported as one thing, because which quadrant landed
 * where is the subject of other proofs and not of this one.
 *
 * The three places are measured from where the shapes actually sit rather than
 * guessed: a layer arrives with a half-extent of a quarter of the frame's
 * height (R65) and the frame is 16:9, so a centred shape spans 0.36 to 0.64
 * across and a 300px drag carries one about 0.16 of the width. Moving one shape
 * right and one left leaves exactly three readable places -- one where the top
 * layer covers the picture, one where the picture covers the bottom layer, and
 * one where the bottom layer draws alone.
 */
async function readStudioStackOrder(page: Page): Promise<string> {
  return page.locator(STUDIO_PRODUCT_OUTPUT).evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) return "nogl";

    const at = (fx: number): string => {
      const pixel = new Uint8Array(4);
      // readPixels counts from the bottom and the picture's red and blue
      // quadrants are its top half, so the row read is above the middle.
      gl.readPixels(
        Math.round(canvas.width * fx),
        Math.round(canvas.height * 0.6),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel,
      );
      const [red, green, blue] = [pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0];
      if (green > 140 && red < 120 && blue < 120) return "under";
      if (red > 140 && blue > 140 && green < 120) return "over";
      if (red > 140 || blue > 140 || green > 140) return "picture";
      return "ground";
    };

    return `left=${at(0.4)} mid=${at(0.55)} right=${at(0.72)}`;
  });
}

/**
 * The same three places, read inside the page for the reorder helper.
 *
 * A second copy of the reading rather than a shared function, because this one
 * is serialized into the page and closes over nothing. The duplication is the
 * price of that, and the alternative -- a helper that resolves at compile time
 * and is undefined in the browser -- is not one.
 */
const STACK_ORDER = (
  root: HTMLElement,
): { layerIds: string[]; outputSignature: string } => {
  const canvas = root.querySelector<HTMLCanvasElement>(
    "[data-toolcraft-product-output]",
  );
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    const at = (fx: number): string => {
      const pixel = new Uint8Array(4);
      gl.readPixels(
        Math.round(canvas.width * fx),
        Math.round(canvas.height * 0.6),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel,
      );
      const [red, green, blue] = [pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0];
      if (green > 140 && red < 120 && blue < 120) return "under";
      if (red > 140 && blue > 140 && green < 120) return "over";
      if (red > 140 || blue > 140 || green > 140) return "picture";
      return "ground";
    };

    outputSignature = `left=${at(0.4)} mid=${at(0.55)} right=${at(0.72)}`;
  }

  return {
    layerIds: Array.from(root.querySelectorAll("[data-layer-id]")).map(
      (row) => row.getAttribute("data-layer-id") ?? "",
    ),
    outputSignature,
  };
};

test("browser: studio image layer composites above, below, and between procedural layers", async ({
  page,
}) => {
  test.setTimeout(180_000);
  writeImportFixture();

  // From an empty stack, so every layer in the frame is one this test put there.
  // Cleared after the first load and then reloaded, rather than through an
  // init script. An init script runs on *every* navigation in the context, so a
  // later reload wipes storage again -- including the record that the flow has
  // been answered, which brings the dialog back over a test that dismissed it
  // long ago. That is what happened here: "Add layer" was never found because a
  // study picker had reappeared on top of it.
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();
  // The flow is answered before anything is touched. These fixtures clear
  // storage to start from an empty stack, which is a first visit, so the
  // dialog opens over the shell and its backdrop intercepts every pointer
  // event afterwards -- which surfaced as a hover timing out on a layer row
  // that Playwright had just reported visible and stable.
  await dismissStudioOnboarding(page);
  const session = await createToolcraftBrowserProofSession(page);

  await importStudioImage(page);
  await expect
    .poll(async () => readStudioLayerIds(page), { timeout: 15_000 })
    .toHaveLength(1);
  const imageLayerId = (await readStudioLayerIds(page))[0] ?? "";

  // Below: a procedural layer added over the picture hides it where the two
  // meet. Both inks the same, so the layer is a flat colour and a sample says
  // which layer reached the pixel rather than only that something did.
  await addStudioLayer(page);
  const underLayerId =
    (await readStudioLayerIds(page)).find((id) => id !== imageLayerId) ?? "";
  await setStudioColorHex(page, "First colour", "#00CC00");
  await setStudioColorHex(page, "Second colour", "#00CC00");
  await expect
    .poll(async () => readStudioStackOrder(page), { timeout: 15_000 })
    .toBe("left=under mid=under right=ground");

  // Above: the same two layers in the other order, reordered through the panel
  // rows because that is the only reorder affordance the product has. Wrapped in
  // the reorder evidence helper, which is stricter than the reading alone -- it
  // requires the same set of layers before and after, a different order, and a
  // different frame, so a proof cannot pass by having deleted one of them.
  const rowsBefore = await readStudioLayerIds(page);
  await expectToolcraftLayerReorder(
    session.observe(STACK_ORDER),
    session.controlAction("selectedLayer.type", async () => {
      await dragStudioLayerRow(page, underLayerId, imageLayerId);
    }),
    {
      layerIds: [...rowsBefore].reverse(),
      outputSignature: "left=picture mid=picture right=ground",
    },
    { requirementId: "layers.imageComposite", target: "selectedLayer.type" },
  );

  // Between: a third layer over the picture, and the two procedural shapes
  // moved apart so all three are visible at once. The green one goes right
  // until it reaches past the picture's edge; the magenta one goes left until
  // it stops short of the middle.
  await selectStudioLayer(page, imageLayerId);
  await addStudioLayer(page);
  await setStudioColorHex(page, "First colour", "#CC00CC");
  await setStudioColorHex(page, "Second colour", "#CC00CC");
  await dragCanvasHandle(page, "studio-region-move", { x: -300, y: 0 });

  await selectStudioLayer(page, underLayerId);
  await dragCanvasHandle(page, "studio-region-move", { x: 300, y: 0 });

  // One frame carrying the whole order: the top layer covers the picture on the
  // left, the picture covers the bottom layer in the middle, and the bottom
  // layer draws alone on the right where the picture does not reach. No pair of
  // these three readings could be produced by a stack in a different order.
  await expect
    .poll(async () => readStudioStackOrder(page), { timeout: 15_000 })
    .toBe("left=over mid=picture right=under");
});

