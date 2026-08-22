import { expect, type Page } from "@playwright/test";

import {
  openStudioSingleLayer,
  readStudioOutputSignature,
  setStudioSelectValue,
  setStudioSlider,
  STUDIO_PRODUCT_OUTPUT,
} from "./studio-product-helpers";
import { test } from "./toolcraft-product-test";

/**
 * The spatial mode: the product's second renderer, and its only geometry.
 *
 * Everything else in this studio composites a frame from a stack of fields, and
 * the colour change a Physichromie shows as a viewer moves past it is computed
 * from an angle — a good simulation, and not the phenomenon. Standing the fins
 * up and moving around them is. So the claims here are about *occlusion* rather
 * than about a control moving something.
 *
 * **It ships with a fixed viewpoint and no orbit, which is a deviation taken
 * knowingly.** An orbit needs an orientation gizmo — the schema will not accept
 * one without the other — and a gizmo must declare seven coverages, two of
 * which are unreachable through no fault of this product: the model-drag recipe
 * finds its surface by an attribute only the runtime's model layer writes, and
 * the shared preconditions read an `aria-valuemax` the runtime's own
 * render-scale slider does not set. Both are filed upstream, as issues 19 and
 * 21, with patches.
 *
 * So what is proved here is what is true here: the field stands up as fins, the
 * fins come from the field rather than from a second set of numbers, and the
 * depth is the one thing the mode adds. The parallax those fins exist for
 * arrives with the orbit.
 */
const RELIEF = "[data-studio-relief]";

/**
 * A row across the relief, sampled finely enough to see a fin change shape.
 *
 * `readStudioOutputSignature` reads nine points, which is right for "did the
 * composite change at all" and wrong for a field of thin fins: nine samples can
 * land on the same faces whatever the depth is, and the proof would report that
 * standing the fins up changed nothing.
 */
async function readStudioReliefRow(page: Page): Promise<string> {
  return page.locator(RELIEF).evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl || canvas.width === 0) return "nogl";
    const span = Math.floor(canvas.width * 0.7);
    const pixels = new Uint8Array(span * 4);
    gl.readPixels(
      Math.floor((canvas.width - span) / 2),
      Math.floor(canvas.height / 2),
      span,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    const samples: string[] = [];
    const stride = Math.max(1, Math.floor(span / 96));
    for (let index = 0; index < span; index += stride) {
      const offset = index * 4;
      samples.push(`${pixels[offset]},${pixels[offset + 3]}`);
    }
    return samples.join("|");
  });
}

test("browser: studio relief replaces the field with geometry", async ({ page }) => {
  test.setTimeout(240_000);

  await openStudioSingleLayer(page);

  // Flat first: the stack renderer owns the canvas and there is nothing to turn.
  await expect(page.locator(RELIEF)).toHaveCount(0);
  const field = await readStudioOutputSignature(page);

  await setStudioSelectValue(page, "stack.view", "As a relief");

  // One renderer at a time. Two elements claiming to be the product output
  // would make every proof that reads "the frame" ambiguous.
  await expect(page.locator(RELIEF)).toHaveCount(1);
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toHaveCount(1);

  await expect
    .poll(async () => readStudioOutputSignature(page), { timeout: 20_000 })
    .not.toBe(field);

  // And back: the field returns and the handle goes with the geometry it turned.
  await setStudioSelectValue(page, "stack.view", "As a field");
  await expect(page.locator(RELIEF)).toHaveCount(0);
  await expect
    .poll(async () => readStudioOutputSignature(page), { timeout: 20_000 })
    .toBe(field);
});


test("browser: studio relief stands the band field up as fins", async ({ page }) => {
  test.setTimeout(240_000);

  await openStudioSingleLayer(page);
  await setStudioSlider(page, "Band count", 12);
  await setStudioSelectValue(page, "stack.view", "As a relief");
  await expect(page.locator(RELIEF)).toHaveCount(1);

  /**
   * The fins are the field's, not the relief's own.
   *
   * This is the claim that keeps the two views one work: a relief with its own
   * count would be a different construction wearing the same panel, and the
   * first time an author changed the band count the two would disagree about
   * what they were looking at.
   */
  const fins = page.locator(RELIEF);
  await expect(fins).toHaveAttribute("data-studio-fins", /^12@/u);

  await setStudioSelectValue(page, "stack.view", "As a field");
  await setStudioSlider(page, "Band count", 30);
  await setStudioSelectValue(page, "stack.view", "As a relief");
  await expect(fins).toHaveAttribute("data-studio-fins", /^30@/u);

  // Depth is the one number this mode adds, and it changes the picture: more of
  // each fin's side face reaches a viewpoint that is off the axis.
  const shallow = await readStudioReliefRow(page);
  await setStudioSlider(page, "How far they stand off", 1);
  await expect
    .poll(async () => readStudioReliefRow(page), { timeout: 20_000 })
    .not.toBe(shallow);

  // And the fin count did not move when the depth did: one is the field's, the
  // other is the mode's.
  await expect(fins).toHaveAttribute("data-studio-fins", /^30@1\.00$/u);
});

/**
 * The parallax, which is the thing this whole mode exists for.
 *
 * The requirement it answers is specific: the colour change must arise from
 * *genuine geometric occlusion* of the fins' side faces rather than from a
 * simulated shift. The flat view can move colour around convincingly; what it
 * cannot do is hide one fin behind another.
 *
 * So the assertion is not "the frame changed" — a recolour would pass that. It
 * is that the *proportions* of the inks change while the *set* of inks does
 * not. Faces coming into and out of view is exactly that: more of one ink, less
 * of another, and never a colour that was not already on a fin.
 */
async function readStudioReliefInks(page: Page): Promise<Map<string, number>> {
  const row = await page.locator(RELIEF).evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl || canvas.width === 0) return [] as string[];
    const span = Math.floor(canvas.width * 0.7);
    const pixels = new Uint8Array(span * 4);
    gl.readPixels(
      Math.floor((canvas.width - span) / 2),
      Math.floor(canvas.height / 2),
      span,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    const out: string[] = [];
    for (let index = 0; index < span; index += 1) {
      const offset = index * 4;
      // Quantised, because a lit edge pixel is a blend of two faces rather than
      // a third ink, and counting those as their own colour would report a
      // palette that grows every time the geometry moves.
      const quantise = (value: number): number => Math.round(value / 32) * 32;
      out.push(
        `${quantise(pixels[offset] ?? 0)},${quantise(pixels[offset + 1] ?? 0)},${quantise(
          pixels[offset + 2] ?? 0,
        )},${(pixels[offset + 3] ?? 0) > 127 ? 1 : 0}`,
      );
    }
    return out;
  });

  const counts = new Map<string, number>();
  for (const pixel of row) counts.set(pixel, (counts.get(pixel) ?? 0) + 1);
  return counts;
}

/**
 * Steps the playhead to a fraction of the loop.
 *
 * Stepped with the keyboard rather than by writing a value, because the
 * scrubber is not an `<input>` and assigning through the native setter throws.
 * Local to this file rather than shared: the motion spec has its own for the
 * same reason, and a spec importing another spec makes the second one's tests
 * run twice under Playwright's collection.
 */
async function scrubReliefTimelineTo(
  scrubber: ReturnType<Page["getByRole"]>,
  fraction: number,
): Promise<void> {
  const duration = Number(await scrubber.getAttribute("aria-valuemax"));
  expect(Number.isFinite(duration) && duration > 0).toBe(true);
  const target = duration * fraction;

  await scrubber.focus();
  await scrubber.press("Home");
  let previous = Number(await scrubber.getAttribute("aria-valuenow"));
  for (let press = 0; press < 4_000; press += 1) {
    if (previous >= target) break;
    await scrubber.press("ArrowRight");
    const next = Number(await scrubber.getAttribute("aria-valuenow"));
    expect(next, "the timeline scrubber must respond to a step").toBeGreaterThan(
      previous,
    );
    previous = next;
  }
}

test("browser: studio relief parallax comes from occlusion rather than a colour shift", async ({
  page,
}) => {
  test.setTimeout(300_000);

  await openStudioSingleLayer(page);
  await setStudioSlider(page, "Band count", 16);
  await setStudioSelectValue(page, "stack.view", "As a relief");
  await setStudioSlider(page, "How far they stand off", 0.6);

  const sweep = async (): Promise<string> =>
    (await page.locator(RELIEF).getAttribute("data-studio-sweep")) ?? "";

  // A composition that declares no travel does not move at all, which is the
  // same rule the flat view follows and the reason a still relief costs
  // nothing.
  expect(await sweep(), "a relief with no travel must stand still").toBe("0.000");

  await setStudioSlider(page, "Travel per loop", 1);
  const scrubber = page.getByRole("slider", { name: "Playback position" });
  if (!(await scrubber.isVisible())) {
    await page
      .locator('[data-toolcraft-control-target="panels.timeline.extended"]')
      .getByRole("switch")
      .click();
  }
  const pause = page.getByRole("button", { name: "Pause playback" });
  if (await pause.isVisible()) await pause.click();

  await scrubber.press("Home");
  const start = await readStudioReliefInks(page);
  const startSweep = await sweep();
  expect(start.size, "the relief must be drawing fins").toBeGreaterThan(1);

  // A quarter of the way through, the viewer is at one end of their walk.
  await scrubReliefTimelineTo(scrubber, 0.25);
  const passing = await readStudioReliefInks(page);

  // The inks are the same inks. Nothing new appeared, which is what separates
  // occlusion from a recolour.
  const startInks = [...start.keys()].filter((ink) => ink.endsWith(",1")).sort();
  const passingInks = [...passing.keys()].filter((ink) => ink.endsWith(",1")).sort();
  expect(
    passingInks.every((ink) => startInks.includes(ink)),
    "moving the viewer must not introduce an ink the fins do not carry",
  ).toBe(true);

  // And their shares changed, which is what occlusion does: faces come into
  // view and go out of it.
  const shareChanged = startInks.some(
    (ink) => (start.get(ink) ?? 0) !== (passing.get(ink) ?? 0),
  );
  expect(
    shareChanged,
    "walking past the relief must change how much of each ink reaches the frame",
  ).toBe(true);

  // The seam: the viewer arrives back where they started, so the last frame of
  // the loop is the first. By construction rather than by a lucky rate.
  await scrubber.press("End");
  expect(await sweep(), "a whole number of passes must return the viewer").toBe(
    startSweep,
  );
});
