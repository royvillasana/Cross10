import { expect, type Locator, type Page } from "@playwright/test";

import {
  addStudioGroup,
  addStudioLayer,
  openStudioSingleLayer,
  readStudioLayerIds,
  readStudioLayerVisible,
  readStudioOutputSignature,
  readStudioStackSignature,
  selectStudioLayer,
  setStudioSelectValue,
  setStudioSlider,
  setStudioTechnique,
  readStudioTechnique,
  toggleStudioLayerVisibility,
  STUDIO_PRODUCT_OUTPUT,
} from "./studio-product-helpers";
import {
  STUDIO_PRESETS,
  STUDIO_SERIES,
  STUDIO_SERIES_IDS,
} from "../src/app/studio-presets";
import { expectToolcraftAcceptanceOutcome } from "./browser-acceptance-outcome-helpers";
import {
  expectToolcraftProductObservableToChange,
  getToolcraftProductObservableSnapshot,
} from "./product-observable-helpers";
import { getToolcraftApplicabilityRequirementId } from "../src/app/app-acceptance";
import { expectToolcraftControlApplicabilityState } from "./browser-control-applicability-evidence";
import { createToolcraftBrowserProofSession } from "./browser-proof-session";
import { importStudioImage, writeImportFixture } from "./studio-import-fixture";
import { test } from "./toolcraft-product-test";

/**
 * The four aims, and what each one makes visible.
 *
 * Declared once because both gated presses owe a case per aim: a gated control
 * has to be proved present under every value that qualifies it and absent under
 * every value that does not, and the aim's own four values are that domain.
 */
const STUDIO_APPLY_TARGETS = [
  { label: "The whole canvas", value: "canvas" },
  { label: "The selected layer", value: "layer" },
  { label: "The selected group", value: "group" },
  { label: "The pictures", value: "image" },
] as const;

function studioApplyTargetCase(
  target: (typeof STUDIO_APPLY_TARGETS)[number],
  control: string,
  expectation: "hidden" | "visible",
) {
  return {
    expectation,
    selectorControlType: "select" as const,
    selectorLabel: "Apply it to",
    selectorOptionLabel: target.label,
    selectorTarget: "gallery.target",
    selectorValue: target.value,
    target: control,
  };
}

/**
 * Gallery acceptance domain.
 *
 * The library is the one place in this product where ten separate compositions
 * claim to be compositions, so the proof walks all of them rather than sampling
 * two. A preset that failed to render would look exactly like one nobody had
 * proved, and the reading below is chosen to catch precisely that: the stack the
 * renderer assembled, the rows the panel shows, and whether the frame carries
 * more than one colour.
 */

/** The names the panel is showing, top row first. */
async function readStudioLayerNames(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-layer-id]")).map((row) =>
      (row.textContent ?? "").trim(),
    ),
  );
}

/** How many distinct colours the middle row carries, which is what "drew" means. */
async function readStudioColourVariety(page: Page): Promise<number> {
  return page.locator(STUDIO_PRODUCT_OUTPUT).evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) return 0;
    const width = Math.min(canvas.width, 600);
    const pixels = new Uint8Array(width * 4);
    gl.readPixels(
      Math.floor((canvas.width - width) / 2),
      Math.floor(canvas.height / 2),
      width,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    const seen = new Set<string>();
    for (let index = 0; index < pixels.length; index += 4) {
      seen.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
    }
    return seen.size;
  });
}

/**
 * Waits until the frame stops changing.
 *
 * The evidence helper requires a baseline that holds still before the action --
 * rightly, since a canvas that was already moving could produce a "change" that
 * had nothing to do with the press. Under a loaded suite the first frames after
 * a fixture is built are still settling, so the wait is explicit rather than
 * assumed: two consecutive reads that agree.
 */
async function settleStudioOutput(page: Page): Promise<void> {
  const recent: string[] = [];
  await expect
    .poll(
      async () => {
        recent.push(await getToolcraftProductObservableSnapshot(page));
        if (recent.length > 3) recent.shift();
        // Three in a row rather than two, and over a window rather than back to
        // back: the frames that move under a loaded suite are the ones a
        // resize or a first draw is still catching up with, and two adjacent
        // reads can agree in the gap between them.
        return recent.length === 3 && new Set(recent).size === 1;
      },
      { intervals: [300], timeout: 30_000 },
    )
    .toBe(true);
}

/** The press that offers a technique change, and the two that answer it. */
function studioTechniqueButton(page: Page, name: string): Locator {
  return page
    .locator('[data-toolcraft-control-target="gallery.actions"]')
    .getByRole("button", { name })
    .first();
}

function studioRestoreButton(page: Page): Locator {
  return page
    .locator('[data-toolcraft-control-target="gallery.restore"]')
    .getByRole("button", { name: "Restore previous" })
    .first();
}

/**
 * A technique change carried all the way out.
 *
 * Both presses, deliberately, and it is correct either way round: over existing
 * work the first press only offers and the second replaces, and over an empty
 * canvas the first press applies and clears the offer, which leaves the second
 * with nothing to confirm and nothing to do.
 */
async function applyStudioPreset(page: Page, label: string): Promise<void> {
  await setStudioTechnique(page, label);
  await studioTechniqueButton(page, "Change the technique").click();
  await studioTechniqueButton(page, "replace my work").click();
}

test("browser: studio gallery applies a composition and leaves every control live", async ({
  page,
}) => {
  test.setTimeout(300_000);

  const { session } = await openStudioSingleLayer(page);
  const before = await readStudioLayerIds(page);
  expect(before, "the fixture starts from one layer of the author's own").toHaveLength(1);

  // The library as the product declares it rather than a copy of the list: a
  // test carrying its own would keep passing after an entry was added and never
  // covered, which is the failure `optionCoverage: "each-visible-item"` exists
  // to prevent.
  const entries = STUDIO_PRESETS;
  expect(entries.length, "the library should offer every built-in composition").toBeGreaterThan(1);

  // Every investigation is reachable from the picker, and each item says which
  // one it is. Read from the rendered names rather than from the list the test
  // imported: a series present in the data and missing from the panel is a
  // library the user cannot open, and the data alone cannot tell them apart.
  const offered = await page
    .locator('[data-toolcraft-control-target="gallery.entry"]')
    .getByRole("button")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label") ?? ""),
    );

  expect(offered, "every entry is offered").toHaveLength(entries.length);
  for (const series of STUDIO_SERIES_IDS) {
    expect(
      offered.some((name) => name.includes(STUDIO_SERIES[series].label)),
      `${STUDIO_SERIES[series].label} must be reachable from the picker`,
    ).toBe(true);
  }

  // And the four the canvas can only evoke say so where they are offered,
  // rather than in a comment nobody reads.
  for (const preset of entries) {
    const evoked = STUDIO_SERIES[preset.series].carriage === "evoke";
    expect(
      offered.some(
        (name) => name.startsWith(`${preset.label} —`) && name.includes("evoking"),
      ),
      `${preset.id} should ${evoked ? "" : "not "}be offered as an evocation`,
    ).toBe(evoked);
  }

  // **Undo is still not asserted here, and the reason is still a framework
  // defect rather than a choice.** Applying a preset is several runtime layer
  // commands, and `layers.*` carries no `history` or `historyGroup` -- only
  // `controls.setValue` and `canvas.applySettings` do -- so the deletes and adds
  // are separate entries and no press count reaches the stack underneath.
  // Recorded as issue 7 in `docs/upstream/toolcraft-0.0.18-issues.md`.
  //
  // What *is* asserted, in the proof below this one, is the product's own answer
  // to it: the stack is snapshotted before the application and one press of
  // Restore brings it back. That is the recoverable behaviour a user needs;
  // undo remains the framework's to fix.

  // The first application carries the row's evidence: choosing an entry is one
  // claim and applying it is another, so each is made through the recipe that
  // fits it -- a command side effect for the picker, a change in the product's
  // own output for the action.
  const first = STUDIO_PRESETS[0];
  const second = STUDIO_PRESETS[1];
  if (!first || !second) throw new Error("the library needs at least two entries");

  // What the picker changes is what Apply will bring in, and the stack it will
  // replace is untouched until then -- so the outcome reads both: the entry the
  // gallery now names, and the layers still standing.
  await expectToolcraftAcceptanceOutcome(
    async () => ({
      entry: await readStudioTechnique(page),
      layers: (await readStudioLayerIds(page)).join(","),
    }),
    async () => {
      await setStudioTechnique(page, second.label);
    },
    { evidenceType: "command-side-effect", requirementId: "gallery.entry" },
  );

  // Naming an entry drew nothing: the stack is still the author's own.
  expect(await readStudioLayerIds(page)).toEqual(before);

  await setStudioTechnique(page, first.label);

  // The press itself is proved in the confirmation test below, which is where
  // the row's evidence lives: `gallery.actions` is gated on the aim, so its
  // outcome has to be shown under the aim that makes it visible rather than on
  // its own.
  await applyStudioPreset(page, first.label);

  // Every entry, applied in turn. Each one has to replace the stack with rows
  // of its own and draw something: a preset whose layers arrived but rendered
  // one flat colour would pass a row count and fail here.
  for (const entry of entries) {
    await applyStudioPreset(page, entry.label);

    await expect
      .poll(async () => (await readStudioLayerNames(page)).length, { timeout: 15_000 })
      .toBeGreaterThan(0);

    // The rows the preset names. Measured rather than assumed: this panel lists
    // them in draw order, so the first row is the bottom of the stack.
    await expect
      .poll(async () => readStudioLayerNames(page), { timeout: 15_000 })
      .toEqual(entry.layers.map((layer) => layer.name));
    expect(
      await readStudioStackSignature(page),
      `${entry.label} should assemble the stack it names`,
    ).toBe(entry.layers.map((layer) => layer.typeId).join(">"));
    await expect
      .poll(async () => readStudioColourVariety(page), { timeout: 15_000 })
      .toBeGreaterThan(2);
  }

  // Live, not loaded: a preset is a starting point, so a control moves the
  // picture it just set rather than being overridden by it. Proved on a band
  // field and with the band count, because the reading is the number of
  // distinct colours across a row and cutting forty-eight bands to four has to
  // move it -- an edit that merely turned the field could leave it where it was.
  await applyStudioPreset(page, "Additive Bands");
  const beforeEdit = await readStudioColourVariety(page);
  await setStudioSlider(page, "Band count", 4);
  await expect
    .poll(async () => readStudioColourVariety(page), { timeout: 15_000 })
    .toBeLessThan(beforeEdit);

});

test("browser: studio gallery restores the stack an application replaced", async ({
  page,
}) => {
  test.setTimeout(300_000);

  await openStudioSingleLayer(page);

  // The stack the author had. Names as well as ids, because a restore that
  // rebuilt the right number of layers under the wrong names would still have
  // lost the thing the author recognises.
  const authorIds = await readStudioLayerIds(page);
  const authorNames = await readStudioLayerNames(page);
  expect(authorIds, "the fixture starts from one layer of the author's own").toHaveLength(1);

  const wide = STUDIO_PRESETS.find((preset) => preset.layers.length > 1);
  if (!wide) throw new Error("the library needs an entry of more than one layer");

  await applyStudioPreset(page, wide.label);
  await expect
    .poll(async () => readStudioLayerNames(page), { timeout: 15_000 })
    .toEqual(wide.layers.map((layer) => layer.name));

  // One press, not one per layer. The defect being fixed is that undo needed
  // N+M presses and still did not arrive, so a restore that scaled with the
  // stack would not have been a fix.
  await studioRestoreButton(page).click();

  await expect
    .poll(async () => readStudioLayerIds(page), { timeout: 15_000 })
    .toEqual(authorIds);
  expect(
    await readStudioLayerNames(page),
    "the restored stack should carry the author's own names",
  ).toEqual(authorNames);

  // And it draws. A stack whose rows returned but whose values did not would
  // list correctly and render nothing, which is the failure a row count alone
  // cannot see.
  await expect
    .poll(async () => readStudioColourVariety(page), { timeout: 15_000 })
    .toBeGreaterThan(1);

  // No intermediate resting state: restoring again does nothing, because the
  // snapshot was cleared by the restore that used it. Offering it twice would
  // let a second press rebuild a stack the author had already come back from.
  await studioRestoreButton(page).click();

  expect(
    await readStudioLayerIds(page),
    "a spent snapshot should restore nothing",
  ).toEqual(authorIds);
});

test("browser: studio gallery confirms before it replaces the work", async ({ page }) => {
  test.setTimeout(300_000);

  const { session } = await openStudioSingleLayer(page);

  const authorIds = await readStudioLayerIds(page);
  const authorNames = await readStudioLayerNames(page);
  const authorFrame = await readSettledOutputSignature(page);
  expect(authorIds, "the fixture starts from one layer of the author's own").toHaveLength(1);

  const wide = STUDIO_PRESETS.find((preset) => preset.layers.length > 1);
  if (!wide) throw new Error("the library needs an entry of more than one layer");

  await setStudioTechnique(page, wide.label);

  // The destructive press is offered for one aim and no other. Aiming anywhere
  // narrower is an additive operation, and a press that replaces the whole
  // composition must not be reachable from it -- so it is *absent* rather than
  // present and inert.
  for (const target of STUDIO_APPLY_TARGETS) {
    if (target.value === "canvas") continue;
    await expectToolcraftControlApplicabilityState(
      session,
      session.controlAction("gallery.target", async () => {
        await setStudioSelectValue(page, "gallery.target", target.label);
      }),
      studioApplyTargetCase(target, "gallery.actions", "hidden"),
      { baseRequirementId: "gallery.apply" },
    );
  }

  const canvasTarget = STUDIO_APPLY_TARGETS[0];
  await expectToolcraftControlApplicabilityState(
    session,
    session.controlAction("gallery.target", async () => {
      await setStudioSelectValue(page, "gallery.target", canvasTarget.label);
    }),
    studioApplyTargetCase(canvasTarget, "gallery.actions", "visible"),
    { baseRequirementId: "gallery.apply" },
  );

  // The offer changes nothing. Asserted on the layer list *and* on the frame:
  // an offer that quietly wrote the record would leave the rows alone and
  // repaint the canvas, which a row count cannot see.
  await studioTechniqueButton(page, "Change the technique").click();
  expect(
    await readStudioLayerIds(page),
    "the canvas must be untouched until the change is confirmed",
  ).toEqual(authorIds);
  expect(await readSettledOutputSignature(page)).toBe(authorFrame);

  // Declining changes nothing either, and leaves the technique the canvas is in
  // where it was.
  await studioTechniqueButton(page, "Keep my work").click();
  expect(await readStudioLayerIds(page)).toEqual(authorIds);
  expect(await readStudioLayerNames(page)).toEqual(authorNames);
  expect(await readSettledOutputSignature(page)).toBe(authorFrame);

  // And a declined offer is spent: the next single press has to ask again
  // rather than carrying out the change that was just refused.
  await studioTechniqueButton(page, "Change the technique").click();
  expect(
    await readStudioLayerIds(page),
    "a refused offer must not leave the change armed",
  ).toEqual(authorIds);

  // The evidence is taken over the confirming press, which is the one that
  // actually replaces the stack. Taking it over the offering press would have
  // recorded a change the offer is required not to make.
  await settleStudioOutput(page);
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("gallery.actions", async () => {
      await studioTechniqueButton(page, "replace my work").click();
    }),
    {
      requirementId: getToolcraftApplicabilityRequirementId(
        "gallery.apply",
        studioApplyTargetCase(canvasTarget, "gallery.actions", "visible"),
      ),
    },
  );
  await expect
    .poll(async () => readStudioLayerNames(page), { timeout: 15_000 })
    .toEqual(wide.layers.map((layer) => layer.name));

  // Confirming is agreeing to proceed, not agreeing to lose the work.
  await studioRestoreButton(page).click();
  await expect
    .poll(async () => readStudioLayerIds(page), { timeout: 15_000 })
    .toEqual(authorIds);
});


/**
 * The composite once it has stopped moving.
 *
 * Every equality assertion below compares two frames, so both have to be frames
 * the renderer has finished with. A read taken the instant a state change
 * resolves is not: the panel commits, the pass redraws, and under a loaded
 * suite those are far enough apart to catch a half-drawn frame and report a
 * difference nothing in the product caused.
 */
async function readSettledOutputSignature(page: Page): Promise<string> {
  const recent: string[] = [];
  await expect
    .poll(
      async () => {
        recent.push(await readStudioOutputSignature(page));
        if (recent.length > 3) recent.shift();
        return recent.length === 3 && new Set(recent).size === 1;
      },
      { intervals: [200], timeout: 30_000 },
    )
    .toBe(true);
  return recent[recent.length - 1] ?? "";
}

/** The composite with one layer of the stack hidden, then put back. */
async function readStudioStackWithout(page: Page, hidden: string): Promise<string> {
  await toggleStudioLayerVisibility(page, hidden);
  await expect
    .poll(async () => readStudioLayerVisible(page, hidden), { timeout: 15_000 })
    .toBe(false);
  const signature = await readSettledOutputSignature(page);
  await toggleStudioLayerVisibility(page, hidden);
  await expect
    .poll(async () => readStudioLayerVisible(page, hidden), { timeout: 15_000 })
    .toBe(true);
  return signature;
}

/**
 * Aiming an entry at something narrower than the canvas.
 *
 * One test rather than three because the three aims share a fixture and the
 * claim that matters is the same each time: the layers the aim names change and
 * the layers it does not name are pixel-identical afterwards. Building three
 * fixtures would have proved that claim three times over three different stacks
 * and never once over a stack containing all three kinds of target.
 *
 * The fixture is built rather than taken from a helper because no helper has
 * all of it: a picture, a group with a layer inside it, and a plain layer
 * outside both. Each of the three aims needs one of those to change and at
 * least one of the others to stay exactly as it was.
 */
test("browser: studio gallery aims an entry at one layer", async ({ page }) => {
  test.setTimeout(300_000);
  writeImportFixture();

  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await page.goto("/");
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();

  // The session before the fixture, not after: opening one reloads the page,
  // and this test clears storage on load, so a session opened afterwards would
  // wipe the stack it was about to prove things about.
  const session = await createToolcraftBrowserProofSession(page);

  await importStudioImage(page);
  await expect
    .poll(async () => readStudioStackSignature(page), { timeout: 15_000 })
    .toContain("image");
  const pictureLayerId = (await readStudioLayerIds(page))[0] ?? "";

  // A plain layer outside everything, then a group with a layer inside it. The
  // group becomes the selection when it is added, so the layer added after it
  // lands inside.
  await addStudioLayer(page);
  const looseLayerId =
    (await readStudioLayerIds(page)).find((id) => id !== pictureLayerId) ?? "";
  await addStudioGroup(page);
  const groupId =
    (await readStudioLayerIds(page)).find(
      (id) => id !== pictureLayerId && id !== looseLayerId,
    ) ?? "";
  await addStudioLayer(page);
  const groupedLayerId =
    (await readStudioLayerIds(page)).find(
      (id) => id !== pictureLayerId && id !== looseLayerId && id !== groupId,
    ) ?? "";

  expect(
    [pictureLayerId, looseLayerId, groupId, groupedLayerId].every(Boolean),
    "the fixture needs a picture, a loose layer, a group, and a layer inside it",
  ).toBe(true);

  const engineEntry = STUDIO_PRESETS.find((preset) =>
    preset.layers.some((layer) => typeof layer.values.engine === "string"),
  );
  if (!engineEntry) throw new Error("the library needs an entry carrying an engine");
  await setStudioTechnique(page, engineEntry.label);

  // Aimed at the canvas, the additive press is not offered at all. It is absent
  // rather than disabled, because the canvas aim is a replacement and adding to
  // the work is not one of the things it can do.
  await expectToolcraftControlApplicabilityState(
    session,
    session.controlAction("gallery.target", async () => {
      await setStudioSelectValue(page, "gallery.target", "The whole canvas");
    }),
    studioApplyTargetCase(STUDIO_APPLY_TARGETS[0], "gallery.engineActions", "hidden"),
    { baseRequirementId: "gallery.engineActions" },
  );

  const pressEngine = async (): Promise<void> => {
    await page
      .locator('[data-toolcraft-control-target="gallery.engineActions"]')
      .getByRole("button", { name: "Apply to the selection" })
      .first()
      .click();
  };

  for (const aim of [
    {
      // The selected layer: only it changes, and the picture beside it does not.
      changes: looseLayerId,
      select: looseLayerId,
      target: STUDIO_APPLY_TARGETS[1],
      untouched: pictureLayerId,
    },
    {
      // The selected group: the layer inside it changes, the one outside does not.
      changes: groupedLayerId,
      select: groupId,
      target: STUDIO_APPLY_TARGETS[2],
      untouched: pictureLayerId,
    },
    {
      // The pictures: the imported layer is restyled and stays a picture.
      changes: pictureLayerId,
      select: pictureLayerId,
      target: STUDIO_APPLY_TARGETS[3],
      untouched: groupedLayerId,
    },
  ]) {
    await selectStudioLayer(page, aim.select);

    await expectToolcraftControlApplicabilityState(
      session,
      session.controlAction("gallery.target", async () => {
        await setStudioSelectValue(page, "gallery.target", aim.target.label);
      }),
      studioApplyTargetCase(aim.target, "gallery.engineActions", "visible"),
      { baseRequirementId: "gallery.engineActions" },
    );

    // Each layer as it draws with the other one out of the way, so the two
    // claims below are about layers rather than about a composite in which
    // either could have moved.
    const changesBefore = await readStudioStackWithout(page, aim.untouched);
    const untouchedBefore = await readStudioStackWithout(page, aim.changes);
    const idsBefore = await readStudioLayerIds(page);

    await settleStudioOutput(page);
    await expectToolcraftProductObservableToChange(
      session,
      session.controlAction("gallery.engineActions", pressEngine),
      {
        requirementId: getToolcraftApplicabilityRequirementId(
          "gallery.engineActions",
          studioApplyTargetCase(aim.target, "gallery.engineActions", "visible"),
        ),
      },
    );

    // Nothing was created, removed, or reordered: a narrow aim restyles layers
    // that already exist, and that is the whole of what makes it additive.
    expect(
      await readStudioLayerIds(page),
      `${aim.target.value}: an aimed application must not touch the layer list`,
    ).toEqual(idsBefore);

    await expect
      .poll(async () => readStudioStackWithout(page, aim.untouched), {
        timeout: 30_000,
      })
      .not.toBe(changesBefore);

    // The assertion the whole aim exists for: an application that repainted the
    // layers it was aimed at *and* their neighbours would pass every reading
    // above this one.
    expect(
      await readStudioStackWithout(page, aim.changes),
      `${aim.target.value}: a layer the aim did not name must render exactly as it did`,
    ).toBe(untouchedBefore);
  }

  // The picture is still a picture. Applying an entry built out of band fields
  // restyles it -- the engine, the treatment and the blending land -- and does
  // not turn it into the bands, because a value the layer's own kind has no
  // uniform for is dropped rather than stored.
  await expect
    .poll(async () => readStudioStackSignature(page), { timeout: 15_000 })
    .toContain("image");
});
