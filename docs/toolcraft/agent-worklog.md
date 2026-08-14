# Implementation Worklog

This file records product decisions and the evidence behind them. Keep it short, factual, and current. Update it after schema, renderer, timeline, layer, export, performance, or acceptance decisions.

## Status

Mode: product

Shader Studio composes an ordered stack of procedural shader layers into one WebGL2 field and delivers the assembled GLSL as a readable artifact. The runtime owns the layer list, its selection, ordering, and visibility; product code owns per-layer values, the assembled program, and the composite.

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

### Iteration 1 — Layer stack canvas, renderer pipeline, and workload envelope

- Request: Continue the canvas and composition block: declare the workload envelope dimensions, register the renderer pipeline, build the scene from runtime state, mount the WebGL2 surface, and wire the composition.
- Task type: Renderer, canvas output, and performance modelling for a product app.
- User-visible result: The stack now draws. An author sees every visible layer composited in panel order into the product canvas, edits re-resolve the field while pan and zoom do not, and image export produces the same frame through the same renderer as the preview.
- Source/reference checked: The Croix10 generative art studio in the sibling repository, specifically its pipeline registration, canvas component, scene reader, and export frame; and this product's own layer registry, stack state, and stack renderer.
- Reference inputs: Croix10 supplied the proven shape for the pipeline, canvas, and export frame. Where this product differs it differs deliberately, and each difference is recorded as a decision below rather than carried over silently.
- Docs/contracts read: `workflow.md`, `core/runtime-boundary.md`, `core/performance.md`, `renderer-technique.md`, and `performance.md`, in the routed Plan-then-Implementation order for the renderer and canvas route.
- Contract rules applied: Workload roles are explicit rather than inferred; a runtime-state dimension declares its maximum-workload value directly; a workload dimension appears only on passes whose cost changes with it; the draw runs through the declared pipeline pass rather than a loose effect; renderer resources are created outside React render and released on unmount; backing pixels are CSS size times device pixel ratio times selected scale; and product output stays inside `canvasContent`.
- View interaction intent: Non-spatial, unchanged. Output is a two-dimensional shader field with no geometry, model, or camera, and layer order is a compositing sequence rather than depth, so there is nothing an orbit gesture would move around.
- Interaction ownership: Layer selection stays on the panel. Picking a layer by clicking its contribution on the canvas would be ambiguous wherever layers overlap, which in a composited stack is most of the field, and the topmost layer at a point is often not the one the author means. The complementary canvas operations are pan and zoom, which move the viewport and own no layer state.
- Decision: One `composite` pass covering the whole stack, with cost declared `linear` against a new `stack-depth` workload dimension sourced from runtime state, and a single renderer shared by preview and export.
- Alternatives rejected: One pass per layer, which would describe work the renderer does not do separately, since R52 assembles the stack into a single program. A `constant` cost relationship, which would have avoided a kernel benchmark requirement by encoding a false cost model. A schema-backed source for stack depth, which does not exist because the runtime owns the layer list. A product-enforced depth cap, which R52 rejected and which product code could not implement without rebuilding a runtime surface. A separate export renderer, which would be a second chance for export to disagree with preview.
- State/output mapping: The runtime `layers` array supplies order and visibility; `stack.layerRecord` supplies per-layer values, projected into the `selectedLayer.*` controls for whichever layer is selected and folded back on edit; `appearance.background` and `canvas.renderScale` supply the background colour and backing scale. `buildStudioSceneParameters` prunes the record against the live layer array and converts sRGB hex to linear light, and the result is both the pass cache input and the renderer's argument, so preview and export read one scene.
- Performance intent: ordinary-product-work
- Verification: One bare `npm run verify:delivery` will derive and run the protected proof.
- Risks: The `stack-depth` maximum is a declared proof ceiling chosen as a plausible authoring depth rather than derived from measurement, so a measurement could move it. The non-constant composite pass leaves a kernel benchmark requirement pending, which functional delivery defers. Colour now round-trips through the record, but only unit proof covers it so far; the browser proof arrives with the rest of the layer surface.

## Decisions

### Renderer

- Decision: One WebGL2 `composite` pass assembling the visible stack into a single fragment program, shared by preview and export.
- Reason: The output is a per-pixel field and the product's subject is the composite of several, which neither Canvas 2D nor SVG can express; a shared renderer keeps what an author sees and what they export from drifting.
- Evidence: `studio-pipeline.ts` registers the pass, `studio-canvas.tsx` draws it through `useToolcraftPipelinePass`, and `app-composition.tsx` builds the export frame from the same `createStudioStackRenderer` and `buildStudioSceneParameters`.

### Timeline

- Decision: No timeline yet.
- Reason: Per-layer animation is a later group, and declaring the panel early would oblige playback coverage in a batch with no playback to prove.
- Evidence: `panels.timeline` is omitted.

### Layers

- Decision: The runtime owns the layer list, selection, ordering, and visibility; product code owns only per-layer values.
- Reason: The product's subject is an ordered stack of editable objects, which is exactly what the runtime layers panel provides. The runtime has no per-layer value store, so that one gap is what product code fills.
- Evidence: `panels.layers` is enabled, and `stack.layerRecord` is a product target kept in step with the `selectedLayer.*` controls by `useStudioLayerSync`.

### Controls

- Decision: One `selected-layer` section whose controls edit whichever layer is selected, gated by layer kind.
- Reason: One control set per layer slot would grow the control count with stack depth and collide with the section budget as soon as a stack has more than a couple of layers.
- Evidence: `studio-layer-sections.ts` declares nine controls in a single section with `selectedLayer.type` as the gate.

### View Interaction

- Decision: Non-spatial.
- Reason: The output is a two-dimensional field with no geometry, model, or camera, and layer order is compositing sequence rather than depth.
- Evidence: `viewInteraction: { mode: "non-spatial" }` in `app-acceptance-data.ts`.

### Interaction Ownership

- Decision: Layer selection belongs to the panel.
- Reason: Canvas picking is ambiguous wherever layers overlap, which in a composited stack is most of the field.
- Evidence: The `layer-selection` ownership row, linked to its proof by `interactionId` on the `selectedLayer.type` row.

### Export

- Decision: The primary artifact is the assembled shader source — a script the author takes elsewhere. Image and video export are the secondary surface, and an exported frame is always exactly the canvas: its bounds are the artboard's bounds, in every canvas mode.
- Reason: A shader field has no extent of its own; it fills whatever it is asked to fill. There is no smaller "real" content inside the frame for an export to discover, so the artboard is the only honest boundary — and it is the one an author sets deliberately through Canvas width and height.
- Evidence: `sceneBoundsProvider` in `app-composition.tsx` returns the `canvas.size` rectangle, and `exportRenderer` draws that frame through the same renderer as preview. Measured: finite and infinite exports are both 4096x2304.
- Consequence: `canvas.infinity-export` cannot be proved by this product, and not only until layers gain bounds. Its coverage asks for evidence that an infinite export crops to the union of visible scene elements *rather than* the artboard, and the protected helper requires the infinite artifact to differ in size from the finite one. Under this decision they are equal by design, so the requirement is inapplicable rather than outstanding.
- Follow-up: The contract enforces that coverage from signed validators, and neither schema lever opens it — `fixed-output` sizing is rejected outright for products with export actions, and removing the export surface contradicts the declared image export intent. Both were tried and measured. Resolving it belongs upstream in the shared Toolcraft source, which is where `core/runtime-boundary.md` sends a wrong shared behaviour, followed by a regeneration or sync of this app.

### Performance

- Decision: Two workload dimensions — `stack-depth` from runtime state and `band-count` from the schema — with the composite pass declared `linear`.
- Reason: Every visible layer adds a body call and a composite step to every pixel, so cost grows with the length of the stack; band count sets the field's frequency rather than the work per pixel.
- Evidence: `workloadEnvelope` and `rendererPipeline` in `app-performance.ts` and `studio-pipeline.ts`.

## Evidence

- Source reviewed: the Croix10 pipeline, canvas, scene, and export frame as the reference implementation; this product's layer registry, stack state, and stack renderer.
- Contract applied: the renderer and canvas route's Plan and Implementation documents, the workload envelope and render plan rules, and the runtime boundary for product output.

## Verification

Protected receipts own changed files, the derived plan, commands, selectors, reports, measurements, and pass/fail evidence. Decision Trail iterations record only one bare `npm run verify:delivery` narrative.

## Risks

- Risk: Colour round-trips through the record under unit proof only. The browser proof that an author's picked colour reaches the composite arrives with the rest of the layer surface.
- Risk: The declared `stack-depth` maximum is a proof ceiling rather than a measured one, and a measurement could move it.
- Risk: The composite pass is non-constant, so a kernel benchmark requirement stays pending until an authorized performance run resolves it.
