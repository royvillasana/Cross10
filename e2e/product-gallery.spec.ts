import { expect, type Locator, type Page } from "@playwright/test";

import {
  addStudioGroup,
  addStudioLayer,
  chooseStudioComposition,
  dismissStudioOnboarding,
  openStudioSingleLayer,
  readStudioLayerIds,
  readStudioLayerVisible,
  readStudioOutputSignature,
  readStudioStackSignature,
  selectStudioLayer,
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
import { expectToolcraftControlApplicabilityState } from "./browser-control-applicability-evidence";
import { createToolcraftBrowserProofSession } from "./browser-proof-session";
import { importStudioImage, writeImportFixture } from "./studio-import-fixture";
import { test } from "./toolcraft-product-test";

/**
 * The four aims, and what each one makes visible.
 *
 * Declared once because both presses read the same aim. The aim is no longer a
 * control with a value domain -- it is whatever the layers panel has highlighted
 * -- so what varies here is which row is selected, and the expectation is about
 * which layers the press reaches.
 */
const STUDIO_APPLY_AIMS = [
  { kind: "layer", label: "the selected layer" },
  { kind: "group", label: "the selected group" },
] as const;

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

/**
 * The composite once it has stopped moving, so two frames can be compared.
 *
 * Every equality below compares two reads, and a read taken the instant a state
 * change resolves is of a frame the renderer has not finished with.
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

/** The panel's door into the flow that now owns the technique choice. */
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
  // One call, because the helper now answers the flow's own question: over
  // existing work it agrees to the replacement, over an empty canvas it confirms
  // the size. Both end with the technique on the canvas.
  await setStudioTechnique(page, label);
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

  // Every investigation is reachable, and each card says which one it is. Read
  // from the rendered names rather than from the list the test imported: a
  // series present in the data and missing from the surface is a library the
  // user cannot open, and the data alone cannot tell them apart.
  //
  // Read from the flow rather than the panel, because that is where choosing
  // lives now. The panel keeps only what edits work that already exists.
  await studioTechniqueButton(page, "Change the technique").click();
  const offered = await page
    .locator("[data-studio-onboarding-card]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label") ?? ""));
  await page.keyboard.press("Escape");

  expect(offered, "every entry is offered, plus the blank start").toHaveLength(
    entries.length + 1,
  );
  for (const series of STUDIO_SERIES_IDS) {
    expect(
      offered.some((name) => name.includes(STUDIO_SERIES[series].label)),
      `${STUDIO_SERIES[series].label} must be reachable`,
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
  // Restore brings it back.

  // Dismissing the flow drew nothing: the stack is still the author's own.
  expect(await readStudioLayerIds(page)).toEqual(before);

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

test("browser: studio reopens the flow from the panel", async ({ page }) => {
  test.setTimeout(300_000);

  await openStudioSingleLayer(page);
  const layersBefore = await readStudioLayerIds(page);
  const compositionBefore = await readSettledOutputSignature(page);

  // Two doors, one surface. Opening changes which step is showing and nothing
  // else -- the outcome reads the step, and the composition beside it is
  // asserted to have held still.
  await expectToolcraftAcceptanceOutcome(
    // Read through `evaluate` rather than a locator. `Locator.getAttribute`
    // *waits* for an element that is not there, so an absent dialog cost a full
    // timeout per read and the stability poll never finished -- a snapshot
    // reader has to answer immediately or it is not a snapshot.
    async () => ({
      composition: await readStudioOutputSignature(page),
      step: await page.evaluate(
        () =>
          document
            .querySelector("[data-studio-onboarding]")
            ?.getAttribute("data-studio-onboarding") ?? "closed",
      ),
    }),
    async () => {
      await studioTechniqueButton(page, "Change the technique").click();
    },
    { evidenceType: "command-side-effect", requirementId: "gallery.actions" },
  );

  await expect(page.locator("[data-studio-onboarding]")).toHaveAttribute(
    "data-studio-onboarding",
    "choosing",
  );
  expect(await readStudioLayerIds(page), "opening builds nothing").toEqual(
    layersBefore,
  );

  await page.keyboard.press("Escape");
  await studioTechniqueButton(page, "Work against a study").click();
  await expect(page.locator("[data-studio-onboarding]")).toHaveAttribute(
    "data-studio-onboarding",
    "reference",
  );

  await page.keyboard.press("Escape");
  await expect
    .poll(async () => readStudioOutputSignature(page), { timeout: 15_000 })
    .toBe(compositionBefore);
});

test("browser: studio asks before a technique replaces the work", async ({ page }) => {
  test.setTimeout(300_000);

  await openStudioSingleLayer(page);

  const authorIds = await readStudioLayerIds(page);
  const authorNames = await readStudioLayerNames(page);
  const authorFrame = await readSettledOutputSignature(page);
  expect(authorIds, "the fixture starts from one layer of the author's own").toHaveLength(1);

  const wide = STUDIO_PRESETS.find((preset) => preset.layers.length > 1);
  if (!wide) throw new Error("the library needs an entry of more than one layer");

  await studioTechniqueButton(page, "Change the technique").click();
  await page.locator(`[data-studio-onboarding-card="${wide.id}"]`).click();

  // A technique is a whole construction, so changing it over existing work is a
  // replacement and has to be agreed to. Choosing the card asks rather than acts.
  await expect(page.locator("[data-studio-onboarding]")).toHaveAttribute(
    "data-studio-onboarding",
    "replacing",
  );
  expect(
    await readStudioLayerIds(page),
    "the canvas must be untouched until the change is agreed to",
  ).toEqual(authorIds);
  expect(await readSettledOutputSignature(page)).toBe(authorFrame);

  // Declining changes nothing and goes back to the cards.
  await page.locator("[data-studio-onboarding-keep]").click();
  await expect(page.locator("[data-studio-onboarding]")).toHaveAttribute(
    "data-studio-onboarding",
    "choosing",
  );
  expect(await readStudioLayerIds(page)).toEqual(authorIds);
  expect(await readStudioLayerNames(page)).toEqual(authorNames);
  expect(await readSettledOutputSignature(page)).toBe(authorFrame);

  // Agreeing replaces it.
  await page.locator(`[data-studio-onboarding-card="${wide.id}"]`).click();
  await page.locator("[data-studio-onboarding-replace]").click();
  await expect
    .poll(async () => readStudioLayerNames(page), { timeout: 15_000 })
    .toEqual(wide.layers.map((layer) => layer.name));

  // And agreeing is not agreeing to lose the work.
  await studioRestoreButton(page).click();
  await expect
    .poll(async () => readStudioLayerIds(page), { timeout: 15_000 })
    .toEqual(authorIds);
});

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

test("browser: studio gallery aims an entry at one layer", async ({ page }) => {
  test.setTimeout(300_000);
  writeImportFixture();

  // Cleared once and reloaded, rather than through an init script. An init
  // script runs on *every* navigation, so it also wiped storage on the reload
  // that opening a proof session performs -- which threw away the marker saying
  // the flow had been answered, and threw away the fixture's own ids with it.
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();
  await dismissStudioOnboarding(page);

  // The session before the fixture, not after: opening one reloads the page, and
  // a fixture built first would have to survive that reload.
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
  // The panel's picker, not the flow: this names what the narrow press pushes
  // and applies nothing, which is what leaves the fixture standing.
  await chooseStudioComposition(page, engineEntry.label);

  const pressEngine = async (): Promise<void> => {
    await page
      .locator('[data-toolcraft-control-target="gallery.engineActions"]')
      .getByRole("button", { name: "Apply to the selection" })
      .first()
      .click();
  };

  for (const aim of [
    {
      // A layer row selected: only that layer changes, and the picture beside
      // it does not.
      changes: looseLayerId,
      kind: STUDIO_APPLY_AIMS[0],
      select: looseLayerId,
      untouched: pictureLayerId,
    },
    {
      // A group row selected: the layer inside it changes, the one outside does
      // not. Selecting the group *row* is what says "the group" now -- there is
      // no second control that could say otherwise.
      changes: groupedLayerId,
      kind: STUDIO_APPLY_AIMS[1],
      select: groupId,
      untouched: pictureLayerId,
    },
    {
      // A picture row selected: it is restyled and stays a picture. Reached the
      // same way as any other layer, because it is one.
      changes: pictureLayerId,
      kind: STUDIO_APPLY_AIMS[0],
      select: pictureLayerId,
      untouched: groupedLayerId,
    },
  ]) {
    await selectStudioLayer(page, aim.select);

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
      { requirementId: "gallery.engineActions" },
    );

    // Nothing was created, removed, or reordered: a narrow aim restyles layers
    // that already exist, and that is the whole of what makes it additive.
    expect(
      await readStudioLayerIds(page),
      `${aim.kind.label}: an aimed application must not touch the layer list`,
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
      `${aim.kind.label}: a layer the aim did not name must render exactly as it did`,
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

/**
 * With nothing selected there is nothing to apply to, and the press says so by
 * doing nothing.
 *
 * **"Not offered" is the claim this cannot make, and the reason is worth
 * keeping.** An applicability predicate may only name a rendered control's
 * target, and what is selected in the layers panel is runtime state with no
 * control of its own — so the button cannot be hidden or disabled on it. What is
 * expressible is that pressing it is inert, which is asserted here on the frame
 * rather than on the handler: an author who presses it gets nothing, which is
 * the same outcome a disabled button would have produced, arrived at one step
 * later than it should be.
 *
 * Filed as part of the applicability gap already recorded upstream.
 */
test("browser: studio offers no application when nothing is selected", async ({
  page,
}) => {
  test.setTimeout(120_000);

  // An empty stack, reached by answering the flow with "start from nothing".
  // That is the honest way to have no selection: the runtime owns selection and
  // there is no gesture that clears it, so the state to test is the one an
  // author actually lands in before they have made anything.
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await expect(page.locator(STUDIO_PRODUCT_OUTPUT)).toBeVisible();
  await dismissStudioOnboarding(page);
  expect(await readStudioLayerIds(page)).toHaveLength(0);

  const before = await readStudioOutputSignature(page);

  await page
    .locator('[data-toolcraft-control-target="gallery.engineActions"]')
    .getByRole("button", { name: "Apply to the selection" })
    .first()
    .click();

  // Nothing appeared, and nothing was drawn. An application that fell back to
  // "the whole canvas" when it could not find a subject would create layers here
  // -- which is exactly the behaviour that was removed, and the failure mode a
  // press with no aim invites.
  expect(
    await readStudioLayerIds(page),
    "a press with no subject must not create anything",
  ).toHaveLength(0);
  expect(
    await readStudioOutputSignature(page),
    "a press with no subject must not change the frame",
  ).toBe(before);
});
