import { expectToolcraftSelectedLayerControl } from "./browser-layer-evidence-helpers";
import {
  openStudioSingleLayer,
  setStudioColorHex,
  setStudioLayerKind,
  setStudioSelectValue,
  setStudioSlider,
  toggleStudioSwitch,
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
    const pixels = new Uint8Array(canvas.width * 4);
    gl.readPixels(
      0,
      Math.floor(canvas.height / 2),
      canvas.width,
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
    const frequency = transitions > 40 ? "fine" : transitions > 4 ? "coarse" : "flat";
    const tone = share > 0.9 ? "light" : share < 0.1 ? "dark" : "mixed";
    outputSignature = `${frequency}:${tone}`;
  }

  return {
    controlValue: {
      angle: sliderValue("Angle"),
      bandWidth: sliderValue("Band width"),
      count: sliderValue("Band count"),
      offset: sliderValue("Offset"),
      opacity: sliderValue("Opacity"),
      separator: sliderValue("Band separator"),
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
    const pixels = new Uint8Array(canvas.width * 4);
    gl.readPixels(
      0,
      Math.floor(canvas.height / 2),
      canvas.width,
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

    const frequency = transitions > 40 ? "fine" : transitions > 4 ? "coarse" : "flat";
    outputSignature = `${frequency}:${isLight(0) ? "light" : "dark"}`;
  }

  return {
    controlValue: {
      angle: sliderValue("Angle"),
      bandWidth: sliderValue("Band width"),
      count: sliderValue("Band count"),
      offset: sliderValue("Offset"),
      opacity: sliderValue("Opacity"),
      separator: sliderValue("Band separator"),
    },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

test("browser: studio offset slides the selected layer's bands", async ({ page }) => {
  test.setTimeout(120_000);

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
      outputSignature: "fine:light",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.phase", target: "selectedLayer.phase" },
  );
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

    const left = luma(0.1);
    const middle = luma(0.5);
    const right = luma(0.9);
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
    const pixels = new Uint8Array(canvas.width * 4);
    gl.readPixels(
      0,
      Math.floor(canvas.height / 2),
      canvas.width,
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
      const left = Math.floor(canvas.width * fraction) * 4;
      const right = Math.floor(canvas.width * (1 - fraction)) * 4;
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
    const pixels = new Uint8Array(canvas.width * 4);
    gl.readPixels(
      0,
      Math.floor(canvas.height / 2),
      canvas.width,
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
    const frequency = transitions > 40 ? "fine" : transitions > 4 ? "coarse" : "flat";
    const coverage = share > 0.4 ? "half" : share < 0.2 ? "sparse" : "reduced";
    outputSignature = `${frequency}:${coverage}`;
  }

  return {
    controlValue: {
      angle: sliderValue("Angle"),
      bandWidth: sliderValue("Band width"),
      count: sliderValue("Band count"),
      offset: sliderValue("Offset"),
      opacity: sliderValue("Opacity"),
      separator: sliderValue("Band separator"),
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
