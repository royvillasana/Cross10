import { describe, expect, it } from "vitest";

import {
  appAcceptance,
  appControlSectionInventory,
  appProductReadiness,
} from "./app-acceptance-data";
import { appPerformance } from "./app-performance";
import { appSchema } from "./app-schema";
import {
  CROIX10_MAX_PALETTE_SLOTS,
  CROIX10_MIN_PALETTE_SLOTS,
  CROIX10_REFERENCE_WIDTH_PX,
  CROIX10_ENGINES,
  CROIX10_INTERFERENCE_PITCH_RATIO,
  CROIX10_MAX_PLANES,
  CROIX10_MIN_PLANES,
  CROIX10_STRIPE_COUNT,
  CROIX10_STRIPE_ENGINES,
} from "./croix10-parameters";
import { CROIX10_PRESETS, findCroix10Preset } from "./croix10-presets";
import { buildCroix10RandomizeAssignments } from "./croix10-randomize";
import { CROIX10_SCENE_RECT, CROIX10_SCENE_WIDTH_PX } from "./croix10-scene";
import {
  CROIX10_UNIFORM_NAMES,
  croix10AssembleFragmentShader,
} from "./croix10-shaders";

const sections = appSchema.panels.controls?.sections ?? [];

function control(target: string) {
  for (const section of sections) {
    for (const candidate of Object.values(section.controls)) {
      if (candidate.target === target) return candidate;
    }
  }
  throw new Error(`No schema control renders target ${target}.`);
}

function acceptanceRow(id: string) {
  const row = appAcceptance.find((entry) => entry.id === id);
  if (!row) throw new Error(`No acceptance row with id ${id}.`);
  return row;
}

describe("Croix10 product schema", () => {
  it("publishes the Croix10 product contract for AI assembly", () => {
    expect(appProductReadiness.mode).toBe("product");
    expect(appSchema.canvas.sizing?.mode).toBe("editable-output");
    // Runtime resolves render scale; product code authors only the step.
    expect(appSchema.canvas.renderScale).toMatchObject({
      enabled: true,
      max: 2,
      min: 1,
      step: 0.25,
    });
  });

  it("renders every product section declared in the control section inventory", () => {
    const sectionIds = new Set(
      sections
        .map((section) => section.id)
        .filter((id): id is string => typeof id === "string"),
    );
    const renderedTargets = new Set(
      sections.flatMap((section) =>
        Object.values(section.controls).map((candidate) => candidate.target),
      ),
    );
    for (const entry of appControlSectionInventory) {
      // Background is authored as its own section and relocated into runtime
      // Setup, so its id disappears while its targets stay rendered.
      const rendered =
        sectionIds.has(entry.id) ||
        entry.targets.every((target) => renderedTargets.has(target));
      expect(rendered).toBe(true);
    }
  });

  it("keeps every product section within the ten control budget", () => {
    for (const section of sections) {
      expect(Object.keys(section.controls).length).toBeLessThanOrEqual(10);
    }
  });

  it("gates every stripe control on a stripe engine", () => {
    // Chromosaturation is a full-field wash with no stripe structure, so a stripe
    // control declared always-applicable would promise an outcome it cannot have.
    for (const target of [
      "stripe.count",
      "stripe.widthRatio",
      "stripe.angle",
      "stripe.phase",
      "stripe.jitterAmount",
      "stripe.jitterFrequency",
      "stripe.mirror",
      "bands.separatorWidth",
    ]) {
      expect(control(target).applicability).toMatchObject({
        mode: "conditional",
      });
    }
  });

  it("declares explicit applicability on every product control", () => {
    for (const section of sections) {
      for (const candidate of Object.values(section.controls)) {
        expect(candidate.applicability).toBeDefined();
      }
    }
  });

  it("bounds band density at the Nyquist derived maximum", () => {
    const bands = control("stripe.count");
    expect(bands.max).toBe(CROIX10_STRIPE_COUNT.max);
    expect(bands.min).toBe(CROIX10_STRIPE_COUNT.min);
    expect(bands.sliderValueKind).toBe("discrete");
    // Two backing pixels per band at render scale 1 across the reference width,
    // less the jitter headroom, is where 800 comes from.
    expect(bands.max).toBeLessThanOrEqual(CROIX10_REFERENCE_WIDTH_PX / 2);
  });

  it("keeps rate and ratio sliders visually continuous", () => {
    for (const target of [
      "stripe.widthRatio",
      "stripe.angle",
      "stripe.phase",
      "stripe.jitterAmount",
      "stripe.jitterFrequency",
      "bands.separatorWidth",
      "palette.cyclingOffset",
    ]) {
      expect(control(target).sliderValueKind).toBe("continuous");
    }
  });

  it("owns palette cardinality through a collection control", () => {
    const palette = control("palette.slots");
    expect(palette.type).toBe("collectionActions");
    expect(palette.itemControl?.type).toBe("color");
    expect(palette.hardMaxItems).toBe(CROIX10_MAX_PALETTE_SLOTS);
    expect(palette.minItems).toBe(CROIX10_MIN_PALETTE_SLOTS);
  });

  it("declares the mandatory image export settings pair", () => {
    expect(control("export.image.format").defaultValue).toBe("png");
    expect(control("export.image.resolution").defaultValue).toBe("4k");
  });

  it("classifies a performance role on every visible product control", () => {
    // Runtime injects its own Setup and Export controls, which it classifies
    // itself; only product-authored sections are this product's obligation.
    const productSections = sections.filter(
      (section) => !(section.id ?? "").startsWith("runtime."),
    );
    expect(productSections.length).toBeGreaterThan(0);
    for (const section of productSections) {
      for (const candidate of Object.values(section.controls)) {
        if (candidate.type === "panelActions") continue;
        expect(candidate.performanceRole).toBeDefined();
        expect(candidate.performanceReason).toBeTruthy();
      }
    }
  });
});

describe("Croix10 renderer contract", () => {
  it("declares stripe dimensions as constant cost", () => {
    const passes = appPerformance.rendererPipeline?.passes ?? [];
    expect(passes.length).toBeGreaterThan(0);
    for (const pass of passes) {
      expect(pass.cost?.relationship).toBe("constant");
    }
  });

  it("keeps the product scene extent constant and origin anchored", () => {
    // Wider than the artboard, and wider than the reference width the density bound
    // is derived from: the world is the wall, the artboard is a window onto it.
    expect(CROIX10_SCENE_RECT.width).toBeGreaterThan(CROIX10_REFERENCE_WIDTH_PX);
    expect(CROIX10_SCENE_RECT.width).toBe(CROIX10_SCENE_WIDTH_PX);
    expect(CROIX10_SCENE_RECT.x).toBe(-CROIX10_SCENE_RECT.width / 2);
    expect(CROIX10_SCENE_RECT.y).toBe(-CROIX10_SCENE_RECT.height / 2);
    // The artboard must sit inside the world, or the finite view would frame a
    // region the provider does not claim.
    expect(CROIX10_SCENE_RECT.width).toBeGreaterThanOrEqual(
      appSchema.canvas.size.width,
    );
    expect(CROIX10_SCENE_RECT.height).toBeGreaterThanOrEqual(
      appSchema.canvas.size.height,
    );
  });

  it("declares a schema control for every engine shader uniform", () => {
    const source = croix10AssembleFragmentShader("couleur-additive");
    const declared = [...source.matchAll(/uniform\s+\w+\s+(\w+)/g)].map(
      (match) => match[1],
    );
    for (const name of declared) {
      expect(CROIX10_UNIFORM_NAMES).toContain(name);
    }
  });

  it("resolves band boundaries with screen space derivatives", () => {
    const source = croix10AssembleFragmentShader("couleur-additive");
    expect(source).toContain("fwidth(");
    expect(source).toContain("smoothstep(");
  });
});
