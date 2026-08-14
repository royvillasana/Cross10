import { describe, expect, it } from "vitest";

import { readStudioShortcut, STUDIO_SHORTCUT_KEYS } from "./studio-shortcuts";
import {
  planStudioPenDrawing,
  STUDIO_PEN_TARGET,
  STUDIO_VERTEX_PATH_TARGET,
} from "./studio-stack-state";

const KEY_EVENT = {
  altKey: false,
  ctrlKey: false,
  defaultPrevented: false,
  key: STUDIO_SHORTCUT_KEYS.pen,
  metaKey: false,
  repeat: false,
  target: null,
};

describe("planStudioPenDrawing", () => {
  it("planStudioPenDrawing starts one drawing, whichever surface asked for it", () => {
    // The Draw button and the P shortcut both carry this plan out, so the two
    // cannot disagree about what starting a drawing means. Both writes matter:
    // handing the canvas to the pen without clearing the path would continue
    // the last drawing rather than begin a new one.
    const commands = planStudioPenDrawing("layer-2", {
      "layer-1": [[0, 0]],
      "layer-2": [[0.1, 0.2]],
    });

    expect(commands).toEqual([
      {
        target: STUDIO_VERTEX_PATH_TARGET,
        type: "controls.setValue",
        value: { "layer-1": [[0, 0]] },
      },
      { target: STUDIO_PEN_TARGET, type: "controls.setValue", value: "layer-2" },
    ]);
  });

  it("asks for nothing when there is no layer to draw on", () => {
    expect(planStudioPenDrawing("", {})).toEqual([]);
  });
});

describe("readStudioShortcut", () => {
  it("hands P to the pen, which is the one mode this product owns", () => {
    expect(readStudioShortcut(KEY_EVENT)).toBe("pen");
    expect(readStudioShortcut({ ...KEY_EVENT, key: "P" })).toBe("pen");
    expect(readStudioShortcut({ ...KEY_EVENT, key: "v" })).toBeNull();
  });

  it("leaves every modified key to the shell that owns it", () => {
    // Undo, redo and zoom are runtime commands with runtime listeners, so a
    // product shortcut that fired with a modifier down would be competing for
    // an operation it does not own. Bare keys only.
    expect(readStudioShortcut({ ...KEY_EVENT, metaKey: true })).toBeNull();
    expect(readStudioShortcut({ ...KEY_EVENT, ctrlKey: true })).toBeNull();
    expect(readStudioShortcut({ ...KEY_EVENT, altKey: true })).toBeNull();
  });

  it("stays out of the way of typing, and of a key already handled", () => {
    expect(readStudioShortcut({ ...KEY_EVENT, target: { tagName: "INPUT" } })).toBeNull();
    expect(
      readStudioShortcut({ ...KEY_EVENT, target: { tagName: "TEXTAREA" } }),
    ).toBeNull();
    expect(
      readStudioShortcut({ ...KEY_EVENT, target: { isContentEditable: true, tagName: "DIV" } }),
    ).toBeNull();
    // And a plain element is not a text box, so the canvas still gets the key.
    expect(readStudioShortcut({ ...KEY_EVENT, target: { tagName: "DIV" } })).toBe("pen");
    expect(readStudioShortcut({ ...KEY_EVENT, defaultPrevented: true })).toBeNull();
    // A held key is one drawing, not one per repeat.
    expect(readStudioShortcut({ ...KEY_EVENT, repeat: true })).toBeNull();
  });
});
