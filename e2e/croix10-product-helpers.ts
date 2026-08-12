import { expect, type Locator, type Page } from "@playwright/test";

import { createToolcraftBrowserProofSession } from "./browser-proof-session";
import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";

/**
 * Shared setup for Croix10 browser proofs.
 *
 * Every proof opens the app, waits for the chromatic field to actually be drawn
 * rather than merely mounted, and then creates the verified proof session. A
 * baseline taken before the field has painted would let an unrelated first frame
 * masquerade as the action's effect.
 */

export const CROIX10_PRODUCT_OUTPUT = "[data-toolcraft-product-output]";

export async function openCroix10(page: Page) {
  await page.goto("/");
  await expect(page.locator(CROIX10_PRODUCT_OUTPUT)).toBeVisible();
  await expect
    .poll(() => readCroix10FieldColorCount(page), { timeout: 15000 })
    .toBeGreaterThan(1);
  return createToolcraftBrowserProofSession(page);
}

/**
 * Distinct colour count of the rendered field, read back from the WebGL buffer.
 *
 * Sampled as small tiles spread across the backing buffer rather than as one
 * corner. A corner is not representative: Transchromie's sheets can leave a corner
 * a single flat colour while the composition is fully drawn, so a corner-only
 * reader would wait forever for a field that is already there. Tiles rather than
 * the whole buffer because this runs in a poll and the backing is 3840x2160.
 */
export async function readCroix10FieldColorCount(page: Page): Promise<number> {
  return page.locator(CROIX10_PRODUCT_OUTPUT).evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) return 0;
    if (canvas.width === 0 || canvas.height === 0) return 0;
    const tile = 32;
    const seen = new Set<string>();
    const centres = [
      [0.2, 0.2],
      [0.8, 0.2],
      [0.2, 0.8],
      [0.8, 0.8],
      [0.5, 0.5],
    ];
    for (const [fractionX, fractionY] of centres) {
      const x = Math.min(
        Math.max(Math.floor(canvas.width * fractionX) - tile / 2, 0),
        Math.max(canvas.width - tile, 0),
      );
      const y = Math.min(
        Math.max(Math.floor(canvas.height * fractionY) - tile / 2, 0),
        Math.max(canvas.height - tile, 0),
      );
      const width = Math.min(tile, canvas.width);
      const height = Math.min(tile, canvas.height);
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      for (let index = 0; index < pixels.length; index += 4) {
        seen.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
      }
    }
    return seen.size;
  });
}

/** Drives a schema slider by keyboard so the change is a real user interaction. */
export async function nudgeCroix10Slider(
  control: Locator,
  steps: number,
  key: "ArrowRight" | "ArrowLeft" = "ArrowRight",
): Promise<void> {
  const slider = control.getByRole("slider").first();
  await slider.focus();
  for (let index = 0; index < steps; index += 1) {
    await slider.press(key);
  }
}

/**
 * Jumps a slider to an end of its range in one keystroke.
 *
 * Preferred over dozens of sequential arrow presses, which are slow enough to
 * outrun the stability window when the machine is loaded.
 */
export async function jumpCroix10Slider(
  control: Locator,
  edge: "End" | "Home",
): Promise<void> {
  const slider = control.getByRole("slider").first();
  await slider.focus();
  await slider.press(edge);
}

/**
 * Sets a slider to a fraction of its range by dragging the real thumb.
 *
 * Scrolled into view first. A pointer drag works in viewport coordinates, so a
 * control sitting below the panel's scroll window would take the gesture at whatever
 * happens to be at those coordinates instead — which reads as "the product did not
 * change" rather than as a mis-aimed drag.
 */
export async function dragCroix10Slider(
  control: Locator,
  page: Page,
  fraction: number,
): Promise<void> {
  const slider = control.getByRole("slider").first();
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  expect(box, "The slider must have layout bounds.").not.toBeNull();
  if (!box) throw new Error("The slider must have layout bounds.");
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.5, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * fraction, y, { steps: 6 });
  await page.mouse.up();
}

/**
 * Prepares a fixture by driving a control outside the measured action.
 *
 * Deliberately not routed through the proof session: this is setup, not evidence,
 * and the session's target-scoped actions exist to bind evidence to exactly one
 * measured interaction.
 */
export async function prepareCroix10Slider(
  page: Page,
  target: string,
  fraction: number,
): Promise<void> {
  const control = await getToolcraftControlFieldByTarget(page, target);
  await dragCroix10Slider(control, page, fraction);
}

/**
 * Locates a runtime Setup switch by its visible field text.
 *
 * The runtime's Background and Infinity canvas switches carry no accessible name
 * of their own, so the field label is the only stable handle.
 */
export function croix10SetupSwitch(page: Page, fieldText: string) {
  return page
    .locator('[data-slot="field"]')
    .filter({ hasText: fieldText })
    .first()
    .getByRole("switch")
    .first();
}

/**
 * Selects an option from a schema select, addressed by runtime target.
 *
 * Two subtleties this handles, both learned the hard way. Options stay in the DOM
 * whether the popover is open or not, so the wait is on visibility: waiting for
 * attachment resolves instantly and clicks a hidden element. And a selection that
 * reveals or hides sibling controls shifts every control index, so the trigger is
 * re-resolved before the confirming assertion rather than reused.
 */
export async function chooseCroix10Option(
  page: Page,
  target: string,
  label: string,
): Promise<void> {
  const control = await getToolcraftControlFieldByTarget(page, target);
  const trigger = control.getByRole("combobox");
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const option = page
    .locator('[role="option"]')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .first();
  await option.waitFor({ state: "visible" });
  await option.click();
  await option.waitFor({ state: "hidden" });

  const settled = await getToolcraftControlFieldByTarget(page, target);
  await expect(settled.getByRole("combobox")).toContainText(label);
}

/** Selects an engine. Thin wrapper so engine specs read clearly. */
export async function chooseCroix10Engine(
  page: Page,
  label: string,
): Promise<void> {
  await chooseCroix10Option(page, "engine.active", label);
}

/**
 * Signature of the real backing buffer.
 *
 * Identity claims are byte claims, so they are read from the GPU buffer rather
 * than from a screenshot: an element screenshot is resampled from the CSS box and
 * is not byte-stable, which makes it the wrong instrument for proving that two
 * renders are the same render.
 */
export async function readCroix10FieldSignature(page: Page): Promise<string> {
  return page.locator(CROIX10_PRODUCT_OUTPUT).evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) return "no-webgl2";
    const { height, width } = canvas;
    if (width === 0 || height === 0) return "empty";
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let sum = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      sum += pixels[index] + pixels[index + 1] + pixels[index + 2];
    }
    let hash = 0;
    const sampled = Math.min(pixels.length, 400_000);
    for (let index = 0; index < sampled; index += 1) {
      hash = (hash * 31 + pixels[index]) >>> 0;
    }
    return `${width}x${height}:${sum}:${hash}`;
  });
}

/**
 * The runtime timeline's transport, addressed the way a user reaches it.
 *
 * These are runtime controls, not product ones: the product declares no play,
 * pause, or duration control anywhere in its panel, so a proof of playback has to
 * drive the top timeline exactly as a person would.
 */
export function croix10Transport(page: Page, label: string): Locator {
  return page.getByRole("button", { name: label, exact: true });
}

/** The playback scrubber, which takes Home, End, and arrow keys. */
export function croix10Scrubber(page: Page): Locator {
  return page.getByRole("slider", { name: "Playback position", exact: true });
}

/**
 * Switches the runtime timeline from its compact transport to the extended one.
 *
 * The compact panel is Play only by design, so scrubbing, duration, and the loop
 * toggle are reachable only here. This is the runtime's own Setup switch — the
 * product does not own it, and flipping it is UI state rather than a scene edit.
 */
export async function showCroix10ExtendedTimeline(page: Page): Promise<void> {
  const toggle = croix10SetupSwitch(page, "Timeline");
  if ((await toggle.getAttribute("aria-checked")) !== "true") {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(croix10Scrubber(page)).toBeVisible();
  await pauseCroix10Timeline(page);
}

/**
 * Stops the clock, so a measurement describes one instant rather than a race.
 *
 * The runtime opens playing. That is right for the product — a drifting scene is
 * already moving when you arrive — but it means any proof that reads the field at
 * a named time has to pause first, or the time it read is not the time it set.
 */
export async function pauseCroix10Timeline(page: Page): Promise<void> {
  const pause = croix10Transport(page, "Pause playback");
  if (await pause.isVisible()) {
    await pause.click();
  }
  await expect(croix10Transport(page, "Play playback")).toBeVisible();
}

/**
 * Starts the clock, or leaves it running if it already is.
 *
 * The runtime opens playing, so a proof that needs the playing state must not
 * assume it has to press Play to get there.
 */
export async function playCroix10Timeline(page: Page): Promise<void> {
  const play = croix10Transport(page, "Play playback");
  if (await play.isVisible()) {
    await play.click();
  }
  await expect(croix10Transport(page, "Pause playback")).toBeVisible();
}

/**
 * Moves the playhead by keyboard and waits for the field to settle there.
 *
 * `Home` is the loop's first instant and `End` its last, which is what makes the
 * seam checkable through the real transport rather than by writing state.
 */
export async function scrubCroix10Timeline(
  page: Page,
  key: "ArrowLeft" | "ArrowRight" | "End" | "Home",
): Promise<void> {
  const scrubber = croix10Scrubber(page);
  await scrubber.focus();
  await scrubber.press(key);
  await settleCroix10Field(page);
}

/**
 * Waits until the rendered field stops changing.
 *
 * The draw runs through a pipeline pass in a layout effect, so a scrub is not
 * visible in the backing buffer on the same tick that dispatched it.
 */
export async function settleCroix10Field(page: Page): Promise<void> {
  let previous = "";
  await expect
    .poll(
      async () => {
        const current = await readCroix10FieldSignature(page);
        const settled = current === previous;
        previous = current;
        return settled;
      },
      { timeout: 15000 },
    )
    .toBe(true);
}

/** Edits the runtime timeline duration through its inline editor. */
export async function setCroix10TimelineDuration(
  page: Page,
  seconds: number,
): Promise<void> {
  await page.getByRole("button", { name: "Edit timeline duration" }).click();
  const editor = page.getByRole("textbox", { name: "timeline duration" });
  await editor.fill(String(seconds));
  await editor.press("Enter");
  await expect(croix10Scrubber(page)).toHaveAttribute(
    "aria-valuemax",
    String(seconds),
  );
}
