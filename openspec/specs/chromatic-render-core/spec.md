# chromatic-render-core Specification

## Purpose
Recorded from the Croix10 change, archived at 110 of 219 tasks.

**Build status is stated per requirement.** Audited against the app on
2026-08-18 (`outstanding` 1.1). Two of these are contradicted by the product on
purpose, and both contradictions are load-bearing rather than drift — the reasons
are given where they occur.
## Requirements
### Requirement: WebGL2 rendering inside the runtime scene surface
All 2D output SHALL be rendered by WebGL2 fragment shaders into a product canvas mounted in `canvasContent`. Backing size and world-to-local translation SHALL come from `useToolcraftProductSceneFrame()`. Product code MUST NOT read DOM geometry, position a second scene wrapper, or use dormant finite `canvas.size` while in infinite mode.

**Status: satisfied.** One canvas in `canvasContent`, sized from
`useToolcraftProductSceneFrame`, with no DOM geometry read and no second
wrapper.

#### Scenario: Scene frame drives backing size
- **WHEN** the renderer prepares a frame
- **THEN** it sizes its drawing buffer from the frame reported by `useToolcraftProductSceneFrame()`
- **AND** `empty` and `unavailable` frames are handled explicitly rather than falling back to finite dimensions

#### Scenario: Infinite mode uses provider bounds
- **WHEN** Infinity canvas is enabled
- **THEN** product output fills the runtime-positioned scene surface derived from `sceneBoundsProvider`
- **AND** no synthetic workspace rectangle is drawn

#### Scenario: WebGL2 unavailable
- **WHEN** the browser cannot provide a WebGL2 context
- **THEN** DOM product text inside `canvasContent`, marked `data-toolcraft-product-text`, names WebGL2 as the requirement rather than leaving a blank canvas
- **AND** it is product output rather than app chrome, because a WebGL2 failure means there is no other output to show

### Requirement: Product scene extent is a fixed world rect
`sceneBoundsProvider` SHALL return a fixed world rectangle of constant dimensions anchored at the world origin, declared as a product constant rather than a control. It MUST NOT vary with `canvas.mode`, playback time, or parameter values, and MUST NOT be derived from dormant finite `canvas.size` while infinite. This is required because a full-field shader has no intrinsic extent and infinite video export unions the provider across every scheduled frame.

**Status: contradicted, deliberately, and this is the sharpest disagreement in
the file.** `studioSceneRect` derives the rectangle from `canvas.size`, which
this requirement forbids in as many words.

The reason is that the two products differ in what a canvas *is*. Croix10's
output size was not an authored property, so a constant rect was honest. This
product's sizing mode is `editable-output`: the author chooses the dimensions in
the flow and can change them afterwards, so a constant would detach both the
infinite-canvas frame and the exported artifact from the control that sets them —
an author would pick 1080x1920 and export something else.

What the requirement is protecting is still protected. The rect does not vary
with `canvas.mode`, with playback time, or with any parameter; it varies with one
thing, the size the author set, and it is centred on the world origin. The
video-export union it worries about holds for the same reason: the size does not
change during a loop.

#### Scenario: Extent is stable across the timeline
- **WHEN** the provider is resolved at several scheduled timeline times
- **THEN** it returns the same world rectangle every time, so infinite video export forms one stable envelope

#### Scenario: Extent is independent of canvas mode
- **WHEN** the user toggles Infinity canvas on and off
- **THEN** the provider returns the same world rectangle in both modes
- **AND** the finite artboard pixels and width/height control values are restored exactly on return to finite

#### Scenario: Infinite image export crops to the union
- **WHEN** PNG is exported in infinite mode
- **THEN** the artifact crops to the outward-rounded union of the provider rect and visible runtime media frames, excluding editor-only handles and the gizmo

### Requirement: Declared renderer pipeline before renderer code
One compiled `rendererPipelineRegistration` SHALL declare every pass with its workload dimensions, cost relationship, execution frequency, lifecycle, execution location, output quality, and exact interaction invalidation, including `initial-render`. `assessToolcraftRenderPlan` SHALL return no structural errors before any renderer code is written, and the same registration SHALL be reused as `rendererPipeline` in performance assessment.

**Status: satisfied.** One registration, reused as `rendererPipeline`, and
`assessToolcraftRenderPlan` runs in the performance gates with no structural
errors. There is one pass to declare rather than five, for the reason the next
requirement records.

#### Scenario: Assessment gates implementation
- **WHEN** the render plan assessment reports a structural error
- **THEN** renderer implementation does not begin until the error is resolved

#### Scenario: One canonical registration
- **WHEN** the composition and the performance configuration are compared
- **THEN** both reference the same compiled pipeline registration rather than parallel declarations

### Requirement: Fixed, bypassable pass order
Passes SHALL execute in the documented order source → interference → stylization → glitch → present, composited through ping-pong framebuffers. A bypassed pass SHALL be skipped entirely rather than neutralized by an identity computation, and disabled features SHALL contribute no per-frame cost.

**Status: superseded.** There is no chain and no ping-pong: the stack is
assembled into a single program in which each layer's body runs once and
composites in place. Stylization and glitch are not passes because they are not
built (`post-fx-suite`), and interference is a per-layer engine rather than a
stage.

The rule underneath survives and is enforced elsewhere: a technique at zero
strength is the identity, and an unused engine's branch is not entered, so a
disabled feature costs nothing per frame.

#### Scenario: Disabled interference costs nothing
- **WHEN** the second stripe layer is disabled
- **THEN** the compiled shader variant omits its code path and no interference pass executes

#### Scenario: Bypass preserves relative order
- **WHEN** an enabled effect is bypassed
- **THEN** the remaining passes execute in the same relative order

### Requirement: Shader variant assembly and caching
Shaders SHALL be assembled from shared GLSL chunks plus one engine chunk, compiled per feature-flag variant, and cached by variant key. The stripe field SHALL have exactly one implementation shared by every consumer.

**Status: satisfied.** Assembled from shared chunks, compiled lazily and cached
by stack signature — the variant key here is *which layer types in which order*,
which is this product's equivalent of a feature-flag set. One stripe field
implementation, in `studio-layers.ts`, used by every consumer.

#### Scenario: Variant reuse
- **WHEN** the user toggles a feature off and on again
- **THEN** the previously compiled variant is reused from cache rather than recompiled

### Requirement: Non-blocking parameter updates
Parameter changes SHALL take effect on the next rendered frame by uploading uniform values, without recompiling shaders and without blocking the render loop. Discrete sliders SHALL still drag smoothly, and product output MUST NOT remain unchanged until pointer release.

**Status: satisfied.** A value change uploads a uniform; only a change to the
*shape* of the stack recompiles, and that is cached. The live-drag half is proved
by `browser perf: shader studio band count drag stays live through the gesture`,
which asserts the composite updates before pointer release.

#### Scenario: Dragging a slider during playback
- **WHEN** the user drags a geometry slider while the timeline is playing
- **THEN** the canvas continues to advance frames and updates continuously during the drag with no shader recompilation

### Requirement: Honest pass cost declaration
Each pass SHALL declare the `relationship` that is true of its cost with respect to its declared workload dimensions. The 2D fragment passes SHALL declare `relationship: "constant"` for stripe count and line frequency, because per-pixel cost does not vary with either. Passes whose cost genuinely scales with a declared dimension SHALL say so; a conservative but false non-constant declaration MUST NOT be used.

**Status: satisfied in substance, and worth reading rather than ticking.** The
pass declares `relationship: "linear"`, and that is honest: it is linear in
*stack depth*, because each layer's body runs per pixel and a deeper stack runs
more of them. Band count is declared as a dimension the pass reads while the
registration records that cost does not vary with it — which is the "constant for
stripe count" this asks for, expressed in the framework's own vocabulary. The
file also names the one dimension that will genuinely change this: a drawn path,
whose crossing test walks a length the author chooses.

#### Scenario: Stripe dimensions are constant-cost
- **WHEN** the pipeline registration declares the engine and composite passes
- **THEN** their cost relationship with respect to stripe count and line frequency is `constant`
- **AND** `assessToolcraftRenderPlan` raises no kernel benchmark requirement for them

#### Scenario: Genuinely scaling passes are declared as such
- **WHEN** a pass cost does scale with a declared dimension, as the 3D lamellae rasterize pass does with lamella count
- **THEN** its relationship states that scaling and any resulting benchmark requirement is recorded as pending

### Requirement: Quality is never reduced to hold a budget
The renderer MUST NOT reduce stripe count, render scale, backing resolution, product range, source fidelity, or visible quality to hold a frame budget. Frame cost SHALL be addressed through pass cost, invalidation, cache lifetime, scheduling, and execution location.

**Status: satisfied.** Nothing degrades anything. Render scale is a control the
author sets and the product never touches; band count's ceiling is the Nyquist
limit rather than a frame budget.

#### Scenario: No runtime quality clamping
- **WHEN** frame time approaches the budget at the maximum reachable workload
- **THEN** the renderer continues rendering at the user's selected quality and render scale
- **AND** no automatic reduction of stripe count, resolution, or fidelity occurs

#### Scenario: Workload dimensions mirror the schema
- **WHEN** a workload control is declared
- **THEN** it carries `performanceRole: "workload"`, maps to exactly one numeric `workloadEnvelope` dimension, and that dimension's `interactiveMax` equals the schema endpoint selected by its `workloadBoundary`

#### Scenario: Render scale is runtime-resolved
- **WHEN** `canvas.renderScale` is enabled
- **THEN** the schema authors only `step`, and the runtime resolves `min` 1, `defaultValue` 2, and `max` 2
- **AND** actual backing pixels equal CSS size × devicePixelRatio × the selected scale in interaction, playback, and steady states

### Requirement: Animation work yields during viewport interaction
The renderer SHALL suspend or coalesce non-essential animation work during canvas drag, pan, pinch, zoom, and radar or center interactions, then resume from the correct timeline time without changing play or pause state.

**Status: pending — not built, and now newly relevant.** No such yielding
exists. It did not matter while nothing animated; the loop introduced in
`video-export-and-motion` means a drifting composition now renders continuously
while the viewport is being dragged.

There is a mitigating half that was built: a composition declaring no drift is
pinned to loop zero, so its scene is unchanged frame to frame and nothing
redraws. The gap is real only for compositions that do drift. Carried as
`outstanding` 1a.8.

#### Scenario: Pan does not change playback state
- **WHEN** the user pans the canvas while playback is running
- **THEN** non-essential work is coalesced during the gesture and playback resumes at the correct time in the same play state

### Requirement: Resource lifecycle
Source-bound GPU resources SHALL be created outside React render, retained according to their declared pass lifecycle, reused across unrelated interactions, and released during cleanup. Animation frames SHALL be cancelled on cleanup, and timeline-only updates MUST NOT recreate source-bound resources.

**Status: satisfied.** The renderer is acquired on first pass execution rather
than in render, kept in a ref across unrelated interactions, and disposed on
unmount; the pointer loop cancels its animation frame on cleanup. A timeline
change alters one uniform and recreates nothing.

#### Scenario: Timeline scrub does not rebuild resources
- **WHEN** the user scrubs the timeline
- **THEN** textures, framebuffers, and programs are reused and no source-bound resource is recreated

