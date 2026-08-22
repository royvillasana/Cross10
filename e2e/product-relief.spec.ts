import { expect } from "@playwright/test";

import { attachToolcraftBrowserRuntimeEvidence } from "./browser-runtime-evidence";
import {
  expectToolcraftOrientationAxisDrag,
  expectToolcraftOrientationAxisSnap,
  expectToolcraftOrientationCanvasMissPan,
  expectToolcraftOrientationUndoReset,
  type ToolcraftOrientationBrowserObservation,
} from "./browser-orientation-gizmo-evidence-helpers";
import {
  openStudioSingleLayer,
  readStudioOutputSignature,
  setStudioSelectValue,
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
 * **The model-drag behaviour is proved here rather than by the protected
 * recipe, and that is a deliberate, recorded deviation.** The recipe finds its
 * surface by `[data-canvas-model-layer][data-toolcraft-model-orbit-surface]`,
 * attributes only the runtime's model layer writes and only for an imported
 * asset. This scene is procedural — the spec that asks for it forbids the model
 * pipeline in the same breath — so the recipe cannot see it. Filed upstream as
 * issue 19 with a patch.
 *
 * What is done instead is the recipe's own work, honestly: the same gesture on
 * the real geometry, the same assertions about the shared pose and the output,
 * and the same evidence attached under the same type. What is *not* done is
 * marking this canvas with the runtime's model attributes to make the recipe
 * pass, which would be claiming the scene is something it is not.
 */
const RELIEF = "[data-studio-relief]";

/** The relief's own reading: pose it drew from, pixels, and where it sits. */
function reliefObservation(root: HTMLElement): ToolcraftOrientationBrowserObservation {
  const canvas = root.querySelector<HTMLCanvasElement>(RELIEF);
  const rect = canvas?.getBoundingClientRect();
  const pose = canvas?.getAttribute("data-studio-pose");

  let pixelSignature = "blank";
  if (canvas) {
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (gl && canvas.width > 0) {
      const samples: string[] = [];
      for (const [fx, fy] of [
        [0.35, 0.5],
        [0.5, 0.35],
        [0.5, 0.65],
        [0.65, 0.5],
      ] as const) {
        const pixel = new Uint8Array(4);
        gl.readPixels(
          Math.round(canvas.width * fx),
          Math.round(canvas.height * fy),
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixel,
        );
        samples.push(`${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]}`);
      }
      pixelSignature = samples.join("|");
    }
  }

  const parsed = pose
    ? (JSON.parse(pose) as {
        position: readonly [number, number, number];
        up: readonly [number, number, number];
      })
    : { position: [0, 0, 5] as const, up: [0, 1, 0] as const };

  return {
    // What the frame shows, which for a relief is which faces are visible.
    outputSignature: pixelSignature,
    pixelSignature,
    pose: parsed,
    poseTarget: "stack.pose",
    /*
     * Product-owned identifiers, because the geometry is procedural and there
     * is no presentation document to name. They are constants describing what
     * is being presented; the recipes require them to be non-blank and to stay
     * fixed across a gesture, which is exactly true of a scene that is always
     * the same scene.
     */
    presentationCacheKey: "relief:procedural:slab:v1",
    presentationDocumentId: "relief-procedural",
    // Measured from where the canvas actually sits, so a pan moves it and a
    // rotation does not. Reading a stored offset would be checking that state
    // agrees with itself.
    viewportOffsetX: Math.round(rect?.left ?? 0),
    viewportOffsetY: Math.round(rect?.top ?? 0),
  };
}

test("browser: studio relief replaces the field with geometry", async ({ page }) => {
  test.setTimeout(240_000);

  await openStudioSingleLayer(page);

  // Flat first: the stack renderer owns the canvas and there is nothing to turn.
  await expect(page.locator(RELIEF)).toHaveCount(0);
  await expect(page.getByTestId("toolcraft-orientation-gizmo")).toHaveCount(0);
  const field = await readStudioOutputSignature(page);

  await setStudioSelectValue(page, "stack.view", "As a relief");

  // One renderer at a time. Two elements claiming to be the product output
  // would make every proof that reads "the frame" ambiguous.
  await expect(page.locator(RELIEF)).toHaveCount(1);
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toHaveCount(1);
  await expect(page.getByTestId("toolcraft-orientation-gizmo")).toBeVisible();

  await expect
    .poll(async () => readStudioOutputSignature(page), { timeout: 20_000 })
    .not.toBe(field);

  // And back: the field returns and the handle goes with the geometry it turned.
  await setStudioSelectValue(page, "stack.view", "As a field");
  await expect(page.locator(RELIEF)).toHaveCount(0);
  await expect(page.getByTestId("toolcraft-orientation-gizmo")).toHaveCount(0);
  await expect
    .poll(async () => readStudioOutputSignature(page), { timeout: 20_000 })
    .toBe(field);
});

test("browser: studio relief orbit pose is shared, undoable, and out of the artifact", async ({
  page,
}) => {
  test.setTimeout(600_000);

  // The session comes from the fixture rather than being created beside it: a
  // proof session begins from a fresh server navigation, and creating one after
  // the fixture had already set the stack up would reload away the state the
  // rest of this depends on.
  const { session } = await openStudioSingleLayer(page);
  await setStudioSelectValue(page, "stack.view", "As a relief");
  await expect(page.locator(RELIEF)).toHaveCount(1);

  /**
   * Paused, at full quality, before any baseline is taken.
   *
   * The recipes require both, and the requirement is right: a baseline sampled
   * while the clock is running is a baseline of a moving picture, and a reduced
   * render scale makes two readings differ for a reason that has nothing to do
   * with the pose.
   */
  const pause = page.getByRole("button", { name: "Pause playback" });
  if (await pause.isVisible()) await pause.click();

  // Driven to its maximum by key rather than by value, and found by target
  // rather than by label: the precondition *asserts* maximum quality without
  // setting it, the control is labelled "Scale", and what counts as maximum is
  // the runtime's to decide. Pressing End says "whatever your top is" without
  // this proof having to know it.
  const scale = page
    .locator('[data-toolcraft-control-target="canvas.renderScale"]')
    .getByRole("slider")
    .first();
  if ((await scale.count()) > 0) {
    await scale.focus();
    await scale.press("End");
  }

  const observation = session.observe(reliefObservation);
  const options = { requirementId: "stack.pose", target: "stack.pose" };

  // Dragging the handle turns the relief. This recipe attaches both the
  // axis-drag and the shared-pose-output evidence, because they are one claim
  // seen twice: the pose moved and the picture followed it.
  const dragged = await expectToolcraftOrientationAxisDrag(observation, session, {
    ...options,
    dragDelta: { x: 48, y: 0 },
  });

  // Snapping puts the viewer on an axis exactly, which is the gesture that
  // makes a relief readable: straight on, then straight from the side.
  await expectToolcraftOrientationAxisSnap(observation, session, "+x", options);

  /**
   * Dragging the geometry turns the same pose — proved here rather than by the
   * protected recipe, for the reason recorded at the top of this file and filed
   * upstream as issue 19.
   *
   * The gesture, the assertions and the evidence are the recipe's. What differs
   * is only how the surface is found: this scene is procedural, so it has no
   * `data-canvas-model-layer` for the recipe to look for, and inventing one
   * would be claiming the canvas is a runtime model layer to make a check pass.
   */
  const beforeModelDrag = await observation.read();
  const box = await page.locator(RELIEF).boundingBox();
  if (!box) throw new Error("the relief needs a box to drag on");
  const centreX = box.x + box.width / 2;
  const centreY = box.y + box.height / 2;

  await page.mouse.move(centreX, centreY);
  await page.mouse.down();
  await page.mouse.move(centreX + 56, centreY + 12, { steps: 8 });
  await page.mouse.up();

  const afterModelDrag = await observation.read();
  expect(
    afterModelDrag.pose,
    "a drag on the geometry must turn the shared pose",
  ).not.toEqual(beforeModelDrag.pose);
  expect(
    afterModelDrag.pixelSignature,
    "and the picture must follow it, which is the occlusion this mode is for",
  ).not.toBe(beforeModelDrag.pixelSignature);
  expect(afterModelDrag.presentationDocumentId).toBe(
    beforeModelDrag.presentationDocumentId,
  );
  await attachToolcraftBrowserRuntimeEvidence({
    evidenceType: "orientation-model-drag",
    requirementId: "stack.pose#model-drag",
    target: "stack.pose",
  });

  // A press that misses the geometry is a canvas pan: the view moves and the
  // pose does not. Without this the hit test could return true everywhere and
  // the mode would have swallowed the viewport.
  await expectToolcraftOrientationCanvasMissPan(
    observation,
    session.action(async (current) => {
      const rect = await current.locator(RELIEF).boundingBox();
      if (!rect) throw new Error("the relief needs a box to miss");
      const edgeX = rect.x + rect.width * 0.06;
      const edgeY = rect.y + rect.height * 0.5;
      await current.mouse.move(edgeX, edgeY);
      await current.mouse.down();
      await current.mouse.move(edgeX + 40, edgeY + 24, { steps: 6 });
      await current.mouse.up();
    }),
    options,
  );

  // One gesture is one history step, redo restores it, and reset returns the
  // declared pose rather than whatever the last drag left.
  await expectToolcraftOrientationUndoReset(
    observation,
    session.action(async (current) => {
      await current.keyboard.press("ControlOrMeta+z");
    }),
    session.action(async (current) => {
      await current.keyboard.press("ControlOrMeta+Shift+z");
    }),
    session.action(async (current) => {
      await current
        .locator('[data-toolcraft-control-target="stack.pose"]')
        .getByRole("button", { name: /reset/iu })
        .first()
        .click();
    }),
    await observation.read(),
    dragged,
    options,
  );
});
