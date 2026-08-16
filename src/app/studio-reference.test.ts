import { describe, expect, it } from "vitest";

import { appProductReadiness } from "./app-acceptance-data";
import { buildStudioSceneParameters } from "./studio-scene";
import { studioAssembleDeliverableSource } from "./studio-source";
import {
  readStudioReferenceView,
  STUDIO_REFERENCE_COMPARE_TARGET,
  STUDIO_REFERENCE_DIFFERENCE,
  STUDIO_REFERENCE_ENTRY_TARGET,
  STUDIO_REFERENCE_ITEMS,
  STUDIO_REFERENCE_OPACITY_TARGET,
  STUDIO_REFERENCE_OVERLAY,
} from "./studio-reference";
import { STUDIO_PRESETS } from "./studio-presets";
import { STUDIO_LAYER_RECORD_TARGET } from "./studio-stack-state";

const STACK = {
  layers: [{ id: "only", visible: true }],
  values: {
    [STUDIO_LAYER_RECORD_TARGET]: {
      only: { typeId: "stripes" as const, values: { angle: 30, count: 12 } },
    },
  },
};

/** The same composition with a reference showing at full strength. */
const WITH_REFERENCE = {
  layers: STACK.layers,
  values: {
    ...STACK.values,
    [STUDIO_REFERENCE_COMPARE_TARGET]: STUDIO_REFERENCE_DIFFERENCE,
    [STUDIO_REFERENCE_ENTRY_TARGET]: STUDIO_PRESETS[0]?.id ?? "",
    [STUDIO_REFERENCE_OPACITY_TARGET]: 1,
  },
};

describe("what the reference shows", () => {
  it("offers every built-in render, each with a picture", () => {
    expect(STUDIO_REFERENCE_ITEMS).toHaveLength(STUDIO_PRESETS.length);
    for (const item of STUDIO_REFERENCE_ITEMS) {
      expect(item.src, `${item.value} needs a render to show`).toContain("data:image/");
    }
  });

  it("shows nothing at zero, rather than something transparent", () => {
    // An element that is present but invisible is the shape a leak takes: it
    // survives a screenshot, a compositing change, and any future path that
    // walks the tree for what the product drew. Empty is the one condition the
    // overlay reads, so there is nothing to render when there is nothing to see.
    expect(readStudioReferenceView(WITH_REFERENCE.values).src).not.toBe("");
    expect(
      readStudioReferenceView({
        ...WITH_REFERENCE.values,
        [STUDIO_REFERENCE_OPACITY_TARGET]: 0,
      }).src,
    ).toBe("");
  });

  it("falls back to the first study when none has been chosen", () => {
    // The choice lives in a dialog now, so the value starts undefined rather
    // than at a control's default. Without the fallback the strength slider in
    // the panel moves with nothing to show, which reads as a broken slider
    // rather than as an unmade choice.
    expect(
      readStudioReferenceView({
        [STUDIO_REFERENCE_ENTRY_TARGET]: "no-such-entry",
        [STUDIO_REFERENCE_OPACITY_TARGET]: 1,
      }).src,
    ).toBe(STUDIO_REFERENCE_ITEMS[0]?.src);
    expect(
      readStudioReferenceView({ [STUDIO_REFERENCE_OPACITY_TARGET]: 1 }).src,
    ).toBe(STUDIO_REFERENCE_ITEMS[0]?.src);
  });

  it("falls back to laying it over for anything it does not recognise", () => {
    expect(readStudioReferenceView({}).compare).toBe(STUDIO_REFERENCE_OVERLAY);
    expect(
      readStudioReferenceView({ [STUDIO_REFERENCE_COMPARE_TARGET]: "nonsense" }).compare,
    ).toBe(STUDIO_REFERENCE_OVERLAY);
  });

  it("clamps the strength into the range the control offers", () => {
    for (const [given, expected] of [
      [-1, 0],
      [2, 1],
      ["loud", 0],
    ] as const) {
      expect(
        readStudioReferenceView({ [STUDIO_REFERENCE_OPACITY_TARGET]: given }).opacity,
      ).toBe(expected);
    }
  });
});

/**
 * The claim that makes the reference safe to have at all.
 *
 * Written as identity against the no-reference case rather than as "the export
 * looks right", because the failure being guarded is a leak rather than a
 * defect: an artifact that carried the reference would look perfectly fine and
 * be the wrong thing to publish.
 *
 * The structural half is stronger than the pixel half and worth stating first:
 * the scene the renderer draws has *no field* for a reference, so the export
 * path and the source assembler do not receive one and skip it — they cannot
 * receive one. That is a property of the types rather than a promise about a
 * code path somebody has to keep true forever.
 */
describe("the reference reaches no artifact", () => {
  it("is absent from the scene the renderer draws", () => {
    const withReference = buildStudioSceneParameters(WITH_REFERENCE, true);
    const without = buildStudioSceneParameters(STACK, true);

    expect(withReference).toEqual(without);
  });

  it("names no reference field in the scene at all", () => {
    // The stronger form: not "the values match" but "there is nowhere for it to
    // go". A field that existed and happened to be empty would be one refactor
    // from being populated.
    const scene = buildStudioSceneParameters(WITH_REFERENCE, true) as Record<
      string,
      unknown
    >;

    for (const key of Object.keys(scene)) {
      expect(key.toLowerCase(), "the scene must carry no reference").not.toContain(
        "reference",
      );
    }
  });

  it("leaves the delivered source byte-identical", () => {
    expect(
      studioAssembleDeliverableSource(buildStudioSceneParameters(WITH_REFERENCE, true)),
    ).toBe(
      studioAssembleDeliverableSource(buildStudioSceneParameters(STACK, true)),
    );
  });

  it("declares no sampler or uniform belonging to the reference", () => {
    const source = studioAssembleDeliverableSource(
      buildStudioSceneParameters(WITH_REFERENCE, true),
    );

    // Not a search for the word: the shipped chunks use "the reference works"
    // to mean the prior art, which is unrelated and would make this assertion
    // fail for being right about the wrong thing. What a leak would look like
    // is a *declaration* -- a sampler the stack never asked for, or a uniform
    // named after the reference.
    expect(source).not.toMatch(/\buReference/u);
    expect(
      source.match(/sampler2D/gu) ?? [],
      "a stack of one band field needs no sampler at all",
    ).toHaveLength(0);
    // The reference is a data URI, and the one way it could reach the source is
    // by being written into it whole.
    expect(source).not.toContain("data:image/");
  });

  it("carries no image data in anything settings transfer could round-trip", () => {
    // Settings transfer moves control values by target. The reference's three
    // targets hold an id, a number, and a mode -- the picture itself is a
    // built-in the product already ships, so there is no image data in state
    // for an exported settings file to carry.
    for (const value of Object.values(WITH_REFERENCE.values)) {
      expect(JSON.stringify(value) ?? "").not.toContain("data:image/");
    }
  });

  it("cannot leak into a video either, for the same structural reason", () => {
    // This assertion used to say "there is no video path", and it was written to
    // fail the day one appeared rather than quietly keep describing a product
    // that no longer existed. It did exactly that, so here is the real claim.
    //
    // A video is the same scene drawn at a series of times, and the scene has no
    // field for a reference at any of them. The pixel-level proof lives in the
    // browser suite, where a real artifact is decoded; what is asserted here is
    // the property that makes it true.
    expect(
      appProductReadiness.mode === "product"
        ? appProductReadiness.exportIntent.video.mode
        : "",
    ).toBe("user-requested");

    for (const timeSeconds of [0, 1.5, 3, 5.999]) {
      const scene = buildStudioSceneParameters(
        { ...WITH_REFERENCE, values: { ...WITH_REFERENCE.values } },
        true,
      ) as Record<string, unknown>;
      expect(
        Object.keys(scene).some((key) => key.toLowerCase().includes("reference")),
        `no reference field at ${timeSeconds}s`,
      ).toBe(false);
    }
  });
});
