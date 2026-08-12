# Implementation Worklog

This file records product decisions and the evidence behind them. Keep it short, factual, and current. Update it after schema, renderer, timeline, layer, export, performance, or acceptance decisions.

## Status

Mode: product

Croix10 renders Carlos Cruz-Diez's chromatic research as live shader parameters. This delivery ships the Couleur Additive engine, the shared stripe field, the palette, and runtime-owned image export.

## Automatic Delivery Lifecycle

Keep this worklog human-shaped. For the first product delivery, record the request, decisions, state/output mapping, reference evidence, rejected alternatives, and known risks; one bare `npm run verify:delivery` derives complete contract proof, one build, full functional acceptance, and no measured performance. For later `functional-targeted` delivery, record only the new intent and decisions; the same bare command derives exact ownership-required proof from protected state.

Classifier output establishes complaint authority only and never path localization. A localized performance complaint adds the domain authority below, then one bare `npm run verify:delivery` runs one targeted iteration. If localization remains unresolved regardless of classifier result, ask one user-facing question naming visible operations and offering targeted diagnosis or a complete review; record neither `performance-iteration` intent nor canonical path authority until the answer supplies exact localization evidence. Never ask the user to choose internal path IDs. A broad or honestly unlocalizable problem may present that single choice with a recommendation for complete review, but the user still chooses. A direct complete-review request needs no further clarification. The full audit remains separate and requires an explicit operator request or accepted offer before `npm run verify:perf` may run. Protected receipts own changed files, plans, checks, reports, measurements, and pass/fail evidence.

When `canvas.renderScale` is enabled, record the renderer decision to preserve selected backing quality and map it to functional `renderScaleCoverage` for interaction and steady state, plus playback when timeline is enabled. The worklog may name the protected `canvas-render-scale-backing` recipe, but it cannot claim its evidence or turn a quality failure into performance authority.

## Performance Iteration Entry Contract

For high-confidence ordinary work, record `Performance intent: ordinary-product-work`. For unresolved localization, whether classification returned high-confidence `performance-iteration` or `needs-agent-judgment`, record the unresolved visible operation but no `Performance intent: performance-iteration` field or `Performance paths` until the user's one clarification provides exact localization. For a localized performance complaint or post-clarification targeted choice, record exactly these domain fields in the latest iteration:

```md
- Performance intent: performance-iteration
- Performance request evidence: "<verbatim exact Request quote>"
- Performance paths: ["performance-path:%5B...%5D"]
- Verification: One bare `npm run verify:delivery` will derive and run the protected proof.
```

The quoted evidence must be an exact nontrivial raw substring of `Request` with identical whitespace and Unicode code units. `Performance paths` must be a non-empty unique JSON array of canonical path IDs. Do not record command arguments, changed-file inventory, executed checks, reports, or measurements; the protected planner and receipt own that machine evidence. Each localized complaint or post-clarification targeted choice authorizes one bounded iteration; after it passes, return the app and wait for user evaluation. Classifier output or complaint evidence alone never supplies path localization or authorizes full certification. The separate operator command is permitted only after the user explicitly requests a complete audit or explicitly accepts the agent's offer; the user does not need to name the command.

## Decision Trail

### Iteration 1 — Croix10 planning: contracts, reconciliation, and inventories

- Request: Build Croix10, a Cruz-Diez homage generative art studio, on the Toolcraft starter kit; then reconcile the plan against the real contract and author the control selection and section inventories.
- Task type: Planning, contract reconciliation, control selection, control section inventory.
- User-visible result: No visible app change. The change artifacts record the reconciled design; five requirements in the original brief could not be built as stated and were resolved with the user.
- Source/reference checked: `AGENTS.md`, the routed `docs/toolcraft/*` contract documents, and the signed runtime and acceptance validators under `src/toolcraft` and `src/app/acceptance`.
- Reference inputs: None. Croix10 is an original product; Cruz-Diez's chromatic series is subject matter, not an app being cloned.
- Docs/contracts read: `workflow.md`, `core/runtime-boundary.md`, `core/setup-export.md`, `core/control-selection.md`, `core/layout.md`, `core/timeline-animation.md`, `core/performance.md`, `core/media-upload.md`, `schema-reference.md`, `component-rules.md`, `renderer-technique.md`, `assembly-workflow.md`, `decision-contract.md`, `acceptance-testing.md`.
- Contract rules applied: `controls-section-inventory-required`, `controls-layout-heuristics`, `output-export-required`, `renderer-view-interaction`, `performance-coverage-levels`.
- View interaction intent: `non-spatial`. Output is a flat shader field with no scene geometry or camera; Physichromie's viewing angle is a colour-state parameter of that field. The later 3D lamellae tool is where a genuine editable spatial scene appears and this becomes `orbit`.
- Interaction ownership: Every field property is panel-owned. No canvas handle is justified because band density, angle, phase, and wobble have no located referent on the canvas and need precise repeatable values.
- Decision: Treat runtime quality clamping as unavailable and stop modelling density as a performance dimension; bound it by a Nyquist fidelity limit instead. Drop GIF, make SVG a clipboard copy, drop webcam, scope the shader editor to a hook chunk, and treat the section decomposition as its own deliverable.
- Alternatives rejected: A runtime quality controller degrading stripe count, product-owned GIF and SVG encoders, live camera input, exposing whole shader programs through a twelve-line control, and titling sections after the branch that reveals them.
- State/output mapping: Each planned section names the exact runtime targets it will render, so every control has a declared home before it is written.
- Performance intent: ordinary-product-work
- Verification: One bare `npm run verify:delivery` will derive and run the protected proof.
- Risks:
  - Risk: The section decomposition leads the schema by one stage, so a target renamed during implementation must be renamed in the design document too.
  - Risk: The two global mode selectors are a deliberate applicability exception and derive no automated presence or absence proof; their branch behaviour depends on named app-owned Playwright tests.

### Iteration 5 — Zero-strength defect root-caused; embedded shapes still withheld

- Request: Root-cause the zero-strength redraw defect: check whether the memoized pass skips a redraw when the parameters object is recreated with equal values, then reinstate the shape controls.
- Task type: Defect investigation, renderer verification, acceptance-method correction.
- User-visible result: No product change. The reported defect does not exist; the renderer is correct. The shape controls remain unshipped for a different and much narrower reason, recorded below.
- Source/reference checked: The WebGL backing buffer read directly across parameter round trips, the memoized pass cache input, and the same round trip on unrelated controls to test whether the behaviour was shape-specific.
- Reference inputs: None.
- Docs/contracts read: `acceptance-testing.md`, `core/performance.md`.
- Contract rules applied: `acceptance-product-observable`, `performance-coverage-levels`.
- View interaction intent: Unchanged `non-spatial`.
- Interaction ownership: Unchanged.
- Decision: There is no rendering defect and the memoized pass is not skipping redraws. Round-tripping wobble and mirror reproduced the same symptom, showing it was never shape-specific, and reading the backing buffer showed it bit-identical after the round trip: same dimensions, identical byte sum, zero differing bytes. The instability was in the measurement. `getToolcraftProductObservableSnapshot` screenshots the element at its CSS box while the backing is twice that at the default resolution scale, so the capture resamples; revealing controls grows the panel and shifts the canvas by a fraction of a pixel, and the resample differs across that shift. A screenshot hash can therefore show that output changed but cannot establish that two frames are identical.
- Alternatives rejected: Trusting the earlier conclusion and hunting a shader bug that does not exist; and shipping the shape controls with the identity claim weakened to "the field changes again", which would have described the feature as working while its defining property went unproven.
- State/output mapping: None active. The distance functions and both perturbation paths remain in the shader guarded to an exact no-op, with the corrected finding recorded beside them.
- Performance intent: ordinary-product-work
- Verification: One bare `npm run verify:delivery` will derive and run the protected proof.
- Risks:
  - Risk: What still blocks the shape controls is narrow. Three proofs pass — outline selection, perturbation mode, and size. The strength proof cannot get a stable screenshot baseline, because the act of revealing the shape controls reflows the panel in the same test that then measures a change. Reducing the baseline sample count did not help. The strength control cannot ship without a passing proof, and the other shape controls are meaningless without it, so the whole surface stays out.
  - Risk: The correction has wider scope than shapes. Any future identity claim must read the backing buffer rather than compare element screenshots. The existing change-only proofs are unaffected, because the differences they assert are far larger than resampling noise.

### Iteration 4 — Engine selector and three further chromatic engines

- Request: Continue to Stage 2: the remaining five engines, embedded shapes, and the interference layer.
- Task type: Schema, renderer, engine-conditional applicability, acceptance, browser proof.
- User-visible result: An Engine selector offering Couleur Additive, Physichromie, Induction Chromatique, and Chromosaturation. Physichromie sweeps colour states with a simulated viewing angle and depth; Induction Chromatique renders high-frequency line pairs with complementary edge fringes; Chromosaturation fills the canvas with an immersive wash whose reach and position are editable. Stripe controls now disappear when Chromosaturation is selected and return when a stripe engine is.
- Source/reference checked: The signed applicability, section-inventory, dependency-branch, and performance-path validators, plus the delivery catalog collector.
- Reference inputs: None. Palette and geometry defaults remain working candidates pending verification against primary sources.
- Docs/contracts read: `core/control-selection.md`, `core/layout.md`, `schema-reference.md`, `component-rules.md`, `acceptance-testing.md`, `core/performance.md`.
- Contract rules applied: `controls-product-coverage`, `controls-section-inventory-required`, `controls-layout-heuristics`, `acceptance-product-observable`, `performance-coverage-levels`.
- View interaction intent: Still `non-spatial`. Physichromie's viewing angle is a colour-state parameter of a flat field, not a camera pose; that reasoning is recorded in product readiness and holds until the 3D lamellae tool.
- Interaction ownership: Unchanged. Every new control is a panel-owned property edit with no located canvas referent.
- Decision: Make every stripe control conditional on a stripe engine rather than always applicable, because Chromosaturation has no stripe structure and an always-applicable control would promise an outcome it cannot have. The engine selector is the recorded cross-entity applicability exception: it gates controls in other sections, so the harness derives no cases for it and a named Playwright test proves both presence and absence instead.
- Alternatives rejected: Keeping stripe controls always-applicable and letting the renderer ignore them, which the contract names as a wrong substitution; declaring the new line-pair frequency non-constant in cost, which would have been a false cost model; and one combined engine spec file, which the delivery catalog rejects because each browser file owns exactly one acceptance domain.
- State/output mapping: `engine.active` selects a fragment branch through `uEngine`; each engine's controls upload as uniforms consumed only by their branch. Scenario `coversTargets` are now derived from the pipeline's exported target lists so the two cannot drift.
- Performance intent: ordinary-product-work
- Verification: One bare `npm run verify:delivery` will derive and run the protected proof.
- Risks:
  - Risk: The engine selector's branch behaviour depends entirely on one named Playwright test, because cross-entity gates derive no automated applicability cases. If that test is renamed or weakened, nothing else catches a missing predicate.
  - Risk: Chromosaturation has no animated drift yet — the brief asks for slowly drifting gradients, which needs the timeline in Stage 3. Spread and balance are static stand-ins.
  - Risk: Product proofs now raise their own per-test timeout because WebGL readback plus stability windows exceed the default budget on one worker. Reducing those timeouts would reintroduce load-dependent flakes.

### Iteration 3 — Browser acceptance proofs for the chromatic field

- Request: Write the 20 browser acceptance specs across the seven domain files using the protected evidence helpers, so the delivery catalog collects and verify:delivery can produce a receipt.
- Task type: Browser acceptance, evidence wiring, defect repair found by that proof.
- User-visible result: Palette slot edits now actually repaint the field, and a control edit now redraws through the declared pipeline pass. Eleven of twenty declared rows are proved in a real browser.
- Source/reference checked: `app-persistence.spec.ts` as the working model for the proof session, plus the protected product-observable, compound-control, and control-target helpers.
- Reference inputs: None.
- Docs/contracts read: `acceptance-testing.md`, `core/performance.md`, `decision-contract.md`.
- Contract rules applied: `acceptance-product-observable`, `controls-product-coverage`, `performance-coverage-levels`.
- View interaction intent: Unchanged `non-spatial`.
- Interaction ownership: Unchanged; the `stripe.count` row carries `interactionId` for the panel-owned field properties.
- Decision: Prove every field parameter through painted pixels read back from the WebGL buffer rather than through DOM signatures or runtime state, and prove the palette compound parts by whether an exact authored colour is present in the field. Sibling preservation is folded into the remove transition so it is one real state change rather than a re-assertion of an already-true condition.
- Alternatives rejected: Asserting control visibility or runtime value mutation, both of which the contract names as invalid final evidence; and twenty shallow visibility tests, which would have made the gate pass while proving nothing.
- State/output mapping: Each proof binds one schema target through `session.controlAction` to a change in the rendered field, so evidence is attached to exactly one measured interaction.
- Performance intent: ordinary-product-work
- Verification: One bare `npm run verify:delivery` will derive and run the protected proof.
- Risks:
  - Resolved: the separator is now a window onto the support rather than a painted mark, so it carries the background colour and its alpha. Excluding the background leaves those lines transparent in preview and in the exported PNG, which makes the Background switch genuinely meaningful and let the last row be proved honestly. `bands.separatorColor` was removed as redundant: the support's colour is the Background colour, so a second control for it would have contradicted the model. Every declared row is now proved and the delivery catalog collects.
  - Risk: Pointer drags on short slider ranges can land on the value they started from, so those proofs use keyboard stepping. A future helper change back to dragging would silently weaken them.
  - Risk: `scripts/toolcraft-product-control-boundary.test.mjs` fails on the untouched scaffold. It is a signed synthetic framework test that builds its own fixture and never reads this app, so `npm run test` cannot reach a fully green exit until it is fixed upstream. Vitest, docs, integrity, and code health all pass.
  - Risk: Three further defects were found only by browser proof and are fixed — the renderer ignored the selected resolution scale so backing never doubled, the band index used `mod(index, slotCount + 0.5)`, and the cycling offset step of 0.001 was finer than the control could be driven or the eye could resolve.

### Iteration 2 — Couleur Additive engine, product mode, and image export

- Request: Proceed with the full first-delivery batch in a continuous run.
- Task type: Schema, custom WebGL renderer, canvas output, export wiring, performance model, acceptance matrix.
- User-visible result: The canvas renders the Couleur Additive module — parallel colour bands divided by thin dark separators — with the stripe field, palette, separator, and background editable live, and Export PNG produces the composition as an image.
- Source/reference checked: The signed runtime canvas, product scene surface, export, and performance validators; `useToolcraftProductSceneFrame`, `shouldIncludeToolcraftPreviewBackground`, and the product export renderer contract.
- Reference inputs: None. The default palette and separator are working candidates drawn from description of Cruz-Diez's canonical green / black / red / black / blue module and are not yet verified against primary sources.
- Docs/contracts read: `schema-reference.md`, `component-rules.md`, `decision-contract.md`, `acceptance-testing.md`, `renderer-technique.md`.
- Contract rules applied: `runtime-shell-required`, `canvas-no-app-ui`, `canvas-surface-preserved`, `infinity-canvas-scene-bounds`, `controls-product-coverage`, `controls-section-inventory-required`, `output-export-required`, `acceptance-product-observable`, `performance-coverage-levels`, `persistence-policy-explicit`.
- View interaction intent: `non-spatial`, unchanged and now declared in product readiness with the reason recorded.
- Interaction ownership: `chromatic-field-properties` claims `property-edit` on the panel for the stripe field, with the canvas alternative rejected because a handle would obscure the boundaries being judged.
- Decision: One framework-free WebGL2 renderer serves both live preview and the runtime export frame, so preview and artifact cannot drift. The stripe field has a single GLSL implementation, boundaries are antialiased analytically with `fwidth`, and the product scene is a fixed origin-anchored world rectangle so infinite bounds stay stable across every scheduled frame.
- Alternatives rejected: Per-stripe geometry, which forfeits analytic antialiasing; supersampling, which scales cost exactly where the budget is tightest; separate preview and export renderers; deriving scene bounds from the dormant finite canvas size; and splitting the seven-control stripe field into workflow stages, which the validator rejects below eleven controls.
- State/output mapping: Schema targets are read by one scene reader and uploaded as shader uniforms; the same reader feeds the export frame, which composites the WebGL surface into the runtime-supplied 2D context. Background inclusion flows through `shouldIncludeToolcraftPreviewBackground` for preview while the runtime owns artifact background rules.
- Performance intent: ordinary-product-work
- Verification: One bare `npm run verify:delivery` will derive and run the protected proof.
- Risks:
  - Risk: The delivery catalog requires every acceptance row's `browserTestName` to exist as a listed Playwright test. Twenty rows are declared and the matching browser specs are not written yet, so the delivery catalog cannot be collected and one ownership gate fails. This is the next coherent batch.
  - Risk: Two defects were found only by browser proof and are now fixed — the palette reader accepted a slot only as a plain string while an edited slot commits as a `{ hex }` object, and the pipeline pass executed once at mount because its cache input was static. The pass is now memoized on the scene inputs and the backing size, which is what makes a control edit redraw.
  - Risk: The chromatic field is acquired on first pass execution rather than in an effect, because the pipeline pass runs in a layout effect. A future refactor that moves acquisition back into `useEffect` would render a blank first frame; the browser smoke test guards against that.
  - Risk: Per-band widths and the engine selector are deliberately absent from this delivery, so the canonical module renders with equal band widths only.
  - Risk: The default palette values are unverified against primary sources.

### Iteration 6 — Embedded shapes shipped by separating the reflow from the measurement

- Request: Fix the strength proof by separating the reflow from the measurement — reveal the shape controls, reload so layout is stable from first paint, then measure — and land the shape controls.
- Task type: Acceptance-method correction, schema surface, browser proofs.
- User-visible result: Embedded shapes ship. A circle, ellipse, rectangle, or split-block outline perturbs the band field, either shifting bands sideways or narrowing them locally, and at zero strength the shape is not there at all.
- Source/reference checked: The runtime persistence status attribute, the derived control-field targets, and the WebGL backing buffer across a strength round trip.
- Reference inputs: None.
- Docs/contracts read: `acceptance-testing.md`, `control-layout.md`.
- Contract rules applied: `acceptance-product-observable`, `control-applicability-cases`, `control-section-inventory`.
- View interaction intent: Unchanged `non-spatial`.
- Interaction ownership: Unchanged — the shape is a field property, not a located canvas referent.
- Decision: Fixture setup now happens before a reload rather than before a measurement. Each shape proof selects the outline, waits for the persisted state to commit, and then reloads: the control panel is already at its final size on the first paint the proof ever sees, so the baseline is sampled against a layout that cannot move, and the reflow that made the screenshot baseline unstable no longer happens inside the measured test. The identity half of the strength claim is read from the backing buffer, not from a screenshot, because a resampled element capture is the wrong instrument for proving two renders are the same render.
- Alternatives rejected: Suppressing the stability window, which would have accepted a baseline the helper itself distrusts; and dropping the identity claim to "the field changes again", which would have left the shape's defining property unproven.
- State/output mapping: `shape.kind` selects the distance function (`uShapeKind`), `shape.strength` scales the mask (`uShapeStrength`), `shape.mode` routes it to the phase or width term (`uShapeMode`), and `shape.size` scales the radius (`uShapeSize`). The outline selector sits in the section it gates, so the harness derives real presence and absence cases.
- Performance intent: ordinary-product-work
- Verification: One bare `npm run verify:delivery` will derive and run the protected proof.
- Risks:
  - Risk: `app-browser-runtime-requirements.spec.ts` cannot pass for any row carrying `renderScaleCoverage`. The derivation emits `canvas.render-scale#interaction` and `#steady`, never the plain row id, while the test requires a requirement whose id equals the row id. This is a contradiction between two framework-owned files, like `scripts/toolcraft-product-control-boundary.test.mjs`, and no product change resolves it.
  - Risk: `npm run verify:delivery` cannot mint a receipt yet, and therefore `npm run verify:perf` cannot run: full performance certification requires a current delivery anchor for the unchanged source. All 31 browser proofs pass, but the derived requirement set asks for 82 evidence attachments the specs do not make — 40 control-applicability states, 37 base evidence attachments scoped to an applicability case, and 5 standalone semantic types. 35 of the 82 belong to the shape controls; the other 47 pre-date them. `npm run verify:kernel` is independent and passes with an empty requirement set, because every pass is declared constant-cost so nothing requires a kernel benchmark.
  - Risk: The control section inventory moved to `croix10-control-sections.ts` because `app-acceptance-data.ts` crossed the code-health line limit. It is proof-model rather than runtime code, so it is deliberately not a verification-impact owner; the impact inventory rejects owners that are not runtime production modules.

### Iteration 7 — Chromointerférence and the interference layer

- Request: Skip the matrix for now and add the interference layer and Chromointerférence engine instead.
- Task type: Engine, shader variant, schema section, browser proofs.
- User-visible result: A fifth engine. Chromointerférence prints a second stripe structure over the first and shows the beat between them: pitch ratio, angle offset, phase offset, and layer coverage set the relationship, and five blend modes composite it in linear light.
- Source/reference checked: The rendered field's mean luminance and near-black population per blend mode, read from the backing buffer.
- Reference inputs: None.
- Docs/contracts read: `core/performance.md`, `control-layout.md`.
- Contract rules applied: `control-applicability-cases`, `control-section-inventory`, `performance-render-plan`.
- View interaction intent: Unchanged `non-spatial`.
- Interaction ownership: Unchanged — the layer relationship is a field property with no located canvas referent.
- Decision: The second layer is a compiled shader variant, not a uniform branch. `croix10AssembleFragmentShader("couleur-additive")` does not contain the interference code at all, so a disabled layer costs nothing per frame rather than costing a branch that always fails; programs stay cached per variant, so toggling the layer reuses its program. The primary field resolver was generalised into `croix10ResolveLayer`, parameterised by density, angle, phase, and width, so both layers are the same grammar rather than two implementations that can drift.
- Alternatives rejected: A layer available under every stripe engine, which would have multiplied the derived applicability matrix across five engines for a feature that only means something where the composite is the subject; and a runtime `uInterferenceEnabled` branch, which contradicts the spec's requirement that the disabled path contribute no per-frame cost.
- State/output mapping: `interference.enabled` selects the variant, `interference.pitchRatio` scales the second layer's density (clamped to the same Nyquist derived maximum as the primary, so a ratio above one cannot alias past the schema bound), `interference.angleOffset` and `interference.phaseOffset` rotate and slide it, `interference.widthRatio` sets its coverage, and `interference.blendMode` selects the linear-light combination.
- Performance intent: ordinary-product-work
- Verification: One bare `npm run verify:delivery` will derive and run the protected proof.
- Risks:
  - Risk: A claim I had to correct against measurement. The second layer originally read the palette one slot along from the primary, and the blend proof asserted that difference blending darkens the field. Both were wrong. The absolute difference of two saturated inks is usually brighter than either, and with a forced slot offset the layers could never agree, so the specified black-where-they-agree region did not exist at any setting. Removing the offset makes the two prints comparable, which is both more physical and what makes the beat rather than an ink change the subject; measured near-black share then rises from 0.06 under normal to 0.20 under difference, and that is what the proof asserts.
  - Risk: Traveling moiré is not shipped. The beat is static because relative drift needs the Stage 3 timeline; the interference spec now records that its speed parameter lands then.
  - Risk: The acceptance rows moved to `croix10-acceptance-rows.ts` for the same line-budget reason the inventory moved earlier. Both are proof-model, so neither is a verification-impact owner.

### Iteration 8 — Transchromie

- Request: Add the Transchromie engine — translucent planes with per-plane colour, opacity, offset, rotation, and subtractive blending.
- Task type: Engine, compound collection, browser proofs.
- User-visible result: A sixth engine. Sheets of transparent colour laid over one another, each with its own colour, opacity, offset, and rotation, stacked either subtractively or additively. Every colour in the output is what is left of the light after the sheets it passed through, so the overlaps carry colours no single sheet contains.
- Source/reference checked: Quadrant and overlap luminance read from the backing buffer under both stacking modes and across collection edits.
- Reference inputs: None.
- Docs/contracts read: `component-rules.md`, `schema-reference.md`.
- Contract rules applied: `control-collection-ownership`, `control-section-inventory`, `acceptance-compound-part-coverage`.
- View interaction intent: Unchanged `non-spatial`. A plane is a colour filter over a flat field, not scene geometry.
- Interaction ownership: Unchanged. A sheet's offset is expressible as a canvas drag in principle, but the panel owns it: the composition is built from precise repeatable relationships between sheets, and no sheet has a located referent a pointer could grab unambiguously where three of them overlap.
- Decision: A plane is one compound collection record via `itemControls`, not four parallel arrays. Colour, opacity, offset, and rotation are added and removed atomically because a sheet without all four is not a sheet, and the contract reserves `itemControls` for exactly this case. Each sheet covers the half of the composition on one side of its own edge, which is what produces the wedges of mixed colour these works are made of.
- Alternatives rejected: A fixed plane count with shared per-plane increments, which would have been cheaper to prove but would have made the sheets a formula rather than a composition; and per-plane parallel scalar controls, which the ten-control cap and the collection contract both rule out.
- State/output mapping: `transchromie.planes` uploads as parallel uniform arrays — one record per index in `uPlaneColor`, `uPlaneOpacity`, `uPlaneOffset`, `uPlaneRotation`, bounded by `uPlaneCount` and the schema's maximum. `transchromie.blendMode` selects filtering against a white ground or summing against a dark one, both in linear light.
- Performance intent: ordinary-product-work
- Verification: One bare `npm run verify:delivery` will derive and run the protected proof.
- Risks:
  - Risk: I misdiagnosed a rendering bug that did not exist. The field looked flat, so I replaced the plane edge's `fwidth` with an analytic gradient believing derivatives in the loop were returning garbage. In fact every probe was reading a 512x256 corner of a 3840x2160 backing buffer, outside every sheet, and the render had been correct throughout. The analytic softness is still the better choice — the gradient is known exactly and it keeps derivatives out of a loop that breaks — but it fixed nothing. The lesson generalises: a readback that samples a fixed corner is not a reader of the composition.
  - Risk: That same corner assumption was in `openCroix10`'s readiness poll, which waited for more than one colour in a 256x64 corner. Transchromie can leave a corner one flat colour while the composition is fully drawn, so the poll timed out on a field that was already there. It now samples tiles spread across the buffer. The equivalent reader in `app-performance-path-adapters.ts` still samples a corner; that is sound for the stripe engines its paths drive, but it would need the same treatment before a path drives a plane composition.
  - Risk: A second claim corrected against measurement. The stacking proof first asserted that subtractive stacking is brighter on average than additive. It is not — additive clips its overlaps towards white while leaving uncovered ground black, so the two means land within a few counts. The distinguishing claim is local and is what the row now declares: an overlap is darker than the sheets crossing it under subtractive and brighter under additive.
  - Risk: One unreproduced flake. `browser: croix10 plane stacking...` failed once in a 42-test parallel run and then passed in five consecutive runs, three isolated and two full. I could not reproduce it and have not diagnosed it, so it is recorded rather than claimed fixed.
  - Risk: Three more line-budget splits. The schema assembly now composes `croix10-engine-sections.ts` through `croix10-applicability.ts`, and the acceptance rows split into core and engine files. The two schema modules are runtime code and so are verification-impact owners; the row files are proof-model and are not.

### Iteration 9 — Preset library and Randomize

- Request: Author the built-in presets and Randomize with per-section locks, so Stage 2 closes.
- Task type: Command wiring, schema sections, browser proofs.
- User-visible result: Ten built-in presets, at least one per series, and a Randomize command with four locks. Loading a preset or rolling Randomize writes ordinary control values, so the panel follows, the canvas re-renders, and one undo puts it all back.
- Source/reference checked: The runtime command union and the panel action handler contract; randomize output sampled across the unit interval for range safety.
- Reference inputs: None.
- Docs/contracts read: `core/runtime-boundary.md`, `core/control-selection.md`.
- Contract rules applied: `control-selection-actions`, `control-layout-toggle-pairs`, `control-acceptance-kind-rules`, `acceptance-command-side-effect`.
- View interaction intent: Unchanged `non-spatial`.
- Interaction ownership: Unchanged.
- Decision: Neither command owns a scene format. A preset is a map of schema targets and randomize derives its values from the schema's own declared domains, and both dispatch one `controls.setValue` per target under a shared `historyGroup` with `history: "merge"`, so the whole batch is a single undo step. Nothing about persistence, reset, or Settings Transfer needs to know these commands exist.
- Alternatives rejected: A preset select that applies on change, which would make persistence dishonest — a reload would replay the preset over the user's later edits — and which the runtime does not support anyway, since product code gets a hook for running a command and not for reacting to a control change. Also rejected: a randomize table of ranges parallel to the schema, which is one more thing to keep in agreement with the schema.
- State/output mapping: `presets.active` stores a choice and `presets.actions` loads it. `randomize.actions` runs the command; `stripe.randomizeLock`, `palette.randomizeLock`, `immersion.randomizeLock`, and `transchromie.randomizeLock` exclude their groups. Randomize reads applicability before assigning, so it never writes a control the panel is not showing.
- Performance intent: ordinary-product-work
- Verification: One bare `npm run verify:delivery` will derive and run the protected proof.
- Risks:
  - Risk: Two documented deviations from the specification, both forced by framework rules rather than chosen. Randomize is an `actions` control in its own section rather than a sticky `panelActions` command, because every acceptance row on a sticky panelActions control must cover every footer action — putting Randomize in the footer would oblige the export proof and the randomize proof to each exercise both commands. And the four locks live in one Randomize section rather than in the sections they protect, because Palette and Translucent Planes each hold a large compound control and runtime splits such a control into its own section, which duplicates section titles. The spec now records both.
  - Risk: Lock targets are named for the entity they protect (`stripe.randomizeLock`, not `randomize.lockStripe`). That is not cosmetic: four adjacent toggles sharing one target prefix are unrepresentable, because the layout rule wants each adjacent pair in a two-column group of exactly two controls and the middle pairs overlap.
  - Risk: Randomize covers four groups, not every parameter. Every engine has something to randomize, but viewer parallax, the afterimage fringe, the interference relationship, and the embedded shape are excluded — randomizing them tends to destroy a composition rather than find one. Extending randomize to them means adding their locks in the same change, or the user gains a parameter they cannot protect.
  - Risk: A latent flaw in the browser proofs, found while writing these. The lock readers first addressed sliders by `aria-label`, which matches nothing — the sliders take their names from label elements — so every value read as an empty string and a lock proof would have passed by comparing blanks. The readers now go through the runtime target, and each lock proof additionally asserts that the value it is protecting is not empty.
  - Risk: The new sections pushed the stripe controls below the panel's scroll window, and three drag proofs began failing because a pointer drag works in viewport coordinates and was landing on whatever sat at those coordinates. `dragCroix10Slider` now scrolls the thumb into view first. Any future proof that drives a control by pointer rather than by keyboard has the same exposure.

### Iteration 10 — The R shortcut and the Settings Transfer round trip

- Request: Bind R to randomize, suppressed while a text or code input has focus, and verify Settings Transfer round-trips the full scene losslessly.
- Task type: Keyboard command, runtime-boundary verification.
- User-visible result: R randomizes, and it stays out of the way while you are typing. Exporting settings and importing them back restores the whole scene, including the engine, a maximum line frequency, and an edited palette slot.
- Source/reference checked: The runtime settings transfer renderer and its import path; the exported JSON's own bytes.
- Reference inputs: None.
- Docs/contracts read: `schema-reference.md` (history and shortcuts), `core/setup-export.md`.
- Contract rules applied: `settings-transfer-runtime-owned`, `acceptance-command-side-effect`.
- View interaction intent: Unchanged `non-spatial`.
- Interaction ownership: Unchanged.
- Decision: The shortcut dispatches the same assignments as the button, under the same history group, so the two paths cannot diverge — one undo either way. Suppression is decided from the event target rather than from a list of the places the app currently puts text: content-editable, textarea, select, value-entry inputs, and the textbox, searchbox, and combobox roles all keep the key. A range input deliberately does not: a slider is exactly where a shortcut should still work.
- Alternatives rejected: Matching on a list of the app's own text targets, which would silently stop covering the shader editor when it arrives. Also rejected: any product save or load control — settings transfer is runtime-owned, and the acceptance model only has a slot for opting out of it.
- State/output mapping: The shortcut writes the same targets as `randomize.actions`. Settings transfer writes nothing product-owned, because every value that defines a Croix10 scene is already a schema target; `settingsTransfer.additionalValueTargets` is empty for that reason rather than by omission.
- Performance intent: ordinary-product-work
- Verification: One bare `npm run verify:delivery` will derive and run the protected proof.
- Risks:
  - Risk: The round trip carries no acceptance row, because the acceptance model's only settings-transfer slot is `opt-out`. Its browser test is therefore unbound by design — the delivery catalog accepts that, since it requires every row to name a listed test and not the converse. If the framework later requires every product browser test to be bound to a row, this test needs a home.
  - Risk: The shortcut is mounted from `Croix10Canvas`, because product code has one mount point inside the runtime shell. It is app-level behaviour living in a canvas component, and the next shortcut the brief asks for — space, S, F — will make that placement look worse. A product shortcut host would be the better shape once there is more than one.
  - Risk: The suppression proof asserts that pressing R inside a hex field leaves the composition untouched. It does not assert that the field received the character, because the hex field filters what it accepts; the stronger claim would need a text control that takes arbitrary input, which the shader editor will provide in Stage 5.

### Iteration 11 — The playback timeline, and drift as whole cycles

- Request: Start Stage 3 — the animation timeline, so the moiré travels and Chromosaturation drifts.
- Task type: Runtime timeline adoption, product motion.
- User-visible result: The app opens playing. Chromointerférence gains a Drift rate that travels the moiré across the loop, and Chromosaturation gains one that sweeps the wash across the field and back. Both are whole cycles per loop, so every rate loops seamlessly; zero holds the field still. Editing the timeline duration changes how long a loop takes and nothing else.
- Source/reference checked: The runtime timeline panel, its transport, its clock, and the export frame-state builder.
- Reference inputs: None.
- Docs/contracts read: `core/timeline-animation.md`.
- Contract rules applied: `timeline-runtime-owned-transport`, `seamless-forward-loops`, `loop-time-from-runtime-helper`, `duration-changes-loop-not-design`.
- View interaction intent: Unchanged `non-spatial`.
- Interaction ownership: Unchanged. The transport is runtime-owned; the product owns only the rates.
- Decision: `mode: "playback"`, not `keyframes`. Both give the same transport, loop semantics, and time source; keyframes additionally obliges `timelineCoverage: "keyframes"` acceptance for every keyframe-capable control — every slider and colour here — and forbids opting any of them out. The motion Stage 3 owes is parameter drift over a runtime-owned loop, which playback expresses exactly, so keyframes becomes its own change. Nothing in the render path moves when it lands, because values already go through `evaluateToolcraftTimelineValues`.
- Decision: Drift rates are integers rather than a continuous rate quantized at evaluation. Whole cycles per loop means every reachable rate already stitches, there is no corrected value to surface, and nothing in state disagrees with what renders. The unit is each parameter's own period: for the stripe field, `lcm(2, paletteLength)` bands, because a one-band shift changes both the palette index and the side of the width alternation. The immersion balance has no spatial period, so its drift is a sine sweep, which closes at every whole cycle for the same reason and is clamped back into the control's declared range.
- Alternatives rejected: A continuous rate with loop-safe quantization (tasks 11.5 and 11.6), which needs a requested value, a quantized value, and UI to explain the difference between them. Also rejected: giving the shader a time uniform. Time enters through the one scene reader instead, so preview and export cannot disagree, and the seam becomes checkable without a GPU.
- State/output mapping: `immersion.driftCycles` and `interference.driftCycles` resolve into the `uImmersionBalance` and `uInterferencePhaseOffset` uniforms the shader already read. No new uniform, and the shader is untouched.
- Performance intent: ordinary-product-work
- Verification: One bare `npm run verify:delivery` will derive and run the protected proof.
- Risks:
  - Risk: The runtime opens playing (`create-template-state.ts:56`). That is right for the product, but it means any proof that reads the field at a named time has to pause first or it measures a race. `showCroix10ExtendedTimeline` pauses for that reason, and the first version of the timeline proof failed exactly this way before it did.
  - Risk: `use-toolcraft-pipeline-pass.ts:50` compares its cache input one level deep, so an identical-but-rebuilt `sceneParameters` object reads as new. Under playback that would redraw a static scene at frame rate. The canvas now holds the previous object while its serialisation is unchanged, which is a JSON compare per state change — far cheaper than the draw it avoids, but it is a workaround for a reference comparison rather than a fix.
  - Risk: The two drift controls add derived applicability cases to the evidence matrix that the deferred delivery receipt will need. Their own proofs are plain product-output proofs rather than harness-driven sweeps, so the matrix rollout has to cover them when the receipt is picked up.
  - Risk: The product browser suite does not complete green in one parallel pass, for two separate framework reasons, neither fixable from product code. **Oversubscription:** `playwright.config.ts` leaves `workers` unset, so Playwright uses half the cores — four here — and four Chromium instances rendering WebGL at 3840x2160 on eight cores slow each other superlinearly. Measured: interference phase offset takes 43.2s with only its own file running at four workers, 1.3m in the full suite at two workers, and 5.5m at four, where it overruns its own budget. Full suite: 43/54 at four workers, 53/54 at two, and every four-worker failure passed on rerun. Raising the budgets is not the fix — surviving four-worker contention needs roughly fifteen-minute ceilings, which destroys what a timeout is for. **Keep-alive close race:** the remaining failure is an `ECONNRESET` on the identity endpoint that the proof session polls before every action. The trace of one shows the failing request issued after 5.995s of idle, and a raw socket against `vite dev` shows the server advertising `Keep-Alive: timeout=5` and closing idle connections at 6007ms. Ruled out along the way: listen backlog (2560 requests at concurrency 256, zero errors), watcher churn (34,867 artifact writes, p50 0.4ms to 0.9ms, zero errors), and memory pressure (34-38% free throughout). The delivery gate is unaffected by the first — `toolcraft-delivery-executor.mjs:186` already runs `--workers=1` in preview mode — but is exposed to the second. Both are written up for the maintainers with the one-line fixes.
  - Risk: The seam proof scrubs to `End`, which is exactly the duration, and the loop maps that back onto zero. That is the real first/last seam, but it is not the same as watching playback cross the boundary. A continuously-playing crossing is not observable byte-for-byte from a test, so the declaration and the scrubbed seam are what stand for it.

### Iteration 12 — Delivery 1: the evidence matrix closed and the receipt minted

- Request: Fix the flaky browser suite, then close whatever was blocking the first delivery.
- Task type: Test infrastructure, acceptance evidence, delivery.
- User-visible result: None in the rendered product. The app now carries a validated delivery receipt: fifty browser proofs derived from the acceptance matrix run and pass, and the artifact the receipt certifies is the same image-export product Iteration 11 left behind.
- Source/reference checked: The derived browser requirement set, the attachments each product proof makes, the runtime timeline state, and the delivery executor's own test selection.
- Reference inputs: None.
- Docs/contracts read: `acceptance-testing.md`, `core/setup-export.md`.
- Contract rules applied: `acceptance-product-observable`, `controls-product-coverage`, `output-export-required`.
- View interaction intent: Unchanged `non-spatial`.
- Interaction ownership: Unchanged. Nothing moved between the canvas and the panel.
- Decision: The `timeline.playback` row is untargeted. It previously named `canvas.renderScale`, which made every derived requirement demand evidence at that target while the framework's timeline helpers attach without one, so the row could not be satisfied by any proof that existed or could be written. The row's subject is the runtime timeline, which owns no schema control target, and an acceptance row is allowed to have none.
- Decision: The renderer publishes its own cycle length as `data-croix10-cycle-seconds`, read from the same `state.timeline` that normalises its phase. The duration evidence claims the runtime range and the rendered cycle move together; without the second half, a proof reads only the scrubber and asserts the runtime agrees with itself.
- Decision: The drift rows are proved through the applicability harness rather than as single-branch product-output proofs, which is what Iteration 11 recorded as owed. Each branch that renders the rate reproves the rate, measured away from the loop origin — at `t=0` every rate renders the same phase, so a rate change read at Home is invisible for reasons that have nothing to do with the control.
- Alternatives rejected: Attaching timeline evidence manually with `canvas.renderScale` as its target, which would have kept a wrong declaration alive to satisfy a validator. Also rejected: inferring the rendered cycle from the scrubber, which is the assertion the evidence exists to prevent.
- State/output mapping: `readCroix10LoopDurationSeconds` reads `state.timeline.durationSeconds` and the canvas publishes it as a data attribute. No uniform, no shader change, and no change to what is drawn.
- Performance intent: ordinary-product-work
- Verification: One bare `npm run verify:delivery` will derive and run the protected proof.
- Risks:
  - Risk: Two framework issues make the *full* browser suite red while leaving delivery untouched, because the gate greps only the acceptance matrix's own test titles and never selects a framework self-test. First, `app-browser-orientation-evidence.spec.ts` appends synthetic transport buttons into the live app root and then requires exactly one playback action with `Play` visible, so any product with a timeline fails it; the runtime hardcodes `isPlaying: true` and the timeline schema exposes no initial play state, so no product change resolves it. Second, `app-browser-runtime-requirements.spec.ts` derives requirements without a schema, and a row carrying `renderScaleCoverage` is denied its base evidence type and emitted only under suffixed ids, so it can never produce a requirement whose id equals the row id — measured at zero without a schema against one with it. Both are written up for the maintainers alongside the worker-oversubscription and keep-alive issues from Iteration 11.
  - Risk: The loop proof samples phases during real playback, which advances on animation frames. Under suite contention the browser throttles them, so a four-second cycle can take far longer than four seconds of wall clock to close; the first version budgeted from wall clock and failed in the suite while passing alone. The budget is now a flat ceiling per cycle and the failure is split so a clock that never moved reads differently from one that moved without closing, but this remains the most timing-sensitive proof in the product suite.
  - Risk: `exportIntent.video` is still `not-requested`, so this receipt certifies an image-export product. The brief asked for video, and flipping the intent reopens this gate and obliges complete video artifact coverage in the same batch. The `Video Export` section, its panel action, and its acceptance rows are all still owed; a section declared ahead of the intent fails correspondence, which is what the flag's comment records.
  - Risk: The suite's stability depends on two local workarounds that live outside the signed tree — a `--workers=2` sibling script and a `NODE_OPTIONS` preload raising the server's keep-alive timeout. They are not part of the delivery command, so a gate run made without the preload is still exposed to the keep-alive race that the upstream report describes.


## Decisions

### Renderer

- Decision: The separator lines are windows onto the support, not painted marks: they carry the background colour and its alpha, so they are the product's only transparent region.
- Reason: A full-bleed field has nowhere for a background to show, which made the mandatory Background switch and the transparent-PNG semantics unprovable. Treating the dividing line as the support showing through is also closer to the originals, where the line is often the ground rather than ink.
- Evidence: `croix10-shaders.ts` mixes toward `uBackgroundColor` across the separator mask and carries `uIncludeBackground` into the output alpha; `product-background.spec.ts` proves the preview background disappears and the exported PNG is transparent while the field survives.

- Decision: WebGL2 fragment shaders in one framework-free renderer shared by preview and the runtime export frame.
- Reason: The output is a continuous per-pixel colour field whose boundaries must be antialiased from screen-space derivatives; that is what keeps high-frequency output stable, and it makes per-pixel cost constant with respect to band count.
- Evidence: `croix10-render.ts` compiles one program per variant and is called by both `croix10-canvas.tsx` and the composition export frame. `croix10-shaders.ts` resolves boundaries with `smoothstep` over `fwidth`.

### Timeline

- Decision: No timeline in this delivery.
- Reason: This batch ships no animation, and the timeline is required only for product animation or video export, neither of which is present yet.
- Evidence: `panels.timeline` is omitted, so the render-scale acceptance row declares `interaction` and `steady` states without `playback`.

### Layers

- Decision: No layers.
- Reason: The product is a single composited field with no multiple editable objects, groups, or selection.
- Evidence: `panels.layers` is omitted and no `selectedLayer.*` target exists.

### Controls

- Decision: Six product sections, each titled for the entity it edits, with the stripe field kept whole at seven controls.
- Reason: Section titles must not resemble the branch that gates them, and an entity of ten or fewer controls must stay in one section. The palette collection stands alone because runtime splits a large compound control out of any section it shares.
- Evidence: `appControlSectionInventory` matches the rendered sections, and every control declares explicit applicability and a performance role.

### View Interaction

- Decision: `non-spatial`.
- Reason: Output is a flat shader field with no scene geometry, model, or camera to orbit.
- Evidence: `appProductReadiness.viewInteraction` records the reason, including why Physichromie's viewing angle is a colour parameter rather than a camera pose.

### Interaction Ownership

- Decision: The panel owns every chromatic field property; no canvas handle exists.
- Reason: Density, angle, phase, and wobble are global field properties with no located canvas referent, and they need precise repeatable values a drag cannot express.
- Evidence: The `chromatic-field-properties` ownership entry names the rejected canvas alternative and is bound to the `stripe.count` acceptance row through `interactionId`.

### Export

- Decision: Image export only, through the runtime typed action and one product `exportRenderer`.
- Reason: Image export is the Toolcraft default. Video was requested and is planned, but intent must correspond exactly to the schema, and declaring it before its section and action exist would fail correspondence and oblige complete video coverage now.
- Evidence: `exportIntent` declares image `toolcraft-default` and video `not-requested`; the composition supplies one `renderFrame` and a non-blank `baseFileName`, and no product module allocates an export canvas or encoder.

### Performance

- Decision: Model the fragment passes as constant cost with respect to the stripe dimensions, and bound density in the schema as a fidelity limit.
- Reason: A fragment shader costs the same per pixel at eight bands or eight hundred, so band count is not a cost driver. The real drivers are pixel count and pass count. Declaring the passes non-constant would encode a false cost model and leave a permanent pending kernel benchmark requirement.
- Evidence: `app-performance.ts` declares both passes `relationship: "constant"`, one `band-count` workload dimension whose `interactiveMax` equals the schema endpoint, and six scenarios covering the derived paths. Density maxima are derived in `croix10-parameters.ts`, not measured.

## Evidence

- Source reviewed: neutral starter schema and local Toolcraft docs.
- Contract applied: starter baseline remains neutral until product behavior exists; `model-appearance-presentation` keeps package import, appearance leases, model canvas output, gizmo pose, and export ownership explicit.

## Verification

Protected receipts own changed files, the derived plan, commands, selectors, reports, measurements, and pass/fail evidence. Decision Trail iterations record only one bare `npm run verify:delivery` narrative.

## Risks

- Risk: This template must be replaced with product-specific decisions before final delivery.
- Risk: A product that selects custom model presentation must mount every declared checked consumer; otherwise runtime reports typed retryable presentation feedback and suppresses only that declared target.
