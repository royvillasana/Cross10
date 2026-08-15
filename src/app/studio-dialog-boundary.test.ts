import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// @ts-expect-error -- a framework script with no type declarations, imported for
// the one question this file asks.
import { getToolcraftSensitiveModuleKind } from "../../scripts/toolcraft-product-boundary-module-policy.mjs";

/**
 * May a product module import the runtime's dialog composite?
 *
 * This exists because an earlier change said no, built around the answer, and
 * was wrong. `engine-targeting-and-control-ia` recorded that "the runtime's
 * `dialog` and `alert-dialog` composites are internal and reach no product
 * surface", and shipped a two-press confirmation in place of the modal the user
 * had asked for. That finding was drawn from a contract sentence about *panels*
 * and generalised to dialogs, which the boundary does not ban.
 *
 * A belief that shapes a design should be enforced rather than remembered. This
 * asks the boundary policy itself — the same function the product-boundary check
 * uses — so the day someone tightens it, the answer changes here first and the
 * design that depends on it fails rather than quietly becoming false.
 */

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sourceFilePath = join(rootDir, "src", "app", "studio-dialog-boundary.test.ts");

function sensitiveKind(moduleSpecifier: string): string | null {
  return (
    (getToolcraftSensitiveModuleKind as (input: {
      moduleSpecifier: string;
      rootDir: string;
      sourceFilePath: string;
    }) => string | null)({ moduleSpecifier, rootDir, sourceFilePath }) ?? null
  );
}

describe("what a product module may import from the runtime's UI", () => {
  it("permits the dialog composite", () => {
    // The whole basis of the dialog-first flow. `composites/**` is named by no
    // rule; the bans are the bare `ui` entry and the controls subtree.
    expect(sensitiveKind("@/toolcraft/ui/components/composites/dialog")).toBeNull();
    expect(
      sensitiveKind("@/toolcraft/ui/components/composites/alert-dialog"),
    ).toBeNull();
  });

  it("bans the bare ui entry and the controls subtree", () => {
    // The half of the earlier finding that was correct, kept here so the
    // permission above cannot be read as a general one.
    // Asserted as "the classifier flags it" rather than as a particular name.
    // The bare entry and the subtree come back under different kinds --
    // `ui-controls` and `ui-control-implementation` -- and pinning the exact
    // string would make this a test of the vocabulary rather than of the ban.
    // The framework's own boundary test pins the string and is red for exactly
    // that reason.
    for (const specifier of [
      "@/toolcraft/ui",
      "@/toolcraft/ui/components/controls",
      "@/toolcraft/ui/components/controls/color/color-picker-popover",
      "@/toolcraft/ui/components/controls/slider",
    ]) {
      expect(sensitiveKind(specifier), `${specifier} must be banned`).not.toBeNull();
    }
  });

  it("still routes runtime state and react through their own entries", () => {
    // Not a boundary question so much as a check that the classifier is
    // actually classifying, rather than returning null for everything and
    // making the permission above meaningless.
    expect(sensitiveKind("@/toolcraft/runtime/react")).toBe("runtime-react");
  });
});
