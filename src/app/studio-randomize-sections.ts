import { STUDIO_RANDOMIZE_GROUPS, STUDIO_RANDOMIZE_TARGET } from "./studio-randomize";

/**
 * Randomize and its locks, in one section.
 *
 * **The command is an `actions` control rather than a sticky footer one, and
 * the locks sit beside it rather than in the sections they cover.** Both were
 * decided against the framework rather than by preference, and the reasoning is
 * worth keeping because it would otherwise be re-derived: a section holding a
 * large compound control cannot also hold a lock -- runtime splits the compound
 * into its own section and the title duplicates -- and every acceptance row on a
 * sticky `panelActions` control must cover every footer action, so putting
 * Randomize in the footer would oblige the export proof and this one to each
 * exercise both commands.
 *
 * Keeping them together turns out to be the better arrangement anyway. A lock is
 * meaningless except in relation to the press it excludes, so a lock rendered
 * four sections away from the button is a switch whose label has to explain what
 * it belongs to. Here the whole decision -- reroll this, keep that -- is one
 * reading.
 *
 * The locks are generated from the same list the planner excludes by, so a group
 * cannot exist in one and not the other. A hand-written switch beside a
 * hand-written group list is exactly the pair that drifts: the lock renders, the
 * author turns it on, and the reroll ignores it.
 */
export const STUDIO_RANDOMIZE_SECTIONS = [
  {
    controls: {
      randomize: {
        semanticGroup: "composition",
        applicability: { mode: "always" },
        actions: [{ label: "Randomize", value: "randomize" }],
        label: "Try something else",
        performanceReason:
          "Writes control values once; the redraw is the ordinary one a control edit causes.",
        performanceRole: "responsiveness",
        target: STUDIO_RANDOMIZE_TARGET,
        type: "actions",
      },
      ...Object.fromEntries(
        STUDIO_RANDOMIZE_GROUPS.map((group) => [
          group.id,
          {
            semanticGroup: "composition",
            applicability: { mode: "always" },
            defaultValue: false,
            label: group.label,
            performanceReason:
              "Excludes targets from the next reroll; nothing renders until the reroll runs.",
            performanceRole: "responsiveness",
            target: group.lockTarget,
            type: "switch",
          },
        ]),
      ),
    },
    id: "randomize",
    title: "Randomize",
  },
] as const;
