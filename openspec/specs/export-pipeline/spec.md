# export-pipeline Specification

## Purpose
Recorded from the Croix10 change, archived at 110 of 219 tasks.

**Build status is stated per requirement.** Audited against the app on
2026-08-19 (`outstanding` 1.1). Most of this was built in
`video-export-and-motion` and is proved against the artifact rather than the
button; two requirements have no subject in this product and say why.
## Requirements
### Requirement: Runtime owns artifact export
Image and video delivery SHALL use typed runtime `export-image` and `export-video` panel actions. Product code SHALL contribute exactly one `ToolcraftAppComposition.exportRenderer` and nothing else. Product code MUST NOT allocate export canvases, call `toBlob` or `toDataURL`, create object URLs, download artifacts, instantiate `MediaRecorder` or `VideoEncoder`, call `canvas.captureStream()`, or import an encoder library.

**Status: satisfied, and asserted rather than trusted.**
`studio-delivery-boundary.test.ts` scans product source for every call named
here and fails on any of them, and separately allows exactly one canvas
allocation — the offscreen surface that obtains a WebGL2 context — naming which
file and why. That is a rendering surface, never encoded and never handed to
anyone.

One clarification the test had to learn: `.click()` is not the signal it looks
like. The product clicks a file input to open the system *open* dialog, which is
bytes coming in. The boundary is bytes going out, so the check names anchors and
download attributes instead.

#### Scenario: One shared export renderer
- **WHEN** either image or video export runs
- **THEN** the runtime resolves the scene frame, allocates backing, composites background and visible runtime media, awaits the same product `renderFrame` callback, encodes, downloads, and reports progress

#### Scenario: No product-owned encoding
- **WHEN** product modules are inspected
- **THEN** none allocates a canvas for export, creates a download URL, or references an encoder

#### Scenario: Deterministic frame in scene coordinates
- **WHEN** the runtime calls `renderFrame` with a state and time
- **THEN** the product draws exactly one deterministic frame in scene coordinates and awaits its real work
- **AND** calling it twice with the same state and time produces identical pixels

### Requirement: WebGL output composited into the supplied 2D context
Because `renderFrame` supplies a `CanvasRenderingContext2D`, the product SHALL render its WebGL passes into its own render target through the supplied `rendererPipeline` client and composite the result into that context. It SHALL use the supplied `timeSeconds` and `timelineProgress` rather than reconstructing time. The asynchronous return SHALL be used whenever a frame depends on work that must complete first.

**Status: satisfied.** The frame draws into its own WebGL surface and composites
into the supplied 2D context, and it uses the supplied `timelineProgress` rather
than reading the timeline — which is what makes a video a series of scenes
rather than one scene encoded repeatedly. Proved by breaking it: passing `0`
instead makes `browser: studio exports a video that carries the timeline` fail on
its not-one-frame-repeated assertion.

The asynchronous return is unused because no frame here depends on prior work.
A video layer would be the first to need it (`outstanding` 1a.7), since a seek
must complete before the frame is sampled.

#### Scenario: Passes run through the supplied pipeline
- **WHEN** an export frame requires GPU passes
- **THEN** they execute through the `rendererPipeline` client supplied to the frame context, the same compiled registration the preview uses

#### Scenario: Composited into the runtime context
- **WHEN** the WebGL result is ready
- **THEN** it is drawn into the supplied 2D context at the given `pixelRatio`
- **AND** the product does not allocate the artifact canvas, choose an encoder, or create a download URL

#### Scenario: Time comes from the frame context
- **WHEN** the product resolves time-dependent state during export
- **THEN** it reads `timeSeconds` and `timelineProgress` from the frame context rather than any clock or product-side reconstruction

### Requirement: Export renderer identity
The composition SHALL supply a non-blank `baseFileName` on the export renderer, since the runtime types it as required and rejects a blank value.

**Status: satisfied.** `baseFileName: "croix10"`.

#### Scenario: Artifact names derive from the product
- **WHEN** an artifact is downloaded
- **THEN** its filename derives from the declared non-blank `baseFileName` rather than the runtime fallback

### Requirement: Compound control part coverage
Acceptance SHALL declare `controlPartCoverage` for every compound control. The gradient SHALL cover `gradientType`, `angle`, `stops.position`, `stops.color`, and `stops.opacity`. The palette collection SHALL cover `add`, `remove`, and `items`, including its limits, full-default add, sibling-preserving edit, preview and export effect, and whole-record removal.

**Status: not applicable — there are no compound controls to cover.** The
gradient is a layer rather than a `gradient` control, and the palette is four
`color` controls plus a count rather than a collection. Both substitutions are
recorded in `color-and-gradient-system`, and the second is a gap
(`outstanding` 1a.9) rather than a design.

If the palette becomes a real collection, this requirement acquires a subject
and its list of parts is the right list.

#### Scenario: Gradient parts each drive output
- **WHEN** each declared gradient part is changed
- **THEN** the rendered output changes for that part

#### Scenario: Collection cardinality and edits are proved
- **WHEN** palette items are added to the limit, edited, and removed
- **THEN** each operation is proved against product output, with sibling items preserved across an edit

### Requirement: Declared export intent
`productReadiness.exportIntent` SHALL declare image as `toolcraft-default` and video as `user-requested` with the explicit user-request evidence recorded. Schema actions and settings sections SHALL correspond exactly to that resolved intent.

**Status: satisfied.** Image is `toolcraft-default`, video is `user-requested`
with the request itself as the recorded evidence. Until video was asked for, the
product and this spec disagreed about it — the spec had required `Export Video`
all along — and flipping the intent is what settled which of them was wrong.

#### Scenario: Image and video layout
- **WHEN** the controls panel is inspected
- **THEN** `Image Export` appears immediately before `Video Export`, `Video Export` sits directly above the sticky actions, `Export Video` is the primary sticky action, and `Export PNG` is secondary

#### Scenario: Export actions use the runtime icon
- **WHEN** the sticky export actions render
- **THEN** both use the `upload-simple` icon matching runtime `Export Settings`

### Requirement: Image export settings and real output size
An `Image Export` section SHALL expose `export.image.format` (default `png`, options PNG and JPG) and `export.image.resolution` (default `4k`, options 2K, 4K, 8K) as two `select` controls in one compact two-column row. The selected resolution SHALL produce real 2048, 4096, or 8192 pixel long-edge output.

**Status: satisfied.** Both selects with those defaults and options, and the
resolution produces real pixels rather than a label — proved by decoding the
artifact and reading its dimensions.

Canvas sizing SHALL have exactly one owner. No product **control** SHALL duplicate
it: a width, height, or aspect control authored into the control surface beside the
runtime's own is two surfaces over one value, and they will disagree.

A product flow that runs **before a canvas exists** MAY set canvas sizing, provided
it writes the runtime's own `canvas.aspectRatio`, `Canvas width`, and `Canvas height`
targets rather than storing a size of its own. That is not a duplicate owner but the
same owner reached earlier, and it is the only way a size can be chosen before there
is work to reflow. Such a flow SHALL NOT persist a canvas size outside those targets.

Where a product offers named output shapes — sizes a destination expects, rather than
ratios — it SHALL set them through those same targets, and the names SHALL describe
the destination rather than claiming an affiliation with it.

#### Scenario: 4K export produces real pixels
- **WHEN** the user exports PNG at 4K
- **THEN** the decoded file's long edge is 4096 pixels
- **AND** stripe pitch scales proportionally so the composition matches the screen rather than showing more stripes

#### Scenario: Aspect ratio comes from Setup
- **WHEN** the user wants a square or custom output shape while editing
- **THEN** they set it through runtime Setup `Aspect ratio`, `Canvas width`, and `Canvas height`
- **AND** no product control in the control surface duplicates canvas sizing

#### Scenario: A pre-canvas flow may size the canvas
- **WHEN** a canvas is sized before it exists
- **THEN** the size is written to the runtime's own aspect, width, and height targets
- **AND** no canvas size is stored anywhere else

#### Scenario: Named output shapes set the real targets
- **WHEN** a named output shape is chosen
- **THEN** the runtime's aspect, width, and height carry that shape's real pixel dimensions
- **AND** the name describes where the output is going rather than claiming an affiliation

#### Scenario: Background honored
- **WHEN** Background is off and the user exports PNG
- **THEN** the PNG is transparent, while JPG remains opaque

### Requirement: Seamless-loop video export
`Export Video` SHALL be available with a `Video Export` section exposing `export.video.format` (default `mp4`, options MP4 and WebM) and `export.video.resolution` (default `current`, options Current and 4K). Duration SHALL follow runtime timeline duration, and the runtime's fixed 30 FPS offline schedule SHALL be used.

**Status: satisfied, and proved on the file rather than the panel.** The
section and its defaults exist; the artifact's packet timings are asserted
against the runtime's own schedule, so a renderer that fell behind and dropped
frames would fail rather than produce a playable file running faster than the
composition it came from. Duration follows the timeline, and the file carries
exactly one duration's worth of frames — it does not hold both ends of the loop,
which would hitch once per cycle.

#### Scenario: Exported video tiles seamlessly
- **WHEN** the user exports video
- **THEN** the file covers exactly the timeline duration and its last frame transitions into its first with no visible jump on repeat

#### Scenario: Cadence independent of render cost
- **WHEN** an expensive engine is exported
- **THEN** encoded packet timestamps and duration follow the 30 FPS schedule and renderer wall-clock cost changes only export latency

#### Scenario: Duration edit changes the artifact
- **WHEN** the user edits timeline duration and exports again
- **THEN** the new artifact's duration and packet count match the edited duration

#### Scenario: Video keeps its background
- **WHEN** Background is off and the user exports video
- **THEN** the exported video retains the selected background color

### Requirement: SVG delivered by clipboard copy
For engine states expressible as vector geometry, an SVG copy action SHALL place SVG markup on the clipboard. It SHALL be an additional product action that does not alter the recorded artifact intent. A product-written SVG file download MUST NOT exist.

**Status: satisfied, with two deviations stated below.** `Copy SVG` places
markup on the clipboard, writes no file, and carries no `role`, so the recorded
image-and-video artifact intent is untouched. It appears only while the selected
layer is geometry and disappears when it stops being so, which is the scenario
below rather than a nicety: the alternative is a file that looks like an
author's work and is not.

**It delivers the selected layer, not the composition.** An applicability
predicate reads rendered controls, so a gate can see whether *this* layer is
expressible and knows nothing about the others in a stack. Scoping the output to
what the gate can see keeps presence and capability the same thing; scoping it
to the composition would mean an action that is offered and then refuses, which
is the pattern this product has been removing everywhere else.

**Jitter and taper are drawn rather than gated**, which is the opposite of what
this file expected and is forced by the same limit. A predicate can only read a
discrete control, and both are continuous sliders — so refusing them in the
generator would produce exactly the offered-then-fails shape. Both turn out to
be geometry anyway: jitter displaces a band, so it is a rectangle somewhere
else, and taper drifts the split along the band's length, so it is a
quadrilateral. What is gated is the layer kind, the chromatic engine, the fold,
and region shapes that have no clip equivalent.

One fidelity note, stated rather than hidden: a jittered band's displacement is
the same expression the shader uses, evaluated in double precision where a
shader has single. The two are not bit-identical, and `sin` of a large argument
is where they diverge; the difference is sub-pixel at the counts and variations
the controls offer.

#### Scenario: Copying Couleur Additive as SVG
- **WHEN** the Couleur Additive engine is active with jitter at zero and no post FX enabled, and the user copies SVG
- **THEN** valid SVG markup with vector bands and separator lines matching the composition is placed on the clipboard with a confirmation

#### Scenario: SVG copy absent when not expressible
- **WHEN** a shader-dependent engine is selected, the field is folded, or the region has no clip equivalent
- **THEN** the SVG copy action is absent through conditional applicability and the reason is stated in its section
- **NOTE** jitter and taper do not remove the action; they are drawn as displaced rectangles and quadrilaterals, because a continuous slider cannot be read by a predicate

### Requirement: GIF export is not provided
GIF SHALL NOT be offered, because the runtime encoder provides MP4 and WebM and product-owned encoders are forbidden. Seamless-loop delivery is covered by WebM.

**Status: satisfied.** No GIF anywhere. The reasoning is now doubly true: the
session confirmed that a product cannot even stage an imported byte, let alone
run an encoder.

#### Scenario: No GIF affordance
- **WHEN** export settings and sticky actions are inspected
- **THEN** no GIF format option or GIF action exists anywhere in the app

### Requirement: Export progress and failure
Runtime export actions SHALL own their Promise and report progress through the sticky footer indicator. Non-export copy actions SHALL return their real Promise from `onPanelAction` and report determinate progress where available. Oversized or empty scenes SHALL fail with visible typed feedback before canvas allocation.

**Status: satisfied for what exists.** The runtime owns export progress, and
the copy-source action returns its real clipboard Promise rather than an
already-resolved one — handing back a resolved Promise would report the copy
finished before the write had.

The oversized-and-empty clause is the runtime's to enforce and has no product
path that could bypass it, since the product never allocates an artifact
canvas.

#### Scenario: UI responsive during export
- **WHEN** a long video export is encoding
- **THEN** controls remain interactive and the sticky footer progress indicator updates

#### Scenario: Oversized export fails clearly
- **WHEN** a requested artifact exceeds 8192 pixels per edge or 67,108,864 pixels
- **THEN** export fails before allocation with typed `scene-export-too-large` feedback

