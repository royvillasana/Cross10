# lamellae-3d Specification

## Purpose
Recorded from the Croix10 change, archived at 110 of 219 tasks.

**Build status: none of this is built, and the product currently declares the
opposite. The owner decided on 2026-08-21 to build it.**

Audited against the app on 2026-08-17 (`outstanding` 1.1). There is no Three.js
scene, no gizmo, no instanced geometry and no curved-surface mode. The only
search hits were the word "three" and the preset named *Lamella Sweep*, which is
a flat band field.

**The conflict was real and does not dissolve.** The app declares
`productReadiness.viewInteraction` as `mode: "non-spatial"`, and its recorded
reason is the direct negation of what the second requirement asks for: *"Output
is a two-dimensional shader field with no scene geometry, model, or camera to
orbit."* Building this flips that declaration.

**What it costs is worth stating plainly, because it is not only work.** The
product's coherence rests on four things: one WebGL2 program assembled from a
layer stack, per-layer uniforms, one export path, and delivery as shader source.
A spatial mode touches all four — a second renderer beside the stack, geometry
where there were uniforms, two pipelines that have to agree at export, and a
scene that **cannot be delivered as a fragment shader**. `Copy shader source`
and the MCP package have no meaning for a composition in this mode, and that is
a gap in the artifact story rather than a detail.

**What it buys is the subject.** A Physichromie *is* lamellae, and its colour
changing as a viewer moves is the phenomenon rather than an effect over it. The
product does that today in the plane, as a simulated shift — which is precisely
what the parallax requirement below forbids. Real occlusion is a different
claim, and the only one that is actually true of the works.

Two things make the build smaller than it looks: Three.js is already a
dependency of the runtime, and the runtime owns the orbit gizmo and the
model-orbit interaction, so no dependency is added and no signed source is
touched.

Scheduled as `outstanding` 1a.5a (the scene, the gizmo and the declaration),
1a.5b (extruded lamellae, real parallax and lighting) and 1a.5c (curved surfaces
and export parity).

**1a.5a was attempted on 2026-08-21 and is blocked on a contradiction between
this file and the framework's own proof recipes.** The build itself worked: a
Three scene rendered into the runtime product scene surface, one product output
at a time, the gizmo appearing only in the spatial mode, the declaration flipped
to `orbit`, and the pose driving the camera. It was reverted rather than landed,
because it cannot be *proved* as specified.

The contradiction is precise. A gizmo control requires all seven orientation
coverages — there is no honest subset — and the `model-drag` one is a protected
recipe that finds its surface by
`[data-canvas-model-layer][data-toolcraft-model-orbit-surface="true"]`. Only the
runtime's model-canvas layer writes those attributes, and only for an imported
model asset. This file's first requirement forbids exactly that: the lamellae
are procedural, so `modelPresentation` stays `{ mode: "runtime" }` and no
loader, lease or presentation document exists. Its second requirement then asks
for direct drag through `useToolcraftModelOrbitInteraction` **with a
product-supplied geometry hit test** — which is what was built, and which the
recipe cannot see.

So the spec asks for a product-owned spatial scene, and the proof machinery can
only certify a runtime-presented model. Marking a product canvas with the
runtime's model-layer attributes would make the recipe pass by claiming the
scene is something it is not, which is the one move this project has refused
everywhere else.

**Filed upstream as issue 19**, with the patch written out in full: an optional
`surfaceSelector` on `createToolcraftModelOrbitAction` and
`expectToolcraftOrientationModelDrag`, defaulting to the runtime's model layer
so no existing caller changes. Both files are protected — their hashes are in
the integrity manifest — so it could not be applied here.

That is the fix the owner chose of the three offered. The other two are recorded
in the issue: making `model-drag` inapplicable when `modelPresentation` is
runtime-owned and no model asset control exists, or routing the spatial mode
through the model pipeline, which would contradict this file's first requirement
instead of its second.

**A second attempt on 2026-08-22 found a second, wider blocker and one closed
door.** It is recorded here because each was discovered by trying rather than by
reading, and because together they change the answer from "waiting on one patch"
to "waiting on two, with no way round either".

**Issue 21 blocks five more of the seven.** The orientation recipes call
preconditions that require the render scale to be at maximum before a baseline
is taken — correct in intent, since a reduced scale makes two readings differ
for reasons unrelated to the pose. They read it from `aria-valuemax`, which the
runtime's own render-scale slider does not set: it is a native
`<input type="range" min="1" max="2">` carrying `aria-valuenow` and no
`aria-valuemax`. The control was already at maximum. The check failed because it
could not read a ceiling that was there. Enabling `canvas.renderScale` is
required by the framework's own documentation, so no product with it can prove
an orientation gizmo at all.

**The obvious workaround is forbidden by name.** Attaching the model-drag
evidence from a product-owned proof — the same gesture, the same assertions, the
same evidence type — trips the code-health policy: *product-owned source must
not import, bridge, or forge reserved browser evidence channels.* The gate
caught it before it shipped, which is the gate doing exactly its job.

**Two real bugs were found and fixed on the way**, neither of which the first
attempt reached because it was reverted before being proved end to end.
Switching to the relief and back left the canvas blank: the stack renderer
stayed bound to a canvas element that no longer existed, so every draw succeeded
into a detached surface and nothing reported an error. And once that was
released the pass still did not re-run, because its inputs were identical either
side of the switch; the mode is now part of the pass's backing input, which is
honest rather than convenient — while the relief owns the canvas, the stack is
drawing into nothing.

The work is preserved on the `relief-blocked-upstream` branch rather than
discarded a second time. It resumes when issues 19 and 21 land, or if the owner
decides to ship the mode without a gizmo — orbit by dragging the geometry alone
— which is a deviation from the contract's "a rotatable scene declares an
orientationGizmo" rule and therefore theirs to make rather than mine.

## Requirements
### Requirement: Procedural lamellae inside the runtime scene surface
The 3D tool SHALL render a Three.js scene into a product canvas marked `data-toolcraft-product-output` inside `canvasContent`, sized and translated by `useToolcraftProductSceneFrame()`. Because the lamellae are procedural geometry rather than an uploaded model, `modelPresentation` SHALL remain `{ mode: "runtime" }` and no model loader, presentation lease, or second Three cache SHALL be created. A canvas outside the runtime scene surface MUST NOT be mounted.

#### Scenario: Scene mounted as product output
- **WHEN** the 3D tool is active
- **THEN** its canvas is inside `canvasContent`, marked as product output, and sized from the runtime scene frame
- **AND** the runtime canvas backing remains visible behind it

#### Scenario: No model pipeline involvement
- **WHEN** product modules are inspected
- **THEN** none imports a GLTF, OBJ, or FBX loader, enumerates media records, or acquires a model presentation lease

### Requirement: Orbit view interaction through the runtime gizmo
Because this is a visible editable spatial scene, `productReadiness.viewInteraction` SHALL declare `mode: "orbit"` with `orientationTargets` exactly matching a schema `orientationGizmo` target. The gizmo SHALL declare a non-degenerate default pose, `label: false`, and `keyframeable: false`, and SHALL sit in the section that owns the 3D view. A hand-rolled orbit camera, paired angle sliders, `vector` pad, or custom canvas camera chrome MUST NOT be used.

#### Scenario: Gizmo owns rotation
- **WHEN** the 3D tool is active
- **THEN** the runtime orientation gizmo appears fixed 16px from the canvas viewport's left and bottom edges and is excluded from export
- **AND** no product-authored camera control exists

#### Scenario: Direct model drag shares the pose target
- **WHEN** the user drags on visible lamellae geometry
- **THEN** `useToolcraftModelOrbitInteraction` with a product-supplied geometry hit test rotates the same shared pose target
- **AND** a drag starting on empty space pans the canvas instead

#### Scenario: One pose consumed everywhere
- **WHEN** the pose changes
- **THEN** preview, hit testing, reset, undo, redo, image export, and video export all read that same target

#### Scenario: Pixels update during the gesture
- **WHEN** the user drags an orientation axis with playback paused and render scale at its maximum
- **THEN** the shared pose and visible product pixels change before pointer release

### Requirement: Extruded lamellae driven by stripe geometry
Lamellae SHALL be instanced geometry whose count and spacing derive from the same stripe pitch and count parameters as the 2D engines, with a depth parameter. Count SHALL be bounded by its schema range and declared as a workload dimension.

#### Scenario: Geometry parameters drive the lamellae
- **WHEN** stripe pitch or count changes
- **THEN** the number and spacing of extruded lamellae change to match, and the same values produce a corresponding 2D composition

#### Scenario: Depth changes occlusion
- **WHEN** lamella depth is increased
- **THEN** the fins extrude further from the backing plane and occlude correspondingly more

#### Scenario: Count is bounded, not degraded
- **WHEN** lamella count is at its schema maximum
- **THEN** the scene renders every declared lamella
- **AND** no automatic reduction of count or quality occurs

### Requirement: Real parallax colour change
Perceived colour change under camera movement SHALL arise from genuine geometric occlusion of the lamellae side faces, not a simulated shift.

#### Scenario: Orbiting changes perceived colour
- **WHEN** the orbit pose is sampled at N evenly spaced values across a sweep
- **THEN** the mean frame colour changes at every step, and the maximum step-to-step delta stays below a stated threshold

#### Scenario: Head-on view
- **WHEN** the camera is perpendicular to the backing plane
- **THEN** side faces are minimally visible and the backing colours dominate

### Requirement: Lighting toggle
A `switch` SHALL toggle between a lit-and-shadowed presentation and a flat unlit presentation.

#### Scenario: Shadows off
- **WHEN** the lighting switch is off
- **THEN** lamellae render with flat colour and no cast shadows, isolating the parallax effect from shading

### Requirement: Stripe shaders on curved surfaces
A mode SHALL wrap the stripe shaders onto a cylinder and a sphere, selected by a schema `select`.

#### Scenario: Stripes on a cylinder
- **WHEN** cylinder mode is selected
- **THEN** the active engine's output maps onto the surface with continuous stripes around the circumference and no visible seam

#### Scenario: Stripes on a sphere
- **WHEN** sphere mode is selected
- **THEN** the stripe field maps onto the sphere and phase animation travels smoothly across the surface

### Requirement: 3D export parity
The 3D tool SHALL contribute to the same shared `exportRenderer`. If preview and export paths differ, a `previewExportDifferenceReason` SHALL be recorded and tests SHALL prove equivalent product semantics.

#### Scenario: Exported 3D frame matches preview
- **WHEN** the user exports PNG with the 3D tool active
- **THEN** the artifact shows the same composition and pose as the preview at that state

