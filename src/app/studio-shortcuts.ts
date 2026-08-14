"use client";

import * as React from "react";

import { useToolcraftDispatch, useToolcraftSelector } from "@/toolcraft/runtime/react";

import { planStudioPenDrawing, STUDIO_VERTEX_PATH_TARGET } from "./studio-stack-state";

/**
 * The keys this product answers to, and — more importantly — the ones it does
 * not (15.4).
 *
 * The ask was for keyboard shortcuts. What settles which shortcuts exist is not
 * taste but ownership, so this was audited against the runtime before anything
 * was written, and most of the obvious candidates turned out not to be the
 * product's to give:
 *
 * - **Undo and redo** are the runtime's. `ToolcraftRoot` already listens on the
 *   document for Cmd/Ctrl+Z, Shift+Z and Ctrl+Y and dispatches `history.undo` /
 *   `history.redo`, and the toolbar contract says in as many words not to add
 *   app-level listeners for them. A product copy would be a second surface for
 *   an operation that already has one, and would fight the original for the
 *   event.
 * - **Zoom and centring** are the runtime's too: `canvas.zoomIn`, `canvas.zoomOut`,
 *   `canvas.zoomReset` and `canvas.center` are toolbar commands, and the
 *   viewport belongs to the shell that draws it. A product-authored Z would be
 *   a second way to move a view the product does not own.
 * - **A select tool (V)** would be a mode for a tool this product has no
 *   concept of. Selection here is picking a layer from the runtime's panel,
 *   which the `layer-selection` ownership entry gives to the panel precisely
 *   because a click on the canvas is ambiguous in a composited stack.
 *
 * What is genuinely product-owned is the pen: `stack.pen` is a product control
 * and the drawing it starts is a product mode. So P is the shortcut, and it is
 * an accelerator for the Draw button rather than a second implementation of it
 * — both run `planStudioPenDrawing`, which is what keeps the operation single
 * even though two things can ask for it.
 *
 * Bare keys only, and none while a modifier is down: every combination with
 * Cmd, Ctrl or Alt belongs to the shell or the browser, and taking one would be
 * the same mistake as reimplementing undo.
 */
export const STUDIO_SHORTCUT_KEYS = { pen: "p" } as const;

/**
 * Whether a key event is somebody else's.
 *
 * A bare letter is a character while a field has focus, so the same event that
 * should start a drawing on the canvas must be left alone in a text box. The
 * runtime makes this exact check before its own shortcuts; this is the product
 * making it before the one it owns, rather than reaching into the runtime's
 * private helper for it.
 */
function isStudioTypingTarget(target: unknown): boolean {
  // Read off the target rather than tested with `instanceof HTMLElement`: the
  // check is about what the element is, and an identity test against this
  // realm's constructor answers a different question -- one that is also false
  // in a test that has no DOM at all.
  const candidate = target as {
    readonly isContentEditable?: boolean;
    readonly tagName?: string;
  } | null;
  if (!candidate) return false;
  if (candidate.isContentEditable === true) return true;

  const tagName =
    typeof candidate.tagName === "string" ? candidate.tagName.toLowerCase() : "";
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

/** Which product shortcut an event asks for, or none. */
export function readStudioShortcut(event: {
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly defaultPrevented: boolean;
  readonly key: string;
  readonly metaKey: boolean;
  readonly repeat: boolean;
  readonly target: unknown;
}): "pen" | null {
  if (event.defaultPrevented || event.repeat) return null;
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  if (isStudioTypingTarget(event.target)) return null;

  return event.key.toLowerCase() === STUDIO_SHORTCUT_KEYS.pen ? "pen" : null;
}

/**
 * Listens for the product's own shortcuts.
 *
 * On the document, because a shortcut that only worked while the canvas held
 * focus would not be a shortcut: the author has just clicked a layer in the
 * panel, and P has to reach the pen from there.
 */
export function useStudioShortcuts(): void {
  const dispatch = useToolcraftDispatch();
  const state = useToolcraftSelector((current) => current);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  React.useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (readStudioShortcut(event) !== "pen") return;

      const current = stateRef.current;
      const commands = planStudioPenDrawing(
        current.selectedLayerId ?? "",
        (current.values as Readonly<Record<string, unknown>>)[STUDIO_VERTEX_PATH_TARGET],
      );
      // No selected layer is nothing to draw on, and swallowing the key there
      // would make it look handled when it did nothing.
      if (commands.length === 0) return;

      event.preventDefault();
      for (const command of commands) dispatch(command);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dispatch]);
}
