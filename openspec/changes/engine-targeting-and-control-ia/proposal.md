# Engine targeting, a revertible Apply, and a control surface that reads

## Why

Applying a gallery composition destroys the stack and cannot be taken back. This
is reproducible: from a stack of `[Lamellae]`, applying *Interference Beat*
gives `[Beat]`; one Undo leaves `[Beat]` untouched, and a second Undo empties the
stack. The previous composition is unreachable by any sequence of presses.

The cause is not a product mistake. `planStudioPresetApplication` emits
`layers.delete` ×N, `layers.add` ×M, `controls.setValue`, `layers.select`, and in
`src/toolcraft/runtime/state/types.ts` only `controls.setValue` and
`canvas.applySettings` carry `history` and `historyGroup`. Every `layers.*`
command carries neither, so each layer mutation commits its own history patch and
the product has no way to fuse them into one entry. `studio-history.test.ts`
already asserts that apply writes stay on the stack, and it passes — because the
**record** write is undoable while the **layer list** mutation is not. The test's
guarantee is weaker than it reads.

Three further problems share a cause with this one, which is why they are one
change rather than four. The gallery's `Composition` picker and the Layer Engine's
`Chromatic engine` picker both offer *Physichromie* and mean different things,
six sections apart. Colour is split across two non-adjacent sections. `Layer kind
→ Image` sits three sections away from the image upload it implies. All of these
are the same defect at different scales: the control surface groups by
implementation history rather than by what the user is doing, and fixing any one
of them means re-authoring the section inventory that the others live in.

## What Changes

- **One engine application with a chosen target.** The gallery `Composition`
  picker and the Layer Engine `Chromatic engine` picker collapse into a single
  applicator. The user picks what to apply and *where* — the selected layer, the
  selected group, or the whole canvas — instead of inferring the difference from
  which of two lookalike sections they happen to be reading. **BREAKING**: the
  gallery no longer always replaces the stack, which amends R58's "this replaces
  the stack and stores nothing about having done so".

- **Apply is revertible.** A stack snapshot is captured immediately before an
  application and restored by an explicit product action. This is a product-side
  mechanism rather than participation in the runtime undo stack, because the
  runtime cannot express a grouped layer mutation. The limitation is recorded
  upstream so the workaround can be retired when the framework grows the
  capability.

- **Any layer can be flipped horizontally and vertically.** `flipX`/`flipY`
  already exist as uniforms and are applied in the picture's own axes after
  rotation; nothing exposes them. Flip becomes a layer transform available to
  every layer type, sitting beside the layer's other geometry. It is named so it
  cannot be confused with the existing stripe-field `Mirror`, which reflects the
  pattern rather than the layer and stays where it is.

- **The control sections are re-cut so related controls are adjacent.** Colour
  stops being split across two sections. The layer's kind and the media that kind
  implies stop being three sections apart. Geometry, including the new flip, is
  one place. Section titles continue to name the entity edited.

- **Pointer effects choose their subject.** "Follow the pointer" stops being only
  a per-layer switch and gains an all-layers target, and the existing radial
  falloff is extended into a displacement rather than a strength multiplier.

- **The history test is tightened** so that a passing suite can no longer coexist
  with an unrevertible apply.

## Capabilities

### New Capabilities

- `engine-application`: one applicator that takes an engine or composition and a
  target — selected layer, selected group, or canvas — and applies it
  revertibly. Owns the snapshot-and-restore contract and the rule that an
  application never silently discards work.
- `pointer-interaction`: pointer-driven shader response as a first-class subject,
  including which layers a pointer effect applies to and how the effect falls off
  with distance from the cursor.

### Modified Capabilities

- `shader-authoring`: "The gallery sets a starting state, not a fixed
  configuration" changes — applying becomes targeted and revertible rather than a
  whole-stack replacement. "Every shader component is a layer" gains flip as a
  layer transform available to every layer type.
- `toolcraft-app-shell`: "Entity-scoped control sections" changes — the section
  inventory is re-cut so that related controls are adjacent, within the ten-control
  cap and the rule that titles name the entity edited.
- `scene-presets`: "Built-in preset library" and "Presets write through runtime
  state" change — applying a preset must be revertible, extending the precedent
  already set by "Randomize is undoable".
- `media-stylization`: image layers gain the flip controls that the media path's
  existing `flipX`/`flipY` uniforms already support.

## Impact

**Product code.** `app-composition.tsx` (the `apply-preset` action and a new
restore action), `studio-presets.ts` (`planStudioPresetApplication` gains a
target and a snapshot), `studio-gallery-sections.ts` and
`studio-layer-sections.ts` (merged into one applicator surface),
`studio-layers.ts` (flip exposed for every layer type, pointer displacement),
`studio-stack-state.ts` (snapshot storage), and the section inventory.

**Tests.** `studio-history.test.ts` tightened; new acceptance rows and browser
proofs for every newly visible control, landing in the same batch as the controls
themselves.

**Framework.** No runtime file changes — `src/toolcraft/**` is signed, and
`index.html` and `src/app/app-identity.ts` are protected files whose hashes sign
the integrity manifest. The `layers.*` history gap is recorded in
`docs/upstream/toolcraft-0.0.18-issues.md` alongside the two existing defects.

**Not affected.** Shader delivery and export are untouched; the assembled
artifact must continue to carry no product identity.

**Pre-existing red, not caused here.** `app-performance.gates` renderer pass
ownership and `scripts/toolcraft-product-control-boundary.test.mjs` both fail on
untouched `main`.
