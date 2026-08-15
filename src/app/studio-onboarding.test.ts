import { describe, expect, it } from "vitest";

import {
  findStudioOutputShape,
  planStudioOnboardingChoice,
  planStudioOnboardingConfirmation,
  planStudioOnboardingDismissal,
  readStudioOnboardingStep,
  shouldStudioOnboardingOpen,
  STUDIO_ONBOARDING_BLANK,
  STUDIO_ONBOARDING_CARDS,
  STUDIO_ONBOARDING_CHOOSING,
  STUDIO_ONBOARDING_CLOSED,
  STUDIO_ONBOARDING_SETTLED_TARGET,
  STUDIO_ONBOARDING_SIZING,
  STUDIO_ONBOARDING_TARGET,
  STUDIO_OUTPUT_SHAPES,
} from "./studio-onboarding";
import { STUDIO_PRESETS } from "./studio-presets";

describe("what the flow offers", () => {
  it("offers every entry plus starting from nothing", () => {
    expect(STUDIO_ONBOARDING_CARDS).toHaveLength(STUDIO_PRESETS.length + 1);
    expect(STUDIO_ONBOARDING_CARDS[0]?.value).toBe(STUDIO_ONBOARDING_BLANK);
    for (const card of STUDIO_ONBOARDING_CARDS.slice(1)) {
      expect(card.src, `${card.value} needs a picture`).toContain("data:image/");
    }
  });

  it("names output shapes for the shape rather than for a platform", () => {
    // The dimensions are facts about a picture. A product that brands them takes
    // on a claim it cannot keep the day the platform changes its numbers.
    for (const shape of STUDIO_OUTPUT_SHAPES) {
      expect(shape.label.toLowerCase()).not.toMatch(
        /instagram|tiktok|facebook|twitter|youtube/u,
      );
    }
    // 4:5 has no runtime aspect preset, which is why these are real dimensions.
    expect(findStudioOutputShape("portrait")).toMatchObject({
      height: 1350,
      width: 1080,
    });
  });

  it("falls back to closed for anything it does not recognise", () => {
    expect(readStudioOnboardingStep(undefined)).toBe(STUDIO_ONBOARDING_CLOSED);
    expect(readStudioOnboardingStep("nonsense")).toBe(STUDIO_ONBOARDING_CLOSED);
    expect(readStudioOnboardingStep(STUDIO_ONBOARDING_SIZING)).toBe(
      STUDIO_ONBOARDING_SIZING,
    );
  });
});

describe("when the flow opens on its own", () => {
  it("opens for someone who has not started", () => {
    expect(
      shouldStudioOnboardingOpen({
        layerCount: 0,
        settled: false,
        step: STUDIO_ONBOARDING_CLOSED,
      }),
    ).toBe(true);
  });

  it("leaves a returning author on their composition", () => {
    expect(
      shouldStudioOnboardingOpen({
        layerCount: 3,
        settled: false,
        step: STUDIO_ONBOARDING_CLOSED,
      }),
    ).toBe(false);
  });

  it("never reopens on the empty canvas it just made", () => {
    // The first thing the browser proofs caught: "start from nothing" finishes
    // the flow and leaves nothing, so a rule keyed on the layer count alone
    // reopened the flow forever on the canvas it had just created.
    expect(
      shouldStudioOnboardingOpen({
        layerCount: 0,
        settled: true,
        step: STUDIO_ONBOARDING_CLOSED,
      }),
    ).toBe(false);
  });

  it("does not reopen over a step that is already showing", () => {
    expect(
      shouldStudioOnboardingOpen({
        layerCount: 0,
        settled: false,
        step: STUDIO_ONBOARDING_SIZING,
      }),
    ).toBe(false);
  });
});

describe("what each step writes", () => {
  const base = {
    background: "#000000",
    layers: [],
    record: {},
    selectedLayerId: null,
  } as const;

  it("records a choice and moves on without applying it", () => {
    const commands = planStudioOnboardingChoice("additive-bands");

    expect(commands).toHaveLength(2);
    expect(
      commands.some((command) => String(command.type).startsWith("layers.")),
      "choosing must build nothing",
    ).toBe(false);
    expect(
      commands.find((command) => command.target === STUDIO_ONBOARDING_TARGET)?.value,
    ).toBe(STUDIO_ONBOARDING_SIZING);
  });

  it("leaves nothing behind when the flow is abandoned", () => {
    // Indistinguishable from never having started: no canvas, no layer, no value
    // beyond the flow's own state. A half-configured canvas is a state nobody
    // chose, which is worse than the one they were in.
    for (const command of planStudioOnboardingDismissal()) {
      expect(
        command.target === STUDIO_ONBOARDING_TARGET ||
          command.target === STUDIO_ONBOARDING_SETTLED_TARGET,
      ).toBe(true);
    }
  });

  it("sizes the canvas before it applies the entry", () => {
    // Applied the other way round, the composition would be built against the
    // old dimensions and then reflowed by the step meant to precede it.
    const commands = planStudioOnboardingConfirmation({
      ...base,
      choice: STUDIO_PRESETS[0]?.id ?? "",
      shape: findStudioOutputShape("portrait"),
    });

    const size = commands.findIndex((command) => command.type === "canvas.setSize");
    const build = commands.findIndex((command) => command.type === "layers.add");
    expect(size).toBeGreaterThanOrEqual(0);
    expect(build).toBeGreaterThan(size);
  });

  it("sets the runtime's own canvas size rather than keeping one", () => {
    const size = planStudioOnboardingConfirmation({
      ...base,
      choice: STUDIO_ONBOARDING_BLANK,
      shape: findStudioOutputShape("vertical"),
    }).find((command) => command.type === "canvas.setSize");

    expect(size?.size).toEqual({ height: 1920, width: 1080 });
  });

  it("builds nothing for a blank start", () => {
    const commands = planStudioOnboardingConfirmation({
      ...base,
      choice: STUDIO_ONBOARDING_BLANK,
      shape: findStudioOutputShape("square"),
    });

    expect(commands.some((command) => String(command.type).startsWith("layers."))).toBe(
      false,
    );
  });

  it("settles the flow so it stops offering itself", () => {
    const settled = planStudioOnboardingConfirmation({
      ...base,
      choice: STUDIO_ONBOARDING_BLANK,
      shape: findStudioOutputShape("square"),
    }).find((command) => command.target === STUDIO_ONBOARDING_SETTLED_TARGET);

    expect(settled?.value).toBe(true);
  });

  it("keeps the flow's own writes off the undo stack", () => {
    // Opening, choosing and closing are consequences of arriving rather than
    // edits to the work. What the flow *applies* is ordinary and undoable.
    for (const command of [
      ...planStudioOnboardingChoice("additive-bands"),
      ...planStudioOnboardingDismissal(),
    ]) {
      expect(command.history).toBe("skip");
    }
  });
});
