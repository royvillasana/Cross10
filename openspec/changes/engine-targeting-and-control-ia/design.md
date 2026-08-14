## Context

Applying a gallery composition destroys the stack irrecoverably. The measured
behaviour, from a stack of `[Lamellae]` applying *Interference Beat*: one Undo
changes nothing, two Undos empty the stack. There is no press count that reaches
the previous composition.

The mechanism is in `planStudioPresetApplication` (`studio-presets.ts:377-404`),
which emits, in order:

```
layers.delete × N      (one per existing layer)
layers.add    × M      (one per preset layer)
controls.setValue      (the layer record)
layers.select
```

`src/toolcraft/runtime/state/types.ts` gives `history` and `historyGroup` to
exactly two commands — `controls.setValue` and `canvas.applySettings`. Every
`layers.*` command has neither field. Each therefore commits its own patch
through `commitToolcraftStatePatch`, and the product has no expression for "these
N+M+2 commands are one edit".

This also explains why the suite is green over a broken behaviour.
`studio-history.test.ts:91` asserts that `app-composition.tsx` dispatches carry
`history: null`, i.e. that apply writes are recorded rather than skipped. That is
true of the record write. The layer-list mutations are not control writes at all,
so the assertion never looked at them.

The remaining problems are control-surface layout. Verified section order in the
running app: Setup → Gallery → Selected Layer → Layer Pattern → Layer Shape →
Layer Palette → Layer Media → Layer Engine → Layer Treatment → Image Export.
`Gallery.Composition` and `Layer Engine.Chromatic engine` both offer
*Physichromie*, six sections apart. Colour is split between Selected Layer
(First, Second) and Layer Palette (slots, Third, Fourth). `Layer kind → Image`
sits three sections from Layer Media.

## Goals / Non-Goals

**Goals:**

- One applicator, one engine vocabulary, one visible statement of what lands where.
- An application that can be taken back in a single action, whatever the stack size.
- Flip on every layer type, using uniforms that already exist.
- A section inventory cut by what the user is doing rather than by module history.
- A pointer effect whose subject the user chooses.
- A history test that cannot pass while apply is unrevertible.

**Non-Goals:**

- Changing `src/toolcraft/**`. It is signed; `index.html` and
  `src/app/app-identity.ts` are protected files whose hashes sign the manifest.
- Fixing the framework. The `layers.*` history gap is recorded upstream, not patched.
- Making the product's restore action participate in the runtime undo stack.
- The timeline. `animationIntent: none` still holds and per-layer animation stays
  in the `outstanding` change.
- Reworking export or delivery.

## Decisions

### Snapshot-and-restore in product state, not runtime history

**Chosen.** Capture the stack — layer identities, order, per-layer values from
`stack.layerRecord`, and the selection — into product state immediately before
the first `layers.delete`, and restore it through one action.

*Why not group the dispatches?* Not expressible. `layers.*` carries no
`historyGroup`. This is the whole reason the defect exists.

*Why not make the record write carry the whole stack, so one `controls.setValue`
undoes everything?* The runtime owns layer identity, order, name, visibility and
parentage (R56). Restoring values onto a layer list that no longer has those
layers restores nothing. The list has to be rebuilt through `layers.add`
regardless, and those calls are exactly what cannot be grouped.

*Why not block Apply behind a confirmation instead?* It trades a recoverable
mistake for a modal on every use, and the user's complaint is that the action is
unrecoverable, not that it is too easy to reach.

**Consequence to be honest about:** the restore action sits beside the global
Undo rather than inside it. Pressing Undo after an Apply will still walk the
individual layer mutations. The applicator therefore has to make its own restore
findable, and the upstream note explains why there are two mechanisms.

### One applicator with an explicit target

**Chosen.** Merge `Gallery.Composition` and `Layer Engine.Chromatic engine` into a
single surface: what to apply, where to apply it, and the action. Targets are the
selected layer, the selected group, and the canvas.

*Why not keep two controls and rename them?* Renaming reduces the collision but
keeps two places to look and two mental models for one verb. The user's own
framing — "one engine application, and we select where to apply that engine" — is
the simpler model and is the one the spec now carries.

*Why is the canvas target still a full stack replacement?* Because that is what a
composition *is*: the gallery entries are stacks, not values (R71). Applying a
stack to the canvas means becoming that stack. What changes is that this is now
one of three targets rather than the only behaviour, and that it is revertible.

**Unavailable rather than disabled.** A group target with no group selected is not
offered, per the existing "Conditional applicability instead of disabling"
requirement in `toolcraft-app-shell`.

### Flip as a layer transform, not a media operation

**Chosen.** Expose `flipX`/`flipY` for every layer type, in the layer's geometry
section, applied in the layer's own axes after rotation — which is what
`studio-layers.ts:598` already does for the picture ("Folded after the turn, so
the mirror runs along the picture's own axes").

*Why not restrict it to images, where the uniforms live today?* The user asked for
"the image or any layer", and a flip that exists for one layer type is a
special case the layer model does not otherwise have.

**Naming is load-bearing.** The stripe field already has `Mirror`
(`studio-layer-sections.ts:207`), which reflects the *pattern within* a layer.
Flip reflects *the layer*. These must not be readable as each other; the spec
carries a scenario for it.

### The section re-cut is authored as an inventory first

**Chosen.** Re-author `appControlSectionInventory` before touching schema code, as
the contract requires, and let the section list fall out of it. The inventory's
`groupingReason` must state the user's task, not the module.

Known constraints the new cut has to satisfy: ten controls per section; titles
name the entity edited and are not generic or control-type names; titles must not
resemble their gating condition (R33) or collide with layer-kind option labels;
sections sharing an `entityId` must be adjacent.

*Why in this change rather than its own?* The applicator merge deletes one section
and rewrites another, and flip adds controls to a third. Sequencing the IA rework
separately means authoring the inventory twice and re-proving every control twice.

### Pointer subject as a layer-set, extending `engineCursor`

**Chosen.** Keep the existing falloff — `cursorReach = 1.0 - smoothstep(0.0, 0.45,
length(centered - cursor))` — and add a subject that selects which layers consult
it. Displacement replaces strength-scaling as the effect.

*Why extend rather than build a post-composite pass?* A pass applied after
compositing moves every layer identically and cannot respond in each layer type's
own terms. It would also add a renderer pass, which obliges a new cost declaration
and performance profile.

**Export determinism is a hard constraint.** A pointer outside the frame must
reach nothing, and pointer position must stay off the undo stack — the existing
comment in `studio-history.test.ts:72` notes the cursor commit "changes every time
a button is clicked, including the Undo button".

## Risks / Trade-offs

**Two undo mechanisms confuse users** → The applicator's restore is presented as
part of the applicator, describing what it restores, rather than as a second
general-purpose Undo. The upstream note records why.

**The re-cut inventory breaks every control's acceptance row** → Every visible
control obliges acceptance coverage and browser proof in the same batch. Do the
inventory first and land controls in batches that each stay green, rather than
re-cutting everything and then repairing the suite.

**Snapshot memory growth** → One snapshot, replaced on each application, not a
stack of them. The restore is "undo the last application", not a second history.

**Snapshot goes stale after manual edits** → An application captured before the
user edits the resulting layers would, on restore, discard those edits. Restore
must therefore be scoped to the application it belongs to and stop being offered
once the user has edited past it.

**The canvas target still destroys work** → It is revertible, which was the actual
complaint, and the narrower targets mean it is no longer the only option.

**Merging the two engine controls is BREAKING for saved settings** → Settings
Transfer round-trips control values by target. Removing or renaming
`gallery.entry` and the layer engine target changes those keys. Either keep the
existing target names under the merged surface or accept that older exported
settings lose their engine selection; the former is preferred and is a task.

**Pre-existing failures may be misread as regressions** → `app-performance.gates`
renderer pass ownership and `scripts/toolcraft-product-control-boundary.test.mjs`
fail on untouched `main`. Confirm against `main` before attributing anything.

## Migration Plan

1. Record the `layers.*` history gap in `docs/upstream/toolcraft-0.0.18-issues.md`.
2. Land snapshot-and-restore against the *current* apply, so the destructive
   behaviour becomes recoverable before it is reshaped.
3. Tighten `studio-history.test.ts` so the old behaviour cannot return.
4. Author the new inventory; land the merged applicator and the section re-cut.
5. Land flip, then the pointer subject.

Steps 2 and 3 are independently shippable and are the user's most acute problem,
so they go first. Rollback for each step is the commit; no data migration is
involved, though step 4 touches persisted control keys — see the BREAKING note.

## Open Questions

- Does the applicator's restore survive a reload? The stack persists, so a
  snapshot that does not persist means restore is unavailable after a refresh.
  Persisting it is a control value like any other and is cheap; the question is
  whether an application from a previous session should still be revertible.
- Should applying to a group with a target narrower than the group's contents
  distribute the composition's layers across the group's layers, or apply the
  composition's first layer to each? The spec requires only that layers outside
  the group are untouched.
- What is the flip control's kind — two toggles, or one multi-select? Two toggles
  match `flipX`/`flipY` directly; a combined control costs one section slot
  instead of two, which may matter against the ten-control cap.
