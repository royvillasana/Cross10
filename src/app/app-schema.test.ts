import { describe, expect, it } from "vitest";

import {
  appAcceptance,
  validateProductAcceptanceCoverage,
} from "./app-acceptance";
import { appPerformance } from "./app-performance";
import { appSchema } from "./app-schema";
import { STUDIO_BAND_COUNT } from "./studio-layer-sections";

/**
 * This file replaces the starter assertions the scaffold ships with.
 *
 * Those asserted the neutral template: no product sections, no layers panel, an
 * upload-driven canvas. Every one of them fails by construction once a product
 * schema exists, so keeping them would mean a permanently red suite that says
 * nothing. What is worth asserting instead is the shape this product actually
 * depends on — the parts that, if they drifted, would break the layer stack
 * quietly rather than loudly.
 */
const persistenceInclude =
  appSchema.persistence.storage === "localStorage"
    ? appSchema.persistence.include
    : [];

describe("appSchema", () => {
  it("keeps the runtime Setup section first and product sections after it", () => {
    const sections = appSchema.panels.controls?.sections ?? [];

    // Background is declared by the product but does not appear here: the
    // runtime relocates it into Setup, which is where the export contract
    // requires the switch and its colour to live.
    expect(sections[0]?.title).toBe("Setup");
    // Background is declared by the product but never appears here: the runtime
    // relocates it into Setup. "Export" is the reverse — the product declares
    // the untitled delivery-actions section and the runtime titles it, which is
    // also why it carries no inventory entry of its own.
    expect(sections.map((section) => section.title)).toEqual([
      "Setup",
      "Selected Layer",
      "Image Export",
      "Export",
    ]);
  });

  it("sizes the output rather than inheriting it from uploaded media", () => {
    // A generated shader has no source image to take dimensions from, so the
    // author sets them. `intrinsic-media` would size the canvas from an upload
    // that never arrives.
    expect(appSchema.canvas.enabled).toBe(true);
    expect(appSchema.canvas.sizing).toEqual({ mode: "editable-output" });
    expect(appSchema.canvas.upload).toBe(false);
  });

  it("enables the layers panel, which the whole product is built on", () => {
    // Not cosmetic: `selectedLayer.*` targets are rejected outright when the
    // panel is disabled, so this flag is what makes the per-layer control
    // surface legal at all.
    expect(appSchema.panels.layers).toBe(true);
  });

  it("does not imply timeline behavior before a product needs it", () => {
    // Animation is a later group. Declaring the panel early would oblige
    // playback coverage in a batch that has no playback to prove.
    expect(appSchema.panels.timeline).toBeUndefined();
    expect(appSchema.assembly.capabilities).not.toContain("timeline.playback");
    expect(appSchema.assembly.capabilities).not.toContain("timeline.keyframes");
    expect(appSchema.assembly.commands).not.toContain("timeline.setCurrentTime");
    expect(appSchema.assembly.commands).not.toContain("timeline.moveKeyframe");
  });

  it("persists the per-layer record, which no control renders", () => {
    // `stack.layerRecord` is written by product code rather than by a control,
    // and an uncontrolled target is dropped on reload unless it is named here.
    // Without this the layer list would come back and every layer would be
    // wearing default values (R56).
    expect(appSchema.persistence.storage).toBe("localStorage");
    expect(persistenceInclude).toContain("canvas");
    expect(persistenceInclude).toContain("layers");
  });

  it("declares stack depth as a runtime-state workload dimension", () => {
    // Stack depth is this product's new workload dimension (task 0.13/2.8a).
    // It is sourced from runtime state rather than a schema target because the
    // runtime owns the layer list, so there is no control behind the magnitude
    // and no schema endpoint for a boundary to equal.
    const stackDepth = appPerformance.workloadEnvelope.dimensions.find(
      (dimension) => dimension.id === "stack-depth",
    );

    expect(stackDepth?.source).toEqual({ kind: "runtime-state", path: "layers" });
    expect(stackDepth?.unit).toBe("layers");
  });

  it("keeps the band count boundary equal to its schema endpoint", () => {
    // The guard that matters: a schema-backed workload boundary must equal the
    // control's own endpoint, so widening the slider without widening the
    // envelope is a failure rather than a silent understatement of the load.
    const bandCount = appPerformance.workloadEnvelope.dimensions.find(
      (dimension) => dimension.id === "band-count",
    );

    expect(bandCount?.interactiveMax).toBe(STUDIO_BAND_COUNT.max);
    expect(bandCount?.batchMax).toBe(STUDIO_BAND_COUNT.max);
    expect(bandCount?.defaultValue).toBe(STUDIO_BAND_COUNT.defaultValue);
  });

  it("keeps performance scenarios empty until the pipeline is registered", () => {
    // Scenarios are derived from pipeline paths, which task 2.8b registers.
    // Authoring them before the passes exist would invent paths.
    expect(appPerformance.scenarios).toEqual([]);
  });

  it("declares production reload coverage for the product schema", () => {
    expect(
      appAcceptance.find((entry) => entry.id === "persistence.reload"),
    ).toMatchObject({
      automated: true,
      browser: true,
      evidence: "persistence-state",
      kind: "runtime",
      persistenceCoverage: "reload",
      persistenceSlices: persistenceInclude,
      target: "canvas.size.width",
    });
  });

  it("covers every visible control with acceptance", () => {
    expect(validateProductAcceptanceCoverage()).toEqual([]);
  });
});
