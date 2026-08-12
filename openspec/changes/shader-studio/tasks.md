# Tasks — Shader Studio

Implementation lives in the sibling app at `../shader-studio` (Toolcraft 0.0.18, integrity green at 650 files). The planning artifacts stay here in Cross10 so the Croix10 change and this one share one history; nothing in Croix10's `src/` is edited by this change.

Three rules from `AGENTS.md` and the Croix10 contract reconciliation apply throughout and are not repeated per task:

- **Product mode obliges proof in the same batch.** Schema, section inventory, acceptance rows, and browser tests for a control land together or the control does not land (R40).
- **Read the routed contract docs before writing** — Plan documents before a plan, Implementation documents immediately before editing code, Verification documents before writing proof; one document per read.
- **Focused checks while implementing, one bare `npm run verify:delivery` at each stage gate.**

Carried decisions from Croix10's `design.md` that this change does not relitigate: R23 (a gradient owns its type and angle atomically), R33/R34 (section titles and gate placement), R43 (a ramp is one entity), R44 (a canvas-owned gesture commits through `controls.setValue`), R45/R46 (a compound collection is exactly its `itemControls`; anything richer lives beside it).

The layer stack is the foundation. Nothing in groups 4 and later can be built against a stack that does not yet assemble, so group 2 precedes all feature work.

## 0. Stage 0 — contracts and product declarations

- [x] 0.1 Record the six-symlink scaffold defect and its fix in `docs/upstream/toolcraft-0.0.18-issues.md` (issue 6) so a future regeneration does not rediscover it
- [x] 0.2 Read `AGENTS.md` and the Plan-phase contract docs in the new app; confirm every runtime helper this change names exists in its signed `src/toolcraft` copy
- [x] 0.3 Create `design.md` for this change and open it with the contract reconciliation: what carries from Croix10 unchanged, what the layer stack changes, and the two framework defects that keep the full browser suite red without gating delivery
- [x] 0.4 Copy the delivery workarounds across — `tools/toolcraft-keepalive-preload.cjs` and the `test:browser:stable` script in `package.json`, the only unsigned surfaces
- [ ] 0.5 Confirm `npm run dev` serves the neutral starter, then switch `src/app/app-acceptance-data.ts` to `mode: "product"` with `productName`, `productSummary`, `requestedBehavior` — must land with 2.x and its acceptance rows as one coherent batch
- [ ] 0.6 Declare `exportIntent` as image and video only, with a written note that shader source is **not** an artifact and leaves through clipboard or MCP (R55)
- [ ] 0.7 Declare `viewInteraction: "non-spatial"` with the reason Croix10 recorded — 2D shader output, no scene geometry to orbit
- [ ] 0.8 Declare `interactionOwnership` assigning layer management to **Layers**, so no `fileDrop` row restates reorder or transform claims the layer recipes already prove (`component-contracts.media-custom.ts:72`)
- [ ] 0.9 Author the Control Selection Inventory for the layer surface first: for each setting record need, value model, built-ins checked, chosen built-in, why, rejected alternatives, target, renderer mapping, acceptance coverage
- [ ] 0.10 Author the entity decomposition and populate `appControlSectionInventory` — every section titled by the entity it edits, every gate in the entity it gates, none over ten controls
- [ ] 0.11 Write the Animation Intent Inventory selecting the keyframes timeline, with the derived loop period for `panels.timeline.defaultDurationSeconds`
- [ ] 0.12 Write the Renderer Technique Decision Matrix, arguing WebGL2 over a Canvas 2D baseline rather than assuming it
- [ ] 0.13 Declare `workloadEnvelope` dimensions — layer **count** is a new workload dimension Croix10 never had, since the assembled program grows with the stack
- [ ] 0.14 Compile `rendererPipelineRegistration` for the stack-composed pass chain, with cache keys that include the stack signature
- [ ] 0.15 Run `assessToolcraftRenderPlan` and resolve every structural error
- [ ] 0.16 Switch `docs/toolcraft/agent-worklog.md` to `Mode: product` with the first Decision Trail entry and all eight decision sections
- [ ] 0.17 Run `npm run ai:check`

## 1. Engine migration from Croix10

Copied, not imported: both apps are monolithic signed packages, so a shared dependency would break integrity in both.

**Reframed by R57.** These modules were moved across, then removed again — they are engine-shaped and the layer stack uses none of them, so they became orphans that fail the delivery gate. Each now travels with the group that consumes it rather than ahead of it. The entries below record what was learned about each module; the move itself happens in group 4.

- [ ] 1.1 Move the GLSL chunk registry and variant assembler with its variant cache → `studio-shaders.ts`
- [ ] 1.2 Move the ramp chunk — coordinate, sample, proximity push, slot colour → `studio-shaders-ramp.ts`
- [ ] 1.3 Move the schema-derived uniform upload, including sRGB-to-linear conversion for colour types → `studio-render.ts`
- [ ] 1.4a Move the parameters module → `studio-parameters.ts`, and the pipeline pass → `studio-pipeline.ts`
- [ ] 1.4b **Deferred to group 2.** The scene reader is the one moved module that reads schema state, and this app has no layer schema yet. Moving it verbatim would import Croix10's engine-shaped state model into an app whose state is a layer stack, so it is rewritten in 2.x against the real schema rather than copied and then undone
- [ ] 1.5 Move the timeline wiring: loop time from `getToolcraftTimelineLoopTime`, no wall-clock read anywhere in the render path — lands with 1.4b, since it reads timeline state through the same reader
- [x] 1.6 Rename every carried symbol off the `croix10` prefix in one pass — `Croix10`→`Studio`, `CROIX10_`→`STUDIO_`. Zero residual references; `tsc --noEmit` clean
- [x] 1.7 Populate `src/app/app-verification-impact.json` for each moved module. **Blocked until 2.8**: every entry's `acceptanceIds` must name rows that exist, and this app declares only `persistence.reload` until the layer acceptance rows land
- [x] 1.8 Write the unit tests for chunk assembly and variant cache keying. Croix10 never wrote them (its own 1.11 is still open), so there is nothing to carry — authored here against the stack-signature key (R54). 12 tests, `studio-layers.test.ts`, all passing

## 2. Layer-type registry and stack assembly

The largest divergence from Croix10, where an engine is one monolithic variant with its components fixed. Here the program is assembled from an ordered stack the user builds.

- [x] 2.1 Define the layer-type registry: each type declares its GLSL chunk, its uniform set, and its blend contribution → `studio-layers.ts`. The per-layer *control* recipe is deferred to 2.6, where it lands with the schema rather than ahead of it
- [x] 2.2 Register the first two types — **stripes** and **gradient** — as the minimum pair that proves ordering matters
- [x] 2.3 Implement stack assembly: one program composed from the ordered stack, source-over blending in linear light, replacing per-engine variant selection. Visibility folds into the composite weight so a hidden layer costs no branch
- [x] 2.4 Key the variant cache on the stack signature — ordered type list, not a single engine id (R54) → `studio-stack-render.ts`. Kept as a separate renderer from the engine one: sharing a cache would mean one key space describing two different notions of "which program"
- [x] 2.4a Resolve **R56** → **route A**, a product-owned record at `stack.layerRecord` keyed by `layer.id`, with `selectedLayer.type` supplying the layer type the runtime has no field for → `studio-stack-state.ts`, 17 tests
- [x] 2.4b Wire the R56 sync into React → `studio-layer-sync.ts`: projects the record into `selectedLayer.*` on selection change, collects edits back under the selected id, guarded on the last-synced id
- [x] 2.4c Declare `persistence.additionalValueTargets: ["stack.layerRecord"]` — an uncontrolled target is not persisted without it, the same gap the cursor hotspot hit in Croix10
- [x] 2.5 Enable `panels.layers`; the runtime owns the list, selection, visibility, grouping, and reordering, and product code authors none of them
- [ ] 2.5a Land **four** runtime acceptance rows — `selection`, `visibility`, `reorder`, `grouping` — each with automated *and* browser proof and a written observable. Grouping is obliged by `runtime-coverage.ts:21` whether or not the product wanted it, so it ships as a real feature rather than a stub (R50)
- [x] 2.6 Wire per-layer editing through `selectedLayer.*` targets → `studio-layer-sections.ts`. Two sections over one entity with a recorded `splitReason`: `Layer Composition` (kind, opacity, angle) and `Layer Pattern` (colours always, band controls gated to stripes, transition shape gated to gradient). `selectedLayer.type` is the gate and sits in the entity it governs (R34); neither title collides with an option label (R33)
- [x] 2.6a Author the product-mode declarations, section inventory, and 13 acceptance rows → `app-acceptance-data.ts`, `studio-acceptance-rows.ts`
- [x] 2.6b Rewrote `src/app/app-schema.test.ts`, which asserts the *starter* shape — no product sections, no layers panel. It fails by design once a product schema exists
- [x] 2.6c **Moved `selectedLayer.type` into `Layer Pattern`.** R34 turns out to be per-*section*, not per-entity: four controls are rejected as "gated by applicability target selectedLayer.type" while that gate sits in a sibling section, even though both sections share an `entityId`. Merging or moving the gate is required; re-check the section budget afterwards
- [x] 2.6d Add the runtime Setup obligations that artifact export brings → `studio-background-sections.ts`, its inventory entry, and two acceptance rows. The section is declared by the product but relocated into Setup by the runtime, so it never appears in the product section list
- [x] 2.6e Add `panelActions` to the controls panel sticky footer → `studio-export-sections.ts`
- [x] 2.6h Inventory entries reconciled with the rendered sections. **An entity with ten or fewer controls must stay in one section**, so `selected-layer`'s two sections were merged into one titled `Selected Layer`, and `delivery-actions` gets no entry at all — the runtime renders the sticky footer outside the product sections
- [x] 2.6l Declare `semanticGroup` on all nine `Selected Layer` controls — three clusters: composition, colour, pattern
- [x] 2.6m Add the `canvas.renderScale` row. `renderScaleCoverage` is an object, and its `states` must equal exactly `interaction, steady` — `playback` joins in the animation group, since this app declares no timeline yet
- [x] 2.6n Land the `scene-bounds-image-export` row. Two separate rows are required, and each is matched on its **evidence** kind — `exported-bytes` for scene-bounds, `viewport-side-effect` for mode-and-restoration
- [x] 2.6i Acceptance rows for `export.image.format`, `export.image.resolution`, and `export.actions` (the footer) with the typed `export-image` action → `studioExportAcceptanceRows`
- [x] 2.6j Add the `mode-and-restoration` infinity row — `editable-output` obliges it independently of export (see 2.6n for the second)
- [x] 2.6k Widen `background.include`'s `backgroundOutputCoverage` to all three: preview-hidden, image-transparent, and infinity-viewport-colour-and-dependency
- [x] 2.6f Add the Image Export settings section, titled and laid out as the validator specifies (two-column inline `layoutGroup`). Its browser row and the `canvas.renderScale` row are 2.6i/2.6j
- [x] 2.6g Link the `layer-selection` ownership entry to its proof via `interactionId` on the `selectedLayer.type` row — the link is an explicit field, not an inferred target match
- [x] 2.7 Resolve R52 → **name-mangled per-layer uniforms**. Its only stated cost (a recompile per stack edit) is inherent under all three schemes because R54 keys on the stack signature, leaving readable delivered source as the tiebreaker
- [ ] 2.8 Acceptance rows for the layer surface, every `selectedLayer.*` control declaring `layerCoverage: "selected-layer-controls"` alongside its own coverage (R51): reordering changes what covers what; a per-layer edit changes only that layer
- [x] 2.8a Declare `workloadEnvelope` dimensions before the pipeline can be registered — the pass declares its cost against named dimensions, and **stack depth** is this product's new one (0.13 lands here rather than in group 0, because it cannot be written before the stack exists). Two dimensions, and the shapes are already settled:
  - `stack-depth` — `source: { kind: "runtime-state", path: "layers" }`, `mapping: "direct"`, unit `layers`. `ToolcraftWorkloadSource` does admit a runtime-state kind alongside schema-target, which is what makes this expressible at all: stack depth has no schema control behind it, since the runtime owns the layer list
  - `band-count` — `source: { kind: "schema-target", target: "selectedLayer.count", workloadBoundary: "maximum" }`, boundary equal to the schema endpoint (200), not an invented number
  - Lands together with `rendererStrategy: "webgl"`, `rendererPipeline`, `rendererTechnique`, and `fixtureAdapters.dimensions` for both ids — the envelope is not independently valid while the strategy still says `none`
- [x] 2.8b Register `rendererPipelineRegistration` for the stack: one `composite` pass, `cacheKey: ["sceneParameters", "backing"]`, and `interactionInvalidation` covering initial-render, control-change (including `canvas.renderScale`), control-drag, and export — with viewport-drag and viewport-zoom declaring `mustNotInvalidate`, since the stack is resolution independent and a viewport transform re-resolves nothing
- [x] 2.8c Write `studio-scene.ts`: runtime state → `StudioStackSceneParameters`, pruning the record against the live layer array and converting hex colours to linear light
- [x] 2.8d Write `studio-canvas.tsx`: mount the WebGL2 surface, run `useStudioLayerSync`, and draw through `useToolcraftPipelinePass` rather than a loose effect, so runtime execution, invalidation, and performance evidence all describe the same declared pass
- [x] 2.8e Wire `appComposition`: `canvasContent`, `rendererPipelineRegistration`, `sceneBoundsProvider`, and an `exportRenderer` that draws through the same renderer as preview so the two cannot drift
- [x] 2.8f Switch `docs/toolcraft/agent-worklog.md` to `Mode: product` with the first Decision Trail entry — the Verification field must match one of the accepted literals exactly, not a results narrative
- [x] 2.9 Browser proofs for both rows, plus an app-owned proof that the assembled shader reflects the same order the panel shows. Layer coverage **must drive real LayersPanel rows and buttons**, never `layers.*` command dispatch (`component-contracts.runtime.ts:297`)
- [ ] 2.10 Run `npm run verify:delivery` — **first protected delivery**, and the point at which product mode is satisfied

## 3. Remaining layer types

- [ ] 3.1 Register the **image** layer type, drawing its media through the runtime media surface rather than a product-authored uploader
- [ ] 3.2 Register the **shape** layer type, applying R45/R46: the collection is exactly its `itemControls`, positions live in a canvas-owned array beside it
- [ ] 3.3 Prove an image layer composites above, below, and between procedural layers — the scenario that motivated the whole stack
- [ ] 3.4 Acceptance rows and browser proofs for both types in the same batch
- [ ] 3.5 Run `npm run verify:delivery`

## 4. Control surface parity with Croix10

Croix10's surface is the floor, not the ceiling. Each control carried across still obliges its own acceptance row and browser proof here — a proof passing in Croix10 proves nothing about this app.

- [ ] 4.1 Carry the stripe field controls onto the stripes layer type
- [ ] 4.2 Carry the chromatic ramp surface (9A) onto the gradient layer type, consuming all five gradient parts per R23
- [ ] 4.3 Carry the cursor field (9B) as a per-layer effect, with the hotspot committed to state per R44 and persisted through `additionalValueTargets`
- [ ] 4.4 Carry the palette and colour slot surface
- [ ] 4.5 Acceptance rows and browser proofs for every control carried, batched per group
- [ ] 4.6 Run `npm run verify:delivery`

## 5. Gallery

- [ ] 5.1 Implement the gallery as a `select` over the preset library, applied through runtime commands so undo and reset behave normally
- [ ] 5.2 Port Croix10's eleven presets as the first collection, each expressed as a layer stack rather than an engine id
- [ ] 5.3 Prove selection sets a starting state and leaves every control live — the scenario the spec exists to pin down
- [x] 5.4 Resolve open question 4: whether the gallery needs its own persistence, and record the answer in `design.md`
- [ ] 5.5 Acceptance rows and browser proofs; run `npm run verify:delivery`

## 6. Per-layer animation

- [ ] 6.1 Extend the timeline transport so each layer carries its own animation rate
- [ ] 6.2 Hold the loop seam per layer — a stack whose layers close at different times does not close at all
- [ ] 6.3 Prove two layers animating at different rates both return to their first frame at the loop's end
- [ ] 6.4 Acceptance rows and browser proofs; run `npm run verify:delivery`

## 7. Shader source assembly

- [x] 7.1 Resolve R53 (proposal open question 2) and record it in `design.md`: whether the artifact is a bare fragment shader or a runnable module carrying its uniform declarations and defaults. The MCP's usefulness depends on the answer, so this precedes 7.2
- [x] 7.2 Implement assembly: composed GLSL plus **current** uniform values — whatever the user has edited them to, not the preset's stored values
- [x] 7.3 Emit source that compiles without referencing the studio's chunk registry
- [x] 7.4 Assert no watermark, attribution comment, or injected identifier appears in the output — a test, not a convention
- [x] 7.5 Unit tests over assembly for every registered layer type and for a mixed stack

## 8. Clipboard delivery

- [x] 8.1 Add the copy-source action as an additional product action that never substitutes for artifact intent (`core/setup-export.md`)
- [x] 8.2 Assert `exportIntent` still describes only image and video after delivery is exercised
- [ ] 8.3 Acceptance row and browser proof; run `npm run verify:delivery`. **Row and proof are done** — the copy action rides on the `export.image-action` entry, because footer coverage is checked against every action in the sticky footer whichever control declares them, and the browser proof asserts runnable source on the clipboard. Only the delivery run is outstanding, and it is blocked with 2.10

## 9. MCP delivery — the primary path

- [ ] 9.1 Scaffold the MCP package outside the signed app, so it carries no integrity obligation
- [ ] 9.2 Expose the gallery: list entries with enough description for an agent to choose between them
- [ ] 9.3 Expose assembled source for a named entry with parameter overrides
- [ ] 9.4 Integration test: an agent-shaped call returns source that compiles standalone
- [ ] 9.5 Document installation and the tool surface

## 10. Preset corrections

Deferred here deliberately — neither the selection model nor the control surface depends on the stored values being right.

- [ ] 10.1 Review all eleven ported presets against the gallery bar and list what each needs
- [ ] 10.2 Correct them, re-proving only the presets whose acceptance coverage changed

## 11. Final delivery gate

- [ ] 11.1 Full `npm run verify:delivery` with a valid receipt
- [ ] 11.2 Record the closing Decision Trail entry with the exact Verification literal the validator accepts
- [ ] 11.3 Run `openspec validate shader-studio --strict` and archive the change
