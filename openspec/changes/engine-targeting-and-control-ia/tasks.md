## 1. Record the framework gap

- [ ] 1.1 Add a third entry to `docs/upstream/toolcraft-0.0.18-issues.md` matching the two existing defects' format: `layers.add`, `layers.delete`, `layers.select`, and `layers.reorder` in `src/toolcraft/runtime/state/types.ts` carry no `history` or `historyGroup` field, so a multi-layer operation cannot be one undo entry. Cite `planStudioPresetApplication` as the case that needs it and name the product-side snapshot as the local workaround to retire when it lands upstream.

## 2. Make the current Apply revertible

- [ ] 2.1 Add a stack snapshot to `studio-stack-state.ts`: layer identities, order, per-layer values from `stack.layerRecord`, and the selected layer id. One snapshot, replaced on each application.
- [ ] 2.2 Capture the snapshot in `planStudioPresetApplication` before the first `layers.delete` is emitted, so no layer is removed before it is recorded.
- [ ] 2.3 Add a restore action to `app-composition.tsx` that rebuilds the snapshot's layer list through `layers.add`, writes back the per-layer record, and restores the selection.
- [ ] 2.4 Scope the restore to the application it belongs to: stop offering it once the user has edited past the application, so restore never silently discards later work.
- [ ] 2.5 Decide and implement whether the snapshot persists across reload (see design Open Questions); whichever is chosen, make the restore action's availability match it.
- [ ] 2.6 Acceptance rows and a browser proof: apply over a known stack, restore, and assert the previous layer list returns layer for layer with its own values and selection.
- [ ] 2.7 Browser proof that a single restore is enough regardless of stack size (one layer replaced by five).

## 3. Close the hole in the history test

- [ ] 3.1 Tighten `studio-history.test.ts` so it asserts the layer-list mutations of an application are recoverable, not only that the record write is recorded. The current assertion at line 91 passes over a broken behaviour and must not be able to again.
- [ ] 3.2 Add a regression proof that no intermediate stack — preset layers removed, previous layers not yet restored — is reachable by the user.

## 4. Author the new section inventory

- [ ] 4.1 Write the full target-by-target `appControlSectionInventory` before any schema edit, with `groupingReason` stating the user's task rather than the module.
- [ ] 4.2 Put every colour target of one layer in a single section, closing the current Selected Layer / Layer Palette split.
- [ ] 4.3 Put the layer kind and the media that kind requires in the same or adjacent sections, closing the current Layer Pattern / Layer Media gap.
- [ ] 4.4 Give the layer's geometry one section and reserve slots in it for flip.
- [ ] 4.5 Check the cut against the ten-control cap, the banned-title list, the R33 gating-condition rule, layer-kind label collisions, and the rule that sections sharing an `entityId` are adjacent.
- [ ] 4.6 Update the acceptance rows that name section titles or positions.

## 5. Technique as context, engine as application

- [ ] 5.1 Replace the technique select with the built-in `imagePicker`, and place it first in the control surface so the techniques are the first thing the user meets.
- [ ] 5.2 Produce a thumbnail per technique. They must be renders the product itself produces from the technique's own stack, not photographs of artworks (see design Open Questions).
- [ ] 5.3 Make the technique picker set the canvas's construction, leaving every control it touched live and editable afterwards.
- [ ] 5.4 Add the confirmation step for a technique change: state that current work will be replaced, leave the canvas untouched until confirmed, and skip asking when there is no work to replace.
- [ ] 5.5 Express the confirmation through built-in controls as a deliberate second action. There is no modal available — do not author one.
- [ ] 5.6 Keep the engine control as the per-target application, and make the surface distinguish context from application despite the shared vocabulary.
- [ ] 5.7 Extend `planStudioPresetApplication` to take a target and emit commands affecting only that target's layers; add the image target alongside layer and group.
- [ ] 5.8 Make the group and image targets unavailable rather than disabled when nothing eligible is selected, per the existing applicability requirement.
- [ ] 5.9 Keep the existing target keys where possible so Settings Transfer round-trips (see the BREAKING note in design).
- [ ] 5.10 Browser proof per technique thumbnail that choosing it changes the render — the `imagePicker` contract requires every visible item to be proved individually, not one proof for the control.
- [ ] 5.11 Browser proofs per engine target: layer-only leaves neighbours unchanged, group-only leaves outsiders unchanged, image-only restyles the picture and changes nothing else.
- [ ] 5.12 Browser proof that applying an engine to a target never asks for confirmation and never replaces the canvas.
- [ ] 5.13 Browser proofs for the confirmation: declining leaves every layer value and the current technique unchanged; confirming is still revertible by the group 2 restore action.

## 6. Flip on every layer type

- [ ] 6.1 Expose `flipX` and `flipY` for every layer type, not only the media path, wired to the existing uniforms.
- [ ] 6.2 Choose the control kind — two toggles or one combined control — against the section budget (see design Open Questions).
- [ ] 6.3 Name the controls so they cannot be read as the stripe field's `Mirror`, and add the schema assertion that the two stay distinct.
- [ ] 6.4 Confirm the fold runs in the layer's own axes after rotation for procedural layers as it already does for pictures.
- [ ] 6.5 Acceptance rows plus a browser proof with an asymmetric image fixture: flip horizontally and assert the sampled left pixel matches the previously sampled right pixel.
- [ ] 6.6 Browser proof that flipping twice returns the layer to its unflipped appearance, and that flip changes neither layer size, position, nor canvas dimensions.
- [ ] 6.7 Assert no new decode of the source asset occurs on flip.

## 7. Give the pointer effect a subject

- [ ] 7.1 Add a pointer subject control — selected layer or every layer — replacing the bare per-layer `engineCursor` switch as the way the subject is chosen.
- [ ] 7.2 Make an all-layers subject drive each layer through its own layer type's parameters rather than one post-composite displacement.
- [ ] 7.3 Extend the existing `cursorReach` falloff into a displacement, keeping the falloff limit so a pointer outside the frame reaches nothing.
- [ ] 7.4 Keep the pointer uniform a uniform in the assembled deliverable rather than baking it to a constant.
- [ ] 7.5 Confirm pointer position is still absent from the undo stack.
- [ ] 7.6 Acceptance rows and browser proofs: selection changes do not move the effect's subject; export with the pointer over the canvas matches the at-rest render.
- [ ] 7.7 Assert the delivered shader with a pointer effect still carries no product name, attribution, or generator marker.

## 8. Verify and close

- [ ] 8.1 Run `npm test` and confirm both halves — `node --test` and vitest — since the `&&` chain hides the second when the first fails.
- [ ] 8.2 Run the browser suite and confirm the only failures are the two that already fail on untouched `main`: `app-performance.gates` renderer pass ownership and `scripts/toolcraft-product-control-boundary.test.mjs`.
- [ ] 8.3 Confirm the integrity gate still passes and that `index.html`, `src/app/app-identity.ts`, and `src/toolcraft/**` are untouched.
- [ ] 8.4 Reproduce the original defect's steps in the running app and confirm the stack returns.
