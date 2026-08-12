import { expectToolcraftSelectedLayerControl } from "./browser-layer-evidence-helpers";
import {
  openStudioSingleLayer,
  openStudioTwoLayerStack,
  selectStudioLayer,
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

/**
 * The single-layer fixture with its shape released to the whole frame.
 *
 * Every proof about the *field* -- what the layer draws -- releases the layer
 * first, because a layer now arrives confined to a shape (R65) and a statistic
 * taken across the frame would otherwise be measuring the shape as much as the
 * field. Zero still means unmasked, so this is one slider rather than a
 * different fixture.
 *
 * The proofs about the shape itself keep the layer confined and use
 * `openStudioSingleLayer` directly.
 */
async function openStudioFieldLayer(
  page: Parameters<typeof openStudioSingleLayer>[0],
) {
  const fixture = await openStudioSingleLayer(page);
  await setStudioSlider(page, "Region size", 0);
  return fixture;
}

test("browser: studio layer kind switches the layer between stripes and gradient", async ({
  page,
}) => {
  // Readback proofs plus their stability windows do not fit the default
  // per-test budget when the whole suite runs on one worker.
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioFieldLayer(page);

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

  const { layerId, session } = await openStudioFieldLayer(page);

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
      jitter: sliderValue("Jitter"),
      offset: sliderValue("Offset"),
      opacity: sliderValue("Opacity"),
      separator: sliderValue("Band separator"),
      region: sliderValue("Region size"),
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
  region: 0,
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

  const { layerId, session } = await openStudioFieldLayer(page);

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

  const { layerId, session } = await openStudioFieldLayer(page);

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

  const { layerId, session } = await openStudioFieldLayer(page);

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

  const { layerId, session } = await openStudioFieldLayer(page);

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
      jitter: sliderValue("Jitter"),
      offset: sliderValue("Offset"),
      opacity: sliderValue("Opacity"),
      separator: sliderValue("Band separator"),
      region: sliderValue("Region size"),
      taper: sliderValue("Taper"),
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

  const { layerId, session } = await openStudioFieldLayer(page);

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

  const { layerId, session } = await openStudioFieldLayer(page);
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

  const { layerId, session } = await openStudioFieldLayer(page);
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
      jitter: sliderValue("Jitter"),
      offset: sliderValue("Offset"),
      opacity: sliderValue("Opacity"),
      separator: sliderValue("Band separator"),
      region: sliderValue("Region size"),
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

  const { layerId, session } = await openStudioFieldLayer(page);

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
      region: sliderValue("Region size"),
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

  const { layerId, session } = await openStudioFieldLayer(page);

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
    const share = (fraction: number) => {
      const x = Math.min(Math.floor(canvas.width * fraction), canvas.width - 1);
      const pixels = new Uint8Array(canvas.height * 4);
      gl.readPixels(x, 0, 1, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let light = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 382) light += 1;
      }
      return light / (pixels.length / 4);
    };

    const delta = Math.abs(share(0.08) - share(0.92));
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
      region: sliderValue("Region size"),
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

  const { layerId, session } = await openStudioFieldLayer(page);
  // Few bands running across the frame, so each band's length is the horizontal
  // axis and a wedge shows as a thickness difference between its two ends.
  await setStudioSlider(page, "Band count", 6);
  await setStudioSlider(page, "Angle", 90);

  await expectToolcraftSelectedLayerControl(
    session.observe(BAND_WEDGE),
    session.controlAction("selectedLayer.taper", async () => {
      await setStudioSlider(page, "Taper", 0.6);
    }),
    {
      controlValue: { ...DEFAULT_SLIDERS, angle: 90, count: 6, taper: 0.6 },
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
      region: sliderValue("Region size"),
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

test("browser: studio region confines the layer to a rectangle", async ({ page }) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);
  // Bands across the frame, so a vertical sampling strip always crosses them.
  await setStudioSlider(page, "Angle", 90);
  // Released to the whole frame first. A layer now arrives already confined
  // (R65), so the transition this control is proved by has to start from the
  // one state where it is not: zero, which still means unmasked.
  await setStudioSlider(page, "Region size", 0);

  // Unmasked the layer covers the frame, so centre and corner both carry the
  // field. Confining it leaves the corner on bare ground.
  await expectToolcraftSelectedLayerControl(
    session.observe(LAYER_REGION),
    session.controlAction("selectedLayer.maskSize", async () => {
      await setStudioSlider(page, "Region size", 0.35);
    }),
    {
      controlValue: {
        ...DEFAULT_SLIDERS,
        angle: 90,
        region: 0.35,
        regionInverted: "false",
      },
      outputSignature: "centre=field corner=ground",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.maskSize", target: "selectedLayer.maskSize" },
  );
});

test("browser: studio region sense swaps which side the layer draws on", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);
  await setStudioSlider(page, "Angle", 90);
  await setStudioSlider(page, "Region size", 0.35);

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
        region: 0.35,
        regionInverted: "true",
      },
      outputSignature: "centre=ground corner=field",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.maskInvert", target: "selectedLayer.maskInvert" },
  );
});

/**
 * Which edges of the frame the layer reaches.
 *
 * Placement is about where the region sits, so the reading asks the frame's four
 * edges whether the layer got there. Widening it reaches left and right without
 * reaching further up or down; moving it across trades one side for the other;
 * moving it down trades top for bottom. One reading names all three because each
 * changes a different pair.
 *
 * Reports only the controls this fixture touches, so an expectation stays
 * legible rather than restating every slider on the layer.
 */
const REGION_PLACEMENT = (
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
    const at = (fx: number, fy: number) => {
      const width = 16;
      const height = Math.min(Math.floor(canvas.height / 4), canvas.height);
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
      // Bands run across the frame in this fixture, so a strip always crosses
      // them where the layer draws and sees one flat colour where it does not.
      return seen.size > 1 ? "field" : "ground";
    };

    outputSignature = `L=${at(0.08, 0.5)} R=${at(0.92, 0.5)} T=${at(0.5, 0.12)} B=${at(0.5, 0.88)}`;
  }

  return {
    controlValue: {
      across: sliderValue("Region across"),
      angle: sliderValue("Angle"),
      aspect: sliderValue("Region aspect"),
      down: sliderValue("Region down"),
      region: sliderValue("Region size"),
    },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

/** A centred region, small enough to leave all four edges uncovered. */
async function openStudioPlacedRegion(page: Parameters<typeof openStudioSingleLayer>[0]) {
  const fixture = await openStudioSingleLayer(page);
  await setStudioSlider(page, "Angle", 90);
  await setStudioSlider(page, "Region size", 0.3);
  return fixture;
}

const PLACEMENT_DEFAULTS = { across: 0, angle: 90, aspect: 1, down: 0, region: 0.3 };

test("browser: studio region aspect reshapes the rectangle", async ({ page }) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioPlacedRegion(page);

  // Wider without being taller: the sides come within reach while the top and
  // bottom stay exactly as they were.
  await expectToolcraftSelectedLayerControl(
    session.observe(REGION_PLACEMENT),
    session.controlAction("selectedLayer.maskAspect", async () => {
      await setStudioSlider(page, "Region aspect", 4);
    }),
    {
      controlValue: { ...PLACEMENT_DEFAULTS, aspect: 4 },
      outputSignature: "L=field R=field T=field B=field",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.maskAspect", target: "selectedLayer.maskAspect" },
  );
});

test("browser: studio region moves across the frame", async ({ page }) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioPlacedRegion(page);

  // One side for the other: the region leaves the centre and the left edge is
  // covered while the right is not.
  await expectToolcraftSelectedLayerControl(
    session.observe(REGION_PLACEMENT),
    session.controlAction("selectedLayer.maskCenterX", async () => {
      await setStudioSlider(page, "Region across", -0.6);
    }),
    {
      controlValue: { ...PLACEMENT_DEFAULTS, across: -0.6 },
      outputSignature: "L=field R=ground T=ground B=ground",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.maskCenterX", target: "selectedLayer.maskCenterX" },
  );
});

test("browser: studio region moves down the frame", async ({ page }) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioPlacedRegion(page);

  // Top for bottom, and the sides untouched, which is what separates a vertical
  // move from a horizontal one.
  await expectToolcraftSelectedLayerControl(
    session.observe(REGION_PLACEMENT),
    session.controlAction("selectedLayer.maskCenterY", async () => {
      await setStudioSlider(page, "Region down", -0.4);
    }),
    {
      controlValue: { ...PLACEMENT_DEFAULTS, down: -0.4 },
      outputSignature: "L=ground R=ground T=field B=ground",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.maskCenterY", target: "selectedLayer.maskCenterY" },
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

    const counts = new Map<string, number>();
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] < 250) continue;
      const hex = `#${[pixels[index], pixels[index + 1], pixels[index + 2]]
        .map((channel) => channel.toString(16).padStart(2, "0"))
        .join("")}`;
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }

    const total = canvas.width;
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
  const fixture = await openStudioFieldLayer(page);
  await setStudioSlider(page, "Band count", 8);
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
      at(0.5 - 0.152, 0.5 - 0.27),
      at(0.5 + 0.152, 0.5 - 0.27),
      at(0.5 - 0.152, 0.5 + 0.27),
      at(0.5 + 0.152, 0.5 + 0.27),
    ]);
    const sides = agree([at(0.5 - 0.152, 0.5), at(0.5 + 0.152, 0.5)]);
    const caps = agree([at(0.5, 0.5 - 0.27), at(0.5, 0.5 + 0.27)]);

    outputSignature = `corners=${corners} sides=${sides} caps=${caps}`;
  }

  const sliderValue = (label: string): number => {
    const slider = root.querySelector(`input[aria-label="${label}"]`);
    return Number(slider?.getAttribute("aria-valuenow") ?? Number.NaN);
  };

  const combobox = root
    .querySelector('[data-toolcraft-control-target="selectedLayer.maskShape"]')
    ?.querySelector('[role="combobox"]');

  return {
    controlValue: {
      aspect: sliderValue("Region aspect"),
      rotation: sliderValue("Region rotation"),
      shape: (combobox?.textContent ?? "").replace(/[^A-Za-z]/gu, ""),
      size: sliderValue("Region size"),
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
  await setStudioSlider(page, "Region size", 0.3);

  // The corners go and nothing else does: the ellipse is inscribed in the
  // rectangle it replaces rather than being a smaller region of the same kind.
  await expectToolcraftSelectedLayerControl(
    session.observe(REGION_EXTENT),
    session.controlAction("selectedLayer.maskShape", async () => {
      await setStudioSelectValue(page, "selectedLayer.maskShape", "Ellipse");
    }),
    {
      controlValue: { aspect: 1, rotation: 0, shape: "Ellipse", size: 0.3 },
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
      controlValue: { shape: "Triangle", sides: "absent", size: 0.3 },
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
      `apex=${at(0.5, 0.5 + 0.27)}`,
      `base=${at(0.5, 0.5 - 0.27)}`,
      `left=${at(0.5 - 0.152, 0.5)}`,
      `right=${at(0.5 + 0.152, 0.5)}`,
    ].join(" ");
  }

  const sliderValue = (label: string): number => {
    const slider = root.querySelector(`input[aria-label="${label}"]`);
    return Number(slider?.getAttribute("aria-valuenow") ?? Number.NaN);
  };

  const combobox = root
    .querySelector('[data-toolcraft-control-target="selectedLayer.maskShape"]')
    ?.querySelector('[role="combobox"]');

  // Reported as "absent" rather than as a number when the control is not
  // rendered, so a named form's reading says out loud that it carries its own
  // side count instead of reading a stale one off a hidden slider.
  const sidesControl = root.querySelector('input[aria-label="Region sides"]');

  return {
    controlValue: {
      shape: (combobox?.textContent ?? "").replace(/[^A-Za-z]/gu, ""),
      sides: sidesControl
        ? Number(sidesControl.getAttribute("aria-valuenow"))
        : "absent",
      size: sliderValue("Region size"),
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
  await setStudioSlider(page, "Region size", 0.3);
  await setStudioSelectValue(page, "selectedLayer.maskShape", "Polygon");
  await setStudioSlider(page, "Region sides", 12);

  // Twelve sides is as close to the ellipse as this control reaches, so the
  // shape holds all four directions. Cutting it to three leaves the apex alone,
  // which is what separates a side count from a size: a smaller polygon would
  // have lost the apex with everything else.
  await expectToolcraftSelectedLayerControl(
    session.observe(POLYGON_EXTENT),
    session.controlAction("selectedLayer.maskSides", async () => {
      await setStudioSlider(page, "Region sides", 3);
    }),
    {
      controlValue: { shape: "Polygon", sides: 3, size: 0.3 },
      outputSignature: "apex=field base=ground left=ground right=ground",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.maskSides", target: "selectedLayer.maskSides" },
  );
});

test("browser: studio region rotation turns the region about its own centre", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { layerId, session } = await openStudioSingleLayer(page);
  await setStudioSlider(page, "Region size", 0.15);
  await setStudioSlider(page, "Region aspect", 4);

  // A wide region that reached its sides and not its caps reaches its caps and
  // not its sides. Trading one pair for the other is what separates a turn from
  // a resize, which would have lost both or gained both.
  await expectToolcraftSelectedLayerControl(
    session.observe(REGION_EXTENT),
    session.controlAction("selectedLayer.maskRotation", async () => {
      await setStudioSlider(page, "Region rotation", 90);
    }),
    {
      controlValue: { aspect: 4, rotation: 90, shape: "Rectangle", size: 0.15 },
      outputSignature: "corners=ground sides=ground caps=field",
      selectedLayerId: layerId,
    },
    {
      requirementId: "selectedLayer.maskRotation",
      target: "selectedLayer.maskRotation",
    },
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
    const at = (fx: number): string => {
      const width = 32;
      const height = 4;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(
        Math.round(canvas.width * fx),
        Math.round(canvas.height * 0.5),
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

    outputSignature = `inside=${at(0.5)} outside=${at(0.05)}`;
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
  // The field beneath has to cover the frame for "outside the lens" to have
  // anything in it. A layer arrives as a shape now (R65), so the one playing
  // the ground is released to the whole frame.
  await setStudioSlider(page, "Region size", 0);

  await selectStudioLayer(page, fixture.gradientLayerId);
  await setStudioSlider(page, "Opacity", 0);
  await setStudioSlider(page, "Region size", 0.3);

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
      outputSignature: "inside=#00b000 outside=#0000ff",
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
      outputSignature: "inside=#808080 outside=#0000ff",
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
      outputSignature: "inside=#c0c0c0 outside=#0000ff",
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
      outputSignature: "inside=#800000 outside=#0000ff",
      selectedLayerId: layerId,
    },
    { requirementId: "selectedLayer.blendMode", target: "selectedLayer.blendMode" },
  );
});
