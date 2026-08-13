import { expect } from "@playwright/test";

import {
  expectToolcraftLayerGrouping,
  expectToolcraftLayerReorder,
  expectToolcraftLayerSelection,
  expectToolcraftLayerVisibility,
} from "./browser-layer-evidence-helpers";
import {
  dragStudioLayerRow,
  openStudioGroupedStack,
  openStudioTwoLayerStack,
  readStudioLayerIds,
  readStudioStackSignature,
  selectStudioLayer,
  STUDIO_PRODUCT_OUTPUT,
  toggleStudioLayerVisibility,
} from "./studio-product-helpers";
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
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await page.goto("/");
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();
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

