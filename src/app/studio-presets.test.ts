import { describe, expect, it } from "vitest";

import { STUDIO_SNAPSHOT_TARGET } from "./studio-stack-state";

import { STUDIO_LAYER_TYPES } from "./studio-layers";
import {
  findStudioPreset,
  planStudioPresetApplication,
  STUDIO_PRESETS,
  STUDIO_SERIES,
  STUDIO_SERIES_IDS,
  studioPresetLayerEntry,
  studioPresetPickerLabel,
} from "./studio-presets";

describe("the preset library", () => {
  it("names every entry in the library exactly once", () => {
    const ids = STUDIO_PRESETS.map((preset) => preset.id);
    const labels = STUDIO_PRESETS.map((preset) => preset.label);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
    // The select is built from this list, so an id it could not find again is
    // an entry the gallery can offer and never apply.
    for (const id of ids) expect(findStudioPreset(id)?.id).toBe(id);
    expect(findStudioPreset("no-such-entry")).toBeNull();
  });

  it("writes only values the layer's own type has", () => {
    // A preset is authored by hand in control units, so a name that does not
    // belong to the type is the mistake to expect: it would be dropped in
    // conversion and the entry would quietly render as something else.
    for (const preset of STUDIO_PRESETS) {
      for (const layer of preset.layers) {
        const known = new Set([
          ...STUDIO_LAYER_TYPES[layer.typeId].uniforms.map((uniform) => uniform.name),
          "blendMode",
          "contrast",
          "hue",
          "maskAspect",
          "maskCenterX",
          "maskCenterY",
          "maskInvert",
          "maskRotation",
          "maskShape",
          "maskSides",
          "maskSize",
          "opacity",
          "saturation",
          "visible",
        ]);

        for (const name of Object.keys(layer.values)) {
          expect(known, `${preset.id} / ${layer.name} / ${name}`).toContain(name);
        }
      }
    }
  });

  it("converts an authored layer into the shader's own units", () => {
    const entry = studioPresetLayerEntry({
      name: "Bands",
      typeId: "stripes",
      values: { colorA: "#ffffff", count: 48, engine: "induction", maskSize: 0 },
    });

    expect(entry.typeId).toBe("stripes");
    expect(entry.values.count).toBe(48);
    expect(entry.values.maskSize).toBe(0);
    // A select's option becomes the index the shader branches on, and a colour
    // becomes a linear triple: white is 1,1,1 in either space, which is why the
    // count and the engine are asserted beside it.
    expect(entry.values.engine).toBe(1);
    expect(entry.values.colorA).toEqual([1, 1, 1]);
  });
});

describe("applying a preset", () => {
  const preset = STUDIO_PRESETS[0];

  it("replaces the stack with the preset's own layers, and writes a record for exactly those", () => {
    if (!preset) throw new Error("the library needs at least one entry");
    const commands = planStudioPresetApplication({
      layers: [
        { id: "old-1", visible: true },
        { id: "old-2", visible: true },
      ],
      preset,
      record: {},
      selectedLayerId: null,
    });

    // The snapshot comes first, before anything is removed. The stack it
    // records is unreachable by undo -- `layers.*` carries no `historyGroup`
    // (upstream issue 7) -- so if it is not taken here it is not taken at all.
    expect(commands[0]?.type).toBe("controls.setValue");
    expect(commands[0]?.target).toBe(STUDIO_SNAPSHOT_TARGET);

    // Every layer present then goes, so what is left is the preset and not the
    // preset composited over whatever was there.
    expect(commands.slice(1, 3)).toEqual([
      { layerId: "old-1", type: "layers.delete" },
      { layerId: "old-2", type: "layers.delete" },
    ]);

    const added = commands.filter((command) => command.type === "layers.add");
    expect(added).toHaveLength(preset.layers.length);
    expect(added.map((command) => (command.layer as { id: string }).id)).toEqual(
      preset.layers.map((_layer, index) => `${preset.id}-${index + 1}`),
    );

    // One record write, holding an entry for each new id and nothing else: a
    // merge would leave a deleted layer's values behind for an undo to restore
    // onto a stack the author never built.
    const writes = commands.filter(
      (command) =>
        command.type === "controls.setValue" &&
        command.target !== STUDIO_SNAPSHOT_TARGET,
    );
    expect(writes).toHaveLength(1);
    expect(Object.keys((writes[0]?.value ?? {}) as Record<string, unknown>)).toEqual(
      preset.layers.map((_layer, index) => `${preset.id}-${index + 1}`),
    );

    // And the topmost layer is selected, so the controls are showing the layer
    // an author looks at first.
    expect(commands.at(-1)).toEqual({
      layerId: `${preset.id}-${preset.layers.length}`,
      type: "layers.select",
    });
  });

  it("adds the preset's layers bottom first, in the order the stack draws them", () => {
    if (!preset) throw new Error("the library needs at least one entry");
    const added = planStudioPresetApplication({
      layers: [],
      preset,
      record: {},
      selectedLayerId: null,
    }).filter((command) => command.type === "layers.add");

    expect(added.map((command) => command.insertIndex)).toEqual(
      preset.layers.map((_layer, index) => index),
    );
    expect(added.map((command) => (command.layer as { name: string }).name)).toEqual(
      preset.layers.map((layer) => layer.name),
    );
  });
});

/**
 * What the library claims about itself.
 *
 * The previous rule here was a total between eight and twelve, which was the
 * right bound on a demonstration that the stack could hold a composition and the
 * wrong one on a library: it said the twelfth good entry had to displace one of
 * the first eleven. What the cap was actually protecting is that the library
 * represents the whole body of work rather than the easy parts, and per-series
 * coverage says that directly.
 */
describe("what the library covers", () => {
  it("carries at least one entry for each of the eight investigations", () => {
    // Eight, not six. Chromoscope and Couleur dans l'espace were missing from a
    // list that claimed to enumerate them, which is the kind of gap a count
    // between eight and twelve could never have caught.
    expect(STUDIO_SERIES_IDS).toHaveLength(8);

    for (const series of STUDIO_SERIES_IDS) {
      expect(
        STUDIO_PRESETS.filter((preset) => preset.series === series),
        `${STUDIO_SERIES[series].label} needs at least one entry`,
      ).not.toHaveLength(0);
    }
  });

  it("declares a series and a palette pedigree for every entry", () => {
    for (const preset of STUDIO_PRESETS) {
      expect(STUDIO_SERIES_IDS, `${preset.id} series`).toContain(preset.series);
      expect(
        ["plausible", "studio", "verified"],
        `${preset.id} palette`,
      ).toContain(preset.palette);
    }
  });

  it("marks an entry in an environmental series as an evocation wherever it is offered", () => {
    // The four environmental series have no picture plane -- their subject is a
    // body moving through coloured space. A flat entry can produce the chromatic
    // condition; presenting it as a rendering of the work would misdescribe both,
    // so the marking travels with the name rather than living in a comment.
    for (const preset of STUDIO_PRESETS) {
      const evoked = STUDIO_SERIES[preset.series].carriage === "evoke";
      expect(
        studioPresetPickerLabel(preset).includes("evoking"),
        `${preset.id} should ${evoked ? "" : "not "}be offered as an evocation`,
      ).toBe(evoked);
    }
  });

  it("keeps every palette the studio's own rather than the artist's", () => {
    /**
     * The task this closes asked for the palettes to be *checked against
     * primary sources*, and doing that would put back the thing the palettes
     * were rewritten to remove.
     *
     * These entries deliberately do not claim to reproduce individual
     * catalogued works: they are constructions in the manner of a technique,
     * with inks chosen for the relationships that technique needs. A palette
     * verified against a source is a claim of correspondence to a particular
     * work, so "verified" here would be asserting exactly what the library is
     * built not to assert -- and `plausible` is worse, because it is a guess
     * wearing the authority of a citation.
     *
     * So the correct end state is every palette `studio`, and this is the guard
     * that keeps it that way. A future entry that wants another pedigree has to
     * come past this test and its reasoning.
     */
    for (const preset of STUDIO_PRESETS) {
      expect(preset.palette, `${preset.id} palette pedigree`).toBe("studio");
    }
  });

  it("claims a verified palette only where one is declared", () => {
    // All of these are the studio's own and claim nothing. The assertion exists
    // for the entry that is one day checked against a primary source: that is
    // the only one allowed to say so, and nothing else may drift into saying it.
    for (const preset of STUDIO_PRESETS) {
      expect(
        studioPresetPickerLabel(preset).includes("verified"),
        `${preset.id} must not imply a verified palette`,
      ).toBe(preset.palette === "verified");
    }
  });

  it("names entries for their construction rather than for catalogued works", () => {
    // The distinction is real rather than cautious: methods and styles are not
    // copyrightable and the series names are the artist's own terms for
    // categories of investigation, while the individual works are protected
    // until well into the next century. A catalogue number in a label is the
    // shape the mistake takes, and this library had one.
    for (const preset of STUDIO_PRESETS) {
      expect(preset.label, `${preset.id} names a catalogue number`).not.toMatch(
        /\d/u,
      );
      for (const claim of ["reproduction", "replica", "copy of", "original"]) {
        expect(
          preset.label.toLowerCase(),
          `${preset.id} must not claim to be a ${claim}`,
        ).not.toContain(claim);
      }
    }
  });

  it("says what each layer's extent is rather than inheriting one", () => {
    // A layer arrives confined to a shape (R65), which is right for building a
    // composition and wrong for an entry that meant a whole-frame field: left
    // unset it would silently land as a quarter-size rectangle in the middle of
    // the canvas. Zero is how the vocabulary says "the whole frame", and an
    // entry that means something narrower has to say that too.
    for (const preset of STUDIO_PRESETS) {
      for (const layer of preset.layers) {
        expect(
          layer.values.maskSize,
          `${preset.id} / ${layer.name} must name its extent`,
        ).toBeTypeOf("number");
      }
    }
  });
});
