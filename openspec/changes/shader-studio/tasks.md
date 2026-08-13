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
- [ ] 2.10 Run `npm run verify:delivery` — **first protected delivery**, and the point at which product mode is satisfied. **Attempted; blocked on authorization, not on the product.** The perf specs it runs require fixture selector, resolution mode, nonce, pass ids, path ids, request authority hash and source hash *together*: `TOOLCRAFT_PERFORMANCE_FIXTURE_RESOLUTION_MODE=strict-development` clears the first gate and lands on the second. Those credentials come from an authorized operator or CI. Do not manufacture a nonce or an authority hash to make the gate green — the worklog already records the honest position: resolving it needs an authorized performance run, not an authored timing value

## 3. Remaining layer types

- [x] 3.1 **Image layers land**, and the surface is `canvas.upload` rather than a fileDrop control — one flag, and the runtime does the rest: it reads the file, allocates the asset, and creates the layer the asset belongs to. No product-authored uploader anywhere, which is what the task asked for.
  - **The evidence contract decided the design.** A `media-lifecycle` row requires `layer-media-lifecycle` evidence, and the only helper that attaches it asserts the layer collection changed. So a dropped picture must *create* a layer; media attaching to the already-selected layer cannot produce the evidence its own row requires. That shape was built and withdrawn rather than committed half-true
  - **No fileDrop, no fileDrop package.** The six-value lifecycle set (upload/remove/reset/rotate/flip/transform-output) exists to hold a *control* honest, and this product declares no control. Enabling `canvas.upload` added no acceptance obligation at all — verified by running the suites, not assumed
  - Renderer: `sampler2D` as a third uniform kind, per-layer texture units, a one-pixel transparent fallback so an unbound sampler cannot show another layer's picture, textures freed with the renderer. Media decoded off the render path through `useToolcraftMediaPresentationUrls`, the surface the runtime exports to products
  - Rotate and flip read from the **asset's own transform**, so the runtime's media controls drive this renderer rather than a product copy that would drift
  - A layer the runtime created for a picture *is* an image layer whatever the record says, because the record cannot know: the runtime allocates layer and asset together, and a product default of "stripes" would draw bands over the picture
  - `canvas.upload: false` had been asserted beside `sizing: editable-output` as one decision; they were always two. The frame is still sized by the author, and an image is a layer rather than the thing the frame is measured by


- [ ] 3.2 Register the **shape** layer type, applying R45/R46: the collection is exactly its `itemControls`, positions live in a canvas-owned array beside it
- [ ] 3.3 Prove an image layer composites above, below, and between procedural layers — the scenario that motivated the whole stack
- [ ] 3.4 Acceptance rows and browser proofs for both types in the same batch
- [ ] 3.5 Run `npm run verify:delivery`

## 4. Control surface parity with Croix10

> **Beyond parity — the wedge (R59).** The reference works the product is aiming at need two capabilities Croix10 does not have: a per-layer **taper**, which moves the colour split along a band's length so the band reads as a wedge rather than a line, and a per-layer **region mask** with an inside/outside sense, which confines that bend to a shape while the surrounding field stays parallel. Taper is self-contained and lands here; the mask is architectural and should be designed with the shape layer type in 3.2 rather than retrofitted. Taper was attempted once and reverted — see R59 for the measurement that rejected it and the observable to build against.

Croix10's surface is the floor, not the ceiling. Each control carried across still obliges its own acceptance row and browser proof here — a proof passing in Croix10 proves nothing about this app.

- [ ] 4.1 Carry the stripe field controls onto the stripes layer type. **Mirror is done**; jitter amount, jitter frequency and band separator are not, and they are blocked on the section budget rather than on the shader. Mirror took `selected-layer` to exactly ten controls, and an eleventh fails with *"owns 11 controls in section Selected Layer. Split entities above 10 controls into explicit workflow stages"*. So the entity must be split into workflow stages before any further per-layer control lands — and the split has to keep R34 (the `selectedLayer.type` gate sits in the section it gates) and R33 (section titles cannot collide with the gate's option labels), which is what made the earlier single-section arrangement the right one at nine controls
- [ ] 4.2 Carry the chromatic ramp surface (9A) onto the gradient layer type, consuming all five gradient parts per R23
- [ ] 4.3 Carry the cursor field (9B) as a per-layer effect, with the hotspot committed to state per R44 and persisted through `additionalValueTargets`
- [x] 4.4 Carry the palette and colour slot surface (delivered as 12.0)
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

## 12. Component shapes, layer treatment, and shadows

Raised from the user's reference set and decomposed in R60. Ordered so each item is useful before the next exists. Group 4.4's palette moves ahead of 4.2 and 4.3, because the two-ink limit is what holds back half the references and nothing here removes it.

- [x] 12.0 Carry the palette surface first (this is 4.4, pulled forward). A layer carries two colours and the works carry three or four; wedge zones and wedge prints are otherwise reachable today
- [x] 12.1 Extend the region with **shape kind** — rectangle or ellipse — and **rotation**. The region is already a placed, sized rectangle, so the shape lives there rather than in a parallel construct. Ellipse is what group B needs; rotation is what group C needs
- [~] 12.2 (deferred, R62) Register the **shape layer type**: a layer that draws its region rather than being clipped to it, with a plain or striped fill. This is the "component", and it is the first layer type with an extent of its own — which is also what re-arms the `scene-bounds-image-export` requirement deferred in R58, so that row returns with it
- [x] 12.3 (branch `region-handles-wip`, unmerged pending the slider retirement) **Canvas handles** for the shape: drag to move, node handles to resize. Runtime extension point with acceptance `kind: "canvas-handle"`; handles write runtime state, carry no text, and are proved absent from the exported artifact in the same batch
- [x] 12.4 **Layer treatment** — hue, saturation, contrast. Applied as the layer composites, so a layer can change what is beneath it rather than only painting over it
- [x] 12.5 **Blend mode** per layer. With 12.4 this is what makes a shape read as a lens, which is the whole of group B
- [ ] 12.6 **Tapered shadow** attached to a shape: an offset band whose thickness varies along its length. The reference shadows are wedges rather than blurs, so this reuses the taper construction rather than adding a filter
- [x] 12.7 Revisited with 13.4 and 14.8 as one pass. Treatment made a layer read the composite beneath it and write it back, which is more work *per layer* and therefore still linear in stack depth; the declaration now says so for treatment, engines and the cursor rather than being inherited from when every layer only painted
- [ ] 12.8 Acceptance rows and browser proofs for every control and handle above, batched per item
- [ ] 12.9 Presets for the reference set, as gallery entries (group 5). Blocked until 12.0–12.6, because the entries are exactly these capabilities in combination
- [ ] 12.10 **Fluted glass** — striped displacement of an imported image. Needs the image layer type (3.1) first, and is the only reference group whose subject is imported media rather than generated field

## 11. Final delivery gate

- [ ] 11.1 Full `npm run verify:delivery` with a valid receipt
- [ ] 11.2 Record the closing Decision Trail entry with the exact Verification literal the validator accepts
- [ ] 11.3 Run `openspec validate shader-studio --strict` and archive the change

### 12.3 in progress — what is done and what blocks it

Raised by the user: *"instead of having this layer region where we need to handle the layer by these range controls, I wanted to have an Edge and Node controller so I can resize the layer how I want on the canvas and I can drag and drop and move this layer however I want."*

On branch `region-handles-wip`, not merged, because it is not finished.

**Done.** `studio-region-geometry.ts` carries the whole screen-to-shader conversion with 14 passing tests — corner drags hold the opposite corner still, side nodes carry only width, cap nodes only height, and no gesture can ask for a value its slider could not hold. The handles render over the canvas as DOM and are *proved* absent from the exported artifact by the framework's differential export check, which forces every handle to a colour nothing in the stack uses and requires the two artifacts to be indistinguishable.

**Blocked on.** A drag reaches `controls.setValue` for all four region targets and only two land: `maskAspect` and `maskCenterX` take the written value, `maskSize` and `maskCenterY` are dropped — on every handle, including the ones whose purpose is to write them. Half the targets of one batched gesture surviving points at the R56 layer sync rather than the geometry, since the sync folds control edits back into the per-layer record on the same tick and four dispatches in one batch is a case it has not met. The geometry is tested in isolation and computes the right values, so the next session starts by watching what the sync does with a four-target batch, not by re-deriving the arithmetic.

**Also learned.** The product canvas is much larger than the viewport (1920x1080 at a 1280x720 viewport, origin at -320,-180), so a drag expressed as a fraction of the canvas leaves the viewport and its later moves are never delivered. Handle proofs must use modest pixel deltas.

## 13. Shapes and imported media (R63)

Raised by the user: layers that are shapes -- the geometric ones and free-form -- plus PNG, SVG and JPEG import. Ordered by dependency rather than by how the request was phrased: shapes come first because free-form is a shape layer with a vertex list and SVG import produces free-form shapes.

- [ ] 13.1 Register the **shape layer type** with rectangle and ellipse, and pay R62's gating bill in one batch: gate `selectedLayer.colorB` and the three Layer Palette controls, and write the applicability proofs beside them
- [ ] 13.2 Generalise the canvas handle layer from a fixed eight nodes around a rectangle to a **list of handles**, with an acceptance row per handle kind rather than per handle
- [ ] 13.3 **Free-form shapes**: a closed polygon as an ordered vertex list in region units, one node handle per vertex, point-in-polygon in the fragment shader. Vertex count is the first control whose cost is not constant per pixel, so it lands as a workload dimension
- [x] 13.4 Done with 12.7 and 14.8. The vertex count that will vary the cost is the pen's free vertex list, not the polygon side count
- [ ] 13.5 **Raster image layer** (this is 3.1): PNG and JPEG decoded to a texture, through the runtime's `mediaLifecycleCoverage` rather than a plain control
- [ ] 13.6 **SVG import as conversion**, not rasterisation: each path becomes a free-form shape layer, so an imported figure can be recoloured, tapered and treated like a drawn one. Curves flatten to segments -- the tolerance is a decision to record, not a constant to guess -- and every unsupported feature (gradients, strokes, clip paths, text) is reported at import rather than silently dropped
- [ ] 13.7 Retire the four Layer Region sliders in favour of the handles, which the acceptance model requires before 12.3 can merge: one operation, one owning surface

### 13.1 starting brief (superseded by R64 — see group 14; the verification notes at the end still apply)

Everything below is known, not guessed. Written at the end of the session that designed R63 so the next one can start editing rather than re-deriving.

**Where the work goes.** The app is `../shader-studio`, branch `task-2-8a-workload-envelope`. The canvas handles live unmerged on `region-handles-wip`; 13.1 does not depend on them and should branch from the main branch, not from the handles.

**The type.** `src/app/studio-layers.ts`, alongside `stripes` and `gradient`. A flat fill taking `colorA` only. Its GLSL body signature order **must** match its `uniforms` array order -- that trap cost this project three wrong diagnoses when `taper` was declared after `separator` and the body silently received the wrong value. Check the two lists against each other before running anything.

**The gating bill, in full.** Registering a type with no second colour and no palette turns four always-applicable controls conditional. In `src/app/studio-layer-sections.ts`, gate these to stripes and gradient only, following the shape of the existing `STRIPES_APPLICABILITY` / `GRADIENT_APPLICABILITY` constants:

- `selectedLayer.colorB` (section `selected-layer`)
- `selectedLayer.paletteSlots`, `selectedLayer.colorC`, `selectedLayer.colorD` (section `selected-layer-palette`)

Each gated control then needs applicability requirements with their own browser evidence. The existing `export.image-format` rows are the worked example of that shape -- read them before writing new ones.

**Verify both suites, every time.** `npm test` runs `node --test scripts/*.test.mjs` and then `vitest run src`. Grepping only the first one is how nine failures were reported green in this project. Check `# fail` from the node run *and* the `Tests` line from vitest. For the browser suite use `npm run test:browser:stable`, never a bare `playwright test` -- the bare form pulls in the perf and kernel specs, which need `TOOLCRAFT_PERFORMANCE_FIXTURE_RESOLUTION_MODE` and fail without it.

**Known-failing before you start**, so they are not mistaken for new breakage: `finds built-in controls through every module form` (a checker self-test running against a temp fixture, unrelated to product code), and `app-performance.gates.test.ts` (shells out to Playwright, needs the perf environment). The stable browser suite fails five framework specs -- three orientation, one runtime-requirements, one media upload -- all present at the branch point.

**A workload dimension has two homes, and the suites only watch one.** Adding or renaming a dimension re-identifies every performance path, and the path ids appear in *two* files: the scenarios in `src/app/app-performance.ts` and the adapters in `e2e/app-performance-path-adapters.ts`. Update both in the same commit.

Nothing in the stable suites will tell you if you forget. The perf specs are excluded from `test:browser:stable` by design, and the unit gate that would catch it (`app-performance.gates.test.ts`) is the documented failure that shells out to Playwright and needs the performance environment. `polygon-sides` and `path-vertices` each drifted this way with every suite green; `npm run verify:delivery` is what found it, and `npx playwright test --grep "browser perf: toolcraft adapter catalog"` is the cheap local check that would have.

**Measure before writing any expectation.** Every proof in this project that was written from intuition failed; every one written after dumping what the renderer actually produced passed first or second try. Write a throwaway probe spec, print the real pixels, then write the expectation. Delete the probe.

## 14. Shapes as layers, chromatic engines, and cursor input (R64)

Supersedes group 13's shape items. Ordered so each is usable before the next exists, and so the thing blocking the handles goes first.

- [x] 14.1 **Retired the Layer Region section's four sliders** — size, aspect, across and down — and merged the canvas handles (12.3) onto the same branch. The section is now `Layer Shape` and keeps the form, its side count, its rotation and its sense; placement, size and proportion are handle-driven only. **R66** records the three decisions this forced:
  - The four targets survive as *uncontrolled* value targets in `persistence.additionalValueTargets`, because the handles dispatch `controls.setValue` against them. Without that a reload silently resets every shape
  - One `interactionOwnership` entry, `shape-shaping`, on `controls.setValue` — the single target all three gestures actually write. Three entries, one per written target, was tried first and describes one operation three times
  - The default half-extent drops from 0.35 to **0.25**: at 0.35 a shape's corner nodes fall outside a window shorter than the frame, which is the unreachable-handle problem 14.2 existed to fix, one level up
  - The handle proofs no longer size anything first — the fixture is "add a layer", exactly as the 14.2 note predicted — and they witness the drag through the handle box in the DOM rather than through the sliders that used to follow it
  - Three latent proof bugs surfaced and were fixed: a 24px patch judging coverage against 90px bands, ink shares divided by the frame width while reading a window of it, and a mirror reading indexing a full-width row into a windowed buffer
- [x] 14.2 **Shape vocabulary on the layer**, delivered as seven named forms over two constructions — Rectangle, Ellipse, Triangle, Diamond, Pentagon, Hexagon, and Polygon with a side count (3–12) — plus a real default size of 0.35, which is what unblocks 14.1. **R65** records the three decisions this needed:
  - Square and circle get no entry of their own. They are Rectangle and Ellipse at equal extents, the extents are handle-driven, and a form naming itself a square would stop being one on the first drag. The default aspect is one, so choosing Rectangle draws a square and choosing Ellipse draws a circle
  - Polygons are inscribed in the extent, so no form spills past a corner a handle is drawn on
  - The free vertex list lands with the pen (14.4), not here: it is not authorable until the pen exists nor editable until the handle layer renders a list, so shipping the option now would put a form in the select that nobody could choose and no proof could exercise
  - Proof churn, all of it from the default size rather than from the vocabulary: `readStudioColorCount` reads the centre of the frame instead of its corner, the thirteen *field* proofs open through a new `openStudioFieldLayer` that releases the layer with `Region size 0`, and the treatment lens releases the layer playing the ground. Two new browser proofs — the named-form half of `selectedLayer.maskShape`, and `selectedLayer.maskSides`. 27/27 selected-layer proofs green
  - Left for 14.1: the section is still titled Layer Region and the controls are still labelled "Region shape" / "Region sides". Renaming them belongs with retiring the section, not ahead of it
- [x] 14.3 **The overlay renders a point list** computed from the form rather than an axis-aligned box. A diamond wore a rectangle's outline until this landed, and a rotated shape wore an unrotated one; the same list is what the pen's free vertex path will come from
  - The drawing side has to agree with the shader or it traces a shape the renderer is not filling. The shader's base angle points at a *side* (its fold is measured from an apothem) while these points are the vertices, half a wedge further round — and that sum is 90 degrees for every count, so every polygon starts with a vertex straight up. The first version drew each form rotated by half a wedge
  - An SVG path rather than a border, because a border can only be a rectangle. The eight nodes are unchanged: they drive the extent, which is still the geometry a drag writes
- [x] 14.4 **Pen tool**, split where the seam is real. A pen with nothing to store into and a `free` form with nothing able to author it are each unprovable alone; a path that exists in state and is drawn on the overlay is testable end to end today.
  - **Done — the pen collects a path.** Press Draw and the canvas belongs to the pen: a click places a vertex, the path so far is drawn, and clicking the first vertex closes it. Points are stored in field units keyed by layer id (`stack.vertexPaths`), the mode is the layer id being drawn (`stack.penLayerId`) rather than a boolean, and while it is on the extent handles stand aside so every click is the pen's. Evidence is `command-side-effect`, because state is what changed
  - **Done — the shader fills it.** Closing commits the layer to the `free` form and the field draws inside the path and nowhere else. **R69**: the vertices are *compiled into* the assembled source rather than uploaded — a per-layer array would multiply an already-large uniform budget, and more to the point a baked path travels with the delivered shader, which is the artifact this product exists to produce. One test function per layer, the crossing-number rule so concave paths work, vertices stored in the shape's own frame so moving and turning the layer moves the drawing, and a cap of 24 because every vertex is an unrolled iteration
  - **Done — the workload dimension.** `path-vertices` is declared, and it is the first dimension in this product whose cost is *not* constant in it: the crossing test walks the path once per pixel, so its length multiplies the layer's work. The growth class is unchanged — linear in stack depth and linear in path length is what `linear` over a list of dimensions means — but "constant in every dimension but one" is a different claim than the pass used to make. Exhaustive discrete domain, because a path length is built rather than dialled: 0, then 3 up to the cap
  - **Superseded —** The `free` form reads the vertex list, which needs a bounded loop and the vertices as per-layer uniforms under R52's mangling, so a vertex cap is a decision to make. That is also where **vertex count becomes a genuine workload dimension** with a non-constant contribution — the first thing to move the growth class since stack depth, and it revises what R66's cost note now says
  - Still open with it: an `interactionOwnership` entry for the pen as the second canvas-owned operation, and vertex handles for editing a closed path (14.3's point list is what they would be drawn from)
- [x] 14.5 **Chromatic engines** landed as a per-layer axis beside the layer kind — Induction, Physichromie, Interference — with `Engine amount` and `Interference pitch` in a new `Layer Engine` section. Three browser proofs, all green first run. **R67** records the reasoning:
  - An engine *reads* a field rather than building one. Croix10's chunks are field generators, which as a layer type would have given the product eight kinds and no second axis; ported instead as colour operations on the band the body already resolved
  - Only three of the six needed porting. Couleur additive is `selectedLayer.separator` in a stack, transchromie is the stack itself with multiply in linear light, chromosaturation is a gradient layer — the layer model absorbed half the engine registry by being a better model of the same thing
  - The amount is the identity at zero across all three, which caught the port's one real bug: physichromie read as a centred viewer angle sat at flat grey by default, destroying its subject at rest
  - The engine is **not** gated by layer kind, so the gradient honours it too — forced by R34 plus the ten-control rule, and it makes the axis genuinely beside the kind rather than inside one branch of it
- [x] 14.6 **Cursor as a uniform.** `uCursor` carries the pointer in field units; one proximity value reaches every engine and each scales its own amount by it, so the response belongs to the technique. Opt-in per layer through `Follow the pointer`. The listener is on the *window*, not the canvas — the region handles overlay the very field the engines colour and swallow moves bound to it (R68)
- [x] 14.7 **Decided: the cursor is committed to state** (R68). `stack.cursor` is an uncontrolled value target beside `stack.layerRecord`, so the export frame builds the same scene the preview did and the delivered source bakes the position the author left it at — what you see is what you get, and the artifact stays deterministic because it reads a value rather than an event. R44's precedent, applied again. A pointer that leaves the frame parks off-frame, so an export made while not touching the canvas is the field with no cursor in it
- [x] 14.8 Done, and one of the two assumed dimensions did not survive contact with how it was built:
  - **`polygon-sides` is declared**, constant in the way `band-count` is — the shape test folds its angle into one wedge, so twelve sides read what three do. Declaring it obliged a fixture adapter and re-identified all six performance paths
  - **No engine dimension.** A select over strings cannot back one (no numeric bounds), and each engine branch is a constant; the largest is interference. A constant bigger than the old constant is still a constant
  - The relationship stays `linear` in stack depth. What moved is the size of the per-layer constant, which belongs to the pending kernel benchmark rather than to the growth class

### 14.1 is blocked on 14.2, found on starting it

Retiring the four sliders leaves no way to bring a region into existence. A layer's `maskSize` defaults to zero, which means unmasked, and the handles for an unmasked layer are drawn around the whole frame. So the only route to a region becomes "grab a corner of the frame and drag inward".

In the running app that is fine: the canvas is zoomed to fit, so at 70 per cent the frame's south-east corner sits at roughly (1495, 802) inside a 1920x869 window, well within reach.

In the proof viewport it is not. Playwright runs 1280x720 with the canvas laid out at 1920x1080 and offset to (-320, -180), so the frame's corners fall at (1600, 900) and (-320, -180) — every one of them outside the window. `openStudioHandleFixture` currently calls `setStudioSlider(page, "Region size", 0.2)` to get a grabbable region, and once that slider is gone there is nothing to replace it with: the handles that would create the region cannot be reached.

**So 14.2 comes first.** Its premise — a layer is created *as* a shape, with a form and a real default size — removes the problem at the root rather than working around it. A new layer then has a grabbable shape from the moment it exists, the fixture becomes "add a layer", and the size-zero-means-unmasked special case stops being load-bearing.

Do not solve this by widening the proof viewport. That would hide a real question the product should answer: what a freshly created layer *is*. The answer R64 already gives is "a shape", and 14.2 is where that gets built.

**14.2 is done.** A layer now arrives as a Rectangle at half-extent 0.35, so `openStudioHandleFixture` no longer needs `setStudioSlider(page, "Region size", 0.2)` to make a grabbable shape — "add a layer" is enough, and the handles the fixture reaches for are inside the proof viewport from the moment the layer exists. That is the blocker cleared; 14.1 can start.

### 14.9 Duplicate a layer (user request, delivered)

A layer is copied from the `Current layer` Actions control in the Selected Layer section: the copy lands directly above its source, carries every value the source had, and becomes the selection.

- Two dispatches, because a layer lives in two places (R56): `layers.add` with an explicit draft id for the runtime half — identity, name, visibility, group — and one `stack.layerRecord` write for the product half. Either alone is a bug that looks like a feature: only the first gives a plain new layer wearing a copy's name; only the second writes values no layer has
- The id is derived (`layer-1-copy`) rather than random, so provenance is readable in persisted state and in a failing test; the counter only appears on collision
- The target is **`stack.actions`, not `selectedLayer.*`**. R51 obliges every `selectedLayer` target to prove it edits the selected layer's *output*, and duplicating edits no layer at all — it adds one. The rule caught a claim the command could not make
- Evidence is **`command-side-effect`, not rendered pixels**: a copy composited directly above an opaque source is the same frame, so a pixel proof would be unchanged by a duplicate that worked perfectly
- Groups copy as a block: the group, its members, and nested groups, with each member's parentage rewired onto the copies. A member left pointing at the original would have made the copy an empty container, which is why the rewiring is a pure plan with its own tests rather than a detail of the handler

**Revised order for group 14:** 14.2 (shape vocabulary with real defaults) → 14.1 (retire the sliders) → 14.3 (handle list) → 14.4 (pen) → 14.5 (engines) → 14.6/14.7 (cursor) → 14.8 (envelope).
