import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { STUDIO_PRESETS, planStudioPresetApplication } from "./studio-presets";
import {
  STUDIO_SNAPSHOT_TARGET,
  readStudioStackSnapshot,
} from "./studio-stack-state";

const appDir = dirname(fileURLToPath(import.meta.url));

/**
 * Every `controls.setValue` a module dispatches, with the history mode it asked
 * for.
 *
 * Read from the source rather than from a rendered component because the thing
 * being checked is a property of the *dispatch*, and a test that rendered the
 * hook would prove one code path took it while leaving the next one free to
 * forget.
 */
function readDispatchedHistoryModes(fileName: string): readonly (string | null)[] {
  const path = join(appDir, fileName);
  const sourceFile = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const modes: (string | null)[] = [];

  const propertyName = (property: ts.ObjectLiteralElementLike): string | undefined =>
    property.name && (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))
      ? property.name.text
      : undefined;

  function visit(node: ts.Node): void {
    if (ts.isObjectLiteralExpression(node)) {
      const isSetValue = node.properties.some(
        (property) =>
          ts.isPropertyAssignment(property) &&
          propertyName(property) === "type" &&
          ts.isStringLiteralLike(property.initializer) &&
          property.initializer.text === "controls.setValue",
      );

      if (isSetValue) {
        const history = node.properties.find(
          (property) =>
            ts.isPropertyAssignment(property) && propertyName(property) === "history",
        );
        modes.push(
          history &&
            ts.isPropertyAssignment(history) &&
            ts.isStringLiteralLike(history.initializer)
            ? history.initializer.text
            : null,
        );
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return modes;
}

describe("the undo stack carries edits and nothing else", () => {
  it("keeps every derived write out of the undo stack", () => {
    // The defect this guards against was not subtle in its effect and was
    // invisible in its cause: Undo did nothing anywhere in the app, for any
    // edit, because these two modules put derived state on the stack. The
    // sync's record write is the *consequence* of a control edit the runtime
    // has already recorded, and the cursor commit is where the pointer is --
    // which changes every time a button is clicked, including the Undo button
    // that was trying to pop it.
    //
    // So the rule is per dispatch rather than per module: any write from either
    // of these has to say `skip`, and a new one that forgets fails here rather
    // than silently emptying the meaning of the toolbar.
    for (const fileName of ["studio-layer-sync.ts", "studio-canvas.tsx"]) {
      const modes = readDispatchedHistoryModes(fileName);

      expect(modes.length, `${fileName} should still dispatch derived writes`).toBeGreaterThan(
        0,
      );
      expect(modes, `${fileName} writes derived state, so none of it is history`).toEqual(
        modes.map(() => "skip"),
      );
    }
  });

  it("leaves an author's own commands recorded", () => {
    // The other half, and the reason this is not a blanket rule: applying a
    // preset and duplicating a layer are edits, so their record writes stay on
    // the stack.
    //
    // **This assertion is weaker than it looks, and used to be read as more.**
    // It says the record write is recorded, and that is all it says. The layer
    // list is not a control write at all, so nothing here ever looked at it —
    // which is how a green suite sat over an apply whose previous stack no
    // number of Undo presses could reach. What actually covers that is the
    // test below and `studio-snapshot.test.ts`.
    const modes = readDispatchedHistoryModes("app-composition.tsx");

    expect(modes.length).toBeGreaterThan(0);
    expect(modes).toEqual(modes.map(() => null));
  });
});

describe("what undo cannot reach, the product holds instead", () => {
  it("takes the snapshot before the first layer is removed", () => {
    // The ordering is the whole guarantee. A snapshot taken after the deletes
    // records a stack that has already gone, and would restore the applied
    // stack over itself.
    const preset = STUDIO_PRESETS[0];
    if (!preset) throw new Error("the library needs at least one entry");

    const commands = planStudioPresetApplication({
      layers: [{ id: "before", visible: true }],
      preset,
      record: { before: { typeId: "stripes", values: { angle: 30 } } },
      selectedLayerId: "before",
    });

    const snapshotAt = commands.findIndex(
      (command) => command.target === STUDIO_SNAPSHOT_TARGET,
    );
    const firstDeleteAt = commands.findIndex(
      (command) => command.type === "layers.delete",
    );

    expect(snapshotAt).toBeGreaterThanOrEqual(0);
    expect(firstDeleteAt).toBeGreaterThan(snapshotAt);
  });

  it("captures what the stack looked like, not merely that there was one", () => {
    const preset = STUDIO_PRESETS[0];
    if (!preset) throw new Error("the library needs at least one entry");

    const [snapshotWrite] = planStudioPresetApplication({
      layers: [{ id: "before", name: "Before", visible: true }],
      preset,
      record: { before: { typeId: "stripes", values: { angle: 30 } } },
      selectedLayerId: "before",
    });

    const snapshot = readStudioStackSnapshot(snapshotWrite?.value);
    expect(snapshot?.layers).toHaveLength(1);
    expect(snapshot?.layers[0]?.entry).toEqual({
      typeId: "stripes",
      values: { angle: 30 },
    });
    expect(snapshot?.selectedLayerId).toBe("before");
  });

  it("records no snapshot when there is no work to overwrite", () => {
    const preset = STUDIO_PRESETS[0];
    if (!preset) throw new Error("the library needs at least one entry");

    const commands = planStudioPresetApplication({
      layers: [],
      preset,
      record: {},
      selectedLayerId: null,
    });

    expect(
      commands.some((command) => command.target === STUDIO_SNAPSHOT_TARGET),
    ).toBe(false);
  });
});
