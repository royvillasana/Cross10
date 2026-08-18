import { describe, expect, it } from "vitest";

import { deriveToolcraftPerformancePaths } from "@/toolcraft/runtime";

import {
  appAcceptance,
  validateProductAcceptanceCoverage,
} from "./app-acceptance";
import { appPerformance } from "./app-performance";
import { appSchema } from "./app-schema";
import { STUDIO_LOOP_SECONDS } from "./studio-motion";
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
      // One section where four used to be. Choosing a technique and choosing a
      // study both moved into the onboarding flow, because they decide what the
      // canvas *is* rather than shaping work that exists. What is left is the
      // door back to that flow, the way back from a replacement, and the narrow
      // application that edits layers already on the canvas.
      "Composition",
      "Previous Stack",
      // Stays in the panel: how hard to look at a study, and how to read it
      // against the work, are both adjusted while looking at the canvas.
      "Selected Layer",
      // Split from Selected Layer: one entity above ten controls must divide
      // into explicit workflow stages, and the kind gate moves with the
      // controls it reveals because R34 scopes gating to the section.
      "Layer Pattern",
      // Directly after the kind, because choosing "Image" is asking for a
      // picture and the place to supply one should not be three sections away.
      // A file drop renders as its own surface rather than as a field, so it
      // stays its own section rather than becoming an eleventh control in a
      // section already at the cap.
      "Layer Media",
      // What form the layer takes, independent of what it draws, so it needs
      // neither the kind gate nor a place beside it. Its placement, size and
      // proportion left with 14.1 -- the canvas handles own those -- so what
      // remains is the form itself and how it is turned and read.
      "Layer Shape",
      // Every ink the layer carries, in one place. The first two used to sit
      // with the layer's placement, which made "what colours is this" a
      // question answered in two sections four apart.
      "Layer Palette",
      // How the field is coloured, as distinct from what the field is: the
      // engine carries its own gate, so it is a stage of its own rather than a
      // twelfth control in the kind's section.
      "Layer Engine",
      // Its own section because its entity is the pointer rather than the
      // selected layer: it says which layers a gesture reaches, which is a
      // claim about the stack and not a property any one layer can hold.
      // Its own section because what it edits is how a viewer passes the layer
      // rather than what the layer looks like.
      "Layer Motion",
      "Pointer",
      "Layer Treatment",
      "Image Export",
      // Directly after Image Export and directly above the sticky actions,
      // which is where `export-pipeline` requires it once video intent is
      // declared.
      "Video Export",
      "Export",
    ]);
  });

  it("sizes the output rather than inheriting it from uploaded media", () => {
    // A generated shader has no source image to take dimensions from, so the
    // author sets them. `intrinsic-media` would size the canvas from whichever
    // picture happened to arrive first.
    //
    // Upload is on since 3.1 and does not contradict that: an image is a layer
    // in the stack, not the thing the frame is measured by. The two were
    // asserted together while there was no way to import at all, which made a
    // single flag stand for two separate decisions.
    expect(appSchema.canvas.enabled).toBe(true);
    expect(appSchema.canvas.sizing).toEqual({ mode: "editable-output" });
    expect(appSchema.canvas.upload).toBe(true);
  });

  it("enables the layers panel, which the whole product is built on", () => {
    // Not cosmetic: `selectedLayer.*` targets are rejected outright when the
    // panel is disabled, so this flag is what makes the per-layer control
    // surface legal at all.
    expect(appSchema.panels.layers).toBe(true);
  });

  it("declares playback, and no more of the timeline than that", () => {
    // Video export requires a timeline, so the panel is here. Playback and not
    // keyframes, because keyframe mode obliges `timelineCoverage: "keyframes"`
    // for every keyframe-capable control -- which here is every slider and
    // colour in the panel, and is a change in its own right.
    expect(appSchema.panels.timeline).toMatchObject({
      enabled: true,
      mode: "playback",
    });
    // The loop period is a declared number with a reason, and the transport has
    // to agree with the intent that states it.
    expect(appSchema.panels.timeline).toMatchObject({
      defaultDurationSeconds: STUDIO_LOOP_SECONDS,
    });
    expect(appSchema.assembly.capabilities).not.toContain("timeline.keyframes");
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

  it("declares exactly one scenario for every derived performance path", () => {
    // Path ids are products of the pipeline declaration, never hand-authored.
    // This is the guard that a widened invalidation list -- which mints a new
    // canonical path -- cannot land without the scenario that proves it.
    const derived = deriveToolcraftPerformancePaths(appSchema, appPerformance)
      .map((path) => path.id)
      .sort();
    const declared = appPerformance.scenarios.map((scenario) => scenario.pathId).sort();

    expect(declared).toEqual(derived);
    expect(new Set(declared).size).toBe(declared.length);
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
