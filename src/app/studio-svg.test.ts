import { describe, expect, it } from "vitest";

import {
  canStudioExpressAsSvg,
  studioLayerToSvg,
  studioSvgObstacle,
} from "./studio-svg";

/**
 * Vector delivery, and mostly the refusals.
 *
 * The interesting claims here are about what this declines to draw. A generator
 * that produced *something* for a jittered field would hand an author a file
 * that looked like their work and was not, which is worse than no action at
 * all -- so the gate is the feature and the markup is the easy part.
 */
const BANDS = {
  typeId: "stripes",
  values: {
    angle: 0,
    colorA: [1, 1, 1] as const,
    colorB: [0, 0, 0] as const,
    count: 8,
    engine: 0,
    jitterAmount: 0,
    maskAspect: 1,
    maskCenterX: 0,
    maskCenterY: 0,
    maskShape: 0,
    maskSize: 0,
    mirror: 0,
    paletteSlots: 2,
    phase: 0,
    separator: 0,
    taper: 0,
    widthRatio: 0.5,
  },
};

describe("what can be delivered as vector geometry", () => {
  it("declares vector delivery only for the states that are vector geometry", () => {
    expect(canStudioExpressAsSvg(BANDS)).toBe(true);
    expect(studioSvgObstacle(BANDS)).toBeNull();

    // Every refusal names itself, because "unavailable" with no reason is the
    // most annoying possible form of a correct decision.
    const refused: [Record<string, unknown>, string][] = [
      [{ engine: 1 }, "engine"],
      [{ mirror: 1 }, "mirror"],
      [{ maskShape: 6 }, "region"],
    ];
    for (const [override, word] of refused) {
      const layer = { ...BANDS, values: { ...BANDS.values, ...override } };
      expect(canStudioExpressAsSvg(layer), JSON.stringify(override)).toBe(false);
      expect(studioSvgObstacle(layer) ?? "").toContain(word);
    }

    // A field that is not a band field at all is the first refusal, not the
    // last: a gradient is a ramp, and a ramp drawn as rectangles is a
    // quantization nobody asked for.
    expect(canStudioExpressAsSvg({ ...BANDS, typeId: "gradient" })).toBe(false);
    expect(canStudioExpressAsSvg(undefined)).toBe(false);
  });

  it("refuses to produce markup for a state it cannot express", () => {
    // The gate is enforced where the markup is made as well as where the
    // control is offered. A caller that skipped the check would otherwise get
    // a file that silently omitted the fold.
    expect(() =>
      studioLayerToSvg({
        height: 100,
        layer: { ...BANDS, values: { ...BANDS.values, mirror: 1 } },
        width: 100,
      }),
    ).toThrow(/not vector geometry/u);
  });

  it("draws jitter and taper rather than refusing them", () => {
    /**
     * These two are drawn instead of gated, and the reason is a framework
     * limit rather than generosity: applicability predicates can only read
     * discrete controls, so a gate cannot see a continuous slider at all.
     * Refusing them in the generator would mean an action that is offered and
     * then fails, which is the pattern this product keeps removing.
     *
     * Both are genuinely geometry: a jittered band is a rectangle somewhere
     * else, and a tapered one is a quadrilateral.
     */
    const jittered = studioLayerToSvg({
      height: 400,
      layer: { ...BANDS, values: { ...BANDS.values, jitterAmount: 0.4 } },
      width: 400,
    });
    const even = studioLayerToSvg({ height: 400, layer: BANDS, width: 400 });
    expect(jittered).not.toBe(even);
    // Displaced, not dissolved: still one rectangle per band.
    expect((jittered.match(/<rect /gu) ?? []).length).toBe(
      (even.match(/<rect /gu) ?? []).length,
    );

    const tapered = studioLayerToSvg({
      height: 400,
      layer: { ...BANDS, values: { ...BANDS.values, taper: 0.002 } },
      width: 400,
    });
    expect(tapered).toContain("<polygon");
    expect(tapered).not.toContain("<rect");
  });

  it("draws one rectangle per band, in the layer's own inks", () => {
    const svg = studioLayerToSvg({ height: 400, layer: BANDS, width: 400 });

    expect(svg.startsWith("<svg xmlns=")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('fill="#000000"');

    // Eight bands across the height, and enough beyond the frame that a
    // rotated field still covers its corners.
    const rects = svg.match(/<rect /gu) ?? [];
    expect(rects.length).toBeGreaterThanOrEqual(8);

    // Half of each band is inked at the default split, which is what makes the
    // markup a description of the field rather than a stripe pattern that
    // happens to look like one.
    const first = /height="([\d.]+)"/u.exec(svg.slice(svg.indexOf("<rect")));
    expect(Number(first?.[1])).toBeCloseTo((400 / 8) * 0.5, 3);
  });

  it("keeps the region clip out of the rotated group", () => {
    const turned = studioLayerToSvg({
      height: 400,
      layer: {
        ...BANDS,
        values: { ...BANDS.values, angle: 30, maskShape: 1, maskSize: 0.5 },
      },
      width: 400,
    });

    // The failure this guards is silent and wrong rather than broken: a
    // clip-path on the same element as a transform resolves in the space that
    // transform establishes, so the region would turn with the field instead of
    // confining it.
    const clipAt = turned.indexOf('clip-path="url(#region)"');
    const rotateAt = turned.indexOf("rotate(");
    expect(clipAt).toBeGreaterThan(-1);
    expect(rotateAt).toBeGreaterThan(clipAt);
    expect(turned).toContain("<ellipse");
  });
});
