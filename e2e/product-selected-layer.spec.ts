import { expectToolcraftSelectedLayerControl } from "./browser-layer-evidence-helpers";
import {
  openStudioSingleLayer,
  setStudioLayerKind,
} from "./studio-product-helpers";
import { test } from "./toolcraft-product-test";

/**
 * Selected-layer control acceptance domain.
 *
 * These proofs edit whichever layer is selected and show the composite follow.
 * The fixture is a single layer for a reason: an edit to a layer sitting under
 * an opaque one changes no pixel, and the proof would fail for a reason that has
 * nothing to do with the control.
 *
 * The output signature has to be semantic and predictable, because the helper
 * compares the post-action state against a written-down expectation rather than
 * merely checking that something moved. Layer kind gets that for free — changing
 * it changes which body the assembled program calls, which the canvas already
 * reports.
 */

test("browser: studio layer kind switches the layer between stripes and gradient", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);

  await expectToolcraftSelectedLayerControl(
    session.observe((root: HTMLElement) => {
      // Scoped by schema target, not by document order: the first combobox on
      // the page is the canvas aspect ratio, and reading that one would report a
      // value the tested control never had.
      const combobox = root
        .querySelector('[data-toolcraft-control-target="selectedLayer.type"]')
        ?.querySelector('[role="combobox"]');
      return {
        // The select renders its current value as its own text, with a
        // disclosure glyph attached; the letters are the value.
        controlValue: (combobox?.textContent ?? "").replace(/[^A-Za-z]/gu, ""),
        outputSignature:
          root
            .querySelector("[data-toolcraft-product-output]")
            ?.getAttribute("data-studio-stack") ?? "absent",
        selectedLayerId:
          root
            .querySelector('[data-layer-id][aria-selected="true"]')
            ?.getAttribute("data-layer-id") ?? "",
      };
    }),
    session.controlAction("selectedLayer.type", async () => {
      await setStudioLayerKind(page, "Gradient");
    }),
    {
      controlValue: "Gradient",
      outputSignature: "gradient",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.type", target: "selectedLayer.type" },
  );
});
