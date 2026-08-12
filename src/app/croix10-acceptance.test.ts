/**
 * Croix10 acceptance declarations. Each test is named by a row's
 * `automatedTestName`, which is how a declaration and its proof stay bound.
 * Timeline declarations live in `croix10-acceptance-timeline.test.ts`.
 */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  appAcceptance,
  appControlSectionInventory,
  appProductReadiness,
  appTransferMode,
} from "./app-acceptance-data";
import { appPerformance } from "./app-performance";
import { appSchema } from "./app-schema";
import {
  CROIX10_MAX_PALETTE_SLOTS,
  CROIX10_MIN_PALETTE_SLOTS,
  CROIX10_IMMERSION_BALANCE,
  CROIX10_LOOP_DURATION_SECONDS,
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

const CROIX10_SHORTCUT_SOURCE = readFileSync(
  new URL("./croix10-shortcuts.ts", import.meta.url),
  "utf8",
);
import {
  CROIX10_SCENE_RECT,
  croix10SequencePeriodBands,
  readCroix10SceneParameters,
} from "./croix10-scene";
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

describe("Croix10 acceptance declarations", () => {
  it("declares production reload coverage for the Croix10 schema", () => {
    const row = acceptanceRow("persistence.reload");
    expect(row.persistenceCoverage).toBe("reload");
    const resolved =
      appSchema.persistence.storage === "localStorage"
        ? appSchema.persistence.include
        : [];
    expect(row.persistenceSlices).toEqual(resolved);
  });

  it("declares selected render scale backing for interaction, playback, and steady state", () => {
    expect(acceptanceRow("canvas.render-scale").renderScaleCoverage).toEqual({
      kind: "selected-backing-pixels",
      states: ["interaction", "playback", "steady"],
    });
  });

  it("declares infinity canvas mode and finite restoration coverage", () => {
    expect(acceptanceRow("canvas.infinity-mode").infinityCanvasCoverage).toBe(
      "mode-and-restoration",
    );
  });

  it("declares infinite image export crops to the product scene bounds", () => {
    expect(
      acceptanceRow("canvas.infinity-image-export").infinityCanvasCoverage,
    ).toBe("scene-bounds-image-export");
  });

  it("declares background inclusion output coverage", () => {
    expect(acceptanceRow("background.include").backgroundOutputCoverage).toEqual([
      "image-transparent-when-excluded",
      "infinity-viewport-color-and-dependency",
      "preview-hidden-when-excluded",
    ]);
  });

  it("declares background colour drives rendered output", () => {
    expect(acceptanceRow("background.color").evidence).toBe("product-output");
  });

  it("declares engine selection switches the rendered grammar", () => {
    const row = acceptanceRow("engine.active");
    expect(row.optionCoverage).toBe("each-visible-item");
    expect(control("engine.active").options?.length).toBe(6);
  });

  it("declares viewing angle sweeps the physichromie colour state", () => {
    expect(acceptanceRow("viewer.angle").target).toBe("viewer.angle");
  });

  it("declares depth scales how strongly the angle shifts colour", () => {
    expect(acceptanceRow("viewer.parallax").target).toBe("viewer.parallax");
  });

  it("declares line pair frequency changes the induced field", () => {
    expect(acceptanceRow("induction.frequency").target).toBe(
      "induction.frequency",
    );
  });

  it("declares fringe width changes the complementary edge", () => {
    expect(acceptanceRow("induction.fringe-width").target).toBe(
      "induction.fringeWidth",
    );
  });

  it("declares fringe strength changes the induced colour", () => {
    expect(acceptanceRow("induction.fringe-intensity").target).toBe(
      "induction.fringeIntensity",
    );
  });

  it("declares spread changes the immersive field transition", () => {
    expect(acceptanceRow("immersion.spread").target).toBe("immersion.spread");
  });

  it("declares balance moves the immersive field transition", () => {
    expect(acceptanceRow("immersion.balance").target).toBe("immersion.balance");
  });

  it("declares band count changes the rendered band density", () => {
    const row = acceptanceRow("stripe.count");
    expect(row.target).toBe("stripe.count");
    expect(row.interactionId).toBe("chromatic-field-properties");
  });

  it("declares width ratio narrows alternate bands", () => {
    expect(acceptanceRow("stripe.width-ratio").target).toBe("stripe.widthRatio");
  });

  it("declares angle rotates the rendered stripe field", () => {
    expect(acceptanceRow("stripe.angle").target).toBe("stripe.angle");
  });

  it("declares phase shifts the rendered sequence sideways", () => {
    expect(acceptanceRow("stripe.phase").target).toBe("stripe.phase");
  });

  it("declares wobble bends band boundaries and is exactly straight at zero", () => {
    expect(acceptanceRow("stripe.jitter-amount").target).toBe(
      "stripe.jitterAmount",
    );
  });

  it("declares wobble rate changes the boundary wobble period", () => {
    expect(acceptanceRow("stripe.jitter-frequency").target).toBe(
      "stripe.jitterFrequency",
    );
  });

  it("declares mirror reflects the field about its axis", () => {
    expect(acceptanceRow("stripe.mirror").target).toBe("stripe.mirror");
  });

  it("declares separator width changes the divider thickness", () => {
    expect(acceptanceRow("bands.separator-width").target).toBe(
      "bands.separatorWidth",
    );
  });

  it("declares the second layer switch gates its own controls", () => {
    expect(control("interference.enabled").type).toBe("switch");
    // The layer's own controls are gated by the switch that lives beside them,
    // so the harness derives both a presence and an absence case.
    for (const target of [
      "interference.pitchRatio",
      "interference.angleOffset",
      "interference.phaseOffset",
      "interference.widthRatio",
      "interference.blendMode",
    ]) {
      const applicability = control(target).applicability;
      const predicates =
        applicability?.mode === "conditional" ? applicability.all : [];
      expect(
        predicates.some(
          (predicate) => predicate.target === "interference.enabled",
        ),
      ).toBe(true);
    }
  });

  it("declares the pitch ratio sets the beat period", () => {
    const ratio = control("interference.pitchRatio");
    expect(ratio.defaultValue).toBe(CROIX10_INTERFERENCE_PITCH_RATIO.defaultValue);
    // A ratio far from one reads as two unrelated gratings, not as moiré.
    expect(ratio.max).toBeLessThanOrEqual(1.5);
    // The second layer's density is clamped to the same Nyquist derived bound as
    // the primary, so the ratio cannot alias past the schema's band maximum.
    expect(croix10AssembleFragmentShader("interference")).toContain(
      `${CROIX10_STRIPE_COUNT.max}.0`,
    );
  });

  it("declares the angle offset rotates the beat", () => {
    expect(control("interference.angleOffset").min).toBe(
      -control("interference.angleOffset").max!,
    );
  });

  it("declares the phase offset translates the beat", () => {
    expect(control("interference.phaseOffset").max).toBe(1);
  });

  it("declares layer coverage opens windows onto the layer beneath", () => {
    expect(control("interference.widthRatio").min).toBeGreaterThan(0);
  });

  it("declares every blend mode composites in linear light", () => {
    expect(
      control("interference.blendMode").options?.map((option) => option.value),
    ).toEqual(["normal", "multiply", "screen", "difference", "additive"]);
    // The single-layer variant must not contain the second layer's code at all,
    // which is what makes a disabled layer free rather than a failed branch.
    const twoLayer = croix10AssembleFragmentShader("interference");
    const oneLayer = croix10AssembleFragmentShader("couleur-additive");
    expect(twoLayer).toContain("croix10RenderInterference");
    expect(oneLayer).not.toContain("croix10RenderInterference");
    expect(twoLayer).toContain("croix10BlendLayers");
  });

  it("declares plane collection add, remove, and record coverage", () => {
    const planes = control("transchromie.planes");
    expect(planes.type).toBe("collectionActions");
    expect(planes.minItems).toBe(CROIX10_MIN_PLANES);
    expect(planes.hardMaxItems).toBe(CROIX10_MAX_PLANES);
    // A sheet without all four fields is not a sheet, so the four are one record
    // added and removed atomically rather than four parallel arrays.
    expect(Object.keys(planes.itemControls ?? {}).sort()).toEqual([
      "color",
      "offset",
      "opacity",
      "rotation",
    ]);
    // The shader's loop is bounded by the same maximum the schema enforces.
    expect(croix10AssembleFragmentShader("couleur-additive")).toContain(
      `index < ${CROIX10_MAX_PLANES}`,
    );
  });

  it("declares stacking composites planes in linear light", () => {
    expect(
      control("transchromie.blendMode").options?.map((option) => option.value),
    ).toEqual(["subtractive", "additive"]);
    // Transchromie is not a stripe engine: sheets have no band structure, so the
    // stripe sections must be absent under it rather than inert.
    expect(CROIX10_STRIPE_ENGINES).not.toContain("transchromie");
  });

  it("declares a preset for every engine series", () => {
    expect(CROIX10_PRESETS.length).toBeGreaterThanOrEqual(8);
    expect(CROIX10_PRESETS.length).toBeLessThanOrEqual(12);
    const engines = new Set(
      CROIX10_PRESETS.map((preset) => preset.values["engine.active"]),
    );
    for (const engine of Object.keys(CROIX10_ENGINES)) {
      expect(engines).toContain(engine);
    }
    // Every preset target must be a target the schema actually renders, or loading
    // it would write state nothing reads.
    for (const preset of CROIX10_PRESETS) {
      for (const target of Object.keys(preset.values)) {
        expect(() => control(target)).not.toThrow();
      }
    }
  });

  it("declares the preset load command writes schema targets", () => {
    // The preset library owns no serialization format: a preset is a map of the
    // same schema targets the panel edits, which is why undo and reset work on it.
    for (const preset of CROIX10_PRESETS) {
      expect(Object.keys(preset.values).length).toBeGreaterThan(0);
    }
    expect(findCroix10Preset(CROIX10_PRESETS[0].id)?.id).toBe(
      CROIX10_PRESETS[0].id,
    );
    expect(findCroix10Preset("not-a-preset")).toBeNull();
  });

  it("declares randomize assigns in-range values in one step", () => {
    // Sampled across the whole unit interval rather than at one seed: the floors,
    // ceilings, and step snapping all interact, and the failure mode is at the ends.
    for (const seed of [0, 0.001, 0.25, 0.5, 0.75, 0.999, 1]) {
      const assignments = buildCroix10RandomizeAssignments(
        { values: {} } as never,
        () => seed,
      );
      expect(assignments.length).toBeGreaterThan(0);
      for (const assignment of assignments) {
        const declared = control(assignment.target);
        if (declared.type !== "slider") continue;
        expect(assignment.value).toBeGreaterThanOrEqual(declared.min ?? 0);
        expect(assignment.value).toBeLessThanOrEqual(declared.max ?? 1);
      }
    }
  });

  it("declares the stripe field lock excludes its targets", () => {
    expect(control("stripe.randomizeLock").type).toBe("switch");
    expect(control("stripe.randomizeLock").defaultValue).toBe(false);
    // A locked group contributes no assignments at all, rather than being
    // assigned and then reverted.
    const locked = buildCroix10RandomizeAssignments(
      { values: { "stripe.randomizeLock": true, "engine.active": "couleurAdditive" } } as never,
      () => 0.5,
    );
    expect(locked.map((assignment) => assignment.target)).not.toContain(
      "stripe.count",
    );
    const unlocked = buildCroix10RandomizeAssignments(
      { values: { "engine.active": "couleurAdditive" } } as never,
      () => 0.5,
    );
    expect(unlocked.map((assignment) => assignment.target)).toContain(
      "stripe.count",
    );
  });

  it("declares the palette lock excludes its targets", () => {
    expect(control("palette.randomizeLock").type).toBe("switch");
    expect(control("palette.randomizeLock").defaultValue).toBe(false);
    // A locked group contributes no assignments at all, rather than being
    // assigned and then reverted.
    const locked = buildCroix10RandomizeAssignments(
      { values: { "palette.randomizeLock": true, "engine.active": "couleurAdditive" } } as never,
      () => 0.5,
    );
    expect(locked.map((assignment) => assignment.target)).not.toContain(
      "palette.slots",
    );
    const unlocked = buildCroix10RandomizeAssignments(
      { values: { "engine.active": "couleurAdditive" } } as never,
      () => 0.5,
    );
    expect(unlocked.map((assignment) => assignment.target)).toContain(
      "palette.slots",
    );
  });

  it("declares the immersive field lock excludes its targets", () => {
    expect(control("immersion.randomizeLock").type).toBe("switch");
    expect(control("immersion.randomizeLock").defaultValue).toBe(false);
    // A locked group contributes no assignments at all, rather than being
    // assigned and then reverted.
    const locked = buildCroix10RandomizeAssignments(
      { values: { "immersion.randomizeLock": true, "engine.active": "chromosaturation" } } as never,
      () => 0.5,
    );
    expect(locked.map((assignment) => assignment.target)).not.toContain(
      "immersion.spread",
    );
    const unlocked = buildCroix10RandomizeAssignments(
      { values: { "engine.active": "chromosaturation" } } as never,
      () => 0.5,
    );
    expect(unlocked.map((assignment) => assignment.target)).toContain(
      "immersion.spread",
    );
  });

  it("declares the plane lock excludes its targets", () => {
    expect(control("transchromie.randomizeLock").type).toBe("switch");
    expect(control("transchromie.randomizeLock").defaultValue).toBe(false);
    // A locked group contributes no assignments at all, rather than being
    // assigned and then reverted.
    const locked = buildCroix10RandomizeAssignments(
      { values: { "transchromie.randomizeLock": true, "engine.active": "transchromie" } } as never,
      () => 0.5,
    );
    expect(locked.map((assignment) => assignment.target)).not.toContain(
      "transchromie.planes",
    );
    const unlocked = buildCroix10RandomizeAssignments(
      { values: { "engine.active": "transchromie" } } as never,
      () => 0.5,
    );
    expect(unlocked.map((assignment) => assignment.target)).toContain(
      "transchromie.planes",
    );
  });

  it("declares the randomize shortcut and its suppression", () => {
    // The shortcut is not a second implementation: it dispatches the same
    // assignments under the same history group as the button.
    expect(CROIX10_SHORTCUT_SOURCE).toContain("buildCroix10RandomizeAssignments");
    expect(CROIX10_SHORTCUT_SOURCE).toContain('historyGroup: "croix10-randomize"');
    // Suppression is decided from the event target, so a text surface added later
    // is covered without being listed here.
    expect(CROIX10_SHORTCUT_SOURCE).toContain("isContentEditable");
    expect(CROIX10_SHORTCUT_SOURCE).toContain('role === "textbox"');
  });

  it("keeps settings transfer runtime-owned and unopposed", () => {
    // Runtime owns Export/Import Settings. The product must not opt out, and must
    // not author a competing save or load control.
    expect(appSchema.settingsTransfer.enabled).toBe(true);
    expect(appSchema.settingsTransfer.additionalValueTargets).toEqual([]);
    for (const row of appAcceptance) {
      expect(row.settingsTransferCoverage).toBeUndefined();
    }
    const forbidden = /\b(save|load|import|export settings|scene json)\b/i;
    for (const section of sections) {
      for (const [id, control] of Object.entries(section.controls)) {
        if (control.type !== "actions" && control.type !== "panelActions") continue;
        for (const action of control.actions ?? []) {
          const label = typeof action === "string" ? action : action.label;
          // "Load" is the preset command, which loads schema values rather than a
          // settings file; everything else matching the pattern would be a
          // product-authored settings transfer.
          if (id === "load") continue;
          expect(label ?? "").not.toMatch(forbidden);
        }
      }
    }
  });

  it("declares palette collection add, remove, and item coverage", () => {
    expect(acceptanceRow("palette.slots").controlPartCoverage).toEqual([
      "collectionActions.add",
      "collectionActions.items",
      "collectionActions.remove",
    ]);
  });

  it("declares cycling offset rotates band colours", () => {
    expect(acceptanceRow("palette.cycling-offset").target).toBe(
      "palette.cyclingOffset",
    );
  });

  it("declares image export format selection coverage", () => {
    expect(acceptanceRow("export.image-format").optionCoverage).toBe(
      "each-visible-item",
    );
  });

  it("declares image export resolution selection coverage", () => {
    expect(acceptanceRow("export.image-resolution").optionCoverage).toBe(
      "each-visible-item",
    );
  });

  it("declares complete image export artifact behaviour", () => {
    const row = acceptanceRow("export.image-action");
    expect(row.exportArtifactCoverage).toBe("all-required-image-export-behavior");
    expect(row.actionCoverage).toEqual(["export-image"]);
  });
});
