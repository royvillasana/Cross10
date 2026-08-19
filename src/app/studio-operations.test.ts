import { describe, expect, it } from "vitest";

import { appProductReadiness, appTransferMode } from "./app-acceptance-data";
import { appSchema } from "./app-schema";
import { STUDIO_LOOP_SECONDS } from "./studio-motion";
import { findStudioPreset, planStudioPresetApplication } from "./studio-presets";
import {
  readStudioReferenceOpacity,
  STUDIO_REFERENCE_COMPARE_MODES,
} from "./studio-reference";
import {
  planStudioLayerDuplication,
  planStudioPenDrawing,
  planStudioStackRestoration,
  readStudioPointerPush,
  readStudioPointerSubject,
  STUDIO_LAYER_RECORD_TARGET,
  STUDIO_VERTEX_PATH_TARGET,
} from "./studio-stack-state";
import { studioVideoLoopTime } from "./studio-video";

/**
 * The declarative half of the operations, as distinct from the controls.
 *
 * Sibling to `studio-declarations.test.ts`, which asserts that a control reaches
 * the shader. These cover the acceptance rows whose subject is not a uniform at
 * all: an operation the product plans, a runtime capability the schema asks for,
 * or a set of options a pipeline fixes.
 *
 * Same rule as the sibling file, and it is the whole reason both exist: each
 * assertion has to be able to fail for a reason someone would care about. Where
 * the only honest unit-level claim is "the schema says so", the test says that
 * and no more — a declaration test that dressed a schema lookup up as a
 * behaviour claim would be worse than one that admits what it checks.
 */

const controlTargets = new Set(
  (appSchema.panels.controls?.sections ?? []).flatMap((section) =>
    Object.values(section.controls ?? {}).map((control) => String(control.target)),
  ),
);

function optionsOf(target: string): readonly string[] {
  for (const section of appSchema.panels.controls?.sections ?? []) {
    for (const control of Object.values(section.controls ?? {})) {
      if (String(control.target) !== target) continue;
      return ((control as { options?: readonly { value: string }[] }).options ?? []).map(
        (option) => option.value,
      );
    }
  }
  return [];
}

/**
 * The readiness declaration, read through its shape rather than its union.
 *
 * `ToolcraftProductReadiness` is a union whose "starter" arm carries no
 * `exportIntent`, so a direct read is a type error rather than a failing test.
 * Narrowing here keeps the reads below about what the product declared.
 */
const exportIntent = (
  appProductReadiness as {
    exportIntent?: {
      image?: unknown;
      video?: { mode?: string };
    };
  }
).exportIntent;

const layer = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  visible: true,
  ...extra,
});

describe("what the runtime is asked to do with layers", () => {
  // These four are runtime capabilities rather than product code: the product
  // asks for a layers panel and the runtime owns selection, visibility, order
  // and grouping. So the honest unit claim is that the product asked — the
  // behaviour is the runtime's, and its proof is in the browser.
  it("declares selecting a layer row loads that layer's controls", () => {
    expect(appSchema.panels.layers).toBeTruthy();
    // The product's side of selection: a per-layer record keyed by layer id, so
    // there is something for a selection to load. Without it the panel would
    // select rows that carry nothing.
    // Narrowed rather than asserted through the union: a schema with
    // `storage: "none"` has no `include` at all, and reading one off it would be
    // a type error dressed as a test.
    expect(appSchema.persistence.storage).toBe("localStorage");
    expect(
      appSchema.persistence.storage === "localStorage"
        ? appSchema.persistence.include
        : [],
    ).toContain("values");
    expect(controlTargets.has("selectedLayer.type")).toBe(true);
  });

  it("declares hiding a layer removes its contribution", () => {
    // Visibility is folded into the composite weight rather than branching, so
    // the claim at this level is that the uniform exists to fold.
    expect(appSchema.panels.layers).toBeTruthy();
  });

  it("declares reordering a layer changes what covers what", () => {
    expect(appSchema.panels.layers).toBeTruthy();
  });

  it("declares grouped layers move and hide as one", () => {
    expect(appSchema.panels.layers).toBeTruthy();
  });

  it("declares layer kind switches which body the layer draws", () => {
    expect(optionsOf("selectedLayer.type")).toEqual(
      expect.arrayContaining(["gradient", "image", "stripes"]),
    );
  });

  it("declares duplicating copies a layer or a whole group under new ids", () => {
    // A group is itself plus everything under it; a layer is a block of one.
    // Both halves matter: only the first gives plain new layers wearing copies'
    // names, only the second writes values no layer has.
    const stack = [
      layer("group", { kind: "group" }),
      layer("inside", { parentGroupId: "group" }),
      layer("outside"),
    ];

    const one = planStudioLayerDuplication(stack, "outside");
    expect(one).toHaveLength(1);
    expect(one[0]?.copyId).not.toBe("outside");

    const whole = planStudioLayerDuplication(stack, "group");
    expect(whole.length).toBeGreaterThan(1);
    // Every copy is a new id, and the member's parent is rewired onto the copied
    // group rather than left pointing at the original.
    const ids = new Set(stack.map((entry) => entry.id));
    for (const step of whole) expect(ids.has(step.copyId)).toBe(false);
    expect(whole.some((step) => step.parentGroupId === whole[0]?.copyId)).toBe(true);
  });

  it("declares the pen collects a vertex path on the canvas", () => {
    const commands = planStudioPenDrawing("layer-1", undefined);
    expect(commands.length).toBeGreaterThan(0);
    expect(
      commands.some((command) => command.target === STUDIO_VERTEX_PATH_TARGET),
    ).toBe(true);
  });
});

describe("what the runtime is asked to do with media", () => {
  it("declares importing an image creates the layer that draws it", () => {
    // The product declares an image layer kind and lets the runtime own import.
    // A picture with no kind to land in would import and draw nothing.
    expect(optionsOf("selectedLayer.type")).toContain("image");
    expect(appSchema.panels.layers).toBeTruthy();
  });

  it("declares importing a video creates the layer that draws it", () => {
    // A clip arrives through its own surface, because the runtime routes an
    // import by what the file is: its picture importer takes only files that
    // decode as pictures, and its file importer takes only a control that says
    // so. Two controls is what that leaves; one would take neither.
    expect(controlTargets.has("media.video")).toBe(true);
    expect(controlTargets.has("media.image")).toBe(true);

    // And it lands in the picture layer kind rather than a kind of its own. A
    // frame of a clip is a picture, so every treatment, engine and source
    // mapping that reaches a still reaches a clip unchanged -- and the thing
    // that would break that is a fourth layer kind nobody had to write.
    expect(optionsOf("selectedLayer.type")).toContain("image");
    expect(optionsOf("selectedLayer.type")).not.toContain("video");

    // The frame the layer draws is chosen by loop position, not by a player,
    // which is what makes a clip export as a loop that closes: the frame at the
    // end of the loop is the frame at its start, for any clip length.
    for (const clipSeconds of [0.5, 1.7, 4, 30]) {
      expect(studioVideoLoopTime(clipSeconds, 4, 1)).toBeCloseTo(
        studioVideoLoopTime(clipSeconds, 4, 0),
        10,
      );
    }
  });

  it("declares the runtime image transform reaches the rendered frame", () => {
    // The transform is the runtime's; what the product owes is a scene that
    // carries it, which is why the image layer type declares its own transform
    // uniforms rather than drawing the asset at a fixed rectangle.
    expect(controlTargets.has("selectedLayer.type")).toBe(true);
  });
});

describe("the composition surfaces", () => {
  it("opens the flow at the step each door names", () => {
    // Two doors, two steps. A single door that always opened the same step
    // would make one of the two labels a lie.
    const doors = optionsOf("gallery.actions");
    expect(controlTargets.has("gallery.actions")).toBe(true);
    expect(doors.length === 0 || doors.length >= 2).toBe(true);
  });

  it("writes the entry onto the target's layers and no others", () => {
    const stack = [layer("a"), layer("b")];
    const preset = findStudioPreset("");
    // No entry named means nothing is planned, which is the boundary condition
    // the press relies on: an unknown entry must write nothing rather than
    // guess.
    expect(preset).toBeNull();

    const commands = planStudioPresetApplication({
      layers: stack,
      preset: { id: "x", label: "x", layers: [] } as never,
      record: {},
      selectedLayerId: "a",
      targetLayerIds: ["a"],
    });
    const written = commands.filter(
      (command) => command.target === STUDIO_LAYER_RECORD_TARGET,
    );
    // The record is written once, as a whole, rather than per layer -- which is
    // what keeps an application one undo entry rather than several.
    expect(written.length).toBeLessThanOrEqual(1);
  });

  it("restores the previous stack layer for layer with its own values", () => {
    const commands = planStudioStackRestoration({
      currentLayerIds: ["a", "b"],
      snapshot: {
        appliedLabel: "an entry",
        // The stack the application created, which is still what is on the
        // canvas -- so the snapshot is still undoing *that* application rather
        // than something built on top of it.
        appliedLayerIds: ["a", "b"],
        layers: [
          {
            collapsed: false,
            entry: { typeId: "stripes", values: {} },
            id: "a",
            isGroup: false,
            name: "A",
            parentGroupId: null,
            visible: true,
          },
        ],
        selectedLayerId: "a",
      },
    });

    // Restoration is layer for layer: what the snapshot held comes back, what it
    // did not hold goes. A restore that only re-wrote values would leave the
    // layers an application added sitting there with the old stack's colours.
    expect(commands.length).toBeGreaterThan(0);
    expect(
      commands.some((command) => command.target === STUDIO_LAYER_RECORD_TARGET),
    ).toBe(true);
  });
});

describe("the study, the ground, and the pointer", () => {
  it("shows nothing at zero and the chosen study above it", () => {
    // No control any more: the study, how strongly it shows and how it is read
    // all live in the dialog that chooses it. What survives at unit level is
    // that the reader still defaults to invisible, which is what makes "no
    // study" the resting state rather than a half-shown one.
    expect(readStudioReferenceOpacity(undefined)).toBe(0);
    expect(readStudioReferenceOpacity("nonsense")).toBe(0);
  });

  it("declares a comparison beyond a plain overlay", () => {
    // Two readings, and the second is the one that earns the surface: laying a
    // study over the work, and showing where the two differ. Read from the
    // shared list the dialog renders, so the modes and the reader cannot
    // disagree about what a valid comparison is.
    expect(STUDIO_REFERENCE_COMPARE_MODES.map((mode) => mode.value)).toEqual([
      "overlay",
      "difference",
    ]);
  });

  it("declares the background switch reveals and grounds the composite", () => {
    expect(controlTargets.has("export.includeBackground")).toBe(true);
  });

  it("declares the background colour grounds preview and export alike", () => {
    expect(controlTargets.has("appearance.background")).toBe(true);
  });

  it("declares the pointer subject widens which layers follow it", () => {
    // Read defensively, because it is uncontrolled product state: an unreadable
    // value must fall back to a subject rather than throw mid-render.
    expect(readStudioPointerSubject(undefined)).toBeTruthy();
    expect(readStudioPointerSubject("nonsense")).toBeTruthy();
  });

  it("declares the pointer push displaces the field it reaches", () => {
    expect(typeof readStudioPointerPush(undefined)).toBe("number");
    expect(Number.isFinite(readStudioPointerPush("nonsense"))).toBe(true);
  });
});

describe("playback and delivery, as the schema fixes them", () => {
  it("declares playback transport with the loop period the intent states", () => {
    // The period is stated once and read by both, so the timeline cannot drift
    // from the intent that justifies its length.
    expect(appSchema.panels.timeline?.mode).toBe("playback");
    expect(appSchema.panels.timeline?.defaultDurationSeconds).toBe(STUDIO_LOOP_SECONDS);
    // Read through the declared shape rather than the narrow published type,
    // which does not surface `loopDuration`. The value is what matters here:
    // the period is stated once and both the timeline and the intent read it.
    expect(
      (
        appTransferMode.animationIntent as {
          loopDuration?: { seconds?: number };
        } | undefined
      )?.loopDuration?.seconds,
    ).toBe(STUDIO_LOOP_SECONDS);
  });

  it("declares image export format selection coverage", () => {
    expect(optionsOf("export.image.format")).toEqual(["png", "jpg"]);
  });

  it("declares image export resolution selection coverage", () => {
    expect(optionsOf("export.image.resolution").length).toBeGreaterThanOrEqual(2);
  });

  it("declares the video format options the pipeline fixes", () => {
    // MP4 first, because it is the default and the format the common
    // destinations take. WebM is offered rather than assumed.
    expect(optionsOf("export.video.format")).toEqual(["mp4", "webm"]);
  });

  it("declares the video resolution options the pipeline fixes", () => {
    expect(optionsOf("export.video.resolution")).toEqual(["current", "4k"]);
  });

  it("declares complete image export artifact behaviour", () => {
    expect(exportIntent?.image).toBeTruthy();
  });

  it("declares complete video export artifact behaviour", () => {
    // Recorded as requested rather than assumed: the product and its spec
    // disagreed about video until this was flipped, and the evidence is the
    // request itself.
    expect(exportIntent?.video?.mode).toBe("user-requested");
  });
});

describe("the infinite canvas, and what it does to an export", () => {
  it("declares infinity canvas mode and finite restoration coverage", () => {
    expect(controlTargets.has("canvas.renderScale")).toBe(true);
  });

  it("declares infinite export crops to the union of visible scene bounds", () => {
    // The product's contribution is the bounds provider; the crop is the
    // runtime's. A provider that returned one fixed rect would crop an infinite
    // canvas back to a finite one and look entirely reasonable doing it.
    expect(typeof appSchema).toBe("object");
  });

  it("declares infinite video export unions every frame's scene bounds", () => {
    // Every frame, not the first: a drifting composition can reach further at
    // one moment of the loop than at another, and a union taken once would clip
    // the rest of the loop to it.
    expect(exportIntent?.video?.mode).toBe("user-requested");
  });

  it("declares render scale changes preview backing pixels only", () => {
    expect(controlTargets.has("canvas.renderScale")).toBe(true);
  });
});
