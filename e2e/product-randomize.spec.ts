import { expect, type Page } from "@playwright/test";

import { appSchema } from "../src/app/app-schema";
import { STUDIO_RANDOMIZE_GROUPS } from "../src/app/studio-randomize";
import {
  openStudioSingleLayer,
  readStudioOutputSignature,
  toggleStudioSwitch,
} from "./studio-product-helpers";
import { test } from "./toolcraft-product-test";

/**
 * Randomize acceptance domain: the reroll, and the four locks that bound it.
 *
 * One file because it is one decision -- reroll this, keep that -- and because
 * the delivery catalog requires one acceptance domain per spec file, which is
 * also why the press is named `randomize.actions` rather than `stack.randomize`.
 *
 * Every claim here is about *restraint* rather than about randomness. That a
 * press produces a different composition is the easy half and the half a broken
 * implementation also passes; the half worth proving is that a locked group
 * survives it, and that one press is one undo.
 */

const RECORD_KEY = appSchema.persistence.key;

/**
 * The stored values of every layer, which is where a layer actually lives.
 *
 * Read from persistence rather than from the panel, because the panel shows one
 * layer at a time and a reroll writes all of them -- and because the claim a
 * lock makes is about values, not about what a control happens to display.
 */
async function readStudioRecord(
  page: Page,
): Promise<Record<string, { values?: Record<string, unknown> }>> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    // Nested under `state`, which is the shape the runtime writes. Reading
    // `values` from the top level returns undefined and every comparison below
    // then holds trivially -- a lock proof that passes because it is comparing
    // "{}" with "{}".
    const values =
      (JSON.parse(raw) as { state?: { values?: Record<string, unknown> } }).state
        ?.values ?? {};
    return (values["stack.layerRecord"] ?? {}) as Record<
      string,
      { values?: Record<string, unknown> }
    >;
  }, RECORD_KEY);
}

/** Just the uniforms one group owns, across every layer. */
async function readStudioGroupValues(
  page: Page,
  uniforms: readonly string[],
): Promise<string> {
  const record = await readStudioRecord(page);
  return JSON.stringify(
    Object.entries(record)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, entry]) => [
        id,
        uniforms.map((uniform) => entry.values?.[uniform] ?? null),
      ]),
  );
}

async function pressStudioRandomize(page: Page): Promise<void> {
  await page
    .locator('[data-toolcraft-control-target="randomize.actions"]')
    .getByRole("button", { name: "Randomize" })
    .first()
    .click();
}

test("browser: studio randomize moves the composition and one undo returns it", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await openStudioSingleLayer(page);

  const before = await readStudioRecord(page);
  const framedBefore = await readStudioOutputSignature(page);

  await pressStudioRandomize(page);

  // The values moved, and the frame moved with them. Reading both matters: a
  // reroll that wrote the record without projecting the controls would change
  // the stored values and leave the canvas exactly as it was, which is the
  // failure this product's two-places-per-layer design invites.
  await expect
    .poll(async () => JSON.stringify(await readStudioRecord(page)), {
      timeout: 15_000,
    })
    .not.toBe(JSON.stringify(before));
  await expect
    .poll(async () => readStudioOutputSignature(page), { timeout: 15_000 })
    .not.toBe(framedBefore);

  // Nothing left its declared range. Checked against the schema the panel
  // renders rather than against numbers written here, so this cannot pass by
  // agreeing with a stale copy of the ranges.
  const declared = new Map<string, { max?: number; min?: number }>();
  for (const section of appSchema.panels.controls?.sections ?? []) {
    for (const control of Object.values(section.controls ?? {})) {
      const target = String(control.target);
      if (!target.startsWith("selectedLayer.")) continue;
      declared.set(target.slice("selectedLayer.".length), {
        max: control.max as number | undefined,
        min: control.min as number | undefined,
      });
    }
  }
  for (const entry of Object.values(await readStudioRecord(page))) {
    for (const [uniform, value] of Object.entries(entry.values ?? {})) {
      const range = declared.get(uniform);
      if (!range || typeof value !== "number") continue;
      if (typeof range.min === "number") {
        expect(value, `${uniform} below its declared minimum`).toBeGreaterThanOrEqual(
          range.min,
        );
      }
      if (typeof range.max === "number") {
        expect(value, `${uniform} above its declared maximum`).toBeLessThanOrEqual(
          range.max,
        );
      }
    }
  }

  // And the frame is still a composition rather than a blank or a single flat
  // colour, which is the degenerate result a range error produces.
  const signature = await readStudioOutputSignature(page);
  expect(new Set(signature.split("|")).size).toBeGreaterThan(1);

  // One press, one undo. Two recorded writes would need two undos, and the
  // first would leave the record and the panel disagreeing about the layer.
  await page.keyboard.press("ControlOrMeta+z");
  await expect
    .poll(async () => JSON.stringify(await readStudioRecord(page)), {
      timeout: 15_000,
    })
    .toBe(JSON.stringify(before));
});

for (const group of STUDIO_RANDOMIZE_GROUPS) {
  const what = {
    engine: "the chromatic engine",
    field: "the band field",
    motion: "the drift",
    palette: "the inks",
  }[group.id];
  const others = STUDIO_RANDOMIZE_GROUPS.filter(
    (entry) => entry.id !== group.id,
  ).flatMap((entry) => entry.uniforms);

  test(`browser: studio randomize spares ${what} when it is locked`, async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await openStudioSingleLayer(page);

    // One reroll before the lock goes on, so the values being protected are
    // ones a reroll actually chose. Locking a fresh composition would compare
    // an empty record against an empty record and hold for the wrong reason --
    // which is exactly what happened when this was written the obvious way.
    await pressStudioRandomize(page);
    await expect
      .poll(async () => Object.keys(await readStudioRecord(page)).length, {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);

    await toggleStudioSwitch(page, group.lockTarget);

    const locked = await readStudioGroupValues(page, group.uniforms);
    const free = await readStudioGroupValues(page, others);
    expect(locked, "the protected values must exist before they are protected").not.toBe(
      "[]",
    );

    await pressStudioRandomize(page);

    // The unlocked groups moved. Without this the assertion below would pass
    // against a reroll that did nothing at all, which is the vacuous shape a
    // lock proof takes.
    await expect
      .poll(async () => readStudioGroupValues(page, others), { timeout: 15_000 })
      .not.toBe(free);

    expect(
      await readStudioGroupValues(page, group.uniforms),
      `${what} must survive a reroll while its lock is on`,
    ).toBe(locked);
  });
}
