import { describe, expect, it } from "vitest";

import { STUDIO_LAYER_TYPES } from "./studio-layers";
import {
  findStudioPreset,
  planStudioPresetApplication,
  STUDIO_PRESETS,
  studioPresetLayerEntry,
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
      layerIds: ["old-1", "old-2"],
      preset,
    });

    // Every layer present goes first, so what is left is the preset and not the
    // preset composited over whatever was there.
    expect(commands.slice(0, 2)).toEqual([
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
    const writes = commands.filter((command) => command.type === "controls.setValue");
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
    const added = planStudioPresetApplication({ layerIds: [], preset }).filter(
      (command) => command.type === "layers.add",
    );

    expect(added.map((command) => command.insertIndex)).toEqual(
      preset.layers.map((_layer, index) => index),
    );
    expect(added.map((command) => (command.layer as { name: string }).name)).toEqual(
      preset.layers.map((layer) => layer.name),
    );
  });
});
