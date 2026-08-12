# Tasks — Croix10

Revised against the Toolcraft contract (see `design.md` → Contract Reconciliation) and an independent critique of the validators in `src/app/acceptance/`. The **first** protected delivery is 12.5, not group 6 — declaring video export obliges complete video coverage at full functional acceptance. Later delivery gates: 13, 17, 18, 19, 20.

Two process rules from `AGENTS.md` apply throughout and are not repeated per task: read the routed Plan documents before writing a plan, Implementation documents immediately before editing code, and Verification documents before writing proof — one document per read, never concatenated; and record a verification tier note for each coherent delivery batch. Use focused checks while implementing, and one bare `npm run verify:delivery` at each stage gate.

## 0. Stage 0 — contracts and product declarations

- [x] 0.1 Identify and scaffold the starter kit — `@pixel-point/toolcraft@0.0.18`, generated in place as `croix10` with `claude-code` skills
- [x] 0.2 Read `AGENTS.md` and the Plan-phase contract docs; verify every named runtime helper exists in the signed `src/toolcraft` copy
- [x] 0.3 Reconcile the pin-on-read decisions and record the five contract conflicts with accepted resolutions in `design.md`
- [x] 0.4 Run `npm install` if needed and confirm `npm run dev` serves the neutral starter on the saved port with the `toolcraft-app-title` marker
- [x] 0.5 Switch `src/app/app-acceptance-data.ts` to `mode: "product"` with `productName`, `productSummary`, `requestedBehavior` — **mandatory** (starter readiness is invalid in a renamed folder) but must land with 1.1–1.2, 5.2, 5.4 and their acceptance rows as one coherent batch, since product mode obliges an export surface and proof for every visible control (R40)
- [x] 0.6 Declare `exportIntent`: image `toolcraft-default`, video `user-requested` quoting the brief's explicit WebM/MP4 request as evidence
- [x] 0.7 Declare `viewInteraction` — `non-spatial` with a written reason that pre-empts the wrong-substitution check: 2D shader output, no scene geometry to orbit, and Physichromie's viewing angle is a colour-state parameter rather than a camera. Note that Stage 6 flips it to `orbit` (F18)
- [x] 0.8 Declare `interactionOwnership` for every operation that could live on either surface, with evidence, chosen surface, and rejected duplicate
- [x] 0.9 Author the Control Selection Inventory: for each product setting record need, value model, built-ins checked, chosen built-in, why, rejected alternatives, target, renderer/export mapping, acceptance coverage
- [x] 0.9a Record the built-in fit check for engine selection comparing `tabs` and `select` with a concrete reason — ruling out `segmented` alone is not a justification, and `tabs` is the documented owner for a choice that replaces the view below it (F10)
- [x] 0.10 Author the whole-product entity decomposition as a design document with stable `entityId`, `entity`, exact targets, `groupingReason`, and `workflowStage`/`splitReason` — 26 sections, none over ten controls (design.md → Control section decomposition)
- [x] 0.10e Populate `appControlSectionInventory` per stage, alongside the schema sections it describes — the validator rejects an entry with no rendered section just as it rejects a section with no entry (R40)
- [x] 0.10a Title every section by the entity it edits, never by the branch that gates it, so no title equals/contains/is contained by a gate's condition value or option label (R33) — e.g. `Signal Damage` not `Glitch`, `Character Grid` not `ASCII`
- [x] 0.10b Place every gate in the same inventory entity as the controls it gates; record the engine/tool selectors as the deliberate cross-entity exception proved by named Playwright tests (R34)
- [x] 0.10c Give `Image Export`, `Video Export`, and `Background` their own inventory entries and count their targets against those sections' ten-control budgets (F7)
- [x] 0.10d Verify no section title is generic or a control-type name, and that any broad title (`Motion`, `Export`, `Scene`, `Shape`) stays under eight controls and three semantic clusters (F7)
- [x] 0.11 Write the Animation Intent Inventory selecting the keyframes timeline, and record the derived loop period for `panels.timeline.defaultDurationSeconds`
- [x] 0.12 Write the Renderer Technique Decision Matrix: `sourceRepresentation`, `productRepresentation`, `previewRenderer`, `exportRenderer`, `rendererStrategy`, `whyNotAlternativeStrategies`, `fidelityRisks`, `performanceRisks`, `intentionalRasterizationReason`
- [x] 0.13 Derive the line-frequency and stripe-count maxima from the Nyquist limit against effective pixel pitch at 1080p and record the derivation — computed, not measured, and not a performance bound (C1, R31)
- [x] 0.14 Declare `workloadEnvelope` dimensions mapping each `performanceRole: "workload"` control to one numeric dimension with `interactiveMax` at its schema endpoint
- [x] 0.15 Compile `rendererPipelineRegistration` declaring every pass with cost, frequency, lifecycle, execution location, quality, cache keys, and exact interaction invalidation including `initial-render`
- [x] 0.15a Declare the 2D passes `relationship: "constant"` for stripe dimensions, since per-pixel cost does not vary with them; reserve non-constant relationships for passes that genuinely scale, such as the Stage 6 lamellae rasterize pass (R31)
- [x] 0.16 Run `assessToolcraftRenderPlan` and resolve every structural error
- [ ] 0.16a Declare `kernelBenchmarkDecisions` for any requirement the assessment raises rather than only noting it as pending, and record in the Renderer Technique Matrix why WebGL2 is the chosen strategy over a Canvas 2D baseline — the contract expects that choice to be argued, not assumed (F19)
- [x] 0.17 Register `fixtureAdapters.dimensions` per envelope dimension and derive paths with `deriveToolcraftPerformancePaths`
- [x] 0.18 Switch `docs/toolcraft/agent-worklog.md` to `Mode: product` with the first Decision Trail entry, covering every required field — request, task type, user-visible result, source checked, docs and contract rules applied, view interaction, interaction ownership, decision, alternatives rejected, state/output mapping, verification narrative, risks — plus the eight decision sections with `Decision:`/`Reason:`/`Evidence:` each; `npm run test` fails on omissions (F20)
- [x] 0.18a Add the runtime check for whether a product global keydown shortcut is permissible and how it can be proved, given acceptance `kind` is only `canvas-handle | control | runtime` and no `interactionOwnership.capability` fits; plan a named app-owned Playwright test rather than an acceptance row (F17)
- [x] 0.19 Run `npm run ai:check` — code health passed (8 files); the AST boundary pass runs with installed dependencies at the delivery gate

## 1. Render core

- [x] 1.1 Author the base schema with `canvas.mode: "editable-output"`, default 16:9 / 1920×1080, and `canvas.renderScale: { step }` for the WebGL preview
- [x] 1.2 Author the `Background` source section pairing `export.includeBackground` with a `color` target, and confirm the runtime relocates both into Setup
- [x] 1.3 Mount the WebGL2 product canvas in `canvasContent`, sized from `useToolcraftProductSceneFrame()` with explicit `empty` and `unavailable` handling
- [x] 1.4 Implement `sceneBoundsProvider` returning exact-state world-space product rectangles
- [ ] 1.5 Implement the render loop driven by `getToolcraftTimelineLoopTime`, with no wall-clock read anywhere in the render path
- [x] 1.6 Implement the GLSL chunk registry and feature-flag variant assembler with variant caching
- [ ] 1.7 Implement the ping-pong pass chain in the declared order, skipping bypassed passes entirely
- [x] 1.8 Implement the present pass with linear-light to sRGB conversion and `shouldIncludeToolcraftPreviewBackground(state)`
- [x] 1.9 Implement resource lifecycle through `useToolcraftPipelinePass`: creation outside render, retention per declared lifecycle, cancellation and release on cleanup
- [ ] 1.10 Implement animation-work coalescing during canvas drag, pan, pinch, zoom, and radar interactions, resuming at the correct time without changing play state
- [ ] 1.11 Write unit tests for chunk assembly and variant cache keying

## 2. Parameter schema foundation

- [x] 2.1 Establish the parameter declaration pattern in `app-schema.ts` with `target`, `defaultValue`, `applicability`, `performanceRole`, `performanceReason`
- [x] 2.2 Move defaults and domain logic into product modules separate from the schema assembly module, for narrow later-delivery ownership
- [x] 2.3 Implement uniform upload derived from schema targets, including sRGB-to-linear conversion for colour types
- [x] 2.4 Declare intent fields: `sliderValueKind: "discrete"` for counts and band numbers, `"continuous"` for rates and intensities
- [ ] 2.5 Implement conditional `applicability` for engine-scoped and tool-scoped controls, verifying hidden values are preserved
- [ ] 2.6 Write the product test asserting every engine shader uniform has a schema control and every numeric control has finite bounds with an in-range default — partial: the current test checks declared uniforms against the known-uniform list, not against schema controls
- [x] 2.7 Populate `src/app/app-verification-impact.json` for every product module with ownership class, nearest acceptance ids, and renderer pass ids

## 3. Shared stripe field

- [x] 3.1 Implement `stripe_field.glsl`: rotation into stripe space, sequence-period arithmetic with per-band widths, band index, signed distance to nearest boundary
- [x] 3.2 Implement analytic antialiasing via `smoothstep` over `fwidth` — the only headroom mechanism now that runtime degradation is forbidden
- [x] 3.3 Implement jitter as lateral displacement, exactly zero-valued at zero amount
- [x] 3.4 Implement mirror/duplication about the composition axis
- [x] 3.5 Implement pitch normalized against canvas width; derive user-facing count and pitch from the sequence period
- [ ] 3.6 Write unit tests for sequence-period arithmetic: per-band width changes grow the period without altering sibling widths

## 4. Couleur Additive engine

- [x] 4.1 Implement `palette.glsl` with the slot array, sequence lookup, and cycling offset
- [x] 4.2 Implement the Couleur Additive engine chunk with independent separator width and colour
- [x] 4.3 Declare the geometry controls across the workflow-staged sections from 0.10, each within the ten-control cap
- [x] 4.4 Declare the palette as `collectionActions` with a `color` `itemControl`, 2–8 items, no per-item labels
- [x] 4.5 Declare the cycling offset control
- [x] 4.6 Verify the canonical green / black / red / black / blue module renders at the configured pitch

## 5. Export wiring

- [ ] 5.0 Enable `panels.timeline` and set `defaultDurationSeconds` from 0.11 — must precede any `Export Video` declaration, since an app with video export must have the timeline enabled (F6)
- [x] 5.1 Implement the single `exportRenderer.renderFrame` drawing one deterministic scene-coordinate frame from the supplied state, `timeSeconds`, and `timelineProgress`, awaiting its real work, with a non-blank `baseFileName` (R38)
- [x] 5.1a Composite WebGL output into the supplied `CanvasRenderingContext2D` via the supplied `rendererPipeline` client, and confirm against `decision-contract.md` that a product render target is not a forbidden export canvas (R30)
- [x] 5.2 Declare the `Image Export` section with `export.image.format` and `export.image.resolution` as a two-column select row
- [ ] 5.3 Declare the `Video Export` section immediately after it, with `export.video.format` and `export.video.resolution`
- [ ] 5.4 Declare typed `export-image` and `export-video` sticky `panelActions` with `icon: "upload-simple"`, video primary and image secondary — **partial**: only `export-image` exists in `app-schema.ts`. The video action cannot land until `exportIntent.video` flips off `not-requested`, which obliges complete video artifact coverage in the same batch, so this stays open with group 12
- [x] 5.5 Verify PNG long-edge pixels for at least two `export.image.resolution` values (2K and 4K), each showing the same composition rather than more stripes, with pitch scaling proportionally (F6)
- [x] 5.6 Verify PNG is transparent with Background off while JPG stays opaque, and that video retains the background
- [x] 5.7 Add the product test asserting no product module allocates an export canvas, calls `toBlob`/`toDataURL`, creates an object URL, or references an encoder

## 6. Stage 1 development checkpoint

Not a delivery gate. Declaring video `user-requested` in 0.6 obliges complete video artifact coverage at *full* functional acceptance, so the first bare `verify:delivery` cannot run until the video proof exists — it moves to group 12 (F6).

- [x] 6.2 Add the `canvas.renderScale` acceptance row with `renderScaleCoverage.kind: "selected-backing-pixels"` and sorted states `["interaction", "playback", "steady"]`
- [x] 6.3 Add acceptance rows for every visible entity so far, plus the reload persistence row with `persistenceSlices` equal to the resolved include list
- [x] 6.3a Add the two required Infinity-canvas rows: `mode-and-restoration` / `viewport-side-effect`, `scene-bounds-image-export` / `exported-bytes`, and `scene-bounds-video-export` / `exported-bytes` (F5)
- [ ] 6.3b Add coverage for oversized (`scene-export-too-large`), empty (`empty-scene`), and unavailable-image exclusion via `createToolcraftUnavailableImageResourceFixture` (F5)
- [x] 6.3c Declare `controlPartCoverage` for the palette `collectionActions` — limits, full-default add, sibling-preserving edit, preview/export effect, whole-record removal (F15)
- [ ] 6.4 Run focused functional and browser checks only — no `verify:delivery` yet
- [x] 6.5 Verify in the browser that Couleur Additive renders, geometry and palette controls drive it live, and slider drags update output before pointer release

## 7. Remaining engines

- [x] 7.1 Implement Physichromie with the virtual viewing-angle uniform producing continuous, jump-free colour-state change
- [x] 7.2 Implement Induction Chromatique: high-frequency line pairs plus complementary edge fringes with controllable width and intensity
- [x] 7.3 Set the Induction line-frequency maximum from the Nyquist limit against effective pixel pitch and document the derivation (C1, R31)
- [x] 7.4 Implement Chromointerférence as a two-layer composite producing traveling moiré (static beat shipped; travel needs the Stage 3 timeline)
- [x] 7.5 Implement Transchromie: translucent planes with per-plane colour, opacity, offset, rotation, and subtractive/additive blending
- [x] 7.6 Implement Chromosaturation: full-field drifting gradients with no visible banding steps
- [x] 7.7 Declare engine selection as a `select` control, preserving shared values across switches
- [ ] 7.8 Add acceptance coverage proving each engine's visible output

## 8. Embedded shapes and interference layer

- [x] 8.1 Implement `shapes.glsl` with circle, ellipse, rectangle, and split-block SDFs
- [x] 8.2 Wire shapes as phase or width perturbations only; verify zero strength is pixel-identical to no shape
- [x] 8.3 Implement the second layer behind a feature flag so the disabled variant omits the code path entirely
- [x] 8.4 Implement `blend.glsl` in linear light; verify red-over-green additive yields yellow and difference renders black where layers agree
- [x] 8.5 Declare the enable switch and its dependent controls in one section with conditional applicability on that switch
- [x] 8.6 Add acceptance coverage per blend mode, proving absence of dependent controls when disabled

> **Group 8 note (added with 9C).** The shipped embedded-shape work above covers *one* analytic shape driving phase/width perturbation. It does **not** cover a user-owned shape collection, uploaded shape sources, canvas dragging, per-shape shadows, or per-shape gradient fill. That scope lives in group 9C and supersedes `embedded-shape` as the owning entity; 8.1–8.2 remain the SDF and perturbation foundation it builds on.

## 9. Colour and gradient system

- [ ] 9.1 Verify the canonical palettes against primary sources before shipping (Open Question 5)
- [ ] 9.2 Implement palette presets replacing collection contents and count without touching geometry, motion, or engine
- [ ] 9.3 Implement the harmony generator as an `actions` control with complementary and triadic rules, button label distinct from control label
- [ ] 9.4 Declare the `gradient` control, keeping its owned type, angle, stop track, and stop list unsplit
- [ ] 9.5 Declare the separate gradient interpolation-space control (R23)
- [ ] 9.6 Implement mapping modes along, across, and radial, with the radial centre as a `vector` control — this is the existing half of "gradients on the stripes": `across` samples the ramp perpendicular to the stripe axis so each stripe takes one colour, `along` varies colour down the length of a single stripe (the Cruz-Diez disc references). 9A.1 completes it
- [ ] 9.7 Implement quantize-to-bands and allow a quantized gradient as the active palette source
- [ ] 9.8 Build the gradient tool with linear, radial, conic, and banded output, plus CSS and SVG clipboard copy actions
- [ ] 9.9 Add acceptance coverage for each mapping mode, quantization, and both copy actions

---

> **Groups 9A–9C — added 2026-08-11 from user reference images.** Three requested capabilities: gradients on the stripes that can be animated and that respond to cursor proximity; and a shape system where shapes can be uploaded, created, dragged on the canvas, given a shadow, and filled with a gradient. Lettered rather than renumbered so the existing delivery-gate numbering (10, 12.5, 13, 17, 18, 19, 20) stays stable.
>
> **Sequencing.** These groups sit before the Stage 2 gate because that is where their entities belong, but they are *not* prerequisites for the first protected delivery at 12.5. Either run them here, or defer the whole block past 12.5 — in which case gate 10 and gate 12.5 verify only what has landed and the block re-enters before gate 13. Do not start them mid-way through group 12.
>
> **Contract debt they create.** Each group opens with a design task because `appControlSectionInventory` validates in both directions (R40) and the C5 decomposition in `design.md` is the authoring contract — new sections cannot be written before the design table lists them.

## 9A. Stripe gradients and gradient animation

Extends group 9. 9.4–9.7 already give a `gradient` control, an interpolation-space control, along/across/radial mapping, and band quantization; what is missing is gradient colour reaching the stripe field as a *fill* rather than only as a palette source, and any way to move a gradient over time.

- [x] 9A.0 Extend the C5 decomposition in `design.md` — **resolved as R43, and the planned split is not available**: `ramp.source` gates the drift controls, and R34 requires a gate to share an entity with what it gates, so a separate `ramp-drift` section would be the exact arrangement R34 rejects. Drift stays in `chromatic-ramp` at nine targets, which obliges `semanticGroup`. R33 also rules out the obvious option labels (`Ramp` is contained by the section title, `Gradient` is the tool label the section was renamed to avoid); the labels are `Palette` and `Continuous`
- [x] 9A.0a Add the matching `appControlSectionInventory` entry in `croix10-control-sections.ts` alongside the rendered schema section, with `semanticGroup` — the validator rejects an entry with no section just as it rejects a section with no entry (R40)
- [x] 9A.1 Implement gradient fill in the shared field: sample the ramp per fragment using the stripe-space coordinate already computed in 3.1, so a stripe's colour comes from the ramp rather than from a palette slot. Keep the palette path intact and select between them with an explicit ramp-source control — a gradient fill must not silently replace the canonical green/black/red/black/blue module proved in 4.6
- [x] 9A.2 Implement per-band gradient sampling so the ramp is evaluated once per band index rather than per pixel when `across` mapping is active, preserving the hard band boundaries and analytic AA from 3.2 (the reference images show flat-per-stripe colour, not a smeared ramp)
- [x] 9A.3 Implement the ramp phase offset as a scalar `slider` target, distinct from the `gradient` control's own angle — R23 forbids grafting fields onto the compound `gradient`, and the drift target must be an independently keyframeable scalar
- [x] 9A.4 Implement ramp drift as a **whole-cycle integer rate** over the timeline loop, exactly as 11.5a ships for the moiré and the Chromosaturation wash — R41 applies unchanged: the domain is integers, zero is byte-identical to static, and every reachable rate closes the seam
- [x] 9A.5 Verify the ramp drift seam: first and last frame match under `timelineLoopProof` (11.10), and a duration edit changes loop length without changing the composition (the 11.6 proof shape)
- [x] 9A.6 Set `keyframeable` per 11.0's classification — **classification recorded in R43, flags deferred**: `control-acceptance-policy.ts:101` only rejects `keyframeable: false` while the timeline is in `keyframes` mode, so writing the flags today would add markings nothing validates. `ramp.phase` and `ramp.driftCycles` are animation targets; `ramp.source`, `ramp.interpolationSpace`, and `ramp.gradient` are not for each new target — the `gradient` compound and the ramp-source selector are not animation targets; phase offset, drift rate, and radial centre are. Record the classification in the same place as 11.0 and honour the R40 deferral note (`control-acceptance-policy.ts:101` still rejects `keyframeable: false` on a capable control while the mode is `keyframes`)
- [x] 9A.7 Declare the new passes' cost, frequency, lifecycle, cache keys, and exact interaction invalidation in `rendererPipelineRegistration`, keeping `relationship: "constant"` with respect to stripe dimensions (R31 / 0.15a) — a ramp lookup does not scale with stripe count
- [x] 9A.8 Add acceptance coverage: ramp fill visibly differs from palette fill, each mapping mode drives the stripes, drift changes pixels across the loop, and drift at zero is pixel-identical to static
- [ ] 9A.9 Verify the gradient reaches both export paths — **PNG half done** (app-owned proof: the artifact changes when the ramp is active, and 2K/4K keep one composition at proportional pitch). The video half waits on video export existing at all — PNG at 2K/4K shows the same ramp composition at proportional pitch (the 5.5 shape), and the exported video's ramp drift tiles seamlessly (the 12.2 shape)

## 9B. Cursor-responsive gradient field

Entirely new. Nothing in groups 0–20 covers pointer-proximity response, and it collides with four existing invariants at once, so the design tasks are not optional preamble.

- [x] 9B.0 Record an Open Question and a decision in `design.md` — **resolved as R44, committed hotspot**: is the cursor position **product state** (schema-backed, persisted, exported) or **transient interaction state** (preview-only)? Everything below depends on the answer. The recommended resolution is transient — a persisted cursor position would be restored on reload as a stale hotspot, and `component-rules.md:137` explicitly forbids exposing a `vector` pad for pointer movement
- [x] 9B.1 Declare `interactionOwnership` for the proximity operation before implementing it (`interaction-surface-ownership` is an invariant, and 0.8 predates this feature): the canvas is the primary surface for *where* the cursor is; the panel owns radius, falloff, and strength. Record the rejected duplicate — no panel control may mirror the hotspot position, or the same capability exists on both surfaces
- [x] 9B.2 Resolve export determinism and record it — **no `previewExportDifferenceReason` needed**: export renders the committed hotspot, and live-during-gesture preview is the same relationship a slider has between drag and release: `renderFrame` is a pure function of state, `timeSeconds`, and `timelineProgress` (5.1), so a transient cursor cannot reach it. Either freeze the proximity term to its neutral value in export and declare `previewExportDifferenceReason`, or promote a committed hotspot to state. Do not leave preview and export silently divergent
- [x] 9B.3 Implement the proximity field in the shader as a distance-to-hotspot term modulating ramp phase, ramp amplitude, or stripe width — one declared target list, not an ambient effect on everything
- [x] 9B.4 Declare the panel controls in their own inventory entity per 9A.0's pattern: enable `switch`, radius `slider`, falloff `select`, strength `slider`. The enable gate lives in the same entity as what it gates (R34) and the title must not resemble the gate value (R33)
- [x] 9B.5 Read pointer position through the runtime canvas pointer path inside `canvasContent`; render no product UI on the canvas (`canvas-no-app-ui` is an invariant — no visible hotspot ring, crosshair, or label)
- [x] 9B.6 Feed proximity through the same coalescing path as 1.10 so pointer motion cannot outrun the frame budget, and confirm it does not read wall-clock time anywhere (R7 / 1.5 — proximity is a spatial term, not a temporal one)
- [x] 9B.7 Verify zero strength is pixel-identical to the un-modulated render, and that the effect is absent entirely when the enable switch is off (the 8.2 / 16.4 proof shape)
- [x] 9B.8 Add acceptance coverage: moving the pointer changes visible pixels before pointer release, the effect is bounded by the declared radius, and the exported artifact matches whichever resolution 9B.2 recorded
- [ ] 9B.9 Verify proximity interacts correctly with playback — a paused scene still responds to the cursor, and a playing scene composes proximity with 9A.4 drift without breaking the loop seam

## 9C. Shape composition layer

Extends group 8 from one embedded shape to a user-owned collection of placed, draggable, styled shapes. The reference images show independently placed and rotated stripe panels, shapes carrying their own gradient fill, and hard offset shadows behind the stripe bands.

- [x] 9C.0 Extend the C5 decomposition in `design.md` — **resolved as R45, and the planned split does not exist**: placement, fill, and shadow are per-shape `itemControls` inside one compound record, not sections, so the ten-control section budget never applies to them and runtime splits a large compound control into its own section regardless. One entity, one section, one control. `embedded-shape` is replaced rather than kept alongside
- [x] 9C.1 Add the Control Selection Inventory rows — recorded in R45 for the new value models (task 0.9's table): the shape list is a user-owned array of a multi-field record → `collectionActions` with `itemControls`, exactly as the translucent-plane row already resolves; per-shape centre → `vector`; uploaded shape source → `fileDrop`. Record the rejected alternatives, including the named wrong substitution of a count slider plus fixed controls
- [ ] 9C.2 Implement the shape record as the panel-owned fields only — kind, size, rotation, strength, mode, fill, shadow — with **positions in a separate canvas-owned `shapes.centers` array** (R46): a centre inside the record is either a rendered `vector` that mirrors canvas placement in the panel, or an undeclared field the add proof cannot cover. A missing position entry means the composition centre; removal drops the matching entry so the two stay index-aligned
- [ ] 9C.3 Declare the shape list as `collectionActions` with `itemControls`, with a bounded maximum derived from the pass-cost declaration rather than left open, and `controlPartCoverage` for limits, full-default add, sibling-preserving edit, preview/export effect, and whole-record removal (the 6.3c shape). Removal coverage must also prove the position array stayed aligned (R46)
- [ ] 9C.4 Extend `shapes.glsl` beyond 8.1's circle/ellipse/rectangle/split-block with the additional analytic kinds the references need — rotated rectangle/panel, rounded rectangle, triangle, and polygon — each as an SDF so 3.2's analytic AA applies unchanged
- [ ] 9C.5 Implement uploaded shape sources as a multiple file-kind `fileDrop` with `variant: "collection-actions"` and its own `itemControls`, which renders per-shape settings under each attached file and persists them keyed by `mediaId` (R45) — `accept` narrowed to SVG and PNG, converted to a signed-distance or alpha mask at a declared sampling resolution, retained and released through the runtime asset lifecycle with explicit `unavailable` handling (the 14.1 / 14.9 shape, and `renderDefaultCanvasMedia: false` from 14.0 applies for the same reason — the runtime must not composite the source over the product's stylization of it)
- [ ] 9C.6 Declare the shape-mask sampling resolution as a `workloadEnvelope` dimension with `interactiveMax` at its schema endpoint, and register its `fixtureAdapters.dimensions` path (0.14 / 0.17)
- [ ] 9C.7 Implement per-shape fill as an offset and scale into the existing chromatic ramp, plus an optional solid `color` item — **not a per-shape `gradient` control**: `component-rules.md:91` fixes the item types a collection accepts and `gradient` is not among them, so a gradient per shape is not expressible as an item field (R45)
- [ ] 9C.8 Implement the per-shape shadow: offset, blur, colour, and opacity, composited in linear light before sRGB conversion (R10 / 8.4). Verify zero offset with zero blur is pixel-identical to no shadow
- [ ] 9C.9 Implement canvas dragging as a product canvas handle writing the shape's centre target — tokenized, textless, export-excluded, and runtime-bound per `canvas-handle-placement`; one history group per completed gesture; pointer cancel and lost capture end the gesture cleanly
- [x] 9C.10 Resolve and record how a product-authored canvas handle is declared — **there is no schema route, and R44 established the alternative**: the canvas owns the pointer interaction, writes the target through `controls.setValue` on gesture end, and is proved by named app-owned Playwright tests. Already working for the cursor hotspot
- [x] 9C.11 Declare `interactionOwnership` for shape placement — **canvas owns placement outright, no panel `vector`** (R45), for the same reason the cursor hotspot has none. Size, rotation, and fill stay in the panel as a different capability
- [ ] 9C.12 Extend `sceneBoundsProvider` (1.4) so placed shapes and their shadows expand the world-space product rectangle, and re-prove the Infinity-canvas rows from 6.3a against the new bounds — a shadow falling outside the old bounds must not be clipped from export
- [ ] 9C.13 Declare each new pass in `rendererPipelineRegistration` with an honest cost relationship: unlike the stripe dimensions (R31), per-shape and shadow-blur passes genuinely scale with shape count and blur radius, so they are **not** `relationship: "constant"`
- [ ] 9C.14 Verify the mask-upload path allocates no export canvas, calls no `toBlob`/`toDataURL`, creates no object URL outside the runtime hook, and references no encoder (the 5.7 assertion extended to the new modules)
- [ ] 9C.15 Set `keyframeable` per shape field: centre, rotation, size, strength, shadow offset, and gradient phase are animation targets; kind, uploaded source reference, and z-order are not (11.0 / R36)
- [ ] 9C.16 Add acceptance coverage: add/remove/reorder shapes, drag updates pixels before pointer release with playback paused and render scale at maximum (the 19.10 proof shape), shadow renders behind its shape, gradient fill follows shape rotation, and the whole composition survives reload persistence and Settings Transfer round-trip (10.4)
- [ ] 9C.17 Update `src/app/app-verification-impact.json` for every new module with ownership class, nearest acceptance ids, and renderer pass ids (2.7 / 20.6)

---

## 10. Stage 2 gate

- [x] 10.1 Author 8–12 built-in presets, at least one per series, applying through runtime commands so undo and reset behave normally
- [x] 10.2 Implement Randomize with lock switches, verifying range safety and single-step undo (an `actions` command in its own section rather than sticky `panelActions`, and one lock section rather than per-section locks — both forced by framework rules, see design)
- [x] 10.3 Bind `R` to randomize, suppressed while any text or `code` input has focus
- [x] 10.4 Verify Settings Transfer round-trips the full scene losslessly, and confirm no product-authored save/load control exists
- [ ] 10.5 Run bare `npm run verify:delivery`; record the Decision Trail entry

## 11. Animation system

- [x] 11.0a Enable `panels.timeline` in `playback` mode with the product-derived loop period and matching `timeline-playback` animation intent (R40)
- [x] 11.0b Derive render time from `getToolcraftTimelineLoopProgress` and read control values through `evaluateToolcraftTimelineValues`, so preview and the export frame share one time source (11.1's evaluated-value rule, satisfied ahead of keyframes)
- [x] 11.0c Hold scene parameters referentially stable across playback ticks, so a scene with no drift does not redraw at frame rate (R42)
- [ ] 11.0 Classify every schema target as a genuine animation target or not, and set `keyframeable: false` on everything that is not — seeds, mode/engine/tool selectors, sampling resolution, section locks, export selects, palette cardinality, shader hook source. Record the classification; keyframe coverage is required for every inferred keyframe-capable control (R36). **Deferred with keyframes mode (R40): `control-acceptance-policy.ts:101` rejects `keyframeable: false` on a capable control while the mode is `keyframes`, so this task is unbuildable as written and needs restating in the keyframes change**

- [ ] 11.1 Wire keyframe tracks over animatable parameters, reading values through evaluated-value helpers rather than raw `state.values` (evaluated-value half done in 11.0b; tracks deferred with keyframes mode)
- [ ] 11.2 Implement selected-keyframe editing that updates the selected point rather than adding one
- [ ] 11.3 Implement sine, triangle, and periodic-noise LFOs with rate, amplitude, phase, offset
- [ ] 11.4 Implement combined evaluation: LFO applied relative to the keyframed value, clamped to declared range
- [x] 11.5 Implement loop-safe rate quantization at evaluation time, preserving the user's requested rate in state and surfacing the quantized value — **superseded by R41**: the drift domain is integers, so every reachable rate already loops and there is no corrected value to surface
- [x] 11.5a Ship whole-cycle drift for the travelling moiré and the drifting Chromosaturation wash, with zero rendering byte-identically at every instant and every rate closing the seam
- [x] 11.6 Implement requantization when the user edits timeline duration, keeping the scene design stable — **no requantization needed under R41**; proved instead that a duration edit changes loop length while the composition and the seam are unchanged
- [ ] 11.7 Implement global speed as a discrete whole-cycle multiplier over an integer domain, preserving relative phase and seamless loops at every reachable value (R32)
- [ ] 11.8 Implement driven-parameter UI: live value, driven indicator, base-value editing during playback
- [ ] 11.9 Write unit tests for loop quantization, combined-evaluation clamping, and loop-boundary state equality
- [x] 11.10 Declare `timelineLoopProof`: forward-only direction, reverse forbidden, first/last seam match, reproof after a duration edit

## 12. Video export proof and first delivery

- [ ] 12.0 Add complete video artifact coverage: both formats, both resolutions, real MIME/container or typed capability failure, even-safe `current` sizing, aspect-preserving 4K inside 3840×2160 (F6)
- [ ] 12.1 Verify exported video covers exactly the timeline duration with 30 FPS packet cadence and correct packet count
- [ ] 12.2 Verify the exported loop tiles seamlessly on repeat and that decoded frames actually differ
- [ ] 12.3 Verify a duration edit changes artifact duration and packet count
- [ ] 12.4 Verify export progress reports through the sticky footer and controls stay interactive during encode
- [x] 12.5 Run the first bare `npm run verify:delivery` for first product delivery, then `npm run dev`; record the Decision Trail entry with every required field (F6, F20) — gate exited 0 with 50 browser proofs and a valid receipt at the time. The receipt has since gone **stale** after the 9A/9B batches and needs re-running before the next delivery

## 13. Stage 3 gate

- [ ] 13.1 Verify keyframes, LFOs, and duration edits interact correctly across all six engines at 1080p
- [ ] 13.2 Run bare `npm run verify:delivery`; record the Decision Trail entry

## 14. Media sources

- [ ] 14.0 Set `renderDefaultCanvasMedia: false` on the composition, so the runtime generic media layer does not composite the source over the product's stylization of that same source in preview, export, or scene bounds (F4)
- [ ] 14.1 Declare the image `fileDrop` with `assetKind: "image"`; keep the pre-content canvas neutral with no placeholder artwork or CTA
- [ ] 14.2 Implement cover/crop drawing inside current canvas bounds without changing `canvas.size`, keeping Setup sizing visible
- [ ] 14.3 Consume `state.mediaAssets[].transform` for the runtime `90°`, `Flip H`, `Flip V` actions rather than product-owned transform state
- [ ] 14.4 Implement stripe mapping modes driving width and phase from source luminance
- [ ] 14.5 Implement palette quantization so every output pixel is an active palette colour
- [ ] 14.6 Implement the sampling resolution control and declare it as a workload dimension
- [x] 14.7 Resolve how product code obtains decoded video frames from a runtime media asset — `useToolcraftMediaPresentationUrls` returns a blob URL for any non-model asset (R29)
- [ ] 14.8 Declare the video `fileDrop` with `assetKind: "file"`, `multiple: false`, and `accept` narrowed to video MIME types and extensions
- [ ] 14.9 Create the never-mounted `<video>` decode element from the blob URL, retained and released through the hook's lifecycle, and handle `unavailable` assets
- [ ] 14.9a Build the retained-handle bridge from the hook to `renderFrame` — a module-scoped ref written by a hook mounted inside `canvasContent` and read by the plain export callback — with defined behaviour when export starts before the retain resolves or after release, and a seek timeout policy for the ~240 seeks an 8s export implies (R39)
- [ ] 14.10 Implement deterministic `currentTime` mapping from timeline loop time, and await the seek inside the export frame callback before sampling
- [ ] 14.11 Assert preview/export parity to nearest-frame tolerance, documenting the codec-dependent seek limitation (Open Question 9)
- [ ] 14.12 Implement deterministic previous-frame motion detection driving stripe phase with a strength control
- [ ] 14.13 Confirm no `getUserMedia`, camera source, or `MediaStream` reference exists anywhere in product code (C3)

## 15. ASCII, pixel, halftone

- [ ] 15.1 Implement the ASCII/ANSI pass over any source including the live generative canvas, with character set, cell size, and mono/palette/source colour modes
- [ ] 15.2 Mark any DOM product text with `data-toolcraft-product-output` or `data-toolcraft-product-text`
- [ ] 15.3 Implement pixelation with block size and optional palette quantization
- [ ] 15.4 Implement dot and cross halftone with cell size and angle, dot size varying with luminance
- [ ] 15.5 Implement line halftone by reusing the shared stripe field so it responds to stripe angle and jitter
- [ ] 15.6 Add acceptance coverage for each stylization mode

## 16. Glitch

- [ ] 16.1 Implement RGB channel split along the current stripe axis, so stripe angle changes split direction
- [ ] 16.2 Implement block displacement, scanline tearing, and datamosh-style smear
- [ ] 16.3 Derive noise from seed plus `getToolcraftTimelineLoopTime`, periodic over the duration so loops stay seamless
- [ ] 16.4 Verify all-zero intensity is pixel-identical to the un-glitched render, and that bypass preserves relative pass order
- [ ] 16.5 Add acceptance coverage per effect

## 17. Stage 4 gate

- [ ] 17.1 Verify image and video stylization plus ASCII, pixel, halftone, and glitch hold the frame budget and export correctly
- [ ] 17.2 Run bare `npm run verify:delivery`; record the Decision Trail entry

## 18. Shader hook editor (Stage 5)

- [ ] 18.1 Define the self-contained hook chunk contract per engine — documented inputs and outputs, sized for a 12-line viewport (C4)
- [ ] 18.2 Declare the `code` control with `textValueKind: "structured"`, preloaded with the active engine's hook
- [ ] 18.3 Implement coalesced compile-and-swap with uniform locations re-resolved by name and surviving values preserved
- [ ] 18.4 Implement the error surface with compiler log and line numbers mapped to the hook the user sees, keeping the last good program rendering
- [ ] 18.5 Implement annotation parsing so hook-declared uniforms register as controls in a separate namespace, dropped on reset
- [ ] 18.6 Implement the reset `actions` control and include hook source plus uniform values in Settings Transfer via `additionalValueTargets`
- [ ] 18.7 Confirm no code-editor dependency was added; run bare `npm run verify:delivery` and record the Decision Trail entry

## 19. 3D lamellae (Stage 6)

- [ ] 19.1 Add Three.js and mount the lamellae canvas as `data-toolcraft-product-output` inside `canvasContent`, sized from the runtime scene frame
- [ ] 19.2 Switch `viewInteraction` to `mode: "orbit"` with `orientationTargets` matching the schema gizmo target
- [ ] 19.3 Declare the `orientationGizmo` with a non-degenerate default pose, `label: false`, `keyframeable: false`, in the section owning the 3D view
- [ ] 19.4 Bind `useToolcraftModelOrbitInteraction` with a product-supplied geometry hit test; verify a miss pans the canvas
- [ ] 19.5 Build instanced lamellae from stripe pitch and count with a depth parameter, bounded by schema range
- [ ] 19.6 Verify parallax colour change comes from real side-face occlusion, with backing colours dominating head-on
- [ ] 19.7 Implement the lighting `switch` with a flat unlit alternative
- [ ] 19.8 Implement cylinder and sphere stripe-shader wrapping, seamless around the circumference
- [ ] 19.9 Extend `exportRenderer` to cover the 3D tool; record `previewExportDifferenceReason` if the paths differ
- [ ] 19.10 Verify pose and pixels update before pointer release with playback paused and render scale at maximum
- [ ] 19.11 Run bare `npm run verify:delivery`; record the Decision Trail entry

## 20. Final polish and delivery

- [ ] 20.1 Verify all product styling is locally anchored `*.module.css` with no global CSS, `:global`, or host-attribute selectors
- [ ] 20.2 Verify the product dependency graph is acyclic and no module imports below `src/toolcraft/ui/components/controls/**`
- [ ] 20.3 Verify no product section declares a reserved runtime target and no banned section title exists
- [ ] 20.4 Verify every section is within the ten-control cap, with `semanticGroup` present on eight-to-ten-control sections
- [ ] 20.5 Confirm the declared pass cost relationships still match the implemented shaders, and that the Nyquist-derived maxima still hold for the final render-scale and resolution assumptions — no measured performance, which requires separate user authority (R31)
- [ ] 20.6 Confirm `app-verification-impact.json` is complete with no stale paths, unknown ids, or blanket ownership
- [ ] 20.7 Finalize the worklog with one Decision Trail entry per delivery batch and remaining risks
- [ ] 20.8 Write the README covering engines, parameters, keyboard shortcut, export options, and browser requirements
- [ ] 20.9 Run bare `npm run verify:delivery` then `npm run dev`, and report the functional receipt without claiming measured performance
