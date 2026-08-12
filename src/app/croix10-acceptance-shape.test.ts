/**
 * Croix10 embedded-shape acceptance declarations. Split out to keep the other
 * declaration files inside the test-file line budget.
 */

import { describe, expect, it } from "vitest";

import { appAcceptance } from "./app-acceptance-data";
import { appSchema } from "./app-schema";

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

describe("Croix10 embedded shape acceptance declarations", () => {
  it("declares the shape is absent until an outline is chosen", () => {
    expect(acceptanceRow("shape.kind").optionCoverage).toBe("each-visible-item");
    expect(control("shape.kind").defaultValue).toBe("none");
  });

  it("declares zero strength renders identically to having no shape", () => {
    const strength = control("shape.strength");
    expect(strength.defaultValue).toBe(0);
    expect(strength.min).toBe(0);
    // The claim is about pixels: the shape emerges from the bands and leaves no
    // trace at zero. The browser proof reads the real backing buffer for the
    // identity half, because a resampled element screenshot is not byte-stable.
    expect(acceptanceRow("shape.strength").evidence).toBe("rendered-pixels");
  });

  it("declares the perturbation mode changes how bands react", () => {
    expect(control("shape.mode").options?.map((option) => option.value)).toEqual([
      "phase",
      "width",
    ]);
  });

  it("declares shape size changes the perturbed region", () => {
    expect(acceptanceRow("shape.size").target).toBe("shape.size");
  });
});
