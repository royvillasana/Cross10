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
  selectStudioLayer,
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
