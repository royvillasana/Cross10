import { describe, expect, it } from "vitest";

import { studioLayerUniforms } from "./studio-layers";
import {
  STUDIO_PRESETS,
  findStudioPreset,
  planStudioPresetApplication,
  planStudioTargetedApplication,
  studioPresetLayerEntry,
} from "./studio-presets";
import {
  STUDIO_APPLY_TO_CANVAS,
  STUDIO_APPLY_TO_GROUP,
  STUDIO_APPLY_TO_IMAGE,
  STUDIO_APPLY_TO_LAYER,
  STUDIO_LAYER_RECORD_TARGET,
  STUDIO_SNAPSHOT_TARGET,
  readStudioApplyTarget,
  studioApplicationLayerIds,
  type StudioLayerRecord,
  type StudioRuntimeLayer,
} from "./studio-stack-state";

/**
 * Aiming an application, and the confirmation the widest aim needs.
 *
 * The two halves are tested together because the property that matters is the
 * *difference* between them: one replaces the composition and must ask first,
 * the other restyles layers that already exist and must not. A suite that
 * proved each in isolation would pass over the case that made this worth
 * building — a destructive press and an additive one under the same label.
 */

const layer = (
  id: string,
  extra: Partial<StudioRuntimeLayer> = {},
): StudioRuntimeLayer => ({ id, name: id, visible: true, ...extra });

/** Bottom first, with a group holding two of the four. */
const STACK: readonly StudioRuntimeLayer[] = [
  layer("ground"),
  layer("pack", { kind: "group" }),
  layer("inner", { parentGroupId: "pack" }),
  layer("nested", { kind: "group", parentGroupId: "pack" }),
  layer("deep", { parentGroupId: "nested" }),
  layer("outside"),
];

describe("studioApplicationLayerIds", () => {
  it("names the selected layer alone", () => {
    expect(
      studioApplicationLayerIds({
        layers: STACK,
        selectedLayerId: "ground",
        target: STUDIO_APPLY_TO_LAYER,
      }),
    ).toEqual(["ground"]);
  });

  it("names nothing when the layer target is aimed at a group", () => {
    // A group holds no values of its own, so writing an entry onto one would
    // store a record nothing ever reads.
    expect(
      studioApplicationLayerIds({
        layers: STACK,
        selectedLayerId: "pack",
        target: STUDIO_APPLY_TO_LAYER,
      }),
    ).toEqual([]);
  });

  it("names every layer under the selected group, however deeply nested", () => {
    expect(
      studioApplicationLayerIds({
        layers: STACK,
        selectedLayerId: "pack",
        target: STUDIO_APPLY_TO_GROUP,
      }),
    ).toEqual(["inner", "deep"]);
  });

  it("never names the group itself", () => {
    const named = studioApplicationLayerIds({
      layers: STACK,
      selectedLayerId: "pack",
      target: STUDIO_APPLY_TO_GROUP,
    });
    expect(named).not.toContain("pack");
    expect(named).not.toContain("nested");
  });

  it("reads a selection inside a group as that group", () => {
    expect(
      studioApplicationLayerIds({
        layers: STACK,
        selectedLayerId: "inner",
        target: STUDIO_APPLY_TO_GROUP,
      }),
    ).toEqual(["inner", "deep"]);
  });

  it("names nothing for the group target when nothing eligible is selected", () => {
    // The whole point of the empty answer: the caller emits nothing rather than
    // falling back to a wider target, and the wider target destroys the stack.
    expect(
      studioApplicationLayerIds({
        layers: STACK,
        selectedLayerId: "outside",
        target: STUDIO_APPLY_TO_GROUP,
      }),
    ).toEqual([]);
  });

  it("names the layers carrying a picture, wherever they sit", () => {
    expect(
      studioApplicationLayerIds({
        layers: STACK,
        mediaLayerIds: ["deep", "outside"],
        selectedLayerId: "ground",
        target: STUDIO_APPLY_TO_IMAGE,
      }),
    ).toEqual(["deep", "outside"]);
  });

  it("names nothing for the image target when no layer carries a picture", () => {
    expect(
      studioApplicationLayerIds({
        layers: STACK,
        mediaLayerIds: [],
        selectedLayerId: "ground",
        target: STUDIO_APPLY_TO_IMAGE,
      }),
    ).toEqual([]);
  });

  it("falls back to the canvas for anything it does not recognise", () => {
    expect(readStudioApplyTarget("nonsense")).toBe(STUDIO_APPLY_TO_CANVAS);
    expect(readStudioApplyTarget(undefined)).toBe(STUDIO_APPLY_TO_CANVAS);
    expect(readStudioApplyTarget(STUDIO_APPLY_TO_GROUP)).toBe(STUDIO_APPLY_TO_GROUP);
  });
});

describe("planStudioTargetedApplication", () => {
  const preset = findStudioPreset("lamella-sweep");
  if (!preset) throw new Error("the library must carry lamella-sweep");

  const record: StudioLayerRecord = {
    ground: { typeId: "gradient", values: { angle: 17 } },
    outside: { typeId: "stripes", values: { count: 3 } },
  };

  it("writes one record command and no layer command at all", () => {
    const commands = planStudioTargetedApplication({
      layerIds: ["ground"],
      preset,
      record,
    });

    expect(commands).toHaveLength(1);
    expect(commands[0]?.type).toBe("controls.setValue");
    expect(commands[0]?.target).toBe(STUDIO_LAYER_RECORD_TARGET);
  });

  it("captures no snapshot, because it overwrites no stack", () => {
    const commands = planStudioTargetedApplication({
      layerIds: ["ground"],
      preset,
      record,
    });
    expect(
      commands.some((command) => command.target === STUDIO_SNAPSHOT_TARGET),
    ).toBe(false);
  });

  it("leaves every layer the target does not name exactly as it was", () => {
    const [command] = planStudioTargetedApplication({
      layerIds: ["ground"],
      preset,
      record,
    });
    const next = command?.value as StudioLayerRecord;

    expect(next.outside).toEqual(record.outside);
  });

  it("keeps each named layer's own kind rather than retyping it", () => {
    const [command] = planStudioTargetedApplication({
      layerIds: ["ground"],
      preset,
      record,
    });
    const next = command?.value as StudioLayerRecord;

    // The entry is built out of stripe layers and the target is a gradient.
    // Retyping would have replaced the layer rather than restyled it.
    expect(preset.layers[0]?.typeId).toBe("stripes");
    expect(next.ground?.typeId).toBe("gradient");
  });

  it("drops the values the named layer's kind has no uniform for", () => {
    const [command] = planStudioTargetedApplication({
      layerIds: ["ground"],
      preset,
      record,
    });
    const next = command?.value as StudioLayerRecord;
    const gradientUniforms = new Set(
      studioLayerUniforms("gradient").map((uniform) => uniform.name),
    );

    for (const name of Object.keys(next.ground?.values ?? {})) {
      expect(gradientUniforms.has(name)).toBe(true);
    }
    // `count` is a stripe reading and the entry sets it; a gradient has none.
    expect(next.ground?.values.count).toBeUndefined();
  });

  it("carries the engine across, which is what the target application is for", () => {
    const [command] = planStudioTargetedApplication({
      layerIds: ["ground"],
      preset,
      record,
    });
    const next = command?.value as StudioLayerRecord;
    const source = studioPresetLayerEntry(preset.layers[0]!);

    expect(next.ground?.values.engine).toBe(source.values.engine);
    expect(next.ground?.values.engineAmount).toBe(source.values.engineAmount);
  });

  it("lays a multi-layer entry across the target in order, repeating when it runs out", () => {
    const sheets = findStudioPreset("transchromie-sheets");
    if (!sheets) throw new Error("the library must carry transchromie-sheets");

    const [command] = planStudioTargetedApplication({
      layerIds: ["a", "b", "c", "d"],
      preset: sheets,
      record: {},
    });
    const next = command?.value as StudioLayerRecord;

    // Three sheets over four layers: the fourth takes the first sheet again.
    expect(next.a?.values.angle).toBe(next.d?.values.angle);
    expect(next.a?.values.angle).not.toBe(next.b?.values.angle);
  });

  it("emits nothing when the target names no layer", () => {
    expect(planStudioTargetedApplication({ layerIds: [], preset, record })).toEqual([]);
  });

  it("moves the controls too when the selected layer is one of the named ones", () => {
    // Without this the write lasts exactly one pass: the sync sees the controls
    // and the record disagree with the selection unchanged, reads that as an
    // edit the user made, and folds the stale controls back over the entry.
    const commands = planStudioTargetedApplication({
      layerIds: ["ground"],
      preset,
      record,
      selectedLayerId: "ground",
    });

    const projected = commands.filter((command) =>
      String(command.target).startsWith("selectedLayer."),
    );
    expect(projected.length).toBeGreaterThan(0);
    expect(commands[0]?.target).toBe(STUDIO_LAYER_RECORD_TARGET);
  });

  it("keeps the projection out of the undo stack", () => {
    // It is a consequence of the record write above it, not a second edit: one
    // press must cost one undo, and an undo that popped only the projection
    // would leave the two halves of the layer disagreeing.
    const projected = planStudioTargetedApplication({
      layerIds: ["ground"],
      preset,
      record,
      selectedLayerId: "ground",
    }).filter((command) => String(command.target).startsWith("selectedLayer."));

    for (const command of projected) expect(command.history).toBe("skip");
  });

  it("projects nothing when the selection is not one of the named layers", () => {
    // Writing the controls anyway would put the entry's values onto whichever
    // layer happened to be selected -- which is the exact failure the target
    // exists to prevent.
    const commands = planStudioTargetedApplication({
      layerIds: ["ground"],
      preset,
      record,
      selectedLayerId: "outside",
    });

    expect(
      commands.some((command) => String(command.target).startsWith("selectedLayer.")),
    ).toBe(false);
  });
});

describe("planStudioPresetApplication with a target", () => {
  const preset = STUDIO_PRESETS[0]!;

  it("touches the layer list only for the canvas target", () => {
    for (const target of [
      STUDIO_APPLY_TO_LAYER,
      STUDIO_APPLY_TO_GROUP,
      STUDIO_APPLY_TO_IMAGE,
    ] as const) {
      const commands = planStudioPresetApplication({
        layers: STACK,
        preset,
        record: {},
        selectedLayerId: "ground",
        target,
        targetLayerIds: ["ground"],
      });

      expect(
        commands.some((command) => String(command.type).startsWith("layers.")),
      ).toBe(false);
    }

    const replacement = planStudioPresetApplication({
      layers: STACK,
      preset,
      record: {},
      selectedLayerId: "ground",
      target: STUDIO_APPLY_TO_CANVAS,
    });
    expect(
      replacement.some((command) => command.type === "layers.delete"),
    ).toBe(true);
  });

  it("defaults to the canvas when no target is given", () => {
    // The old call shape has to keep meaning what it meant, or a caller that
    // was never updated would quietly stop replacing anything.
    const commands = planStudioPresetApplication({
      layers: STACK,
      preset,
      record: {},
      selectedLayerId: "ground",
    });
    expect(commands.some((command) => command.type === "layers.add")).toBe(true);
  });
});
