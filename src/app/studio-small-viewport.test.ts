import { describe, expect, it } from "vitest";

import {
  isStudioBoxReachable,
  isStudioSmallViewport,
  planStudioPanelRescue,
  planStudioSmallViewportArrangement,
  STUDIO_SMALL_VIEWPORT_TARGET,
  STUDIO_SMALL_VIEWPORT_WIDTH,
} from "./studio-small-viewport";

const PHONE = { height: 800, width: 390 } as const;
const DESKTOP = { height: 800, width: 1280 } as const;

/** The measured failure: the Controls panel on a 390px screen, before any fix. */
const OFF_SCREEN = { height: 780, left: 714, top: 10, width: 300 } as const;

describe("what counts as reachable", () => {
  it("accepts a collapsed header, which is short by design", () => {
    // The rule was an absolute 40px floor for one round, and it called a 38px
    // collapsed panel header unreachable. A header is the whole surface a user
    // taps to open a collapsed panel, so a rule that rejects it rejects the
    // arrangement this change exists to produce.
    expect(
      isStudioBoxReachable({ height: 38, left: 8, top: 8, width: 300 }, PHONE),
    ).toBe(true);
  });

  it("rejects a sliver of a wide panel", () => {
    // The same absolute floor passed this: 53 visible pixels of a 300px panel,
    // which is not a panel anyone can use.
    expect(
      isStudioBoxReachable({ height: 38, left: 337, top: 8, width: 300 }, PHONE),
    ).toBe(false);
  });

  it("rejects the box that motivated the change", () => {
    expect(isStudioBoxReachable(OFF_SCREEN, PHONE)).toBe(false);
  });

  it("accepts a panel larger than the screen when it fills the screen", () => {
    // A panel taller than the viewport can never show a fraction of itself, so
    // what is asked of it is that it covers the viewport rather than that it
    // fits inside one.
    expect(
      isStudioBoxReachable({ height: 1600, left: 8, top: 0, width: 300 }, PHONE),
    ).toBe(true);
  });

  it("treats a missing or empty box as unreachable", () => {
    expect(isStudioBoxReachable(null, PHONE)).toBe(false);
    expect(
      isStudioBoxReachable({ height: 0, left: 0, top: 0, width: 0 }, PHONE),
    ).toBe(false);
  });
});

describe("the rescue", () => {
  it("moves an off-screen panel by the distance it is away", () => {
    // A delta from where the panel actually is, rather than a position derived
    // from the runtime's shell width, panel width and margin. Those are runtime
    // numbers, and re-deriving them here would be right today and silently wrong
    // the first time one changed.
    const offset = planStudioPanelRescue({
      box: OFF_SCREEN,
      currentOffset: { x: 0, y: 0 },
      viewport: PHONE,
    });

    expect(offset).toEqual({ x: 8 - 714, y: 8 - 10 });
  });

  it("adds to the offset the panel already carries", () => {
    // The delta is applied on top of the existing translate, so a panel that has
    // already been moved once is corrected rather than moved twice.
    expect(
      planStudioPanelRescue({
        box: OFF_SCREEN,
        currentOffset: { x: -100, y: 0 },
        viewport: PHONE,
      }),
    ).toEqual({ x: -100 + (8 - 714), y: 8 - 10 });
  });

  it("leaves a reachable panel alone, whoever put it there", () => {
    // This is what makes the arrangement safe to run on every load: a panel the
    // user dragged somewhere workable is already reachable, so nothing is
    // planned for it and their arrangement survives.
    expect(
      planStudioPanelRescue({
        box: { height: 38, left: 40, top: 40, width: 300 },
        currentOffset: { x: 0, y: 0 },
        viewport: PHONE,
      }),
    ).toBeNull();
  });

  it("plans nothing for a panel it cannot measure", () => {
    expect(
      planStudioPanelRescue({
        box: null,
        currentOffset: { x: 0, y: 0 },
        viewport: PHONE,
      }),
    ).toBeNull();
  });
});

describe("the arrangement", () => {
  const panels = [
    { box: OFF_SCREEN, currentOffset: { x: 0, y: 0 }, panelId: "controls" },
    {
      box: { height: 87, left: 10, top: 10, width: 240 },
      currentOffset: { x: 0, y: 0 },
      panelId: "layers",
    },
  ];
  const sectionIds = ["gallery", "reference", "selected-layer"];

  it("does nothing at all above the threshold", () => {
    expect(
      planStudioSmallViewportArrangement({
        alreadyArranged: false,
        panels,
        sectionIds,
        viewport: DESKTOP,
      }),
    ).toEqual([]);
    expect(isStudioSmallViewport(DESKTOP)).toBe(false);
    expect(isStudioSmallViewport({ height: 800, width: STUDIO_SMALL_VIEWPORT_WIDTH }))
      .toBe(false);
  });

  it("rescues only the panel that needs it", () => {
    const rescues = planStudioSmallViewportArrangement({
      alreadyArranged: true,
      panels,
      sectionIds,
      viewport: PHONE,
    }).filter((command) => command.type === "panels.setOffset");

    expect(rescues).toHaveLength(1);
    expect(rescues[0]?.panelId).toBe("controls");
  });

  it("collapses every panel and every section on the first narrow load", () => {
    const commands = planStudioSmallViewportArrangement({
      alreadyArranged: false,
      panels,
      sectionIds,
      viewport: PHONE,
    });

    // Collapsed rather than hidden: a collapsed panel keeps the header you tap
    // to open it, and a hidden one needs another surface to bring it back --
    // which on a phone there is no room for.
    const collapsed = commands.filter((command) => command.type === "panels.update");
    expect(collapsed.map((command) => command.panelId)).toEqual(["controls", "layers"]);
    for (const command of collapsed) {
      expect(command.patch).toEqual({ collapsed: true });
    }

    expect(
      commands
        .filter((command) => command.type === "panels.setSectionCollapsed")
        .map((command) => command.sectionId),
    ).toEqual(sectionIds);
  });

  it("marks itself done so the collapse never happens twice", () => {
    const marker = planStudioSmallViewportArrangement({
      alreadyArranged: false,
      panels,
      sectionIds,
      viewport: PHONE,
    }).find((command) => command.target === STUDIO_SMALL_VIEWPORT_TARGET);

    expect(marker?.value).toBe(true);
    // Derived from opening the app at a width, not an edit anyone made, so it
    // does not belong on the undo stack.
    expect(marker?.history).toBe("skip");
  });

  it("never collapses again once it has", () => {
    // The failure this prevents: a layout that re-imposes itself on every load
    // undoes the user's own choice each time they come back, which is worse than
    // a bad layout because they can no longer fix it.
    const commands = planStudioSmallViewportArrangement({
      alreadyArranged: true,
      panels,
      sectionIds,
      viewport: PHONE,
    });

    expect(commands.some((command) => command.type === "panels.update")).toBe(false);
    expect(
      commands.some((command) => command.type === "panels.setSectionCollapsed"),
    ).toBe(false);
    expect(commands.some((command) => command.target === STUDIO_SMALL_VIEWPORT_TARGET))
      .toBe(false);
  });

  it("plans nothing once everything is reachable and arranged", () => {
    // Idempotence, which is what lets this run on every load and every resize
    // without a marker guarding the rescue.
    expect(
      planStudioSmallViewportArrangement({
        alreadyArranged: true,
        panels: panels.map((panel) => ({
          ...panel,
          box: { height: 38, left: 8, top: 8, width: 300 },
        })),
        sectionIds,
        viewport: PHONE,
      }),
    ).toEqual([]);
  });

  it("touches nothing but panels and its own marker", () => {
    // No layer, no control value, no canvas command. Arranging a viewport is not
    // an edit to the work, and a proof that only counted commands would pass
    // over one that quietly was.
    for (const command of planStudioSmallViewportArrangement({
      alreadyArranged: false,
      panels,
      sectionIds,
      viewport: PHONE,
    })) {
      const type = String(command.type);
      expect(
        type.startsWith("panels.") || command.target === STUDIO_SMALL_VIEWPORT_TARGET,
      ).toBe(true);
    }
  });
});
