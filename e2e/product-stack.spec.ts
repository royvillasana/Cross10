import { expect, type Page } from "@playwright/test";

import { expectToolcraftAcceptanceOutcome } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftSelectedLayerControl } from "./browser-layer-evidence-helpers";
import {
  expectToolcraftProductObservableToChange,
  getToolcraftProductObservableSnapshot,
} from "./product-observable-helpers";
import {
  addStudioLayer,
  openStudioSingleLayer,
  readStudioLayerIds,
  readStudioSelectedLayerId,
  readStudioOutputSignature,
  selectStudioLayer,
  setStudioSelectValue,
  setStudioSlider,
  STUDIO_PRODUCT_OUTPUT,
} from "./studio-product-helpers";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { test } from "./toolcraft-product-test";
import {
  POINTER_REACH,
  settleStudioFrame,
} from "./studio-stack-readers";


test("browser: pressing P hands the canvas to the pen", async ({ page }) => {
  test.setTimeout(120_000);

  await openStudioSingleLayer(page);
  const output = page.locator(STUDIO_PRODUCT_OUTPUT);
  const box = await output.boundingBox();
  if (!box) throw new Error("The canvas needs a bounding box to draw on.");

  const vertices = page.locator('[data-testid^="studio-pen-vertex-"]');
  const moveHandle = page.getByTestId("studio-region-move");

  // A drawing already under way, started from the button, so the shortcut has
  // something to be measured against.
  await page
    .locator('[data-toolcraft-control-target="stack.pen"]')
    .getByRole("button", { name: "Draw" })
    .first()
    .click();
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.3);
  await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.3);
  await expect(vertices).toHaveCount(2);

  // Closing is what gives the canvas back, and only a closed path leaves the
  // extent handles up to be stood aside again.
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.7);
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.3);
  await expect(moveHandle).toBeVisible();
  await expect(vertices).toHaveCount(3);

  const pressed = await expectToolcraftAcceptanceOutcome(
    async () => ({
      handlesShown: await moveHandle.isVisible(),
      vertices: await vertices.count(),
    }),
    async () => {
      await page.keyboard.press("p");
    },
    { evidenceType: "command-side-effect", requirementId: "stack.pen.shortcut" },
  );

  // Both halves of the operation, which is what makes this the Draw button's
  // accelerator rather than a lookalike that only flips the mode: the canvas
  // belongs to the pen, and the path it starts is empty rather than the closed
  // one that was there a moment ago.
  expect(pressed).toEqual({ handlesShown: false, vertices: 0 });

  // And it draws: the key started a real drawing, not a mode with nothing
  // behind it.
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await expect(vertices).toHaveCount(1);
});

test("browser: studio pen draws a free path on the canvas", async ({ page }) => {
  test.setTimeout(120_000);

  await openStudioSingleLayer(page);
  const output = page.locator(STUDIO_PRODUCT_OUTPUT);
  const box = await output.boundingBox();
  if (!box) throw new Error("The canvas needs a bounding box to draw on.");

  const vertices = page.locator('[data-testid^="studio-pen-vertex-"]');
  const moveHandle = page.getByTestId("studio-region-move");
  await expect(moveHandle, "the extent handles own the canvas before the pen does").toBeVisible();

  const at = (fx: number, fy: number) => ({
    x: box.x + box.width * fx,
    y: box.y + box.height * fy,
  });
  const corners = [at(0.35, 0.3), at(0.65, 0.3), at(0.5, 0.7)];

  const drawn = await expectToolcraftAcceptanceOutcome(
    async () => ({
      handlesShown: await moveHandle.isVisible(),
      vertices: await vertices.count(),
    }),
    async () => {
      await page
        .locator('[data-toolcraft-control-target="stack.pen"]')
        .getByRole("button", { name: "Draw" })
        .first()
        .click();
      for (const corner of corners) {
        await page.mouse.click(corner.x, corner.y);
      }
    },
    { evidenceType: "command-side-effect", requirementId: "stack.pen" },
  );

  // Three vertices placed, and the extent handles stood aside while they were:
  // a click that reached a resize node would have resized instead of drawing.
  expect(drawn).toEqual({ handlesShown: false, vertices: 3 });

  // Closing on the first vertex gives the canvas back and keeps the path.
  await page.mouse.click(corners[0]?.x ?? 0, corners[0]?.y ?? 0);
  await expect(moveHandle).toBeVisible();
  await expect(vertices).toHaveCount(3);

  // And the layer is now that shape: the field draws inside the triangle just
  // drawn and nowhere else. Read at the centroid, which is inside any triangle,
  // against a corner of the frame that the path does not reach.
  await expect
    .poll(
      async () =>
        page.locator(STUDIO_PRODUCT_OUTPUT).evaluate((node) => {
          const canvas = node as HTMLCanvasElement;
          const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
          if (!gl) return "nogl";
          const at = (fx: number, fy: number): string => {
            const width = 24;
            const height = 24;
            const pixels = new Uint8Array(width * height * 4);
            gl.readPixels(
              Math.round(canvas.width * fx) - width / 2,
              Math.round(canvas.height * fy) - height / 2,
              width,
              height,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              pixels,
            );
            const seen = new Set<string>();
            for (let index = 0; index < pixels.length; index += 4) {
              seen.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
            }
            return seen.size > 1 ? "field" : "ground";
          };
          // fy is flipped: readPixels counts from the bottom and the clicks
          // above were placed from the top.
          return `inside=${at(0.5, 1 - 0.44)} outside=${at(0.9, 1 - 0.1)}`;
        }),
      { timeout: 10_000 },
    )
    .toBe("inside=field outside=ground");
});

test("browser: studio pointer subject reaches every layer", async ({ page }) => {
  test.setTimeout(180_000);

  const { layerId, session } = await openStudioSingleLayer(page);
  await setStudioSlider(page, "Band count", 8);
  await setStudioSelectValue(page, "selectedLayer.engine", "Induction");
  await setStudioSlider(page, "Engine amount", 1);

  const output = page.locator(STUDIO_PRODUCT_OUTPUT);
  const box = await output.boundingBox();
  if (!box) throw new Error("The canvas needs a bounding box to aim a pointer at.");
  const aim = async (fraction: number): Promise<void> => {
    await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
    // One commit per frame, so the value the shader reads is a frame behind the
    // move that produced it.
    await page.waitForTimeout(200);
  };

  await aim(0.4);

  // The layer's own switch stays off throughout. That is the whole point: what
  // is being proved is that the stack-level choice reaches a layer that never
  // opted in, and a fixture that opted in first would prove nothing.
  await expectToolcraftSelectedLayerControl(
    session.observe(POINTER_REACH),
    session.controlAction("stack.pointerSubject", async () => {
      await setStudioSelectValue(page, "stack.pointerSubject", "Every layer");
      // Put back after the click, which left the canvas for the sidebar. An
      // engine following a pointer that has gone reaches nothing anywhere.
      await aim(0.4);
    }),
    {
      controlValue: { follow: "false", reach: "Everylayer" },
      outputSignature: "left=induced right=plain",
      selectedLayerId: layerId,
    },
    { requirementId: "stack.pointerSubject", target: "stack.pointerSubject" },
  );

  // And narrowing it again gives the layer back its own answer.
  //
  // That answer is *not* "no effect": a layer that does not follow the pointer
  // applies its engine evenly across the whole field, which reads as induced on
  // both sides. Following is what makes the effect local, so the difference
  // being proved is even-everywhere against strong-where-the-pointer-is -- and
  // the widened reading must not have written itself onto the layer.
  await expectToolcraftSelectedLayerControl(
    session.observe(POINTER_REACH),
    session.controlAction("stack.pointerSubject", async () => {
      await setStudioSelectValue(
        page,
        "stack.pointerSubject",
        "Layers that follow it",
      );
      await aim(0.4);
    }),
    {
      controlValue: { follow: "false", reach: "Layersthatfollowit" },
      outputSignature: "left=induced right=induced",
      selectedLayerId: layerId,
    },
    { requirementId: "stack.pointerSubject", target: "stack.pointerSubject" },
  );

  // The subject is a claim about the stack, not about the selection, so moving
  // the selection must move nothing.
  //
  // This is the failure the stack-level control exists to avoid: an effect that
  // lived on "whichever layer is selected" would follow the selection around,
  // and an author who clicked a row to look at its settings would find the
  // picture had changed underneath them. Read as the frame rather than as the
  // control, because a control that stayed put while the render followed the
  // selection is exactly what would slip through.
  await setStudioSelectValue(page, "stack.pointerSubject", "Every layer");
  await addStudioLayer(page);
  const pointerLayerIds = await readStudioLayerIds(page);
  expect(pointerLayerIds.length, "two layers, so the selection has somewhere to go")
    .toBe(2);

  await aim(0.4);
  const reaching = await settleStudioFrame(page);

  // The pointer is genuinely doing something at this state, or the equalities
  // below would hold over a frame nothing was reaching in the first place.
  await page.mouse.move(5, 5);
  await page.waitForTimeout(600);
  expect(
    await settleStudioFrame(page),
    "the pointer must be reaching the stack for this to prove anything",
  ).not.toBe(reaching);

  for (const id of [pointerLayerIds[0] ?? "", pointerLayerIds[1] ?? ""]) {
    await selectStudioLayer(page, id);
    await aim(0.4);
    await expect
      .poll(async () => readStudioOutputSignature(page), { timeout: 15_000 })
      .toBe(reaching);
  }
});

test("browser: studio pointer push displaces the field", async ({ page }) => {
  test.setTimeout(180_000);

  const { layerId, session } = await openStudioSingleLayer(page);
  // Dense enough that the sampled window holds a dozen boundaries. At the
  // default count a window holds one, and a single boundary sliding out of it
  // reads the same as the field vanishing.
  await setStudioSlider(page, "Band count", 60);

  // Reached through the stack-level subject rather than the layer's own switch.
  // That switch is gated on an engine being chosen, so opting in through it
  // would mean choosing an engine this proof does not otherwise need -- and the
  // displacement is not an engine effect, so the fixture should not imply one.
  await setStudioSelectValue(page, "stack.pointerSubject", "Every layer");

  const output = page.locator(STUDIO_PRODUCT_OUTPUT);
  const box = await output.boundingBox();
  if (!box) throw new Error("The canvas needs a bounding box to aim a pointer at.");
  const aim = async (fraction: number): Promise<void> => {
    await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
    await page.waitForTimeout(200);
  };

  await aim(0.35);

  // Read where the bands sit near the pointer against where they sit far from
  // it. A displacement moves the field rather than recolouring it, so what
  // changes is the position of the boundaries, and only on one side.
  const bandsNearPointer = async (): Promise<string> =>
    output.evaluate((node) => {
      const canvas = node as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
      if (!gl) return "absent";
      const read = (fx: number): string => {
        const width = 400;
        const x = Math.min(
          Math.max(Math.round(canvas.width * fx) - width / 2, 0),
          canvas.width - width,
        );
        const pixels = new Uint8Array(width * 4);
        gl.readPixels(
          x,
          Math.floor(canvas.height / 2),
          width,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        // Where the boundaries fall, not what colour they are.
        const edges: number[] = [];
        for (let index = 4; index < pixels.length; index += 4) {
          const delta =
            Math.abs(pixels[index]! - pixels[index - 4]!) +
            Math.abs(pixels[index + 1]! - pixels[index - 3]!) +
            Math.abs(pixels[index + 2]! - pixels[index - 2]!);
          if (delta > 60) edges.push(index / 4);
        }
        return edges.join(",");
      };
      return `${read(0.35)}|${read(0.85)}`;
    });

  // The evidence helper needs a baseline that holds still, and rightly: a frame
  // that was already moving could produce a "change" that had nothing to do
  // with the press. Three agreeing reads rather than two, because the frames
  // that move here are the ones a first draw is still catching up with and two
  // adjacent reads can agree in the gap between them.
  const recent: string[] = [];
  await expect
    .poll(
      async () => {
        recent.push(await getToolcraftProductObservableSnapshot(page));
        if (recent.length > 3) recent.shift();
        return recent.length === 3 && new Set(recent).size === 1;
      },
      { intervals: [300], timeout: 30_000 },
    )
    .toBe(true);

  const atRest = await bandsNearPointer();

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("stack.pointerPush", async () => {
      await setStudioSlider(page, "Pointer push", 1);
      // Put the pointer back: moving the slider left the canvas, and a pointer
      // that has gone pushes nothing anywhere.
      await aim(0.35);
    }),
    { requirementId: "stack.pointerPush" },
  );

  const pushed = await bandsNearPointer();
  const [nearRest, farRest] = atRest.split("|");
  const [nearPushed, farPushed] = pushed.split("|");

  expect(nearPushed, "the bands under the pointer should have moved").not.toBe(
    nearRest,
  );
  expect(farPushed, "the bands away from the pointer should not have").toBe(farRest);

  // And a pointer that has left the frame reaches nothing, whatever the amount
  // is set to — which is what keeps an export deterministic.
  //
  // Moved to the top-left corner rather than just past an edge. The commit
  // rides on a window pointermove and reads "inside" from the canvas box, so
  // the pointer has to land somewhere that is off the canvas *and* still in the
  // viewport — just past an edge is easily neither, and then no event fires,
  // the cursor is never committed as away, and the field stays pushed. That
  // reads as this assertion failing when what actually failed was the gesture.
  await page.mouse.move(5, 5);
  await page.waitForTimeout(600);
  expect(
    await bandsNearPointer(),
    "a pointer off the canvas should push nothing",
  ).toBe(atRest);

  expect(await readStudioSelectedLayerId(page)).toBe(layerId);

  // An exported still carries the field at rest, wherever the pointer is.
  //
  // Two exports, one with the pointer parked over the canvas at full push and
  // one with it away, decoded and compared pixel for pixel. Anything else and
  // two exports of one composition would differ by where the mouse happened to
  // be resting, and neither of them would be the composition.
  //
  // Dispatched rather than clicked, and that is the whole difficulty: pressing
  // the button with a real pointer moves the pointer to the button, which
  // commits the cursor away before the export runs and makes the comparison
  // trivially true. A dispatched click fires no pointermove, so the cursor is
  // still over the canvas when the artifact is rendered -- which is the state
  // the requirement is actually about.
  const exportedPixels = async (): Promise<string> => {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PNG" }).dispatchEvent("click");
    const { inspection } = await inspectToolcraftImageDownload({
      backgroundRgba: [0, 0, 0, 255],
      download: await download,
      page,
    });
    return inspection.decodedPixelHash;
  };

  await aim(0.35);
  const exportedWithPointer = await exportedPixels();

  await page.mouse.move(5, 5);
  await page.waitForTimeout(600);
  const exportedAtRest = await exportedPixels();

  expect(
    exportedWithPointer,
    "an export must not depend on where the pointer was left",
  ).toBe(exportedAtRest);
});
