import { expect, type Page } from "@playwright/test";

import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import {
  CROIX10_PRODUCT_OUTPUT,
  chooseCroix10Engine,
  openCroix10,
} from "./croix10-product-helpers";

/**
 * Shared fixture and observation helpers for the Randomize proofs.
 *
 * Split from the spec so both stay within the line budget: the spec is the claims,
 * this is the machinery for setting up a lock combination and reading what Randomize
 * did.
 */

const RUNTIME_APP = '[data-slot="toolcraft-runtime-app"]';

/**
 * Every control value Randomize can touch, read through the controls it belongs to.
 *
 * Addressed by runtime target rather than by accessible name: the sliders take their
 * names from label elements, so an `aria-label` selector matches nothing and every
 * value reads as empty — which would make a lock proof pass by comparing blanks.
 * A target that is not on screen under the current engine reads as empty on purpose;
 * absence is meaningful here rather than exceptional.
 */
export const RANDOMIZE_TARGETS = [
  "stripe.count",
  "stripe.angle",
  "stripe.widthRatio",
  "palette.slots",
  "immersion.spread",
  "immersion.balance",
  "transchromie.planes",
] as const;

export async function readRandomizeState(
  page: Page,
): Promise<Readonly<Record<string, string>>> {
  const state: Record<string, string> = {};
  for (const target of RANDOMIZE_TARGETS) {
    try {
      const field = await getToolcraftControlFieldByTarget(page, target);
      const sliders = await field
        .getByRole("slider")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("aria-valuenow")).join("|"),
        );
      const inputs = await field
        .getByRole("textbox")
        .evaluateAll((nodes) =>
          nodes.map((node) => (node as HTMLInputElement).value).join("|"),
        );
      state[target] = `${sliders}/${inputs}`;
    } catch {
      state[target] = "";
    }
  }
  // The rendered field, from the backing buffer. Every group Randomize can touch is
  // visible in the output, so this changes whenever Randomize assigned anything at
  // all — which is what the change-based evidence needs. The per-target values above
  // are what the lock assertions compare; this is only the liveness signal, and it is
  // read from the GPU rather than from the DOM so a control that re-renders lazily
  // cannot make a real assignment look like no assignment.
  state.field = await page.locator(CROIX10_PRODUCT_OUTPUT).evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) return "no-webgl2";
    const width = Math.min(canvas.width, 640);
    const height = Math.min(canvas.height, 360);
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let sum = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      sum += pixels[index] + pixels[index + 1] * 3 + pixels[index + 2] * 7;
    }
    return String(sum);
  });
  return state;
}

export const LOCK_TARGETS = [
  "stripe.randomizeLock",
  "palette.randomizeLock",
  "immersion.randomizeLock",
  "transchromie.randomizeLock",
] as const;

/**
 * Sets every lock explicitly before a case runs.
 *
 * Cases do not reset each other, so without this a lock left on by the previous case
 * silently joins the one under test — and two locks the harness does not know about
 * can leave Randomize with nothing it is allowed to change, which fails as "the
 * output did not change" and says nothing about the branch.
 */
export async function setLocks(page: Page, on: readonly string[]): Promise<void> {
  for (const target of LOCK_TARGETS) {
    const control = await getToolcraftControlFieldByTarget(page, target);
    const toggle = control.getByRole("switch").first();
    const desired = String(on.includes(target));
    if ((await toggle.getAttribute("aria-checked")) !== desired) {
      await toggle.click();
    }
    await expect(toggle).toHaveAttribute("aria-checked", desired);
  }
}

/**
 * Chooses an engine under which Randomize can still change something.
 *
 * Two locks are on in a lock proof — the row's own and the case's — and a lock proof
 * needs an outcome that changes, so at least one remaining group must be applicable
 * under the engine on screen. Stripes and palette need a banded engine; the immersive
 * field needs Chromosaturation; the sheets need Transchromie. With only two of four
 * groups locked there is always an answer, but it is not always the default engine.
 */
export async function chooseEngineForLocks(
  page: Page,
  lockedTargets: readonly string[],
): Promise<void> {
  const locked = new Set(lockedTargets);
  const label =
    locked.has("stripe.randomizeLock") && locked.has("palette.randomizeLock")
      ? locked.has("immersion.randomizeLock")
        ? "Transchromie"
        : "Chromosaturation"
      : "Couleur Additive";
  const trigger = page
    .locator('[data-slot="field"]')
    .filter({ hasText: "Engine" })
    .first()
    .getByRole("combobox");
  if (((await trigger.textContent()) ?? "").includes(label)) return;
  await chooseCroix10Engine(page, label);
}

export async function pressRandomize(page: Page): Promise<void> {
  const control = await getToolcraftControlFieldByTarget(
    page,
    "randomize.actions",
  );
  await control.getByRole("button", { name: "Randomize" }).click();
}

export async function setLock(page: Page, target: string): Promise<void> {
  const control = await getToolcraftControlFieldByTarget(page, target);
  const lock = control.getByRole("switch").first();
  await lock.click();
  await expect(lock).toHaveAttribute("aria-checked", "true");
}

/**
 * Applies engine and lock setup, then reloads into it, so the panel is at its final
 * size before anything is measured. Selecting an engine swaps whole sections.
 */
export async function openCroix10Randomize(
  page: Page,
  engineLabel: string,
  lockTarget: string,
): Promise<Awaited<ReturnType<typeof openCroix10>>> {
  await page.goto("/");
  await expect(page.locator(CROIX10_PRODUCT_OUTPUT)).toBeVisible();
  await chooseCroix10Engine(page, engineLabel);
  await setLock(page, lockTarget);
  await expect(page.locator(RUNTIME_APP)).toHaveAttribute(
    "data-toolcraft-persistence-status",
    "success",
  );
  return openCroix10(page);
}

