import { expect, type Page } from "@playwright/test";

import {
  appControlSectionInventory,
  getToolcraftApplicabilityRequirementId,
  getToolcraftControlApplicabilityCases,
  type ToolcraftControlApplicabilityCase,
} from "../src/app/app-acceptance";
import { appSchema } from "../src/app/app-schema";
import { expectToolcraftAcceptanceOutcome } from "./browser-acceptance-outcome-helpers";
import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { expectToolcraftControlApplicabilityState } from "./browser-control-applicability-evidence";
import type { ToolcraftBrowserProofSession } from "./browser-proof-session";
import { chooseCroix10Option } from "./croix10-product-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";

/**
 * Applicability cases, driven from the same derivation the delivery gate uses.
 *
 * The gate does not ask for a list of cases somebody wrote down; it derives them from
 * the schema and the section inventory, and then requires evidence for each one. So
 * this harness derives them the same way and drives them, which means adding a
 * control or a peer selector extends the proof automatically instead of silently
 * leaving a gap. Hand-enumerating 125 cases would have gone stale on the next engine.
 *
 * Each case gets up to two attachments. Every case proves the dependent control is
 * present or absent under that selector value. A present case additionally reproves
 * the control's own product outcome in that branch — which is the point of the rule:
 * a control that is visible but inert in some branch is a bug that only shows up if
 * the outcome is reproved in every branch rather than once.
 */

export type Croix10ApplicabilityEvidence =
  | "command-side-effect"
  | "product-output"
  | "rendered-pixels";

export type Croix10ApplicabilityProofOptions = Readonly<{
  /** The row's own interaction. The index counts only the cases that act, so a caller
   *  can alternate direction and every case produces a real change rather than
   *  re-applying the value already set. A hidden case does not advance it. */
  act: (index: number) => Promise<void>;
  evidence?: Croix10ApplicabilityEvidence;
  /** Required for command-side-effect rows, whose outcome is state rather than pixels. */
  observe?: () => Promise<unknown>;
  page: Page;
  /** Runs before the selector is driven, e.g. to select an engine under which the
   *  row's own action can actually do something in this case. */
  prepare?: (applicabilityCase: ToolcraftControlApplicabilityCase) => Promise<void>;
  requirementId: string;
  /** Supplies the visible case's own evidence, for rows whose evidence is a
   *  specialised recipe the generic paths cannot emit — an exported artifact, say. */
  proveVisible?: (requirementId: string, index: number) => Promise<void>;
  /** Puts back whatever `act` disturbed, so the next case starts from a state where
   *  the selector still exists. Not measured. */
  restore?: () => Promise<void>;
  session: ToolcraftBrowserProofSession;
  target: string;
}>;

export function croix10ApplicabilityCases(
  target: string,
): ToolcraftControlApplicabilityCase[] {
  return getToolcraftControlApplicabilityCases({
    schema: appSchema,
    sectionInventory: appControlSectionInventory,
    target,
  });
}

/** Drives one selector to the value a case names, through its real control. */
async function driveSelector(
  page: Page,
  applicabilityCase: ToolcraftControlApplicabilityCase,
): Promise<void> {
  switch (applicabilityCase.selectorControlType) {
    case "select": {
      const label = applicabilityCase.selectorOptionLabel;
      if (!label) {
        throw new Error(
          `Applicability case for ${applicabilityCase.selectorTarget} has no option label.`,
        );
      }
      await chooseCroix10Option(page, applicabilityCase.selectorTarget, label);
      return;
    }
    case "checkbox":
    case "switch": {
      const control = await getToolcraftControlFieldByTarget(
        page,
        applicabilityCase.selectorTarget,
      );
      const toggle = control
        .getByRole(applicabilityCase.selectorControlType)
        .first();
      const desired = String(applicabilityCase.selectorValue);
      if ((await toggle.getAttribute("aria-checked")) !== desired) {
        await toggle.click();
      }
      await expect(toggle).toHaveAttribute("aria-checked", desired);
      return;
    }
    default:
      // Deliberately loud. A selector type this harness cannot drive would
      // otherwise be skipped, and a skipped case reads as a satisfied one.
      throw new Error(
        `Applicability harness cannot drive a ${applicabilityCase.selectorControlType} selector (${applicabilityCase.selectorTarget}).`,
      );
  }
}

export async function proveCroix10ApplicabilityCases(
  options: Croix10ApplicabilityProofOptions,
): Promise<void> {
  const cases = croix10ApplicabilityCases(options.target);
  expect(
    cases.length,
    `Target "${options.target}" should derive applicability cases; if it derives none, this proof is not needed.`,
  ).toBeGreaterThan(0);

  let index = 0;
  for (const applicabilityCase of cases) {
    await options.prepare?.(applicabilityCase);

    await expectToolcraftControlApplicabilityState(
      options.session,
      options.session.controlAction(applicabilityCase.selectorTarget, () =>
        driveSelector(options.page, applicabilityCase),
      ),
      applicabilityCase,
      { baseRequirementId: options.requirementId, timeoutMs: 10_000 },
    );

    if (applicabilityCase.expectation === "hidden") {
      continue;
    }

    const requirementId = getToolcraftApplicabilityRequirementId(
      options.requirementId,
      applicabilityCase,
    );
    const step = index;

    if (options.proveVisible) {
      await options.proveVisible(requirementId, step);
    } else if (options.evidence === "command-side-effect") {
      if (!options.observe) {
        throw new Error(
          `Command side-effect row "${options.requirementId}" must supply an observation.`,
        );
      }
      await expectToolcraftAcceptanceOutcome(
        options.observe,
        () => options.act(step),
        { evidenceType: "command-side-effect", requirementId },
      );
    } else if (options.evidence) {
      await expectToolcraftProductObservableToChange(
        options.session,
        options.session.controlAction(options.target, () => options.act(step)),
        { requirementId },
      );
    } else {
      throw new Error(
        `Row "${options.requirementId}" must declare evidence or supply proveVisible.`,
      );
    }

    await options.restore?.();
    index += 1;
  }
}
