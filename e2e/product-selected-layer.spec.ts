import { expect, type Page } from "@playwright/test";

import { expectToolcraftAcceptanceOutcome } from "./browser-acceptance-outcome-helpers";

import { expectToolcraftSelectedLayerControl } from "./browser-layer-evidence-helpers";
import {
  addStudioGroup,
  addStudioLayer,
  dismissStudioOnboarding,
  openStudioSingleLayer,
  readStudioCentreSignature,
  readStudioLayerIds,
  readStudioSelectedLayerId,
  readStudioOutputSignature,
  readStudioStackSignature,
  STUDIO_PRODUCT_OUTPUT,
  openStudioTwoLayerStack,
  selectStudioLayer,
  setStudioColorHex,
  setStudioLayerKind,
  setStudioSelectValue,
  setStudioSlider,
  toggleStudioSwitch,
} from "./studio-product-helpers";
import {
  expectToolcraftProductObservableToChange,
  getToolcraftProductObservableSnapshot,
} from "./product-observable-helpers";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import {
  importStudioImage,
  readStudioImageCorners,
  writeImportFixture,
} from "./studio-import-fixture";
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
        // Centred: the layer is a shape confined to the middle of the frame
        // (R65), so a row starting at the left edge would count bare ground as
        // the layer's own colour.
        // Wide enough for several cycles of the ink rhythm and still inside the
        // shape: at eight bands a 512-pixel window holds barely one cycle, and
        // a palette of four reads as a palette of three.
        const width = Math.min(canvas.width, Math.floor(canvas.height * 0.4));
        const pixels = new Uint8Array(width * 4);
        gl.readPixels(
          Math.floor((canvas.width - width) / 2),
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

/**
 * Every per-layer slider value, plus a semantic reading of the field.
 *
 * One reader serves every slider proof. It cannot be parameterised — an
 * observation reader is serialized into the page and closes over nothing — so
 * instead of naming one control it reports them all, and each proof predicts the
 * whole set. That also makes each proof assert what it did *not* change.
 *
 * The field is read as frequency and tone rather than as pixels:
 *
 * - `frequency` counts light/dark transitions along the middle row. Band count
 *   changes it directly; a quarter turn removes them entirely because the bands
 *   then run parallel to the sampled row.
 * - `tone` is the share of light pixels. Band width moves it without touching
 *   frequency, and opacity at zero leaves the background alone.
 *
 * Both are bucketed, so the expectation is a class the control's meaning implies
 * rather than a pixel count that depends on backing size.
 */
const LAYER_FIELD = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const sliderValue = (label: string): number => {
    const slider = root.querySelector(`input[aria-label="${label}"]`);
    return Number(slider?.getAttribute("aria-valuenow") ?? Number.NaN);
  };

  const canvas = root.querySelector(
    "[data-toolcraft-product-output]",
  ) as HTMLCanvasElement | null;
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    // Read across the middle of the layer's own shape rather than the whole
    // frame. A layer is a shape (R65) and the sliders that could release it to
    // the frame are gone with 14.1, so a full-width row would spend most of its
    // length on bare ground. Half the frame height is the widest span that
    // stays inside a shape at its default size, and it is measured against
    // height because that is the unit the field and the shape share.
    const span = Math.floor(canvas.height * 0.4);
    const pixels = new Uint8Array(span * 4);
    gl.readPixels(
      Math.floor((canvas.width - span) / 2),
      Math.floor(canvas.height / 2),
      span,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );

    let transitions = 0;
    let light = 0;
    let previous: boolean | undefined;
    for (let index = 0; index < pixels.length; index += 4) {
      const isLight = pixels[index] + pixels[index + 1] + pixels[index + 2] > 382;
      if (isLight) light += 1;
      if (previous !== undefined && previous !== isLight) transitions += 1;
      previous = isLight;
    }

    const share = light / (pixels.length / 4);
    // Measured against the span above rather than against the frame: inside the
    // shape the default 24 bands cross the row about 19 times and 4 bands cross it 3,
    // so the boundaries sit either side of those readings rather than either
    // side of the counts a full-width row used to see.
    const frequency = transitions > 15 ? "fine" : transitions > 2 ? "coarse" : "flat";
    const tone = share > 0.9 ? "light" : share < 0.1 ? "dark" : "mixed";
    outputSignature = `${frequency}:${tone}`;
  }

  return {
    controlValue: {
      angle: sliderValue("Angle"),
      bandWidth: sliderValue("Band width"),
      count: sliderValue("Band count"),
      jitter: sliderValue("Jitter"),
      offset: sliderValue("Offset"),
      opacity: sliderValue("Opacity"),
      separator: sliderValue("Band separator"),
      taper: sliderValue("Taper"),
    },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

const DEFAULT_SLIDERS = {
  angle: 0,
  taper: 0,
  jitter: 0,
  bandWidth: 0.5,
  count: 24,
  offset: 0,
  opacity: 1,
  separator: 0,
};

test("browser: studio band count changes the selected layer's frequency", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);

  // 24 bands to 4: the field keeps its balance of light and dark and only its
  // frequency drops, which is exactly what the control claims to do.
  await expectToolcraftSelectedLayerControl(
    session.observe(LAYER_FIELD),
    session.controlAction("selectedLayer.count", async () => {
      await setStudioSlider(page, "Band count", 4);
    }),
    {
      controlValue: { ...DEFAULT_SLIDERS, count: 4 },
      outputSignature: "coarse:mixed",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.count", target: "selectedLayer.count" },
  );
});

test("browser: studio layer angle rotates only the selected layer", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);

  // A quarter turn puts the bands parallel to the sampled row, so the row that
  // crossed every band now sits inside one of them.
  await expectToolcraftSelectedLayerControl(
    session.observe(LAYER_FIELD),
    session.controlAction("selectedLayer.angle", async () => {
      await setStudioSlider(page, "Angle", 90);
    }),
    {
      controlValue: { ...DEFAULT_SLIDERS, angle: 90 },
      outputSignature: "flat:light",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.angle", target: "selectedLayer.angle" },
  );
});

test("browser: studio band width changes the selected layer's balance", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);

  // Widening the band keeps every boundary where it was and moves the balance
  // between the two colours -- frequency holds, tone does not.
  await expectToolcraftSelectedLayerControl(
    session.observe(LAYER_FIELD),
    session.controlAction("selectedLayer.widthRatio", async () => {
      await setStudioSlider(page, "Band width", 0.95);
    }),
    {
      controlValue: { ...DEFAULT_SLIDERS, bandWidth: 0.95 },
      outputSignature: "fine:light",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.widthRatio", target: "selectedLayer.widthRatio" },
  );
});

test("browser: studio layer opacity fades only the selected layer", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);

  // At zero the layer contributes nothing and the background is all that is
  // left, which is the composite weight doing its job rather than a branch.
  await expectToolcraftSelectedLayerControl(
    session.observe(LAYER_FIELD),
    session.controlAction("selectedLayer.opacity", async () => {
      await setStudioSlider(page, "Opacity", 0);
    }),
    {
      controlValue: { ...DEFAULT_SLIDERS, opacity: 0 },
      outputSignature: "flat:dark",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.opacity", target: "selectedLayer.opacity" },
  );
});

/**
 * The field's phase, read as which colour the row starts in.
 *
 * Offset is the one slider the frequency-and-tone reader cannot see: sliding the
 * bands leaves their count and their balance exactly as they were, so both
 * buckets hold and the proof would claim nothing moved. Where the first band
 * begins is the property offset actually changes, and it returns to its starting
 * value after a full cycle, which is what makes it a phase rather than a drift.
 */
const LAYER_PHASE = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const sliderValue = (label: string): number => {
    const slider = root.querySelector(`input[aria-label="${label}"]`);
    return Number(slider?.getAttribute("aria-valuenow") ?? Number.NaN);
  };

  const canvas = root.querySelector(
    "[data-toolcraft-product-output]",
  ) as HTMLCanvasElement | null;
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    // Read across the middle of the layer's own shape rather than the whole
    // frame. A layer is a shape (R65) and the sliders that could release it to
    // the frame are gone with 14.1, so a full-width row would spend most of its
    // length on bare ground. Half the frame height is the widest span that
    // stays inside a shape at its default size, and it is measured against
    // height because that is the unit the field and the shape share.
    const span = Math.floor(canvas.height * 0.4);
    const pixels = new Uint8Array(span * 4);
    gl.readPixels(
      Math.floor((canvas.width - span) / 2),
      Math.floor(canvas.height / 2),
      span,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );

    const isLight = (index: number) =>
      pixels[index] + pixels[index + 1] + pixels[index + 2] > 382;
    let transitions = 0;
    for (let index = 4; index < pixels.length; index += 4) {
      if (isLight(index) !== isLight(index - 4)) transitions += 1;
    }

    // Measured against the span above rather than against the frame: inside the
    // shape the default 24 bands cross the row about 19 times and 4 bands cross it 3,
    // so the boundaries sit either side of those readings rather than either
    // side of the counts a full-width row used to see.
    const frequency = transitions > 15 ? "fine" : transitions > 2 ? "coarse" : "flat";
    // A little inside the span: its first pixel falls exactly on a band seam at
    // half a cycle, where the colour is the average of the two and the reading
    // says nothing about which band the row opens in.
    const opening = Math.floor(span * 0.02) * 4;
    outputSignature = `${frequency}:${isLight(opening) ? "light" : "dark"}`;
  }

  return {
    controlValue: {
      angle: sliderValue("Angle"),
      bandWidth: sliderValue("Band width"),
      count: sliderValue("Band count"),
      jitter: sliderValue("Jitter"),
      offset: sliderValue("Offset"),
      opacity: sliderValue("Opacity"),
      separator: sliderValue("Band separator"),
      taper: sliderValue("Taper"),
    },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

/**
 * How far along its ramp each of three places inside the shape has got.
 *
 * A gradient reads its colour from a position the ramp's shape supplies, so
 * moving the ramp along that axis changes the colour at a fixed place. Reported
 * as three coarse buckets rather than as levels, because the claim is about
 * where the ramp sits and not about what any particular pixel is worth: at the
 * ends of the offset's domain the transition has been carried clear of the
 * shape, so every place reads the same end of the ramp.
 *
 * The buckets are far from the readings that decide them -- the saturated ends
 * measure 0 and 255 against thresholds of 55 and 200 -- which is what keeps a
 * proof about placement from turning into a proof about tone mapping.
 *
 * Inlined because this reader is serialized into the page and cannot call
 * anything defined outside it.
 */
const RAMP_PLACEMENT = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const sliderValue = (label: string): number => {
    const slider = root.querySelector(`input[aria-label="${label}"]`);
    return Number(slider?.getAttribute("aria-valuenow") ?? Number.NaN);
  };

  const canvas = root.querySelector(
    "[data-toolcraft-product-output]",
  ) as HTMLCanvasElement | null;
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    const at = (fx: number): string => {
      const size = 6;
      const pixels = new Uint8Array(size * size * 4);
      gl.readPixels(
        Math.round(canvas.width * fx) - size / 2,
        Math.round(canvas.height * 0.5) - size / 2,
        size,
        size,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      let total = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        total +=
          ((pixels[index] ?? 0) + (pixels[index + 1] ?? 0) + (pixels[index + 2] ?? 0)) / 3;
      }
      const level = total / (size * size);
      return level >= 200 ? "light" : level <= 55 ? "dark" : "mid";
    };

    outputSignature = `a=${at(0.4)} b=${at(0.5)} c=${at(0.6)}`;
  }

  return {
    controlValue: { offset: sliderValue("Offset") },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

test("browser: studio offset slides the selected layer's field along its own axis", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const { layerId, session } = await openStudioSingleLayer(page);

  // Half a cycle swaps which colour the row opens in while leaving the band
  // count untouched -- the bands slide rather than change.
  await expectToolcraftSelectedLayerControl(
    session.observe(LAYER_PHASE),
    session.controlAction("selectedLayer.phase", async () => {
      await setStudioSlider(page, "Offset", 0.5);
    }),
    {
      controlValue: { ...DEFAULT_SLIDERS, offset: 0.5 },
      outputSignature: "fine:dark",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.phase", target: "selectedLayer.phase" },
  );

  // The same control over the other kind of field, which is why it is one
  // control rather than two: the layer becomes a gradient and Offset stays,
  // now sliding the ramp along its own axis instead of the bands along theirs.
  await setStudioLayerKind(page, "Gradient");
  await setStudioSlider(page, "Offset", 0);

  // A gradient arrives white-to-black across the frame, so the shape shows the
  // light end and the middle of the ramp. Carrying the ramp forward by six
  // tenths puts the whole shape past its far end: every place reads black,
  // which no other control on this layer can do -- the angle turns the ramp
  // without moving where it starts, and the slots change the inks rather than
  // their placement.
  await expectToolcraftSelectedLayerControl(
    session.observe(RAMP_PLACEMENT),
    session.controlAction("selectedLayer.phase", async () => {
      await setStudioSlider(page, "Offset", 0.6);
    }),
    {
      controlValue: { offset: 0.6 },
      outputSignature: "a=dark b=dark c=dark",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.phase", target: "selectedLayer.phase" },
  );

  // And it slides both ways: the same distance the other way carries the ramp's
  // near end past the shape instead, so every place reads white. A control that
  // had merely darkened the layer could not produce this half, and a domain
  // that started at zero could not have asked for it.
  await setStudioSlider(page, "Offset", -0.6);
  await expect
    .poll(
      async () =>
        page.locator(STUDIO_PRODUCT_OUTPUT).evaluate((node) => {
          const canvas = node as HTMLCanvasElement;
          const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
          if (!gl) return "nogl";
          const at = (fx: number): string => {
            const size = 6;
            const pixels = new Uint8Array(size * size * 4);
            gl.readPixels(
              Math.round(canvas.width * fx) - size / 2,
              Math.round(canvas.height * 0.5) - size / 2,
              size,
              size,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              pixels,
            );
            let total = 0;
            for (let index = 0; index < pixels.length; index += 4) {
              total +=
                ((pixels[index] ?? 0) +
                  (pixels[index + 1] ?? 0) +
                  (pixels[index + 2] ?? 0)) /
                3;
            }
            const level = total / (size * size);
            return level >= 200 ? "light" : level <= 55 ? "dark" : "mid";
          };
          return `a=${at(0.4)} b=${at(0.5)} c=${at(0.6)}`;
        }),
      { timeout: 15_000 },
    )
    .toBe("a=light b=light c=light");
});

/**
 * The shape of the gradient across the middle row.
 *
 * Read as a shape rather than as pixels because that is what the control names.
 * A linear ramp runs one way across the row; a radial ramp is symmetric about
 * the centre, which is bright while both ends are dark; an angular ramp sweeps
 * around the centre. Comparing three samples names which of those the frame is,
 * without depending on the exact colours or the backing size.
 */
const GRADIENT_SHAPE = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const canvas = root.querySelector(
    "[data-toolcraft-product-output]",
  ) as HTMLCanvasElement | null;
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    const y = Math.floor(canvas.height / 2);
    const luma = (fraction: number) => {
      const pixel = new Uint8Array(4);
      gl.readPixels(
        Math.min(Math.floor(canvas.width * fraction), canvas.width - 1),
        y,
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel,
      );
      return pixel[0] + pixel[1] + pixel[2];
    };

    const left = luma(0.5 - 0.125);
    const middle = luma(0.5);
    const right = luma(0.5 + 0.125);
    const margin = 40;

    outputSignature =
      middle > left + margin && middle > right + margin
        ? "centre-bright"
        : left > middle + margin && middle > right + margin
          ? "descending"
          : right > middle + margin && middle > left + margin
            ? "ascending"
            : "even";
  }

  const combobox = root
    .querySelector('[data-toolcraft-control-target="selectedLayer.rampType"]')
    ?.querySelector('[role="combobox"]');

  return {
    controlValue: (combobox?.textContent ?? "").replace(/[^A-Za-z]/gu, ""),
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

test("browser: studio transition shape redistributes the gradient", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);
  await setStudioLayerKind(page, "Gradient");

  // Linear runs across the row; radial is symmetric about a bright centre. The
  // ramp is redistributed rather than recoloured, which is what the control
  // claims and what a colour-based reading would have missed.
  await expectToolcraftSelectedLayerControl(
    session.observe(GRADIENT_SHAPE),
    session.controlAction("selectedLayer.rampType", async () => {
      await setStudioSelectValue(page, "selectedLayer.rampType", "Radial");
    }),
    {
      controlValue: "Radial",
      outputSignature: "centre-bright",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.rampType", target: "selectedLayer.rampType" },
  );
});

/**
 * Whether the field reads as a reflection of itself.
 *
 * Mirror is the one stripe control whose effect is a relationship rather than a
 * quantity: it changes neither how many bands there are nor how light the field
 * is, so frequency and tone both hold and would report nothing moved. What it
 * changes is symmetry about the centre, so that is what this samples — the left
 * half against the right half reversed.
 */
const FIELD_SYMMETRY = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const canvas = root.querySelector(
    "[data-toolcraft-product-output]",
  ) as HTMLCanvasElement | null;
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    // Read across the middle of the layer's own shape rather than the whole
    // frame. A layer is a shape (R65) and the sliders that could release it to
    // the frame are gone with 14.1, so a full-width row would spend most of its
    // length on bare ground. Half the frame height is the widest span that
    // stays inside a shape at its default size, and it is measured against
    // height because that is the unit the field and the shape share.
    const span = Math.floor(canvas.height * 0.4);
    const pixels = new Uint8Array(span * 4);
    gl.readPixels(
      Math.floor((canvas.width - span) / 2),
      Math.floor(canvas.height / 2),
      span,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );

    const isLight = (index: number) =>
      pixels[index] + pixels[index + 1] + pixels[index + 2] > 382;
    const samples = 64;
    let matched = 0;
    for (let step = 0; step < samples; step += 1) {
      const fraction = (step + 0.5) / (samples * 2);
      // Against the span, not the canvas: the row read above is a centred
      // window now, and indexing it by frame fractions would run off the end
      // of the buffer and compare undefined against undefined.
      const left = Math.floor(span * fraction) * 4;
      const right = Math.floor(span * (1 - fraction)) * 4;
      if (isLight(left) === isLight(right)) matched += 1;
    }

    // A reflected field agrees at nearly every mirrored pair; an unreflected one
    // agrees only where the bands happen to line up.
    outputSignature = matched >= samples - 4 ? "mirrored" : "repeated";
  }

  const toggle = root.querySelector(
    '[data-toolcraft-control-target="selectedLayer.mirror"] [role="switch"]',
  );

  return {
    controlValue: toggle?.getAttribute("aria-checked") ?? "absent",
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

test("browser: studio mirror reflects the selected layer about its axis", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);
  // Few, wide bands at the default offset. Two choices, both load-bearing:
  // at the default band count the bands are fine enough that mirrored and
  // unmirrored pairs agree by coincidence about as often as they disagree, and
  // at an offset of a quarter cycle the field is symmetric about its own axis
  // already, so mirroring it is a genuine no-op and the proof would be asserting
  // nothing. Measured across offsets before this fixture was chosen.
  await setStudioSlider(page, "Band count", 3);

  await expectToolcraftSelectedLayerControl(
    session.observe(FIELD_SYMMETRY),
    session.controlAction("selectedLayer.mirror", async () => {
      await toggleStudioSwitch(page, "selectedLayer.mirror");
    }),
    {
      controlValue: "true",
      outputSignature: "mirrored",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.mirror", target: "selectedLayer.mirror" },
  );
});

/**
 * How much of the band field is actually painted, alongside its frequency.
 *
 * The separator opens a gap the layer does not paint, so what changes is
 * coverage rather than the pattern: the bands stay where they are and stay as
 * many, and progressively less of each one is drawn. Reading both is what makes
 * the proof say that specifically -- a reader that only counted light pixels
 * could not tell a separator from a narrower band.
 *
 * Thresholds picked from measurement rather than intuition: at no separator the
 * field is a little over half light, and at the maximum it is an eighth.
 */
const BAND_COVERAGE = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const sliderValue = (label: string): number => {
    const slider = root.querySelector(`input[aria-label="${label}"]`);
    return Number(slider?.getAttribute("aria-valuenow") ?? Number.NaN);
  };

  const canvas = root.querySelector(
    "[data-toolcraft-product-output]",
  ) as HTMLCanvasElement | null;
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    // Read across the middle of the layer's own shape rather than the whole
    // frame. A layer is a shape (R65) and the sliders that could release it to
    // the frame are gone with 14.1, so a full-width row would spend most of its
    // length on bare ground. Half the frame height is the widest span that
    // stays inside a shape at its default size, and it is measured against
    // height because that is the unit the field and the shape share.
    const span = Math.floor(canvas.height * 0.4);
    const pixels = new Uint8Array(span * 4);
    gl.readPixels(
      Math.floor((canvas.width - span) / 2),
      Math.floor(canvas.height / 2),
      span,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );

    let light = 0;
    let transitions = 0;
    let previous: boolean | undefined;
    for (let index = 0; index < pixels.length; index += 4) {
      const isLight = pixels[index] + pixels[index + 1] + pixels[index + 2] > 382;
      if (isLight) light += 1;
      if (previous !== undefined && previous !== isLight) transitions += 1;
      previous = isLight;
    }

    const share = light / (pixels.length / 4);
    // Measured against the span above rather than against the frame: inside the
    // shape the default 24 bands cross the row about 19 times and 4 bands cross it 3,
    // so the boundaries sit either side of those readings rather than either
    // side of the counts a full-width row used to see.
    const frequency = transitions > 15 ? "fine" : transitions > 2 ? "coarse" : "flat";
    const coverage = share > 0.4 ? "half" : share < 0.2 ? "sparse" : "reduced";
    outputSignature = `${frequency}:${coverage}`;
  }

  return {
    controlValue: {
      angle: sliderValue("Angle"),
      bandWidth: sliderValue("Band width"),
      count: sliderValue("Band count"),
      jitter: sliderValue("Jitter"),
      offset: sliderValue("Offset"),
      opacity: sliderValue("Opacity"),
      separator: sliderValue("Band separator"),
      taper: sliderValue("Taper"),
    },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

test("browser: studio band separator opens a gap to what sits beneath", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);

  // The bands keep their count and their positions; each one is simply painted
  // over less of its own cycle, and the ground shows through the rest.
  await expectToolcraftSelectedLayerControl(
    session.observe(BAND_COVERAGE),
    session.controlAction("selectedLayer.separator", async () => {
      await setStudioSlider(page, "Band separator", 0.4);
    }),
    {
      controlValue: { ...DEFAULT_SLIDERS, separator: 0.4 },
      outputSignature: "fine:sparse",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.separator", target: "selectedLayer.separator" },
  );
});

/**
 * How evenly the bands are spaced, measured as the spread of their run lengths.
 *
 * Jitter displaces each band from its even position, so what changes is the
 * regularity of the spacing rather than the number of bands or the balance of
 * light and dark. Run-length spread names that directly: an unjittered field's
 * runs are all the same length, and a jittered one's are not.
 *
 * The first and last runs are dropped because they are clipped by the edge of
 * the frame and would read as irregular in a field that is not.
 *
 * Thresholds from measurement: an even field spreads by about 0.02, and any
 * jitter worth the name spreads by more than 0.3.
 */
const BAND_REGULARITY = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const sliderValue = (label: string): number => {
    const slider = root.querySelector(`input[aria-label="${label}"]`);
    return Number(slider?.getAttribute("aria-valuenow") ?? Number.NaN);
  };

  const canvas = root.querySelector(
    "[data-toolcraft-product-output]",
  ) as HTMLCanvasElement | null;
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    // Read across the middle of the layer's own shape rather than the whole
    // frame. A layer is a shape (R65) and the sliders that could release it to
    // the frame are gone with 14.1, so a full-width row would spend most of its
    // length on bare ground. Half the frame height is the widest span that
    // stays inside a shape at its default size, and it is measured against
    // height because that is the unit the field and the shape share.
    const span = Math.floor(canvas.height * 0.4);
    const pixels = new Uint8Array(span * 4);
    gl.readPixels(
      Math.floor((canvas.width - span) / 2),
      Math.floor(canvas.height / 2),
      span,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );

    const runs: number[] = [];
    let current = 0;
    let previous: boolean | undefined;
    for (let index = 0; index < pixels.length; index += 4) {
      const isLight = pixels[index] + pixels[index + 1] + pixels[index + 2] > 382;
      if (previous === undefined || isLight === previous) current += 1;
      else {
        runs.push(current);
        current = 1;
      }
      previous = isLight;
    }

    const inner = runs.slice(1, -1);
    const mean = inner.reduce((sum, run) => sum + run, 0) / (inner.length || 1);
    const variance =
      inner.reduce((sum, run) => sum + (run - mean) ** 2, 0) / (inner.length || 1);
    const spread = Math.sqrt(variance) / (mean || 1);
    outputSignature = spread < 0.1 ? "even" : spread > 0.3 ? "irregular" : "uneven";
  }

  return {
    controlValue: {
      angle: sliderValue("Angle"),
      bandWidth: sliderValue("Band width"),
      count: sliderValue("Band count"),
      jitter: sliderValue("Jitter"),
      offset: sliderValue("Offset"),
      opacity: sliderValue("Opacity"),
      separator: sliderValue("Band separator"),
      taper: sliderValue("Taper"),
    },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

test("browser: studio jitter displaces each band from its even position", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);

  // The count holds and the light-to-dark balance holds; only the evenness of
  // the spacing gives way, which is what distinguishes a displacement from a
  // change of frequency or width.
  await expectToolcraftSelectedLayerControl(
    session.observe(BAND_REGULARITY),
    session.controlAction("selectedLayer.jitterAmount", async () => {
      await setStudioSlider(page, "Jitter", 0.6);
    }),
    {
      controlValue: { ...DEFAULT_SLIDERS, jitter: 0.6 },
      outputSignature: "irregular",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.jitterAmount", target: "selectedLayer.jitterAmount" },
  );
});

/**
 * Which band is where, read at three fixed places inside the layer's shape.
 *
 * Jitter variation cannot be read by any statistic of the field, and that is
 * the whole difficulty: the number of bands, the light-to-dark balance and the
 * spread of the run lengths all hold steady across its domain, because it does
 * not change how irregular the field is -- it changes which bands took which
 * displacement. So the reading names the arrangement directly: three points,
 * each comfortably inside a band, reported as the ink that reached them.
 *
 * That is a differential claim rather than a fingerprint. Nothing here asserts
 * that a particular value produces a particular picture; what is asserted is
 * that moving the control swaps the ink at every one of the three, which no
 * change of amount, count or width could do while leaving the field's own
 * statistics where they were.
 *
 * The places and the two values are measured, not chosen: at a count of six
 * with the jitter at nine tenths, variation 12 reads dark-light-dark and
 * variation 5 reads light-dark-light, stable across repeated runs. The points
 * sit inside the shape a layer arrives with (R65), since a reading outside it
 * would find bare ground.
 *
 * Inlined because this reader is serialized into the page and cannot call
 * anything defined outside it.
 */
const BAND_ARRANGEMENT = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const sliderValue = (label: string): number => {
    const slider = root.querySelector(`input[aria-label="${label}"]`);
    return Number(slider?.getAttribute("aria-valuenow") ?? Number.NaN);
  };

  const canvas = root.querySelector(
    "[data-toolcraft-product-output]",
  ) as HTMLCanvasElement | null;
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    const at = (fx: number): string => {
      const size = 6;
      const pixels = new Uint8Array(size * size * 4);
      gl.readPixels(
        Math.round(canvas.width * fx) - size / 2,
        Math.round(canvas.height * 0.5) - size / 2,
        size,
        size,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      let light = 0;
      let dark = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const level =
          (pixels[index] ?? 0) + (pixels[index + 1] ?? 0) + (pixels[index + 2] ?? 0);
        if (level > 600) light += 1;
        else if (level < 120) dark += 1;
      }
      // A patch that straddled an edge is reported as such rather than rounded
      // to one side, so a reading that had drifted onto a boundary would fail
      // loudly instead of passing half the time.
      if (light === size * size) return "light";
      if (dark === size * size) return "dark";
      return "edge";
    };

    outputSignature = `a=${at(0.368)} b=${at(0.476)} c=${at(0.62)}`;
  }

  return {
    controlValue: {
      count: sliderValue("Band count"),
      jitter: sliderValue("Jitter"),
      variation: sliderValue("Jitter variation"),
    },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

test("browser: studio jitter variation rearranges which bands moved where", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);

  // Six bands rather than the default twenty-four, so each one is wide enough
  // that a sample sits well inside it, and the jitter near its limit so the
  // displacements are large enough to swap which band covers a place.
  await setStudioSlider(page, "Band count", 6);
  await setStudioSlider(page, "Jitter", 0.9);

  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (
              document.querySelector(
                "[data-toolcraft-product-output]",
              ) as HTMLCanvasElement | null
            )?.width ?? 0,
        ),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);

  // Every one of the three places changes ink, and the field is the same field:
  // same count, same amount, same two inks. Only which band took which
  // displacement has moved, which is exactly what this control is for and the
  // only thing it does.
  await expectToolcraftSelectedLayerControl(
    session.observe(BAND_ARRANGEMENT),
    session.controlAction("selectedLayer.jitterVariation", async () => {
      await setStudioSlider(page, "Jitter variation", 5);
    }),
    {
      controlValue: { count: 6, jitter: 0.9, variation: 5 },
      outputSignature: "a=light b=dark c=light",
      selectedLayerId: layerId,
    },
    {
      requirementId: "selectedLayer.jitterVariation",
      target: "selectedLayer.jitterVariation",
    },
  );
});

/**
 * How much thicker a band is at one end than the other.
 *
 * Taper moves the split between a band's two colours along the band's own
 * length, so the band becomes a wedge. Sampling a column near each end and
 * comparing their light share names that directly: a wedge separates them, and
 * anything that changes a band's width uniformly -- band width, separator --
 * moves them together and leaves the difference at zero.
 *
 * That distinction is the whole point of the reading. An earlier attempt at this
 * control drove the wrong uniform entirely, and a signature that only tracked
 * overall lightness reported it as working.
 *
 * Each column is read in its own call so one cannot serve stale bytes for the
 * other. Thresholds from measurement: flat at zero, and about 0.45 and 0.90 at
 * a third and two thirds of the control's range.
 */
const BAND_WEDGE = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const sliderValue = (label: string): number => {
    const slider = root.querySelector(`input[aria-label="${label}"]`);
    return Number(slider?.getAttribute("aria-valuenow") ?? Number.NaN);
  };

  const canvas = root.querySelector(
    "[data-toolcraft-product-output]",
  ) as HTMLCanvasElement | null;
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    // Over the shape's own height rather than the frame's: the ground above and
    // below the shape is neither light nor wedged, and counting it into both
    // columns equally would shrink the difference the control is judged by.
    const columnHeight = Math.floor(canvas.height * 0.6);
    const columnTop = Math.floor((canvas.height - columnHeight) / 2);
    const share = (fraction: number) => {
      const x = Math.min(Math.floor(canvas.width * fraction), canvas.width - 1);
      const pixels = new Uint8Array(columnHeight * 4);
      gl.readPixels(x, columnTop, 1, columnHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let light = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 382) light += 1;
      }
      return light / (pixels.length / 4);
    };

    // Columns just inside the shape's own width rather than at the frame's
    // edges, which the layer no longer reaches (R65).
    const delta = Math.abs(share(0.5 - 0.125) - share(0.5 + 0.125));
    outputSignature = delta < 0.05 ? "even" : delta > 0.3 ? "wedged" : "leaning";
  }

  return {
    controlValue: {
      angle: sliderValue("Angle"),
      bandWidth: sliderValue("Band width"),
      count: sliderValue("Band count"),
      jitter: sliderValue("Jitter"),
      offset: sliderValue("Offset"),
      opacity: sliderValue("Opacity"),
      separator: sliderValue("Band separator"),
      taper: sliderValue("Taper"),
    },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

test("browser: studio taper turns each band into a wedge", async ({ page }) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);
  // Few bands running across the frame, so each band's length is the horizontal
  // axis and a wedge shows as a thickness difference between its two ends.
  await setStudioSlider(page, "Band count", 6);
  await setStudioSlider(page, "Angle", 90);

  await expectToolcraftSelectedLayerControl(
    session.observe(BAND_WEDGE),
    session.controlAction("selectedLayer.taper", async () => {
      await setStudioSlider(page, "Taper", 1);
    }),
    {
      controlValue: { ...DEFAULT_SLIDERS, angle: 90, count: 6, taper: 1 },
      outputSignature: "wedged",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.taper", target: "selectedLayer.taper" },
  );
});

/**
 * Where the layer draws, read as the centre of the frame against its corners.
 *
 * A region confines the layer, so the two disagree: one carries the field and
 * the other carries whatever sits beneath it. Unmasked they agree, because the
 * layer covers everything. Inverting the sense swaps which is which, so the
 * same reading names all three states without a separate observable.
 */
const LAYER_REGION = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const sliderValue = (label: string): number => {
    const slider = root.querySelector(`input[aria-label="${label}"]`);
    return Number(slider?.getAttribute("aria-valuenow") ?? Number.NaN);
  };

  const canvas = root.querySelector(
    "[data-toolcraft-product-output]",
  ) as HTMLCanvasElement | null;
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    // A tall strip, read against a field whose bands run across it. Both halves
    // of that matter: a strip that lies along a band rather than across it sits
    // inside a single colour, and then a covered corner and a bare one both
    // report one colour and the reading cannot tell them apart. That is exactly
    // how this first lied -- the corner was white when covered and black when
    // masked, and counting colours saw one either way.
    const patch = (fx: number, fy: number) => {
      const width = 16;
      const height = Math.min(Math.floor(canvas.height / 3), canvas.height);
      const x = Math.min(
        Math.max(Math.floor(canvas.width * fx) - width / 2, 0),
        canvas.width - width,
      );
      const y = Math.min(
        Math.max(Math.floor(canvas.height * fy) - height / 2, 0),
        canvas.height - height,
      );
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const seen = new Set<string>();
      for (let index = 0; index < pixels.length; index += 4) {
        seen.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
      }
      // A patch of the striped field carries both colours; a patch of bare
      // ground carries one.
      return seen.size > 1 ? "field" : "ground";
    };

    outputSignature = `centre=${patch(0.5, 0.5)} corner=${patch(0.06, 0.06)}`;
  }

  return {
    controlValue: {
      angle: sliderValue("Angle"),
      bandWidth: sliderValue("Band width"),
      count: sliderValue("Band count"),
      jitter: sliderValue("Jitter"),
      offset: sliderValue("Offset"),
      opacity: sliderValue("Opacity"),
      regionInverted:
        root
          .querySelector(
            '[data-toolcraft-control-target="selectedLayer.maskInvert"] [role="switch"]',
          )
          ?.getAttribute("aria-checked") ?? "absent",
      separator: sliderValue("Band separator"),
      taper: sliderValue("Taper"),
    },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

test("browser: studio region sense swaps which side the layer draws on", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);
  await setStudioSlider(page, "Angle", 90);

  // The region becomes a hole rather than the whole of the layer: the field and
  // the bare ground trade places.
  await expectToolcraftSelectedLayerControl(
    session.observe(LAYER_REGION),
    session.controlAction("selectedLayer.maskInvert", async () => {
      await toggleStudioSwitch(page, "selectedLayer.maskInvert");
    }),
    {
      controlValue: {
        ...DEFAULT_SLIDERS,
        angle: 90,
        regionInverted: "true",
      },
      outputSignature: "centre=ground corner=field",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.maskInvert", target: "selectedLayer.maskInvert" },
  );
});

/**
 * Which inks the layer is actually working in, and how many.
 *
 * Every ink in use covers a fair share of the row -- a fifth or more when four
 * are in play -- while the blend between two neighbouring bands covers well
 * under a percent. Measurement across two, three and four slots put the
 * smallest ink at 20% and the largest blend at 0.8%, so a 5% share separates
 * them with room to spare and without hard-coding how many there are.
 *
 * The whole row is read rather than a leading slice: a slice narrow enough to
 * be cheap covers only a band or two, which cannot tell a four-ink cycle from a
 * two-ink one.
 *
 * Inlined because this reader is serialized into the page and cannot call
 * anything defined outside it.
 */
const PALETTE_INKS = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const canvas = root.querySelector<HTMLCanvasElement>(
    "[data-toolcraft-product-output]",
  );
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    // Read across the middle of the layer's own shape rather than the whole
    // frame. A layer is a shape (R65) and the sliders that could release it to
    // the frame are gone with 14.1, so a full-width row would spend most of its
    // length on bare ground. Half the frame height is the widest span that
    // stays inside a shape at its default size, and it is measured against
    // height because that is the unit the field and the shape share.
    const span = Math.floor(canvas.height * 0.4);
    const pixels = new Uint8Array(span * 4);
    gl.readPixels(
      Math.floor((canvas.width - span) / 2),
      Math.floor(canvas.height / 2),
      span,
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

    // The share is of the row actually read, not of the frame. Dividing by the
    // frame width while reading a window of it put every ink near the threshold
    // and dropped whichever fell under -- a four-ink palette read as three.
    const total = span;
    outputSignature =
      [...counts.entries()]
        .filter(([, count]) => count / total > 0.05)
        .map(([hex]) => hex)
        .sort()
        .join("|") || "none";
  }

  const hexField = (label: string): string =>
    root
      .querySelector<HTMLInputElement>(`input[aria-label="${label} hex"]`)
      ?.value.toLowerCase() ?? "";

  const slots = root.querySelector('input[aria-label="Colour slots"]');

  return {
    controlValue: {
      colorC: hexField("Third colour"),
      colorD: hexField("Fourth colour"),
      slots: Number(slots?.getAttribute("aria-valuenow") ?? Number.NaN),
    },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

/**
 * Few enough bands that every slot of the cycle gets a wide run of its own,
 * which is what lets a share threshold see the whole palette at once.
 */
async function openStudioPaletteLayer(
  page: Parameters<typeof openStudioSingleLayer>[0],
) {
  const fixture = await openStudioSingleLayer(page);
  // Twelve rather than eight: the sampled row is the shape's width now, and at
  // eight bands it holds barely three of them -- a four-ink cycle that never
  // completes reads as a three-ink palette.
  await setStudioSlider(page, "Band count", 12);
  return fixture;
}

test("browser: studio colour slots change how many inks the layer cycles", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioPaletteLayer(page);

  // Two inks alternating becomes four inks in rotation: the third and fourth
  // colours enter the field, and the first two keep the shares they had.
  await expectToolcraftSelectedLayerControl(
    session.observe(PALETTE_INKS),
    session.controlAction("selectedLayer.paletteSlots", async () => {
      await setStudioSlider(page, "Colour slots", 4);
    }),
    {
      controlValue: { colorC: "#ff0000", colorD: "#0000ff", slots: 4 },
      outputSignature: "#000000|#0000ff|#ff0000|#ffffff",
      selectedLayerId: layerId,
    },
    {
      requirementId: "selectedLayer.paletteSlots",
      target: "selectedLayer.paletteSlots",
    },
  );
});

test("browser: studio third palette colour recolours its own slot", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioPaletteLayer(page);
  await setStudioSlider(page, "Colour slots", 4);

  // Red leaves the field and green takes its place; the other three inks are
  // exactly where they were, which is what makes this the third slot rather
  // than a recolour of the whole layer.
  await expectToolcraftSelectedLayerControl(
    session.observe(PALETTE_INKS),
    session.controlAction("selectedLayer.colorC", async () => {
      await setStudioColorHex(page, "Third colour", "#00FF00");
    }),
    {
      controlValue: { colorC: "#00ff00", colorD: "#0000ff", slots: 4 },
      outputSignature: "#000000|#0000ff|#00ff00|#ffffff",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.colorC", target: "selectedLayer.colorC" },
  );
});

test("browser: studio fourth palette colour occupies the last slot", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioPaletteLayer(page);
  await setStudioSlider(page, "Colour slots", 4);

  // The same reading against the last slot: blue goes, yellow arrives, and the
  // first three inks are untouched.
  await expectToolcraftSelectedLayerControl(
    session.observe(PALETTE_INKS),
    session.controlAction("selectedLayer.colorD", async () => {
      await setStudioColorHex(page, "Fourth colour", "#FFFF00");
    }),
    {
      controlValue: { colorC: "#ff0000", colorD: "#ffff00", slots: 4 },
      outputSignature: "#000000|#ff0000|#ffff00|#ffffff",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.colorD", target: "selectedLayer.colorD" },
  );
});

/**
 * Where the region reaches, read at the corners of its bounding box, at the
 * middle of its sides, and at the middle of its caps.
 *
 * Three places rather than one because the two controls this serves change
 * different pairs of them. A rectangle reaches all three; the ellipse inscribed
 * in it gives up the corners and keeps the rest, which is exactly the
 * difference between the shapes. A wide region reaches its sides and not its
 * caps, and turning it a quarter-turn trades one for the other -- which a
 * reading of the corners alone could not tell from the region simply shrinking.
 *
 * The sample points sit at nine tenths of each half-extent so they fall inside
 * a rectangle with room to spare, which is what makes "outside" mean the shape
 * and not the sampling. Measured before the expectations were written: the
 * rectangle reads field at all eight points, the ellipse ground at all four
 * corners.
 *
 * Inlined because this reader is serialized into the page and cannot call
 * anything defined outside it.
 */
const REGION_EXTENT = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const canvas = root.querySelector<HTMLCanvasElement>(
    "[data-toolcraft-product-output]",
  );
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    const at = (fx: number, fy: number): string => {
      const width = 40;
      const height = 6;
      const x = Math.min(
        Math.max(Math.round(canvas.width * fx) - width / 2, 0),
        canvas.width - width,
      );
      const y = Math.min(
        Math.max(Math.round(canvas.height * fy) - height / 2, 0),
        canvas.height - height,
      );
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const colours = new Set<string>();
      for (let index = 0; index < pixels.length; index += 4) {
        colours.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
      }
      // The bands run across the frame, so a patch always crosses several of
      // them where the layer draws and sees one flat colour where it does not.
      return colours.size > 1 ? "field" : "ground";
    };

    const agree = (places: readonly string[]): string =>
      places.every((place) => place === places[0]) ? places[0] : "mixed";

    const corners = agree([
      at(0.5 - 0.127, 0.5 - 0.225),
      at(0.5 + 0.127, 0.5 - 0.225),
      at(0.5 - 0.127, 0.5 + 0.225),
      at(0.5 + 0.127, 0.5 + 0.225),
    ]);
    const sides = agree([at(0.5 - 0.127, 0.5), at(0.5 + 0.127, 0.5)]);
    const caps = agree([at(0.5, 0.5 - 0.225), at(0.5, 0.5 + 0.225)]);

    outputSignature = `corners=${corners} sides=${sides} caps=${caps}`;
  }

  const combobox = root
    .querySelector('[data-toolcraft-control-target="selectedLayer.maskShape"]')
    ?.querySelector('[role="combobox"]');

  return {
    controlValue: {
      shape: (combobox?.textContent ?? "").replace(/[^A-Za-z]/gu, ""),
    },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

test("browser: studio region shape switches the rectangle for an ellipse", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);

  // The corners go and nothing else does: the ellipse is inscribed in the
  // rectangle it replaces rather than being a smaller region of the same kind.
  await expectToolcraftSelectedLayerControl(
    session.observe(REGION_EXTENT),
    session.controlAction("selectedLayer.maskShape", async () => {
      await setStudioSelectValue(page, "selectedLayer.maskShape", "Ellipse");
    }),
    {
      controlValue: { shape: "Ellipse" },
      outputSignature: "corners=ground sides=field caps=field",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.maskShape", target: "selectedLayer.maskShape" },
  );

  // The same extent read as three sides rather than as a rounded box. Choosing
  // a named polygon leaves the apex and gives up the rest, and the side count
  // control stays absent because the name carries its own.
  await expectToolcraftSelectedLayerControl(
    session.observe(POLYGON_EXTENT),
    session.controlAction("selectedLayer.maskShape", async () => {
      await setStudioSelectValue(page, "selectedLayer.maskShape", "Triangle");
    }),
    {
      controlValue: { shape: "Triangle", sides: "absent" },
      outputSignature: "apex=field base=ground left=ground right=ground",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.maskShape", target: "selectedLayer.maskShape" },
  );
});

/**
 * How far a polygon form reaches along each axis of its own extent.
 *
 * A regular polygon is inscribed in the extent (R65), so the reading that tells
 * one form from another is which of the four axis directions the shape still
 * reaches. A point-up triangle keeps its apex and gives up the two sides and
 * the base; a twelve-sided one keeps all four and reads like the ellipse it is
 * approaching. Corners are not read at all here — every polygon loses them, so
 * they would say nothing about the side count.
 *
 * The vertical points are named for the shape rather than for the buffer:
 * `readPixels` measures from the bottom of the backing while the field measures
 * from the centre upward, so the apex sits at the *larger* fraction.
 *
 * Sample points sit at nine tenths of each half-extent, matching REGION_EXTENT
 * so the two readings are directly comparable. Measured before the expectations
 * were written: at three sides the apex reads field and the other three read
 * ground; at twelve, all four read field.
 *
 * Inlined because this reader is serialized into the page and cannot call
 * anything defined outside it.
 */
const POLYGON_EXTENT = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const canvas = root.querySelector<HTMLCanvasElement>(
    "[data-toolcraft-product-output]",
  );
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    const at = (fx: number, fy: number): string => {
      const width = 40;
      const height = 6;
      const x = Math.min(
        Math.max(Math.round(canvas.width * fx) - width / 2, 0),
        canvas.width - width,
      );
      const y = Math.min(
        Math.max(Math.round(canvas.height * fy) - height / 2, 0),
        canvas.height - height,
      );
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const colours = new Set<string>();
      for (let index = 0; index < pixels.length; index += 4) {
        colours.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
      }
      return colours.size > 1 ? "field" : "ground";
    };

    outputSignature = [
      `apex=${at(0.5, 0.5 + 0.225)}`,
      `base=${at(0.5, 0.5 - 0.225)}`,
      `left=${at(0.5 - 0.127, 0.5)}`,
      `right=${at(0.5 + 0.127, 0.5)}`,
    ].join(" ");
  }

  const combobox = root
    .querySelector('[data-toolcraft-control-target="selectedLayer.maskShape"]')
    ?.querySelector('[role="combobox"]');

  // Reported as "absent" rather than as a number when the control is not
  // rendered, so a named form's reading says out loud that it carries its own
  // side count instead of reading a stale one off a hidden slider.
  const sidesControl = root.querySelector('input[aria-label="Sides"]');

  return {
    controlValue: {
      shape: (combobox?.textContent ?? "").replace(/[^A-Za-z]/gu, ""),
      sides: sidesControl
        ? Number(sidesControl.getAttribute("aria-valuenow"))
        : "absent",
    },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

test("browser: studio region sides reshape the polygon", async ({ page }) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);
  await setStudioSelectValue(page, "selectedLayer.maskShape", "Polygon");
  await setStudioSlider(page, "Sides", 12);

  // Twelve sides is as close to the ellipse as this control reaches, so the
  // shape holds all four directions. Cutting it to three leaves the apex alone,
  // which is what separates a side count from a size: a smaller polygon would
  // have lost the apex with everything else.
  await expectToolcraftSelectedLayerControl(
    session.observe(POLYGON_EXTENT),
    session.controlAction("selectedLayer.maskSides", async () => {
      await setStudioSlider(page, "Sides", 3);
    }),
    {
      controlValue: { shape: "Polygon", sides: 3 },
      outputSignature: "apex=field base=ground left=ground right=ground",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.maskSides", target: "selectedLayer.maskSides" },
  );
});

// The rotation proof left this file with 15.3, along with the slider it drove.
// The turn is proved where it now happens: "browser: studio rotation grip turns
// the layer's shape on the canvas", in the canvas handle spec.

/**
 * How many tones the field carries, and how much of it is neither ink.
 *
 * Both halves are needed because the three engines change different things. An
 * induced fringe multiplies the tones without moving either ink, so counting
 * distinct colours sees it. A beat between two printed structures keeps the
 * tone count where it was and moves how much of the row sits between the two
 * inks, so the mid share sees that instead.
 *
 * Measured before the expectations were written, at eight bands: the plain
 * field carries 4 distinct colours and almost nothing between the inks; an
 * induced field at a quarter carries 37; at full amount 120, with nearly half
 * the row between the inks. Interference holds 7 to 9 tones throughout and
 * moves its mid share from 0.19 to 0.31 across the pitch range.
 *
 * Inlined because this reader is serialized into the page and cannot call
 * anything defined outside it.
 */
const ENGINE_FIELD = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const canvas = root.querySelector<HTMLCanvasElement>(
    "[data-toolcraft-product-output]",
  );
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    const span = Math.floor(canvas.height * 0.4);
    const pixels = new Uint8Array(span * 4);
    gl.readPixels(
      Math.floor((canvas.width - span) / 2),
      Math.floor(canvas.height / 2),
      span,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );

    const seen = new Set<string>();
    let between = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      seen.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
      const sum = pixels[index] + pixels[index + 1] + pixels[index + 2];
      if (sum > 60 && sum < 700) between += 1;
    }

    const tones =
      seen.size <= 8 ? "flat" : seen.size <= 60 ? "induced" : "saturated";
    const mid = between / span > 0.25 ? "wide" : "narrow";
    outputSignature = `tones=${tones} mid=${mid}`;
  }

  const combobox = root
    .querySelector('[data-toolcraft-control-target="selectedLayer.engine"]')
    ?.querySelector('[role="combobox"]');
  const slider = (label: string): number | string => {
    const input = root.querySelector(`input[aria-label="${label}"]`);
    return input ? Number(input.getAttribute("aria-valuenow")) : "absent";
  };

  return {
    controlValue: {
      amount: slider("Engine amount"),
      engine: (combobox?.textContent ?? "").replace(/[^A-Za-z]/gu, ""),
      pitch: slider("Interference pitch"),
    },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

test("browser: studio chromatic engine recolours the field it is given", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);
  await setStudioSlider(page, "Band count", 8);

  // The inks do not change and the boundaries do: induction puts the complement
  // of the local colour along every edge, which is the afterimage the eye makes
  // there anyway, made explicit.
  await expectToolcraftSelectedLayerControl(
    session.observe(ENGINE_FIELD),
    session.controlAction("selectedLayer.engine", async () => {
      await setStudioSelectValue(page, "selectedLayer.engine", "Induction");
    }),
    {
      controlValue: { amount: 0.25, engine: "Induction", pitch: "absent" },
      outputSignature: "tones=induced mid=narrow",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.engine", target: "selectedLayer.engine" },
  );
});

test("browser: studio engine amount scales the technique", async ({ page }) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);
  await setStudioSlider(page, "Band count", 8);
  await setStudioSelectValue(page, "selectedLayer.engine", "Induction");

  // The fringe widens until most of the row is carrying an induced colour
  // rather than one of the two inks.
  await expectToolcraftSelectedLayerControl(
    session.observe(ENGINE_FIELD),
    session.controlAction("selectedLayer.engineAmount", async () => {
      await setStudioSlider(page, "Engine amount", 1);
    }),
    {
      controlValue: { amount: 1, engine: "Induction", pitch: "absent" },
      outputSignature: "tones=saturated mid=wide",
      selectedLayerId: layerId,
    },
    {
      requirementId: "selectedLayer.engineAmount",
      target: "selectedLayer.engineAmount",
    },
  );
});

test("browser: studio interference pitch changes the beat", async ({ page }) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);
  await setStudioSlider(page, "Band count", 8);
  await setStudioSelectValue(page, "selectedLayer.engine", "Interference");
  await setStudioSlider(page, "Engine amount", 0.5);
  await setStudioSlider(page, "Interference pitch", 1);

  // At a ratio of one the two structures coincide and the field is mostly the
  // tone their agreement leaves; pulling the pitch apart moves the beat, and
  // the row stops sitting between the inks.
  await expectToolcraftSelectedLayerControl(
    session.observe(ENGINE_FIELD),
    session.controlAction("selectedLayer.enginePitch", async () => {
      await setStudioSlider(page, "Interference pitch", 0.5);
    }),
    {
      controlValue: { amount: 0.5, engine: "Interference", pitch: 0.5 },
      outputSignature: "tones=flat mid=narrow",
      selectedLayerId: layerId,
    },
    {
      requirementId: "selectedLayer.enginePitch",
      target: "selectedLayer.enginePitch",
    },
  );
});


/**
 * Which side of the field is carrying the technique.
 *
 * The cursor's whole claim is spatial -- the engine reaches where the pointer
 * is and not where it is not -- so the reading has to ask two places rather
 * than measure one. Both sample points sit inside the shape, either side of its
 * centre, so a difference between them is the pointer's doing and not the
 * shape's edge.
 *
 * Measured before the expectations were written, at eight bands with induction
 * at full amount: a plain band carries 4 distinct tones across the patch and an
 * induced one carries 13 to 17, so the boundary between them is nowhere near
 * either reading.
 *
 * Inlined because this reader is serialized into the page and cannot call
 * anything defined outside it.
 */
const CURSOR_FIELD = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const canvas = root.querySelector<HTMLCanvasElement>(
    "[data-toolcraft-product-output]",
  );
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    const at = (fx: number): string => {
      const width = 120;
      const x = Math.min(
        Math.max(Math.round(canvas.width * fx) - width / 2, 0),
        canvas.width - width,
      );
      const pixels = new Uint8Array(width * 4);
      gl.readPixels(
        x,
        Math.floor(canvas.height / 2),
        width,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      const seen = new Set<string>();
      for (let index = 0; index < pixels.length; index += 4) {
        seen.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
      }
      return seen.size > 8 ? "induced" : "plain";
    };

    outputSignature = `left=${at(0.4)} right=${at(0.6)}`;
  }

  const combobox = root
    .querySelector('[data-toolcraft-control-target="selectedLayer.engine"]')
    ?.querySelector('[role="combobox"]');

  return {
    controlValue: {
      engine: (combobox?.textContent ?? "").replace(/[^A-Za-z]/gu, ""),
      follow:
        root
          .querySelector(
            '[data-toolcraft-control-target="selectedLayer.engineCursor"] [role="switch"]',
          )
          ?.getAttribute("aria-checked") ?? "absent",
    },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

test("browser: studio engine follows the pointer across the field", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);
  await setStudioSlider(page, "Band count", 8);
  await setStudioSelectValue(page, "selectedLayer.engine", "Induction");
  await setStudioSlider(page, "Engine amount", 1);

  const output = page.locator(STUDIO_PRODUCT_OUTPUT);
  const box = await output.boundingBox();
  if (!box) throw new Error("The canvas needs a bounding box to aim a pointer at.");
  const aim = async (fraction: number): Promise<void> => {
    await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
    // One commit per frame, so the value the shader reads is a frame behind the
    // move that produced it.
    await page.waitForTimeout(200);
  };

  await aim(0.4);

  // The pointer has to be put back after the switch is clicked: clicking it
  // moves the pointer to the sidebar, which is off the canvas, and an engine
  // following a pointer that has left reaches nothing anywhere. Both halves are
  // the same action -- turn it on, then point at something.
  await expectToolcraftSelectedLayerControl(
    session.observe(CURSOR_FIELD),
    session.controlAction("selectedLayer.engineCursor", async () => {
      await toggleStudioSwitch(page, "selectedLayer.engineCursor");
      await aim(0.4);
    }),
    {
      controlValue: { engine: "Induction", follow: "true" },
      outputSignature: "left=induced right=plain",
      selectedLayerId: layerId,
    },
    {
      requirementId: "selectedLayer.engineCursor",
      target: "selectedLayer.engineCursor",
    },
  );

  // And it is the pointer that decides which side, not the switch: moving to
  // the other half of the field trades one for the other.
  await aim(0.6);
  await expect
    .poll(async () => output.evaluate((node) => node.getAttribute("data-studio-stack")), {
      timeout: 5000,
    })
    .toBe("stripes");
  expect(
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        "[data-toolcraft-product-output]",
      );
      const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
      if (!canvas || !gl) return "absent";
      const at = (fx: number): string => {
        const width = 120;
        const x = Math.round(canvas.width * fx) - width / 2;
        const pixels = new Uint8Array(width * 4);
        gl.readPixels(x, Math.floor(canvas.height / 2), width, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const seen = new Set<string>();
        for (let index = 0; index < pixels.length; index += 4) {
          seen.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
        }
        return seen.size > 8 ? "induced" : "plain";
      };
      return `left=${at(0.4)} right=${at(0.6)}`;
    }),
  ).toBe("left=plain right=induced");
});


/**
 * What a duplicate is: one more layer in the stack, carrying the values of the
 * one it came from.
 *
 * Every part of the reading is needed, because each alone passes for the wrong
 * reason. The row count grows for a plain Add too. The stack signature grows
 * for a plain Add too. A band count of 7 proves only that something is
 * selected. Together with the selection landing on an id derived from the
 * source, they say the copy exists, draws, and is a copy.
 *
 * Pixels are deliberately not the observable, and the acceptance row says so: a
 * copy composited directly above an opaque source is the same picture, so a
 * rendered-pixels proof would be unchanged by a duplicate that worked
 * perfectly. What changed is runtime state, which is a command side effect.
 */
/**
 * The Duplicate button, scoped to the control that owns it.
 *
 * By target rather than by name: the page carries some seventy buttons and more
 * than one can answer to a name, so a bare name query resolves to whichever the
 * runtime rendered first and then waits forever for it to become clickable.
 */
function studioDuplicateButton(page: Page) {
  return page
    .locator('[data-toolcraft-control-target="stack.actions"]')
    .getByRole("button", { name: "Duplicate" })
    .first();
}

/**
 * Scrolled into view before it is pressed.
 *
 * The controls panel has a sticky footer, and the button sits under it at some
 * scroll positions -- present, enabled, and unable to receive a click, which
 * reads as a hang rather than as a miss.
 */
async function clickStudioDuplicate(page: Page): Promise<void> {
  const button = studioDuplicateButton(page);
  await button.scrollIntoViewIfNeeded();
  await button.click();
}

async function readStudioDuplicateState(page: Page): Promise<{
  bandCount: number;
  rows: number;
  selectedLayerId: string;
  stack: string;
}> {
  return page.evaluate(() => ({
    bandCount: Number(
      document
        .querySelector('input[aria-label="Band count"]')
        ?.getAttribute("aria-valuenow") ?? Number.NaN,
    ),
    rows: document.querySelectorAll("[data-layer-id]").length,
    selectedLayerId:
      document
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
    stack:
      document
        .querySelector("[data-toolcraft-product-output]")
        ?.getAttribute("data-studio-stack") ?? "absent",
  }));
}

test("browser: studio duplicate copies the layer and its settings", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId } = await openStudioSingleLayer(page);
  // An edit the defaults would never produce, so a fresh layer cannot pass for
  // a copy of this one.
  await setStudioSlider(page, "Band count", 7);

  const after = await expectToolcraftAcceptanceOutcome(
    async () => readStudioDuplicateState(page),
    async () => {
      await clickStudioDuplicate(page);
    },
    {
      evidenceType: "command-side-effect",
      requirementId: "selectedLayer.duplicate",
    },
  );

  expect(after).toEqual({
    bandCount: 7,
    rows: 2,
    selectedLayerId: `${layerId}-copy`,
    stack: "stripes>stripes",
  });

  // The source is untouched: selecting it back finds the value it always had,
  // which is what makes this a copy rather than a move.
  await selectStudioLayer(page, layerId);
  await expect
    .poll(
      async () => (await readStudioDuplicateState(page)).bandCount,
      { timeout: 5000 },
    )
    .toBe(7);

  // A group is the same command over a bigger block: the group and everything
  // under it. Two rows arrive rather than one, and the copied member draws --
  // which it could only do from inside the copied group, because a member left
  // pointing at the original would have made the copy an empty container.
  //
  // The group is built here rather than through the shared grouped fixture,
  // and every id is derived by diffing the panel rather than assumed. This test
  // has already built a stack and the app persists it, so a fixture that
  // expects to start from nothing starts from something instead.
  const beforeGroup = await readStudioLayerIds(page);
  await addStudioGroup(page);
  const groupId =
    (await readStudioLayerIds(page)).find((id) => !beforeGroup.includes(id)) ?? "";
  expect(groupId, "adding a group must add exactly one row").not.toBe("");

  // The group is the selection, so the next layer lands inside it.
  await addStudioLayer(page);
  const rowsWithGroup = await readStudioLayerIds(page);
  const stackWithMember = (await readStudioDuplicateState(page)).stack;

  await selectStudioLayer(page, groupId);
  await clickStudioDuplicate(page);

  await expect
    .poll(async () => readStudioLayerIds(page), { timeout: 10_000 })
    .toHaveLength(rowsWithGroup.length + 2);

  const afterGroup = await readStudioDuplicateState(page);
  expect(afterGroup.selectedLayerId).toBe(`${groupId}-copy`);
  // One more entry in the assembled stack: the copied member is drawing, which
  // it does only from inside the copied group.
  expect(afterGroup.stack.split(">")).toHaveLength(
    stackWithMember.split(">").length + 1,
  );
});



/**
 * The colour the layer leaves behind, read inside its region and outside it.
 *
 * Treatment is not something a layer does to itself -- it is something it does
 * to what is beneath it -- so a reading that only looked inside could not tell
 * a lens from a layer that simply painted that colour. Two places, and the
 * outside one staying put, is what makes it a lens.
 *
 * Channels are reported to the nearest sixteenth so a driver that rounds a
 * multiply differently by a count or two reads the same. Measured before the
 * expectations were written: a red field turns to (0, 178, 0) at a hue shift of
 * 120, drains to (127, 127, 127) at zero saturation, and flattens to
 * (188, 188, 188) at zero contrast.
 *
 * Inlined because this reader is serialized into the page and cannot call
 * anything defined outside it.
 */
const TREATED_FIELD = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const canvas = root.querySelector<HTMLCanvasElement>(
    "[data-toolcraft-product-output]",
  );
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    const at = (fx: number, fy = 0.5): string => {
      const width = 32;
      const height = 4;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(
        Math.round(canvas.width * fx),
        Math.round(canvas.height * fy),
        width,
        height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );

      const counts = new Map<string, number>();
      for (let index = 0; index < pixels.length; index += 4) {
        const quantised = [pixels[index], pixels[index + 1], pixels[index + 2]]
          .map((channel) => Math.min(Math.round(channel / 16) * 16, 255))
          .map((channel) => channel.toString(16).padStart(2, "0"))
          .join("");
        counts.set(quantised, (counts.get(quantised) ?? 0) + 1);
      }

      return `#${
        [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? ""
      }`;
    };

    // Inside is the middle of the triangle; outside is below its base, where the
    // rectangle beneath still reaches and the triangle does not. Below rather
    // than beside because that is where the gap between the two forms is widest
    // -- a point beside the apex sits within a few thousandths of the edge, and
    // a patch there straddles it.
    outputSignature = `inside=${at(0.5)} outside=${at(0.5, 0.31)}`;
  }

  const sliderValue = (label: string): number => {
    const slider = root.querySelector(`input[aria-label="${label}"]`);
    return Number(slider?.getAttribute("aria-valuenow") ?? Number.NaN);
  };

  const combobox = root
    .querySelector('[data-toolcraft-control-target="selectedLayer.blendMode"]')
    ?.querySelector('[role="combobox"]');

  return {
    controlValue: {
      blend: (combobox?.textContent ?? "").replace(/[^A-Za-z]/gu, ""),
      contrast: sliderValue("Contrast"),
      hue: sliderValue("Hue shift"),
      saturation: sliderValue("Saturation"),
    },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

/**
 * A lens: a coloured field below, and above it a region-confined layer that
 * paints nothing of its own.
 *
 * Zero opacity is what makes it a lens rather than a filter on a visible layer.
 * Treatment is weighted by reach and opacity only weights the paint, so the
 * layer at zero opacity still treats what it covers -- which is precisely the
 * construction the reference works use, and the one worth proving.
 */
async function openStudioTreatmentLens(
  page: Parameters<typeof openStudioTwoLayerStack>[0],
) {
  const { fixture, session } = await openStudioTwoLayerStack(page);

  await setStudioColorHex(page, "First colour", "#FF0000");
  await setStudioColorHex(page, "Second colour", "#0000FF");
  await setStudioSlider(page, "Band count", 8);

  await selectStudioLayer(page, fixture.gradientLayerId);
  await setStudioSlider(page, "Opacity", 0);
  // The lens is a triangle over a rectangle of the same extent. Both layers are
  // shapes now (R65) and the sliders that could have made one bigger than the
  // other retired with 14.1, so the difference is made with the form instead:
  // the triangle leaves the sides of the rectangle uncovered, and those are the
  // "outside" the reading needs.
  await setStudioSelectValue(page, "selectedLayer.maskShape", "Triangle");

  return { layerId: fixture.gradientLayerId, session };
}

const LENS_DEFAULTS = { blend: "Normal", contrast: 1, hue: 0, saturation: 1 };

test("browser: studio hue shift turns the colours beneath the layer", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const { layerId, session } = await openStudioTreatmentLens(page);

  // Red becomes green where the layer reaches and stays red where it does not.
  await expectToolcraftSelectedLayerControl(
    session.observe(TREATED_FIELD),
    session.controlAction("selectedLayer.hue", async () => {
      await setStudioSlider(page, "Hue shift", 120);
    }),
    {
      controlValue: { ...LENS_DEFAULTS, hue: 120 },
      outputSignature: "inside=#00b000 outside=#ff0000",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.hue", target: "selectedLayer.hue" },
  );
});

test("browser: studio saturation drains the colour beneath the layer", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const { layerId, session } = await openStudioTreatmentLens(page);

  // The colour goes and the brightness stays, which is what separates draining
  // a colour from darkening it.
  await expectToolcraftSelectedLayerControl(
    session.observe(TREATED_FIELD),
    session.controlAction("selectedLayer.saturation", async () => {
      await setStudioSlider(page, "Saturation", 0);
    }),
    {
      controlValue: { ...LENS_DEFAULTS, saturation: 0 },
      outputSignature: "inside=#808080 outside=#ff0000",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.saturation", target: "selectedLayer.saturation" },
  );
});

test("browser: studio contrast flattens what the layer covers", async ({ page }) => {
  test.setTimeout(180_000);

  const { layerId, session } = await openStudioTreatmentLens(page);

  // Everything the layer reaches collapses to one tone; the field outside keeps
  // its own, so this is the layer's doing rather than the renderer's.
  await expectToolcraftSelectedLayerControl(
    session.observe(TREATED_FIELD),
    session.controlAction("selectedLayer.contrast", async () => {
      await setStudioSlider(page, "Contrast", 0);
    }),
    {
      controlValue: { ...LENS_DEFAULTS, contrast: 0 },
      outputSignature: "inside=#c0c0c0 outside=#ff0000",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.contrast", target: "selectedLayer.contrast" },
  );
});

test("browser: studio blend mode changes how the layer meets what it sits on", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const { layerId, session } = await openStudioTreatmentLens(page);

  // A visible mid grey this time, because a blend mode has nothing to do until
  // the layer paints. Under Normal it covers the red with grey; under Multiply
  // the same grey darkens the red instead.
  await setStudioSlider(page, "Opacity", 1);
  await setStudioColorHex(page, "First colour", "#808080");
  await setStudioColorHex(page, "Second colour", "#808080");

  await expectToolcraftSelectedLayerControl(
    session.observe(TREATED_FIELD),
    session.controlAction("selectedLayer.blendMode", async () => {
      await setStudioSelectValue(page, "selectedLayer.blendMode", "Multiply");
    }),
    {
      controlValue: { ...LENS_DEFAULTS, blend: "Multiply" },
      outputSignature: "inside=#800000 outside=#ff0000",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.blendMode", target: "selectedLayer.blendMode" },
  );
});

/**
 * Which side of the layer the wedge is heavier on.
 *
 * Flip is like mirror in that it changes a relationship rather than a quantity:
 * the band count holds, and so does the overall tone, so frequency and tone
 * would both report that nothing moved. What it changes is *direction*, and a
 * field only has a direction if something varies along it -- which is why the
 * fixture sets a taper first. On an untapered field a horizontal flip is a
 * genuine no-op and this would be asserting nothing.
 *
 * Sampled as the light fraction of the left half against the right half. A
 * tapered field is systematically lighter at one end; flipping swaps which.
 */
const FIELD_DIRECTION = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const canvas = root.querySelector(
    "[data-toolcraft-product-output]",
  ) as HTMLCanvasElement | null;
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    // The same centred span the symmetry reader uses, and for the same reason:
    // a layer is a shape, so a full-width row would spend most of its length on
    // bare ground.
    const span = Math.floor(canvas.height * 0.4);
    const pixels = new Uint8Array(span * 4);
    // Read off centre, not across the middle. The taper drifts along the band,
    // which at the default angle is the vertical axis -- and on the centre line
    // that drift is exactly zero, so a row sampled there cannot see the axis
    // flipY folds. A third of the way up is inside the shape and off the axis.
    gl.readPixels(
      Math.floor((canvas.width - span) / 2),
      Math.floor(canvas.height * 0.35),
      span,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );

    let left = 0;
    let right = 0;
    const half = Math.floor(span / 2);
    for (let index = 0; index < span; index += 1) {
      const at = index * 4;
      const light =
        pixels[at]! + pixels[at + 1]! + pixels[at + 2]! > 382 ? 1 : 0;
      if (index < half) left += light;
      else right += light;
    }

    // Two readings, because the two axes move different things and one number
    // cannot carry both. Reversing across the bands moves the field's weight
    // from one side to the other; reversing along them turns the taper around,
    // which changes how much of each band is filled and not where it sits.
    const margin = Math.max(2, Math.floor(half * 0.05));
    const lean =
      left > right + margin
        ? "left"
        : right > left + margin
          ? "right"
          : "even";
    const filled = (left + right) / span;
    const fill = filled > 0.62 ? "high" : filled < 0.38 ? "low" : "mid";
    outputSignature = `lean:${lean} fill:${fill}`;
  }

  // Both switches, because one proof exercises both axes and a reader watching
  // only one would report "nothing changed" for the other's action.
  const readToggle = (axis: string) =>
    root
      .querySelector(
        `[data-toolcraft-control-target="selectedLayer.${axis}"] [role="switch"]`,
      )
      ?.getAttribute("aria-checked") ?? "absent";

  return {
    controlValue: `x:${readToggle("flipX")} y:${readToggle("flipY")}`,
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

test("browser: studio layer flip folds only the selected layer", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const { layerId, session } = await openStudioSingleLayer(page);

  // One wide band, pushed off centre. Both are load-bearing. A flip reverses the
  // field about its own centre, so a field that is periodic across the frame
  // reverses into something statistically identical -- the bands land where
  // other bands were and a half-and-half reading cannot tell. One band with an
  // offset gives the field a side to be on, which is the thing a flip moves.
  await setStudioSlider(page, "Band count", 2);

  const beforeX = await readStudioOutputSignature(page);

  await expectToolcraftSelectedLayerControl(
    session.observe(FIELD_DIRECTION),
    session.controlAction("selectedLayer.flipX", async () => {
      await toggleStudioSwitch(page, "selectedLayer.flipX");
    }),
    {
      controlValue: "x:true y:false",
      outputSignature: "lean:left fill:mid",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.flipX", target: "selectedLayer.flipX" },
  );

  // A switch that says "flip" has to mean a fold, so folding twice returns the
  // layer. Read against the frame rather than the control, because a control
  // that returned to false while the render stayed folded is exactly the
  // failure worth catching.
  await toggleStudioSwitch(page, "selectedLayer.flipX");
  await expect
    .poll(async () => readStudioOutputSignature(page), { timeout: 15_000 })
    .toBe(beforeX);

  // The other axis. The taper is what gives a band's own length a direction, so
  // reversing that length reverses which end of the band is the wide one -- read
  // here as how much of the row is filled rather than as which side it leans to.
  await setStudioSlider(page, "Band count", 8);
  await setStudioSlider(page, "Taper", 1);

  await expectToolcraftSelectedLayerControl(
    session.observe(FIELD_DIRECTION),
    session.controlAction("selectedLayer.flipY", async () => {
      await toggleStudioSwitch(page, "selectedLayer.flipY");
    }),
    {
      controlValue: "x:false y:true",
      outputSignature: "lean:right fill:high",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.flipY", target: "selectedLayer.flipY" },
  );

  // The same switch over an asymmetric picture, which is the reading a
  // procedural field cannot give.
  //
  // A band field has no left that is distinguishable from its right except
  // statistically -- that is why the stage above needed one wide off-centre band
  // to have a side at all. A four-quadrant picture has named colours in named
  // corners, so a horizontal fold is checkable rather than inferable: what was
  // on the right has to be on the left afterwards, exactly, and if the fold ran
  // in the frame's axes rather than the picture's it would not be.
  writeImportFixture();

  // Counted from before the import, so the import's own decode is in the total
  // and the flip has to add nothing to it.
  await page.evaluate(() => {
    const scope = window as unknown as { __studioDecodes?: number };
    scope.__studioDecodes = 0;
    const decode = window.createImageBitmap.bind(window);
    window.createImageBitmap = ((...args: Parameters<typeof decode>) => {
      scope.__studioDecodes = (scope.__studioDecodes ?? 0) + 1;
      return decode(...args);
    }) as typeof window.createImageBitmap;
  });

  const readDecodes = async (): Promise<number> =>
    page.evaluate(
      () => (window as unknown as { __studioDecodes?: number }).__studioDecodes ?? 0,
    );

  const before = await readStudioLayerIds(page);
  await importStudioImage(page);
  await expect
    .poll(async () => readStudioStackSignature(page), { timeout: 15_000 })
    .toContain("image");

  const pictureLayerId =
    (await readStudioLayerIds(page)).find((id) => !before.includes(id)) ?? "";
  expect(pictureLayerId, "the import must have made a layer").toBeTruthy();
  await selectStudioLayer(page, pictureLayerId);

  await expect
    .poll(async () => readStudioImageCorners(page), { timeout: 15_000 })
    .toBe("topLeft=red topRight=blue");

  const decodesBeforeFlip = await readDecodes();
  expect(decodesBeforeFlip, "the import decodes the asset once").toBeGreaterThan(0);

  await toggleStudioSwitch(page, "selectedLayer.flipX");

  // The named colours swap sides. Not "the frame changed" -- the exact reading
  // the fold owes: the left now carries what the right carried.
  await expect
    .poll(async () => readStudioImageCorners(page), { timeout: 15_000 })
    .toBe("topLeft=blue topRight=red");

  // And nothing was decoded again to do it. A flip is a coordinate the shader
  // already reads, so re-decoding the source would be pure waste on every
  // toggle -- and the way that regression would arrive is by routing the layer
  // flip through the asset transform, which is keyed into the decode effect.
  expect(
    await readDecodes(),
    "flipping a layer must not decode the source asset again",
  ).toBe(decodesBeforeFlip);

  // Folded back, the picture returns. Same claim as the band field above, made
  // where it can be read exactly.
  await toggleStudioSwitch(page, "selectedLayer.flipX");
  await expect
    .poll(async () => readStudioImageCorners(page), { timeout: 15_000 })
    .toBe("topLeft=red topRight=blue");
});

/**
 * The same field reading as `CURSOR_FIELD`, reported against the stack-level
 * subject rather than the layer's own switch.
 *
 * A separate reader because the control being proved is a different one: the
 * transition helper requires the control's value to move, and the per-layer
 * switch does not move when the stack-level subject does. Serialised into the
 * page, so it closes over nothing.
 */


/**
 * The second ink, on its own.
 *
 * Split from the first colour's proof because the delivery catalog wants one
 * browser test per acceptance row, and the split is honest rather than
 * bookkeeping: the two controls fill different slots of the same palette, and a
 * wiring mistake that sent both to slot one would pass a proof that only ever
 * moved one of them.
 */
test("browser: studio second layer colour recolours its own slot", async ({ page }) => {
  test.setTimeout(120_000);

  await openStudioSingleLayer(page);
  const before = await readStudioCentreSignature(page);

  await setStudioColorHex(page, "Second colour", "#00FF00");

  await expect
    .poll(async () => readStudioCentreSignature(page), { timeout: 15_000 })
    .not.toBe(before);
});

/**
 * The vertical fold, on its own.
 *
 * Same reason as the second colour, and the same real risk: a horizontal flip
 * wired to both axes would satisfy a proof that only ever pressed one.
 *
 * The taper is what makes a vertical fold visible at all, and finding that out
 * cost three attempts. A band field is periodic across the frame, so reversing
 * it lands bands where other bands were and reads as identical; and a band has
 * no direction along its own length until something gives it one. The taper
 * does — it turns each band into a wedge, so folding reverses which end is wide.
 */
test("browser: studio vertical flip folds only the selected layer", async ({ page }) => {
  test.setTimeout(120_000);

  await openStudioSingleLayer(page);
  await setStudioSlider(page, "Band count", 8);
  await setStudioSlider(page, "Taper", 1);
  const before = await readStudioCentreSignature(page);

  await toggleStudioSwitch(page, "selectedLayer.flipY");

  await expect
    .poll(async () => readStudioCentreSignature(page), { timeout: 15_000 })
    .not.toBe(before);
});

/**
 * Additive mixing, which is the technique the product is partly named for.
 *
 * The spec states this scenario in its own words: a red layer over a green one
 * renders yellow where they overlap. That is not a stylistic option — *Couleur
 * Additive* is one of the eight series in the gallery, and *Transchromie* is
 * defined as overlapping translucent planes with selectable subtractive **and
 * additive** mixing. Neither could be rendered as specified until this existed.
 *
 * Read as a hue rather than an exact triple. The sum happens in linear light and
 * the frame is read back in sRGB, so the arithmetic that matters is "both
 * primaries are now present and the third is not" — an equality against a
 * hand-computed byte would be asserting the transfer function rather than the
 * blend.
 */
test("browser: studio additive blending mixes the layers beneath it", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const { fixture } = await openStudioTwoLayerStack(page);

  // Two flat fields, one red and one green, each filling its own layer. Flat
  // because a banded pair would put red beside green as often as over it, and
  // the claim is about overlap.
  for (const [layerId, hex] of [
    [fixture.stripesLayerId, "#FF0000"],
    [fixture.gradientLayerId, "#00FF00"],
  ] as const) {
    await selectStudioLayer(page, layerId);
    await setStudioColorHex(page, "First colour", hex);
    await setStudioColorHex(page, "Second colour", hex);
  }

  const readCentre = async () =>
    page.locator(STUDIO_PRODUCT_OUTPUT).evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
      if (!gl) return [0, 0, 0];
      const pixel = new Uint8Array(4);
      gl.readPixels(
        Math.floor(canvas.width / 2),
        Math.floor(canvas.height / 2),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel,
      );
      return [pixel[0], pixel[1], pixel[2]];
    });

  // Normal blending first: the top layer wins, so the centre is its green with
  // no red in it. This is the baseline the additive reading has to beat, and it
  // is what makes the assertion below a claim about blending rather than about
  // the fixture happening to be yellow already.
  await expect
    .poll(async () => (await readCentre())[0] < 60, { timeout: 15_000 })
    .toBe(true);

  await setStudioSelectValue(page, "selectedLayer.blendMode", "Additive");

  // Reported as the pixel rather than as a boolean, so a failure says what the
  // overlap actually rendered instead of only that it was not yellow.
  await expect
    .poll(async () => (await readCentre()).join(","), { timeout: 15_000 })
    .toMatch(/^(1[2-9][0-9]|2[0-5][0-9]),(1[2-9][0-9]|2[0-5][0-9]),([0-8]?[0-9])$/u);
});

/**
 * Difference blending, whose whole value is what it does when there is nothing
 * to show.
 *
 * The spec states it: overlapping regions render the absolute per-channel
 * difference, and regions where the layers agree render as black. That second
 * clause is the useful one — it turns "are both pictures present" into "how far
 * apart are they", which is why a study is compared this way rather than by
 * being faded over the work.
 *
 * Proved on identical layers, because agreement is the case the mode exists for
 * and the one a difference implementation gets wrong by drifting: two fields
 * that match must vanish, not merely darken.
 */
/**
 * Difference blending: agreement goes dark, disagreement does not.
 *
 * The spec's own words are "regions where the layers agree render as black", and
 * that clause is the whole value of the mode — it turns "are both pictures
 * present" into "how far apart are they", which is why a study is read this way
 * rather than faded over the work.
 *
 * Asserted as near-black, which took two attempts and is worth recording. A
 * single sample at the exact centre of the canvas read about a quarter of the
 * original colour rather than zero, and that looked like a compositing bug — a
 * layer at full opacity arriving at roughly three-quarters weight.
 *
 * It was the sampling. At a band boundary a layer's own coverage is one half,
 * because that is what `smoothstep` evaluates to at the seam it antialiases, so
 * the layer beneath arrives partially and the two fields genuinely differ there.
 * A perfect difference correctly returns light at a seam. The centre of the
 * canvas happened to be exactly one.
 *
 * So the reading takes the darkest pixel in a patch, which is what the
 * requirement actually says: the regions where the layers *agree* render as
 * black. The disagreement case is kept as the second half, because a mode that
 * merely dimmed everything would satisfy the first alone.
 */
test("browser: studio difference blending darkens agreement toward black", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const { fixture } = await openStudioTwoLayerStack(page);

  for (const layerId of [fixture.stripesLayerId, fixture.gradientLayerId]) {
    await selectStudioLayer(page, layerId);
    await setStudioColorHex(page, "First colour", "#3366CC");
    await setStudioColorHex(page, "Second colour", "#3366CC");
    await setStudioSlider(page, "Opacity", 1);
    // Two slots, so the ramp and the band sequence use only the two colours set
    // above. With four, the untouched third and fourth inks are still in the
    // sequence and two layers that look identical are not.
    await setStudioSlider(page, "Colour slots", 2);
  }

  /**
   * The darkest pixel in a patch, not the pixel at the exact centre.
   *
   * A single centre sample is what made this look like a compositing bug. At a
   * band boundary the layer's own coverage is one half — that is the
   * antialiasing, `smoothstep` evaluated at the seam — so the layer beneath
   * arrives partially, the two fields genuinely differ there, and a perfect
   * difference correctly returns light rather than black. The centre of the
   * canvas happened to be exactly such a seam.
   *
   * "Regions where the layers agree render as black" is a claim about the
   * regions that agree, so the reading looks for one.
   */
  const readCentre = async () =>
    page.locator(STUDIO_PRODUCT_OUTPUT).evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
      if (!gl) return 999;
      const width = Math.min(64, canvas.width);
      const height = Math.min(64, canvas.height);
      const patch = new Uint8Array(width * height * 4);
      gl.readPixels(
        Math.floor((canvas.width - width) / 2),
        Math.floor((canvas.height - height) / 2),
        width,
        height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        patch,
      );
      let darkest = 765;
      for (let index = 0; index < patch.length; index += 4) {
        darkest = Math.min(darkest, patch[index] + patch[index + 1] + patch[index + 2]);
      }
      return darkest;
    });


  await setStudioSelectValue(page, "selectedLayer.blendMode", "Difference");

  // Near-black rather than "darker than before": where the two fields agree and
  // both cover fully, an absolute difference is zero. A few units of slack for
  // the sRGB round trip, not enough to hide a mode that only dimmed.
  await expect.poll(async () => readCentre(), { timeout: 15_000 }).toBeLessThan(24);
  const agreeing = await readCentre();

  // Now make the layers disagree. Difference should give back a great deal more
  // light, because the two fields are far apart in every channel.
  await setStudioColorHex(page, "First colour", "#FFCC00");
  await setStudioColorHex(page, "Second colour", "#FFCC00");

  await expect
    .poll(async () => readCentre(), { timeout: 15_000 })
    .toBeGreaterThan(agreeing + 120);
});

/**
 * Reading an imported picture as a field, which is the thing
 * `media-stylization` is named for and did not do.
 *
 * A picture used to be a layer that got *coloured*: the engines recoloured it
 * and the treatments reached it, but nothing turned a source into the bands this
 * product is made of. These four proofs cover the reading and its three dials.
 *
 * The shared fixture imports a picture and confirms it is drawn as one first,
 * because every claim below is a claim about a change *from* that.
 */
async function openStudioReadPicture(page: Page): Promise<string> {
  writeImportFixture();
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();
  await dismissStudioOnboarding(page);
  await importStudioImage(page);

  await expect
    .poll(async () => readStudioStackSignature(page), { timeout: 15_000 })
    .toContain("image");

  const asPicture = await readStudioImageCorners(page);
  expect(asPicture, "the fixture must draw a picture before it is read").toContain(
    "red",
  );
  return asPicture;
}

test("browser: studio reads an imported picture as a band field", async ({ page }) => {
  test.setTimeout(180_000);

  const asPicture = await openStudioReadPicture(page);
  await setStudioSelectValue(page, "selectedLayer.sourceMapping", "Band width");

  // The picture is gone from the frame: what is drawn is the layer's palette
  // arranged by the picture's light, rather than the picture's own colours.
  await expect
    .poll(async () => readStudioImageCorners(page), { timeout: 15_000 })
    .not.toBe(asPicture);
});

test("browser: studio band count across a picture changes its frequency", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await openStudioReadPicture(page);
  await setStudioSelectValue(page, "selectedLayer.sourceMapping", "Band width");
  await setStudioSlider(page, "Bands across the picture", 8);
  const coarse = await readStudioCentreSignature(page);

  await setStudioSlider(page, "Bands across the picture", 120);

  await expect
    .poll(async () => readStudioCentreSignature(page), { timeout: 15_000 })
    .not.toBe(coarse);
});

test("browser: studio balance shifts the ink in a read picture", async ({ page }) => {
  test.setTimeout(180_000);

  await openStudioReadPicture(page);
  await setStudioSelectValue(page, "selectedLayer.sourceMapping", "Band width");
  await setStudioSlider(page, "Bands across the picture", 24);
  const even = await readStudioCentreSignature(page);

  // The rhythm is unchanged; what moves is how much of each band is the first
  // ink rather than the second.
  await setStudioSlider(page, "Balance", 0.85);

  await expect
    .poll(async () => readStudioCentreSignature(page), { timeout: 15_000 })
    .not.toBe(even);
});

test("browser: studio source strength decides how much picture reaches the field", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await openStudioReadPicture(page);
  await setStudioSelectValue(page, "selectedLayer.sourceMapping", "Band phase");
  await setStudioSlider(page, "Bands across the picture", 24);

  // At zero the picture has left the field entirely and what remains is a
  // perfectly regular rhythm. That is the honest bottom of this scale rather
  // than a disabled state, so it has to differ from a reading that lets the
  // picture through.
  await setStudioSlider(page, "How much the picture drives it", 0);
  const regular = await readStudioCentreSignature(page);

  await setStudioSlider(page, "How much the picture drives it", 2);

  await expect
    .poll(async () => readStudioCentreSignature(page), { timeout: 15_000 })
    .not.toBe(regular);
});
