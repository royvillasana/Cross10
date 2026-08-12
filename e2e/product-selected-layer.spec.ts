import { expectToolcraftSelectedLayerControl } from "./browser-layer-evidence-helpers";
import {
  openStudioSingleLayer,
  setStudioColorHex,
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

test("browser: studio layer colours recolour only the selected layer", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);

  // White to red: the bands keep their geometry, so the dominant pair moves from
  // black-and-white to black-and-red and nothing else about the frame changes.
  await expectToolcraftSelectedLayerControl(
    session.observe((root: HTMLElement) => {
      // The two colours the composite is mostly made of, lowest hex first.
      // Semantic and predictable: a stripes layer is flat colour either side of
      // each boundary, so the two dominant colours are the layer's own pair.
      // Antialiased edge pixels are a minority and never displace them, which is
      // why this takes the top two by frequency rather than the set present.
      //
      // Inlined because this reader is serialized into the page and cannot call
      // anything defined outside it.
      const canvas = root.querySelector<HTMLCanvasElement>(
        "[data-toolcraft-product-output]",
      );
      const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
      let outputSignature = "absent";

      if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
        const width = Math.min(canvas.width, 512);
        const pixels = new Uint8Array(width * 4);
        gl.readPixels(
          0,
          Math.floor(canvas.height / 2),
          width,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );

        const counts = new Map<string, number>();
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index + 3] < 250) continue;
          const hex = `#${[pixels[index], pixels[index + 1], pixels[index + 2]]
            .map((channel) => channel.toString(16).padStart(2, "0"))
            .join("")}`;
          counts.set(hex, (counts.get(hex) ?? 0) + 1);
        }

        outputSignature = [...counts.entries()]
          .sort((left, right) => right[1] - left[1])
          .slice(0, 2)
          .map(([hex]) => hex)
          .sort()
          .join("|");
      }

      return {
        controlValue:
          root
            .querySelector<HTMLInputElement>('input[aria-label="First colour hex"]')
            ?.value.toLowerCase() ?? "",
        outputSignature,
        selectedLayerId:
          root
            .querySelector('[data-layer-id][aria-selected="true"]')
            ?.getAttribute("data-layer-id") ?? "",
      };
    }),
    session.controlAction("selectedLayer.colorA", async () => {
      await setStudioColorHex(page, "First colour", "#FF0000");
    }),
    {
      controlValue: "#ff0000",
      outputSignature: "#000000|#ff0000",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.colorA", target: "selectedLayer.colorA" },
  );
});
