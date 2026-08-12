"use client";

import * as React from "react";

import { useToolcraftDispatch, useToolcraftSelector } from "@/toolcraft/runtime/react";

import { buildCroix10RandomizeAssignments } from "./croix10-randomize";

/**
 * The `R` shortcut for Randomize.
 *
 * The same command the Randomize button runs, dispatched the same way: one
 * `controls.setValue` per target under one history group, so the keyboard path and
 * the button path are one undo step each and cannot diverge in behaviour.
 *
 * History's own shortcuts are runtime-owned and this does not touch them. What it
 * does own is the suppression rule, which matters because `R` is a letter: while the
 * user is typing into a hex field, a colour name, or a shader editor, `R` must reach
 * the field and nothing else. Suppression is decided from the event target rather
 * than from a list of places the app happens to put text inputs, so a text surface
 * added later is covered without being enumerated here.
 */

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  const tagName = target.tagName;
  if (tagName === "TEXTAREA" || tagName === "SELECT") return true;
  if (tagName === "INPUT") {
    // A slider is an input too, and a slider is exactly where a shortcut should
    // still work: only value-entry types swallow the key.
    const inputType = (target as HTMLInputElement).type;
    return inputType !== "range" && inputType !== "checkbox" && inputType !== "radio";
  }

  const role = target.getAttribute("role");
  return role === "textbox" || role === "searchbox" || role === "combobox";
}

export function useCroix10RandomizeShortcut(): void {
  const dispatch = useToolcraftDispatch();
  const state = useToolcraftSelector((current) => current);
  // The listener is attached once and reads the latest state through a ref, so a
  // parameter edit does not detach and reattach a window listener on every keystroke.
  const stateRef = React.useRef(state);
  stateRef.current = state;

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "r" && event.key !== "R") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.defaultPrevented || event.repeat) return;
      if (isTextEntryTarget(event.target)) return;

      const assignments = buildCroix10RandomizeAssignments(stateRef.current);
      if (assignments.length === 0) return;

      event.preventDefault();
      for (const assignment of assignments) {
        dispatch({
          history: "merge",
          historyGroup: "croix10-randomize",
          label: "Randomize",
          target: assignment.target,
          type: "controls.setValue",
          value: assignment.value,
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);
}
