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

## R60 — the component model: shapes, treatments, shadows, and presets

Raised by a set of twenty-two reference works supplied by the user, with the request: *a complete background, then a component on top that can be plain or striped, draggable and resizable by node handles, on its own layer, with hue, saturation, contrast and blending mode — and shadows that taper. Plus presets for each, keeping the Cruz-Diez techniques already planned.*

### What the references actually need

Sorting them by mechanism rather than by appearance gives five groups, and the groups are what the work should follow.

**A — Wedge zones.** Horizontal or vertical stripe fields with rectangular zones where the bands taper, the zones differing in lean and often in colour. Most of the set. **Reachable today**: taper (R59) plus the region mask and its placement land this, and the session already reproduced one. What is missing is only colour: each zone wants three or four inks, and a layer carries two.

**B — Chromointerference.** A circle or ellipse over a fine vertical colour field, the shape shifting hue and brightness of everything beneath it rather than painting over it. Needs an **ellipse region**, a **per-layer colour treatment**, and a **blend mode** — the shape is a lens, not a sticker.

**C — Scattered patches.** Rotated rectangles of striped fill on a plain ground, each at its own angle. Needs **shape rotation** and many independent instances.

**D — Wedge prints.** Parallelogram bands in three or four colours. Reachable today except for the ink count, same as group A.

**E — Fluted glass.** Photographs seen through a ribbed surface: a striped *displacement* of an underlying image, not a striped overlay. Needs the **image layer type** (3.1) plus a refraction effect. Furthest from what exists, and the only group whose subject is imported media.

### Decision

Five capabilities, in this order, because each is useful before the next exists.

1. **Shape layer type.** A layer whose fill is plain or striped and whose extent is a rectangle or ellipse with position, size and rotation. This is the "component". It generalises the region mask rather than duplicating it: a region is already a rectangle with a centre and an aspect, so the shape kind and rotation land there and the shape layer is a layer that *draws* its region rather than merely being clipped to it.
2. **Canvas handles.** Drag to move, node handles to resize. The runtime carries this as a first-class extension point with its own acceptance kind, so the handles write to runtime state, stay textless, and are proved to be absent from export — that last part is why this is not a free-floating overlay.
3. **Layer treatment.** Hue, saturation, contrast, and blend mode, applied to a layer as it composites. Treatment is what makes group B possible at all: the shape must change what is beneath it, and a layer that can only paint cannot.
4. **Tapered shadow.** A shadow attached to a shape, offset from it, drawn as a band whose thickness varies along its length — the same construction as the taper that already exists, applied to the shape's edge rather than to a stripe. The reference shadows are wedges, not blurs, which is why this belongs to the taper family rather than to a filter.
5. **Presets.** Each reference expressed as a named stack. This is the gallery (group 5), and it stays blocked behind the ink count and these capabilities rather than being a separate problem.

### Consequence

**The two-ink limit is the binding constraint.** Groups A and D are otherwise reachable now, and both are held back by a layer carrying two colours where the works carry three or four. Group 4.4's palette surface is therefore not a late nicety — it is the thing standing between the current product and half the references. It should move ahead of 4.2 and 4.3.

**Treatment changes what a layer is.** Until now every layer paints and composites. A layer with hue, saturation, contrast or a blend mode reads what is beneath it, which makes the stack order meaningful in a way it has not been, and makes the composite pass genuinely a composite rather than a series of paints. The pass declaration and its workload envelope should be revisited when it lands.

**Handles oblige export proof.** A product editing handle must be provably absent from the exported artifact. That is a browser proof of the same shape as the background-transparency one, and it should be written with the handle rather than after it.

## R61 — the lens falls out of separating reach from opacity

Raised while building R60's treatment (12.4/12.5). The reference works in group B put a shape over a field and the field beneath it shifts hue and brightness without being covered. The obvious reading of that is a mode — "this layer is a lens, not a paint" — and a mode is what the schema would then have to carry, gate controls on, and prove.

### Decision

No mode. Treatment is weighted by the layer's **reach** — visibility and region — and opacity weights **only the paint**. The two were already separate quantities in the composite; they had simply always been multiplied together.

A layer at zero opacity therefore treats everything it covers and paints nothing of its own. That is exactly the lens, reached by dragging a slider the product already had, and every intermediate setting is meaningful rather than being an off state for a mode.

### Consequence

**Opacity now means something more precise.** It was "how much of this layer you see"; it is now "how much of this layer's own colour is painted". For every layer that existed before treatment the two readings coincide, so nothing changes for them, but the second is the one the composite implements.

**The proofs must read outside the region as well as inside.** A reading confined to the layer's own extent cannot tell a lens from a layer that simply painted that colour. Both treatment proofs and any that follow report both places, and the outside one staying put is half the claim.

## R62 — the shape layer type is not free, and the region already carries most of it

Raised while scoping R60's item 1 (task 12.2) after 12.1 landed.

With the region carrying a kind, a rotation, a size, an aspect and a placement, a striped shape is already a stripes layer confined to a region, and the ellipse the works need is a region setting. What a dedicated shape layer type would still add is a **plain fill**.

### Decision

Defer 12.2 rather than build it now, and record what it costs so the decision is not re-taken blind.

A plain-fill type has no second colour and no palette, so registering it turns `selectedLayer.colorB` and all three Layer Palette controls from always-applicable into conditional ones. Every conditional control spawns applicability requirements that each need their own browser evidence — the same shape as the export-format ones already in the catalog. The type is a dozen lines; the gating it forces is the actual work.

### Consequence

**"Plain or striped" is already reachable**, if awkwardly: a gradient layer with both colours equal, confined to an ellipse, is a plain shape. The gap is ergonomic, not expressive, which is why it yields to treatment and handles.

**Nothing re-arms `scene-bounds-image-export`.** R58 deferred that row against "the first layer type with an extent of its own". The region is not that — it clips at composite rather than giving a layer an intrinsic extent — so the deferral stands, and the row stays out rather than joining `canvas.infinity-export` as a second permanently failing requirement.

## R63 — shape layers, free-form shapes, and imported images

Raised by the user: *"the layers [should] be shapes — all the shapes that we had before, the geometric shapes, but also we need to be able to create free-form shapes. Also we need to be able to import images: PNG, SVG, JPEG."*

Three capabilities that look like one request and are not. Each has a different cost, and one of them changes the schema for all the others.

### What already exists

The region carries kind (rectangle or ellipse), size, aspect, placement and rotation (12.1), and it is shaped on the canvas by handles that write those targets (12.3). What is missing is that a region *clips* a layer rather than *being* one — there is no layer whose subject is its own outline.

### Decision

**1. The shape layer type, and the gating bill that comes with it.**

R62 deferred this and priced it: a plain-fill type has no second colour and no palette, so registering it turns `selectedLayer.colorB` and all three Layer Palette controls from always-applicable into conditional ones, and every conditional control spawns applicability requirements that each need their own browser evidence. That bill is now due — it is not avoidable by cleverness, because the user wants shapes as *layers*, not as regions.

Pay it once and deliberately: introduce the type, gate the four controls, and write the applicability proofs in the same batch. Do not spread it across several changes, because a half-gated schema is harder to reason about than either end state.

**2. Free-form shapes are a vertex list, and the handles already exist for them.**

A free-form shape is a closed polygon: an ordered list of points in the same normalised, height-relative units the region already uses. This is the right model rather than bezier paths, because the reference works are hard-edged — every shape in the set is a straight-sided figure — and a curve model would cost a control surface, a solver, and a shader that no reference needs.

The vertex list makes the existing canvas-handle work pay off twice: a vertex is a node handle, and 12.3's geometry module already converts between pointer and region units. What is new is that the number of handles is data rather than a fixed eight, which the handle layer currently assumes.

Rendering: point-in-polygon by crossing count in the fragment shader, bounded by the vertex count. The count must therefore be a workload dimension, since unlike every existing control it changes work per pixel.

**3. Images are two different features wearing one word.**

PNG and JPEG are raster: decode to a texture, sample it, and the layer is an image layer. This is task 3.1, and it needs the runtime's media lifecycle coverage rather than a plain control — the acceptance types already carry `mediaLifecycleCoverage` for exactly this.

SVG is not raster. Rasterising it to a texture throws away the thing that makes it worth importing — it is already a set of shapes, and the product now has a shape layer to put them in. **An imported SVG should become free-form shape layers, one per path, not a picture.** That makes import a conversion into the product's own model rather than a foreign object inside it, and it means an imported logo can be recoloured, tapered, and treated like anything else the user drew.

That decision has a boundary worth stating: SVG features with no equivalent in the shape model — curves, gradients, strokes, clip paths, text — must be reported as unsupported at import rather than silently dropped. Curves specifically will need flattening to line segments, and the flattening tolerance is a real decision, not a constant to guess.

### Consequence

**Order matters, and it is not the order the request was made in.** The shape layer type is the foundation: free-form shapes are a shape layer with a vertex list, and SVG import produces free-form shapes. Raster import is independent of all three and can land whenever. Doing SVG before shapes would mean building a rasteriser that the shape work then makes pointless.

**The handle layer needs to become plural before free-form starts.** It currently renders a fixed eight nodes around one rectangle. A vertex list needs one handle per point, added and removed as the shape is edited, and an acceptance row per handle kind rather than per handle.

**The workload envelope changes for the first time since the stack landed.** Every control so far has been constant per-pixel cost. A polygon's vertex count is not, so `workloadEnvelope` and `rendererPipelineRegistration` both need revisiting — the same revisit 12.7 already asks for after treatment.

### Sequence

1. Shape layer type with the geometric shapes, and the R62 gating bill paid in full.
2. Handle layer generalised from a fixed eight to a list.
3. Free-form vertex shapes, with vertex count declared as a workload dimension.
4. Raster image layer (3.1), PNG and JPEG, through media lifecycle coverage.
5. SVG import as a conversion to free-form shape layers, with an explicit unsupported-feature report.

## R64 — the shape is the layer, the technique is the engine, and the cursor is an input

Supersedes the shape half of R63 and the 13.1 brief written beside it. Raised by the user after seeing 12.1 and 12.3 land:

> *"Right now we have only the square, the rectangle, and the ellipse. What you call the region is this shape and I need to create any type of shape that I want. It can be with a pen ... triangle, circles, squares, rectangles, diamonds ... I don't need the layer region on the sidebar. What I need is to have the option to select those forms to create them."*
>
> *"I didn't see that you removed the other set of options that we previously had ... different chromatic engines so that I can create all the different styles from Cruz-Diez ... they need to be able to, like a shader does, have these cursor interactions."*

### Three corrections to what was planned

**1. The region was the wrong shape of idea.** R63 treated shapes as a new layer *type* sitting beside the region. The user's reading is simpler and better: the region **is** the shape, and it should be chosen when the layer is created rather than assembled afterwards from four sliders. A layer is a shape; the shape has a form; the form is picked from a set.

That kills the Layer Region section as a control surface. Its targets survive as the shape's geometry -- placement, size, aspect, rotation are still what a shape has -- but they are driven by the canvas handles (12.3) and not by sliders in the sidebar. This is the same retirement 13.7 already required for the acceptance model's sake; it now has a product reason as well, which is the better of the two.

**2. Two shapes is not a shape set.** Rectangle and ellipse were what the mask arithmetic gave away cheaply. The user wants the actual vocabulary: triangle, square, rectangle, circle, ellipse, diamond, regular polygon, and a free-form pen. Most of these are one construction, not eight: a **regular polygon of n sides with a rotation** yields triangle, diamond, square, pentagon and hexagon, and the circle is its limit. Only the ellipse (a scaled circle, already present) and the free-form polygon are separate. So the set is three constructions -- ellipse, regular polygon, free vertex list -- presented as a vocabulary of named shapes.

**3. The Cruz-Diez techniques were never ported, not removed.** Worth stating plainly because the user reasonably read their absence as a regression. The engine-shaped modules came from Croix10 and were taken back out under R57 as orphans the layer stack did not consume. Nothing was deleted from a working product; the techniques have been waiting for the layer model to be ready for them, and it now is.

### Decision

**Shapes are chosen, not configured.** Adding a layer offers a form. The form is a `shape` uniform -- ellipse, polygon, or free -- plus a side count for the polygon case and a vertex list for the free case. The sidebar loses Layer Region entirely; the canvas gains the handles that already exist.

**A pen tool is a mode, not a control.** Free-form drawing is a canvas interaction: click to place vertices, close the path to finish. That makes it the second canvas-owned operation after region shaping, and it needs the handle layer to render a list rather than a fixed eight (13.2, unchanged).

**Chromatic engines are a per-layer choice, like the layer kind.** Each Cruz-Diez technique -- chromatic induction, chromointerference, physichromie -- is a way of colouring a field, so it belongs beside `selectedLayer.type` as a second axis: what the layer draws, and how it is coloured. Not a global mode, because the reference works combine techniques across layers in one picture, which a global switch would forbid.

**The cursor is a uniform, not an event.** Hover interaction means the pointer's position and its proximity to a shape reach the shader as values, and each engine decides what to do with them. That keeps every technique's response to the cursor in the same place as the technique itself, and it makes the interaction continuous rather than a hover state that is either on or off. Croix10's proximity-push chunk (task 1.2) is the existing prior art and should be read before this is designed further.

### Consequence

**Retiring the region sliders is now load-bearing, not housekeeping.** It blocks the handles from merging and it is what the user asked for, so it goes first rather than last.

**Cursor input changes the frame contract.** Every control so far has been static: the same stack renders the same frame anywhere. A cursor uniform makes the preview interactive while the exported artifact and the delivered source must stay deterministic -- the export has no cursor. What the cursor resolves to at export time is a decision that must be made explicitly, not inherited, and R53's baked-source deliverable has the same question.

**The workload envelope takes two new dimensions**, not one: polygon vertex count (R63) and whichever engines cost more per pixel than the plain ramp. Both land in the revisit 12.7 already asks for.

## R65 -- the vocabulary is named forms over two constructions, and a layer arrives with a size

Settled while building 14.2, which R64 left as "ellipse, regular polygon with a side count, and free vertex list, presented as named forms". Three questions came up that R64 did not answer, and each was decided against the shape the code actually took.

### Square and circle are not forms

R64's list of names includes square and rectangle, and circle and ellipse. In the geometry they are the same construction at different extents: a square is a rectangle whose two half-extents are equal, and a circle is that reading of an ellipse.

Naming them separately would create a control that lies. The extents are handle-driven (12.3), so the moment an author grabs a corner of their "square" and pulls it wide, the select still says Square while the canvas shows a rectangle. A form the product cannot keep true is worse than a form it does not offer, particularly when the true one is one drag away and starts there: the default aspect is one, so choosing Rectangle draws a square and choosing Ellipse draws a circle.

So the vocabulary is **Rectangle, Ellipse, Triangle, Diamond, Pentagon, Hexagon, Polygon** -- seven names over two constructions, with the side count exposed only for the general case.

### The polygons are inscribed in the extent, not circumscribed about it

A regular polygon can be measured to its vertex or to its side, and the two differ by a factor that grows as the side count falls -- at three sides, a polygon measured to its side reaches twice as far as the box that describes it.

The extent belongs to the handles, so the polygon is measured to its vertex: whatever the form, the shape sits inside the box its size and aspect describe and never spills past a corner a handle is drawn on. The cost is that a triangle covers less of its box than a rectangle does, which is what a triangle is.

Aspect stretches the coordinate rather than the polygon, so a widened diamond is still a diamond and not a lozenge whose angles have drifted.

### The free vertex list arrives with the pen, not here

R64 counts three constructions. Only two land in 14.2. A vertex list is not authorable until the pen exists (14.4) and not editable until the handle layer renders a list (14.3), so shipping the form now would put an option in the select that no author could choose and no proof could exercise. It lands in 14.4, with the operation that creates it.

### A layer arrives with a size

The default half-extent is 0.35 of the frame height rather than zero. This is the part 14.1 was blocked on: a shape that starts at nothing has to be given an extent by something *other* than its handles before its handles can be reached, which is exactly the dependency on the region sliders that 14.1 removes.

Zero still means unmasked. It is no longer where a layer starts, but it is the only way to say "the whole frame", and a size that made the layer vanish instead would leave that unsayable. What changed is that it stopped being load-bearing: nothing has to pass through it to get a shape any more.

**Consequence for the proofs.** Every browser proof that read the frame's corner to find the selected layer was reading a layer that covered the frame because nothing confined it. Those readings move to the shape the layer now has. That is not proof churn to be minimised -- it is the proofs catching up with what a layer is.

## R66 -- the geometry stops being controls, and one entry owns the gesture

Settled while landing 14.1. Retiring the four Layer Region sliders is not a deletion; it is a transfer, and the framework had three things to say about where the geometry lands.

### It is still a value target, just not a control

`selectedLayer.maskSize`, `maskAspect`, `maskCenterX` and `maskCenterY` keep existing. The handles dispatch `controls.setValue` against exactly those names and `collectStudioSelectedLayerEdit` reads them out of the same value map it always did -- what they stop being is *controls*.

That makes them uncontrolled product targets, the same category as `stack.layerRecord`, so they are declared in `persistence.additionalValueTargets`. Without that a reload throws away every shape the author placed, and it fails silently: the shapes come back at their defaults, which looks like a rendering bug rather than a persistence one.

### One ownership entry, because one dispatch

The three gestures write three different targets, and an `interactionOwnership` entry names exactly one. The first attempt split them into three entries -- move, resize, widen -- which typechecked and read badly: they are one operation with one surface and one alternative, described three times.

The truthful single target is `controls.setValue`, which is literally what all three dispatch. So one entry, `shape-shaping`, whose declared alternative is the panel it just left.

### The default size is bounded by the smallest window, not by taste

14.2 set the default half-extent to 0.35 of the frame height. That is wrong for a reason only the handles could reveal: at 0.35 a shape is 756 pixels tall, and in a window shorter than the frame its corner nodes fall outside the view entirely. Handles that cannot be reached are handles that do not exist -- the same failure 14.2 was written to fix, one level up.

**0.25**, half the frame's height, leaves the shape and every one of its nodes inside the view even when the window is smaller than the frame.

### What it cost the proofs, and what that revealed

Re-grounding the proofs on a confined layer turned up three readings that were passing for the wrong reason, all of them latent long before this change:

- A patch 24 pixels wide judged "is the layer here" against a field whose bands repeat every ninety. It was right only while the fixture happened to straddle an edge.
- A row read across a window of the frame divided its ink shares by the *frame's* width, putting every ink within a hair of the threshold. A four-ink palette read as three.
- A mirror reading indexed a full-width row into a buffer holding a window of it, comparing undefined against undefined.

None was caused by retiring the sliders; all three were found by it.

### Inside the shape the drag belongs to the shape

The merge surfaced one interaction the two halves disagreed about. The infinity canvas pans on a plain drag, and the handle body claims the pointer over the whole of the selected shape — so a pan started at the middle of the canvas moved the shape instead of the view.

Resolved the way every design tool resolves it: **inside a selected shape a drag moves the shape; outside it a drag pans the view.** Nothing in the product changed for this; the proof that panned from dead centre now pans from bare canvas, which is what an author does anyway.

Worth naming because it is the first place where the canvas has two owners at once, and 14.4's pen will be the second. A mode that wants the whole canvas — the pen does — has to say so rather than assume it.

## R67 -- an engine reads a field, it does not build one

The port R57 deferred, decided while doing it. Croix10's six engines are field *generators*: each one owns its geometry and produces the whole picture from uniforms. R64 asks for them as "a per-layer axis beside the layer kind", and those two shapes do not fit together as written -- an engine that builds its own field *is* a layer kind, and registering them that way would give the product eight kinds and no second axis at all.

The resolution is to separate what a technique *is* from what it *draws on*. A Cruz-Diez technique is a way of colouring a field with edges in it; the field itself is what a layer kind already provides. So an engine is a colour operation applied to the field the body has just resolved, reading the values that field already computed -- the band index, the distance to the boundary, the two inks either side.

### Three engines, because three of the six are already the product's own model

Reading the six chunks against the layer stack, only three are techniques the stack cannot already express:

- **Induction chromatique** -- the complement of the local colour along every boundary. Ported.
- **Physichromie** -- each strip presenting more of its neighbour as the viewer moves off head-on, with the side faces occluding. Ported.
- **Chromointerference** -- a second printed structure at a different pitch, beating against the first. Ported.

The other three are already here under other names, and porting them would have been duplication rather than delivery:

- **Couleur additive** is a band field whose separators are windows onto the support. That is `selectedLayer.separator`, delivered in group 4 -- and in a *stack*, what shows through a window is the layer beneath, which is the more truthful reading of the technique than a background colour was.
- **Transchromie** is sheets of transparent colour laid over one another, where the overlaps carry colours no sheet contains. That is the layer stack with multiply blending, in linear light, which is exactly what `studioBlend` already does.
- **Chromosaturation** is a full-field wash with no band structure. That is a gradient layer.

Recording this rather than shipping three near-duplicate engines is the point: the layer stack absorbed half of Croix10's engine registry by being a better model of the same thing.

### The amount is the identity at zero

All three engines share one control, and its contract is that **zero changes nothing**. That is what makes the amount comparable across techniques rather than being three unrelated numbers wearing one label, and it means an engine can be chosen and then dialled in rather than taking over the moment it is selected.

It also caught a bug in the port. Physichromie first read its amount as a viewer *angle*, centred so that the default sat at the midpoint -- where every band presents the average of itself and its neighbour, which for two inks is a flat grey field. The technique was destroying its subject at rest. Read as a displacement from head-on, zero is the field untouched and the sweep goes one way.

### The engine is not gated by the layer kind, and that is why the gradient has one

The first attempt gated the engine to stripes, on the ground that Cruz-Diez's techniques are stripe techniques. Two framework rules disagreed, and between them they made a better product decision than the intent had:

R34 puts a gated control in the section holding its gate, which would have put the engine controls in `Layer Pattern`; the ten-control rule then rejected that section at twelve. The only way out is an engine that is *not* gated by the kind -- which means the gradient must honour it too, which means the axis is genuinely beside the kind rather than inside one branch of it. Which is what R64 asked for in the first place.

A ramp has no band edges, so what stands in for the boundary is the seam between consecutive palette slots -- where a gradient's induced colour actually appears.

## R68 -- the cursor is a committed position, not an event

14.6 and 14.7 together, because the export question decides the design rather than following it.

### The decision 14.7 asks for

An exported artifact has no pointer. Neither does R53's delivered source: a shader taken away and compiled elsewhere has no studio around it to move a mouse. But the preview is interactive, and every control until now rendered the same frame anywhere.

Three answers were possible. The cursor could resolve to a neutral position at export -- the frame's centre, say -- which makes the artifact differ from the preview the author was looking at when they pressed the button. It could disable cursor-driven engines at export, which makes the artifact differ *more*. Or the position could be part of the document.

**The cursor is committed to state.** `stack.cursor` is an uncontrolled value target beside `stack.layerRecord`, written by the canvas and read by the scene builder, so the export frame builds the same scene the preview did and the delivered source bakes the position the author left it at. What you see is what you get, and the artifact stays deterministic because the value it reads is a value and not an event.

This is R44's precedent applied again -- the cursor hotspot was committed to state for the same reason -- and it is why the shader takes a `uCursor` uniform rather than sampling anything live.

A pointer that leaves the frame parks off-frame rather than staying where it was, so an export made with the pointer elsewhere on screen is the field with no cursor in it, which is what an author would expect of an image made while not touching the canvas.

### One quantity, and each engine decides

The cursor reaches the engines through a single value: how near the pointer is, falling off across a fixed radius. Each technique multiplies its own amount by it, so the response belongs to the technique rather than to the cursor -- induction spreads its fringe near the pointer, physichromie sweeps its viewing angle there, interference beats there.

Croix10's proximity-push chunk is the prior art. This is the same idea with the push replaced by whatever the technique already does, which is what makes it an input rather than a fourth engine.

It is opt-in per layer (`Follow the pointer`), because a stack where every layer chased the pointer would be a toy rather than an instrument, and because a static layer is still the common case.

### The listener cannot live on the canvas

Found by measurement, and worth recording because it will happen again. The first implementation put `onPointerMove` on the canvas element, and the engines never responded over the shape -- the region handles are an overlay drawn on top of exactly the field the engines colour, and they swallow the moves.

A pointer position is a global fact. It is read from the window and converted against the canvas rectangle, which is also what will keep working when the pen (14.4) adds a second overlay. Commits are coalesced to one per frame; the value is read once per draw regardless.

## R69 -- a drawn path is compiled, not uploaded

Decided while building the second half of 14.4. A free vertex list has to reach the shader somehow, and the two ways are not close.

**Uniforms do not fit, and would be the wrong shape even if they did.** Per-layer uniforms are name-mangled (R52), so a vertex array is one uniform per vertex per layer. The stack already carries about thirty vectors per layer at a declared depth of sixteen; a path of any useful length multiplies a budget that is already the largest thing in the program.

The deciding argument is not the budget though -- it is the same one R52 settled name-mangling on. **The delivered shader is the artifact this product exists to produce.** A baked path travels with it: the source someone takes away draws the shape that was drawn. Uniformed vertices would leave the shape behind and oblige whoever compiles the source to supply eight numbers they never saw.

So the vertices are literals in the assembled program, and the stack signature carries them: two stacks with the same types and different paths are different programs, and leaving the path out of the key would serve a cached shader for the shape the author just changed. Editing a path therefore compiles a new program, which is exactly the churn R52 already accepted as inherent.

### One function per layer

Each path has its own length, so a shared test would need a size it cannot have. Each layer with a path gets its own `studioPathInside{n}`, with the vertices as literals and the loop bound a compile-time constant.

The test is the crossing-number rule rather than a convex one. A pen draws concave shapes constantly, and a half-plane test would quietly fill the hull instead of the outline.

### Stored in the shape's frame

The mask tests against `maskLocal` -- the delta from the shape's centre, turned by its rotation -- so a path stored in absolute field units lands wherever the centre happens to be rather than where it was drawn. Vertices are transformed into that frame once, at authoring time, which is what makes moving and turning the layer move and turn the drawing.

Size and aspect deliberately do not scale it. A path is authored geometry rather than an extent, and the way to change it is to draw it again or move a vertex.

### The cap, and the dimension it does not remove

Twenty-four vertices. Every vertex is a literal and an unrolled iteration, so an unbounded path is an unbounded program.

The cap bounds the cost without making it constant: the crossing test walks the path once per pixel, so per-layer work varies with a length the author chooses. The growth class is unchanged -- still linear in stack depth -- but the per-layer constant is now author-controlled, which is precisely what a workload dimension declares. **It is not declared yet**, because a dimension obliges a fixture adapter that can build a path of a given length, which means driving the pen from the performance fixture. The pipeline comment names the gap rather than staying silent about it.

## R70 -- the chromatic ramp is carried as the layer's own controls, not as a compound gradient

Settled while doing 4.2, which reads "carry the chromatic ramp surface (9A) onto the gradient layer type, consuming all five gradient parts per R23".

R23 is a Croix10 decision: `gradient` is an atomic compound control owning its type, angle and stop list, and splitting those owned fields into sibling controls is forbidden. Croix10 therefore declared the compound control and proved all five parts -- `gradientType`, `angle`, `stops.position`, `stops.color`, `stops.opacity`.

### What this product already has

Reading the four parts against the gradient layer type, three of them are here already and are not siblings *of* a compound control -- they are the layer's own surface, shared with the other kinds:

- **type** is `Transition shape`: linear, radial, angular.
- **angle** is `selectedLayer.angle`, which every layer has, because every field has an orientation.
- **stop colours** are the palette slots: two to four inks, which a stripe rhythm reads as its cycle and a ramp reads as its stops.

What was missing is where the ramp *starts*. Croix10 carried that as 9A.3, a scalar beside the compound control; here it is 4.2's only real content.

### Decision

**Do not declare the compound `gradient` control.** Adopting it now would restate the angle, the transition shape and the palette as fields of a second control -- three operations with two surfaces each, which is the arrangement 14.1 and 15.3 exist to remove. R23 forbids splitting a compound control's fields into siblings; it does not oblige a product whose surface was never built that way to assemble one.

**Carry the ramp's placement as `Offset`, the control that already means it.** A band sequence slides along its axis and a ramp slides along its own, so one control covers both kinds and the gradient body reads a `phase` uniform named for the stripes' own. Its domain becomes signed, because a band sequence repeats and a ramp does not: forward by a cycle is the same bands and a different ramp.

The section rules make the same choice independently. A control gated by `selectedLayer.type` must sit in the section holding that gate (R34), which is `Layer Pattern`, and `Layer Pattern` is full at ten. A gradient-only offset had nowhere to live; the shared one needed no new place at all.

### What stays undelivered, and what it would cost

**Stop positions and stop opacity.** Uneven stops mean a position per slot, which is a collection (R45/R46) and therefore the compound control's job -- so it is the one part of 9A that cannot be carried in the sibling form. Per-stop opacity is a second alpha inside a layer that already has one, and it changes what "reach" means for a ramp: the layer would be partly transparent along its own axis rather than uniformly.

Neither is needed by the reference works: Cruz-Diez's washes are even, and the structures that are not even are band fields, which have their own controls. Recorded here rather than left implied, so the next attempt starts from the price rather than re-deriving it.

## R71 -- the gallery is a picker and an apply, because a select alone would store a stale claim

Settled while starting group 5, and before writing any of it, because the two tasks that describe the gallery disagree in a way the code would have had to resolve by accident.

5.1 asks for the gallery "as a `select` over the preset library". R58 decided the gallery persists nothing -- no stored active entry, because a stored selection keeps naming a preset that no longer describes the stack the moment anything is edited.

Those cannot both be had by a select that applies on change. Every rendered control's value is persisted: `include` carries `values`, and there is no per-target exclusion. So an apply-on-change select stores exactly the claim R58 rejected.

### Decision

**Two controls in one `Gallery` section: a `select` that names an entry, and an `actions` control that applies it.**

The select's value then means *the entry chosen in the gallery*, which stays true after any edit, because it is a picker rather than a status. Nothing about the stack is claimed by it. R58 stands unamended: the gallery still persists no statement about what the stack is.

The rejected alternative is apply-on-change, which is Croix10's arrangement and is right *there*: its presets and its engine share one control surface, so the active entry is a real property of the scene. Here the stack is the state, and the gallery is an applicator.

### A preset is a stack, not a target map

Croix10's preset is `Record<target, value>` and is applied as one `controls.setValue` per entry. That shape cannot express this product: two stripe layers with different angles are two entries under one target.

So a preset here is an ordered list of layers -- a type and its values each -- and applying one is a stack replacement: `layers.delete` for every layer present, `layers.add` per preset layer with explicit draft ids, one write of `stack.layerRecord`, and a `layers.select` at the end. All under a single `historyGroup`, so the whole application is one undo step and there is no parallel scene format to keep in sync. That is 5.1's "applied through runtime commands" read strictly: the runtime owns identity and order, the product owns the values hung off each id (R56).

### The ordering block R58 recorded is discharged

R58 blocked 5.2 on group 4, because six of Croix10's eleven presets are named for engines that did not exist here and would have collapsed into near-identical stripe stacks. Group 4 has landed: the three techniques the stack cannot express itself are `selectedLayer.engine`, and the three it can are the stack's own model (R67). The presets can now be expressed as what they are -- a stack, an engine per layer where the technique is the subject, and a palette.
