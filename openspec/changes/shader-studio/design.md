# Design — Shader Studio

Decisions are numbered continuing Croix10's R-series from R50, so one vocabulary covers both apps and a rule referenced across them means the same thing. R23, R33/R34, R40, R43–R46 are Croix10 decisions this change inherits without relitigating; see `openspec/changes/croix10-generative-art-studio/design.md`.

## Contract reconciliation

### What carries from Croix10 unchanged

The rendering core is not redesigned. The GLSL chunk registry, the schema-derived uniform upload with sRGB-to-linear conversion, the scene reader, and the timeline transport driven by `getToolcraftTimelineLoopTime` all move across as-is. Every runtime helper this change names was verified present in the new app's signed `src/toolcraft` copy before any of it was planned: `getToolcraftTimelineLoopTime`, `useToolcraftProductSceneFrame`, `useToolcraftPipelinePass`, `useToolcraftSelector`, `shouldIncludeToolcraftPreviewBackground`, `assessToolcraftRenderPlan`, `deriveToolcraftPerformancePaths`.

They are **copied, not imported**. Both apps are monolithic signed packages whose integrity manifests cover their own trees; a shared package dependency would have to be signed into both, and neither manifest can reference the other's files. Copying is the only route that leaves both integrity checks green.

### What the layer stack changes

Croix10 assembles one shader variant per engine, with that engine's components fixed at authoring time. Shader Studio assembles one program from an ordered stack the user builds at runtime. Three things follow that Croix10 never had to answer: the variant cache can no longer key on an engine id, per-layer uniforms need an addressing scheme, and the workload envelope gains a dimension because the program's cost now grows with the stack.

### The two framework defects carry too

Issues 3 and 4 in `docs/upstream/toolcraft-0.0.18-issues.md` are contradictions between framework-owned files that no product change resolves, and they make `npm run test:browser` permanently red for any product with a timeline. This app will have a timeline, so it will trip them. They do **not** gate delivery: the executor greps only titles derived from the product's own acceptance matrix, so a framework self-test is never selected. The workarounds for issues 1 and 2 were carried across rather than rediscovered — `tools/toolcraft-keepalive-preload.cjs` and the `test:browser:stable` script, which are the only two unsigned surfaces available.

Issue 6 was found generating this app: the scaffolder installs six skills as symlinks that its own integrity check forbids, so `create` produces a tree that fails its first gate. Fixed by replacing the symlinks with copies; integrity now passes at 650 files.

---

## R50 — Enabling `panels.layers` obliges four runtime proofs, one of which the product did not ask for

**Decision.** Grouping is a shipped feature of this product, not a proof written around an unwanted capability.

**Reason.** `runtime-coverage.ts:21` requires a runtime acceptance entry for each of `selection`, `visibility`, `reorder`, and `grouping` the moment `panels.layers` is enabled, each with both `automated` and `browser` coverage and a written `expectedObservable`. The spec asked for the first three. Grouping arrives as an obligation regardless.

There is no partial route. The check is on `layersEnabled`, so the alternatives are all four proofs or no layer panel at all — and no layer panel means product-authored layer UI, which the spec forbids and which `control-acceptance-policy.ts:126` enforces by rejecting `selectedLayer.*` targets when the panel is disabled.

Given the obligation is unavoidable, the honest resolution is to make grouping real rather than to prove a capability the product treats as vestigial. A stack of stripes, gradients, images, and shapes is exactly the kind of composition where grouping earns its place: a user building a two-gradient wash under three stripe layers wants the wash to move as one thing.

**Evidence.** `src/app/acceptance/runtime-coverage.ts:21-88`, `src/app/acceptance/control-acceptance-policy.ts:126`.

**Consequence.** Group 2 lands four runtime rows, not three, and grouping gets a design pass rather than a stub. Whether grouped layers composite as a pre-blended sub-stack or merely move together in the list is a rendering question resolved in R52.

## R51 — Every `selectedLayer.*` control carries a second coverage obligation beyond its own

**Decision.** A per-layer control's acceptance row declares both its ordinary control coverage and `layerCoverage: "selected-layer-controls"`.

**Reason.** `control-acceptance-coverage.ts:244` fails any control whose target starts with `selectedLayer.` unless its entry declares that coverage, with the stated meaning that the control edits *the currently selected layer's* output. This is a stronger claim than "the control changes the render": it obliges proof that editing with layer A selected leaves layer B alone, which is precisely the spec's second layer scenario.

**Consequence.** The per-layer proof shape is fixed: select A, edit, assert A changed and B did not. Every layer type's controls in groups 3 and 4 reuse it rather than inventing a proof per type.

**Evidence.** `src/app/acceptance/control-acceptance-coverage.ts:225,244-252`.

## R52 — Per-layer uniforms are name-mangled at assembly

**Decision.** Each layer's uniforms are emitted as `uLayer<index>_<name>` during stack assembly.

**Reason.** The stack is dynamic, so a layer's uniforms cannot be named at authoring time the way an engine's are. Three routes were available:

1. **Indexed uniform arrays** — `uLayerAngle[i]`, sized to a maximum stack depth. Keeps one program shape across stacks, but caps depth and pays for slots nobody filled.
2. **Name-mangled per-layer uniforms** — no cap, no waste, and the most readable delivered source. Its stated cost is that every stack edit compiles a new program.
3. **A packed uniform block or texture.** Decouples program identity from stack contents entirely, at the cost of packing and unpacking on both sides — and it emits the least readable source of the three.

Route 2's cost turns out not to be a cost. R54 already keys the program cache on the stack signature, so a stack edit invalidates the cached program under any of the three schemes; the recompile is inherent to the feature rather than added by the choice. With the objection removed, the tiebreaker is what group 7 delivers, and readable standalone source is the artifact this product exists to produce. Route 3 loses on exactly that ground; route 1 loses because a depth cap is a limit the layer model has no reason to carry.

**Consequence.** Bodies are shared and parameterised; only a thin per-layer wrapper is emitted per instance, so a stack of six stripe layers compiles one `studioStripesBody` and six calls to it. Proved in `studio-layers.test.ts`.

**Evidence.** `src/app/studio-layers.ts`, `src/app/studio-layers.test.ts`.

## R56 — Per-layer values live in a product-owned record keyed by `layer.id`

**Decision: route A.** Recorded because two assumptions the layer-stack architecture was written on turn out not to hold, and the resolution shapes every per-layer control in the product.

**What the runtime actually provides.** `ToolcraftState` carries `layers` (an ordered `ToolcraftLayer[]`), `selectedLayerId`, and one flat `values` map. That is all.

Two consequences follow, neither anticipated when open question 3 was resolved:

1. **A runtime layer cannot carry a product type.** `ToolcraftLayerKind` is `"group" | "layer"` and nothing else. There is no field in which a layer says it is stripes rather than a gradient, so the mapping from a runtime layer to a product layer type has to live in product state keyed by `layer.id`.
2. **`selectedLayer.*` is a naming convention, not a per-layer store.** No runtime code reads or writes those targets; the contract rules in `component-contracts.runtime.ts:291-294` describe how a product *should* name them and what it must prove about them. Their values live in the same flat `values` map as everything else, so `selectedLayer.angle` holds **one** value, not one per layer. Selecting a different layer does not swap it.

So the runtime owns the list, its order, its selection, its visibility, and its grouping — everything the spec assigned it — but it does not own per-layer parameter values, and the spec assumed it did.

**Two routes.**

- **A — product-owned per-layer record.** A product target holds a map from `layer.id` to that layer's type and values. `selectedLayer.*` controls are the editing surface for whichever layer is selected; product code reads the selection, writes the edit into the record, and reloads the controls when selection changes. Same shape as R46 (positions in a canvas-owned array beside the collection) and R44 (product code commits through `controls.setValue`): the runtime owns identity and order, the product owns everything hung off it.
- **B — one control set per layer slot**, with applicability gating by selection. Avoids the sync entirely, but the control count grows with stack depth, which collides with the ten-control section budget the moment a stack has more than a couple of layers.

**Route A chosen**, because B's cost scales with exactly the thing this product is for: a stack deep enough to be interesting is a stack whose control count has already broken the section budget. A's cost is a single synchronisation point, and R44 already establishes that a product-owned store written through `controls.setValue` is an accepted pattern with a proof shape that works here.

**How it resolves.**

- The record lives at the uncontrolled product target `stack.layerRecord`, keyed by `layer.id`, holding each layer's `typeId` and its uniform values. Uncontrolled targets need `persistence.additionalValueTargets` to survive reload — the same mechanism the cursor hotspot needed in Croix10.
- `selectedLayer.type` is a real select control, which is what gives the product layer type a home the runtime does not provide. Every other per-layer control gates its `applicability` on it, so a gradient layer never shows a stripe count.
- The sync is **one-directional per event, never bidirectional**. On a selection change, the record's stored values are written into the `selectedLayer.*` targets. On an edit to a `selectedLayer.*` target, the new value is written into the record under the currently selected id. Guarding on the last-synced layer id keeps a selection change from being read back as an edit, which would overwrite the layer just selected with the values of the one just left.
- Layers the runtime removes leave orphan record entries. They are pruned against the live `layers` array on read rather than on delete, because a delete the product does not observe would otherwise leak — and undo can bring a layer back, which a prune-on-delete would have made unrecoverable.

**Consequence.** The spec's resolution to open question 3 needs narrowing: the runtime owns the layer list, its selection, its visibility, its grouping, and its reordering — but it owns the *naming and proof rules* for per-layer controls rather than the storage behind them. That distinction is what this rule supplies.

**Evidence.** `src/toolcraft/runtime/state/types.ts:227-237`, `src/toolcraft/runtime/state/history-patches.ts:106`, `src/toolcraft/runtime/contracts/component-contracts.runtime.ts:285-299`.

## R57 — The engine modules come across when a layer type needs them, not before

**Decision.** The five modules copied from Croix10 in group 1 — parameters, shaders, shaders-ramp, render, pipeline — were removed again. They return in group 4, one at a time, as the layer types that consume them are built.

**Reason.** They are engine-shaped: one shader variant per engine, its components fixed, selected by a `uEngine` branch and keyed on an engine id. The layer stack uses none of that. It has its own registry, its own assembly, its own signature-keyed renderer, and its own state model, and after group 2 the five formed a closed cluster nothing else imported.

The framework does not tolerate that. `app-performance.gates.test.ts` rejects any product module reachable from neither a runtime nor a proof root, so unused code is not merely untidy here — it fails the delivery gate. And the alternative, wiring them in to satisfy reachability, would mean mounting an engine path the product does not use in order to prove it does.

Nothing is lost by removing them: they were copies, and Croix10 still holds the originals under the change that produced them. What group 1 actually established is the sequence — read the module, understand what it assumes, rename it off the `croix10` prefix — and that sequence is cheaper to repeat than to carry dead code through five delivery gates.

**Consequence.** Group 1 is reframed. Moving a module ahead of its consumer is the error; the migration belongs *inside* the group that needs it. The ramp chunk arrives with the gradient layer's ramp controls (4.2), proximity with the cursor field (4.3), the palette with the palette surface (4.4).

**Evidence.** `src/app/app-performance.gates.test.ts`, and the import graph after group 2: `studio-render` and `studio-pipeline` had no importer at all.

## R53 — Open: what the delivered artifact contains

**Status: unresolved**, and it blocks nothing until group 7. Recorded because the MCP's usefulness depends on it and the answer should not be inferred from whatever assembly code is easiest.

A bare fragment shader is smaller and drops straight into an existing pipeline that already has uniforms wired. A runnable module carrying its uniform declarations and default values is what an agent can actually use without a second round-trip — and the MCP is the primary delivery path, which argues for the module.

The spec fixes two properties either way: the source compiles without referencing the studio's chunk registry, and it carries no watermark, attribution comment, or injected identifier. The second is a test in task 7.4, not a convention.

## R54 — The variant cache keys on the stack signature

**Decision.** The cache key is the ordered list of layer types plus their feature flags, not an engine id.

**Reason.** Croix10's key identified one of six engines. Here two stacks with the same types in a different order are different programs, and two stacks with the same order but a different feature flag on one layer are also different programs. An engine-shaped key would collide across both.

**Consequence.** Stack depth enters `workloadEnvelope` as a dimension, since the assembled program's per-pixel cost grows with the number of layers — the first workload dimension in either app that is not a stripe or shape count.

## R55 — Delivery is not an artifact, and `exportIntent` must keep saying so

**Decision.** `exportIntent` declares image and video only. Shader source leaves through a clipboard action or the MCP.

**Reason.** Toolcraft's export contract is typed over image and video, and the runtime owns that pipeline end to end. `core/setup-export.md` permits an additional product action provided it never substitutes for artifact intent, which is exactly the shape of a copy-source button. The MCP sits outside the app entirely and carries no integrity obligation at all.

**Consequence.** Task 8.2 asserts `exportIntent` is unchanged after delivery is exercised — the spec's own scenario, written as a test so the declaration cannot drift toward describing the shader.

## R58 — the gallery needs no persistence of its own

Resolves proposal open question 4: *does the gallery need its own persistence, or is a delivered shader stateless once assembled?*

**Decision.** The gallery persists nothing. Selecting an entry applies a starting state through runtime commands, and what survives a reload is the resulting stack — the control values and `stack.layerRecord` the runtime already persists — not the fact that a preset was chosen.

**Reason.** Two halves of the question, and they answer each other.

The delivered shader is stateless by construction. R53 bakes every parameter into the source as an initialised `const`, so the artifact carries no reference to the studio, no uniform to wire beyond `uResolution`, and nothing to restore. Once assembled it is a file, not a session.

Inside the app, a persisted "active entry" would be a claim that goes stale on the first edit. The gallery sets a starting point and leaves every control live — that is the scenario task 5.3 exists to pin down — so a stored selection would keep naming a preset that no longer describes the stack. Croix10 persists `presets.active` because its presets and its engine share one control surface; here the stack *is* the state, and it already persists.

**Consequence.** The gallery is an applicator, not a mode. It contributes no `additionalValueTargets`, and 5.1's runtime commands give it undo and reset for free — selecting an entry is an ordinary edit, so undo steps back through it like any other.

**Blocked work, recorded here so the ordering is not rediscovered.** Task 5.2 asks for Croix10's eleven presets expressed as layer stacks. They cannot be ported until group 4 lands: their distinguishing targets are `engine.active`, `interference.*`, `induction.*`, `immersion.*`, `transchromie.*`, `palette.slots`, `bands.separatorWidth` and `viewer.angle`, and this product's layer types expose angle, count, width ratio, phase, two colours and a ramp type. Six of the eleven — Induced Third, Physichromie 500, Induction Grid, Interference Beat, Moiré Wedge, Transchromie Sheets — are named for engines that do not exist here yet, and would collapse into near-identical stripe stacks. Group 4 carries those surfaces onto the layer types; group 5.1–5.3 and 5.5 follow it.

## R59 — the wedge is two capabilities, not one control

Raised by reference images of Cruz-Diez and Soto works supplied by the user, and by the request: *bend the stripes inside or outside a shape, and turn the shadow into a stripe with gradients that can change angle.*

**What the references actually do.** The bands stay horizontal and evenly spaced. What moves is the boundary *inside* each band: the split between its two colours drifts along the band's length, so the band reads as a wedge — full thickness at one end, tapering to nothing at the other. The dark band stops being a line of constant width and becomes a triangle, which is what the request calls turning the shadow into a stripe with an angle.

In one reference the drift reverses at a vertical seam, and the reversal is what makes a chevron column emerge from a field that never stops being parallel. In two others the drift is confined to rectangular regions with plain stripes outside them. In the prints every band is a parallelogram and the slant changes between column regions.

**Decision.** This is two independent capabilities and they should land as two, in this order.

1. **Taper** — a per-layer control that moves the colour split along the band's own length. This is the wedge itself, and it is useful on its own: a full-field taper already reproduces the parallelogram prints.
2. **Region mask** — a per-layer shape that selects where the layer draws, with an inside/outside sense. This is what confines the bend to a shape and leaves the surrounding field parallel, and it is what makes the emergent-shape references reachable.

**Reason for the order.** Taper needs no new architecture: it is one more uniform on the stripes type, in a section with room. The mask is architectural — every layer type would carry it, it interacts with the layer record, and it is close enough to the shape layer type in group 3.2 that the two should be designed together rather than one retrofitted onto the other. Building taper first also means the mask has something worth masking on the day it lands.

**Status.** Taper was implemented once and reverted. The shader, control, acceptance row and inventory entry were all in place and the suite stayed green, but a measurement showed it changing the field symmetrically — the light share moved from 0.51 to 0.32 to 0 as the amount rose, while the two ends of a band stayed identical to three decimal places. That is a uniform width shift, not a drift along the band, so the geometry is wrong somewhere between the along-axis derivation and the split. A control whose proof cannot show a wedge is not worth having, so it comes back when the geometry is demonstrated rather than assumed.

The observable is already known and is the one to build against: sample a column near each end of a band and compare the light share. A wedge separates them; a width change moves them together.
