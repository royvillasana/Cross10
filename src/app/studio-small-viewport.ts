/**
 * What the product does when it is opened on a screen too narrow for its panels.
 *
 * **The failure is reachability, not layout.** The runtime shell carries
 * `minWidth: 1024` with `overflow-hidden` (`toolcraft-app.tsx:86-102`), so below
 * that width the shell stays 1024 wide and everything past the viewport edge is
 * clipped with no scroll to reach it. Measured at 390px: the shell is 1024 wide,
 * `document.scrollWidth` is 390, and the Controls panel sits at `left: 714` —
 * inside the shell, outside the screen, and reachable by no gesture at all.
 *
 * **What this cannot do**, so that nothing here reads as more than it is: the
 * requested layout — canvas above, panels stacked below — needs `controls` and
 * `layers` to accept a `bottom` snap edge and needs their 560px floor relaxed,
 * both runtime constants. Upstream issue 11. This makes the product reachable,
 * not well laid out.
 *
 * Everything is expressed as runtime commands, which is a listed extension
 * point. No runtime panel is hidden with styling and no product control surface
 * is authored — both were considered and both are forbidden, for reasons kept in
 * the change's design so they are not proposed a third time.
 *
 * **None of it reaches the undo stack**, and that is a property of the commands
 * rather than a choice made here: `panels-reducer.ts` returns state directly and
 * emits no history patch, so panel arrangement is workspace state rather than an
 * edit. A user's first Undo takes back their first edit, not the layout they
 * were given. The same reducer returns the *same* state when a patch changes
 * nothing, so a repeated identical dispatch costs nothing either.
 */

/** One panel's box on screen, as the product measured it. */
export type StudioPanelBox = Readonly<{
  height: number;
  left: number;
  top: number;
  width: number;
}>;

export type StudioViewport = Readonly<{ height: number; width: number }>;

/**
 * Below this, a 300px panel and a canvas worth looking at stop fitting side by
 * side.
 *
 * Measured rather than chosen: the Controls panel renders 300 wide and the
 * Layers panel 240, so two panels plus anything for the work needs roughly 900.
 * The runtime's own shell minimum is 1024, and at exactly that width nothing is
 * clipped — so 1024 is where the product stops being able to rely on the shell
 * fitting the screen, and it is the honest boundary.
 */
export const STUDIO_SMALL_VIEWPORT_WIDTH = 1024;

/** Set once the product has arranged a narrow viewport, and never unset. */
export const STUDIO_SMALL_VIEWPORT_TARGET = "stack.smallViewportArranged";

export function isStudioSmallViewport(viewport: StudioViewport): boolean {
  return viewport.width < STUDIO_SMALL_VIEWPORT_WIDTH;
}

/**
 * How much of a box has to be on screen before it counts as reachable.
 *
 * A fraction of the box rather than a fixed number of pixels, and that is not
 * fussiness: a collapsed panel is a 38px header by design, so an absolute floor
 * of 40px reports a perfectly usable header as unreachable, while a 300px panel
 * showing a 53px sliver passes the same floor and is not usable at all. The
 * first of those was a real failure in this file before the fraction replaced
 * it.
 *
 * Proportional in both axes, so it says the same thing about a tall panel and a
 * short one.
 */
const REACHABLE_FRACTION = 0.6;

export function isStudioBoxReachable(
  box: StudioPanelBox | null,
  viewport: StudioViewport,
): boolean {
  if (!box || box.width <= 0 || box.height <= 0) return false;

  const visibleWidth = Math.min(box.left + box.width, viewport.width) - Math.max(box.left, 0);
  const visibleHeight =
    Math.min(box.top + box.height, viewport.height) - Math.max(box.top, 0);

  // A panel larger than the screen can never show a fraction of itself, so what
  // is asked of it is that it fills the screen rather than that it fits.
  const wantedWidth = Math.min(box.width, viewport.width) * REACHABLE_FRACTION;
  const wantedHeight = Math.min(box.height, viewport.height) * REACHABLE_FRACTION;

  return visibleWidth >= wantedWidth && visibleHeight >= wantedHeight;
}

/** Where a rescued panel is put, measured in from the edges it is pinned to. */
const RESCUE_MARGIN_PX = 8;

/**
 * The vertical room one collapsed panel takes, header plus a gap.
 *
 * Used instead of a panel's measured height whenever the same arrangement is
 * also collapsing it. On a first narrow load a panel still measures its full
 * body — 780px — and stacking the next one under *that* puts it off the bottom
 * of a phone. What matters is the height it is about to have, which is its
 * header. Measured at 38; the rest is the gap between two stacked headers.
 */
const COLLAPSED_PANEL_STACK_PX = 46;

/**
 * How far a panel has to move to be on screen, as a translate delta.
 *
 * A delta measured from where the panel actually is, rather than a position
 * re-derived from the runtime's own constants. The shell width, the panel width,
 * and the anchor margin are all runtime numbers; re-deriving them here would
 * produce code that is correct today and silently wrong the first time one of
 * them changes, with no test able to tell. Measuring the box and asking how far
 * it is from the screen is right whatever those numbers are.
 *
 * `offset` in panel state is exactly this: a translate applied on top of the
 * CSS-anchored position (`panel-host.tsx:168,206`), so a delta is the unit the
 * command already speaks.
 *
 * Returns null when the panel is already reachable, which is what keeps this
 * from fighting a user who has arranged things themselves: an arrangement that
 * works is never touched, and one that has gone off screen is rescued whether it
 * was the runtime or the user that put it there.
 */
export function planStudioPanelRescue({
  box,
  currentOffset,
  targetTop = RESCUE_MARGIN_PX,
  viewport,
}: {
  readonly box: StudioPanelBox | null;
  readonly currentOffset: Readonly<{ x: number; y: number }>;
  /** Where this panel's top should land, so several can be stacked. */
  readonly targetTop?: number;
  readonly viewport: StudioViewport;
}): Readonly<{ x: number; y: number }> | null {
  if (!box || isStudioBoxReachable(box, viewport)) return null;

  // Pinned to the left of the visible strip. A panel wider than the screen keeps
  // its left edge on screen, which is the edge its header and its controls start
  // from, and one narrower than the screen simply sits at the margin.
  return {
    x: currentOffset.x + (RESCUE_MARGIN_PX - box.left),
    y: currentOffset.y + (targetTop - box.top),
  };
}

export type StudioArrangementCommand = Readonly<Record<string, unknown>>;

/**
 * Everything a narrow viewport asks for, as commands.
 *
 * Two kinds, and they are governed differently on purpose.
 *
 * **The rescue** runs whenever a panel is unreachable, every load, with no
 * marker. It is idempotent and it cannot override anyone: a panel the user put
 * somewhere workable is already reachable and is left alone.
 *
 * **The collapse** runs once and never again. Panel and section collapse are
 * things a user changes deliberately, and re-imposing them on every load would
 * undo that choice every time they came back — which is the failure that makes
 * opinionated layouts hated. One persisted marker is enough, and it is set the
 * first time a narrow viewport is arranged.
 *
 * Collapsed rather than hidden, because collapsed is what the user asked for and
 * it is also the safer of the two: a collapsed panel keeps its header, so it can
 * be opened again by tapping the thing you are looking at. A hidden panel needs
 * some other surface to bring it back, and on a phone there is no room for one.
 */
export function planStudioSmallViewportArrangement({
  alreadyArranged,
  panels,
  sectionIds,
  viewport,
}: {
  readonly alreadyArranged: boolean;
  readonly panels: readonly Readonly<{
    box: StudioPanelBox | null;
    currentOffset: Readonly<{ x: number; y: number }>;
    panelId: string;
  }>[];
  readonly sectionIds: readonly string[];
  readonly viewport: StudioViewport;
}): readonly StudioArrangementCommand[] {
  if (!isStudioSmallViewport(viewport)) return [];

  const commands: StudioArrangementCommand[] = [];

  // Stacked, not piled. Every rescued panel pinned to the same corner means the
  // last one drawn covers the rest, and the one underneath is then unreachable
  // while measuring as perfectly placed — which is what happened: the Layers
  // panel sat at (10,10) with a correct box and nothing of it visible, because
  // Controls was drawn on top of it.
  //
  // The stack starts below anything already reachable, so a panel the user put
  // somewhere workable is neither moved nor landed on.
  let nextTop = RESCUE_MARGIN_PX;
  for (const panel of panels) {
    if (panel.box && isStudioBoxReachable(panel.box, viewport)) {
      nextTop = Math.max(nextTop, panel.box.top + panel.box.height + RESCUE_MARGIN_PX);
    }
  }

  for (const panel of panels) {
    const offset = planStudioPanelRescue({
      box: panel.box,
      currentOffset: panel.currentOffset,
      targetTop: nextTop,
      viewport,
    });
    if (!offset) continue;

    commands.push({ offset, panelId: panel.panelId, type: "panels.setOffset" });
    // The height it is about to have, not the one it has: this arrangement may
    // be collapsing it in the same batch.
    nextTop +=
      (alreadyArranged ? (panel.box?.height ?? 0) : COLLAPSED_PANEL_STACK_PX) +
      RESCUE_MARGIN_PX;
  }

  if (!alreadyArranged) {
    for (const panel of panels) {
      commands.push({
        panelId: panel.panelId,
        patch: { collapsed: true },
        type: "panels.update",
      });
    }
    for (const sectionId of sectionIds) {
      commands.push({ collapsed: true, sectionId, type: "panels.setSectionCollapsed" });
    }
    commands.push({
      // Skipped, like every other write derived from a change rather than made
      // by the user: arranging a viewport is a consequence of opening the app at
      // a width, not an edit anyone should be able to undo.
      history: "skip",
      target: STUDIO_SMALL_VIEWPORT_TARGET,
      type: "controls.setValue",
      value: true,
    });
  }

  return commands;
}
