# export-pipeline Specification

## Purpose
Recorded from the Croix10 change, archived at 110 of 219 tasks.

**Build status here is not audited.** Unlike `shader-authoring` and
`shader-delivery`, no requirement in this file has been checked against the
Croix10 app in this pass, so it states intent rather than confirmed behaviour.
Auditing them is carried as a task in the `outstanding` change; until that is
done, treat every requirement below as a claim to verify rather than one to
rely on.
## Requirements
### Requirement: Runtime owns artifact export
Image and video delivery SHALL use typed runtime `export-image` and `export-video` panel actions. Product code SHALL contribute exactly one `ToolcraftAppComposition.exportRenderer` and nothing else. Product code MUST NOT allocate export canvases, call `toBlob` or `toDataURL`, create object URLs, download artifacts, instantiate `MediaRecorder` or `VideoEncoder`, call `canvas.captureStream()`, or import an encoder library.

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

#### Scenario: Artifact names derive from the product
- **WHEN** an artifact is downloaded
- **THEN** its filename derives from the declared non-blank `baseFileName` rather than the runtime fallback

### Requirement: Compound control part coverage
Acceptance SHALL declare `controlPartCoverage` for every compound control. The gradient SHALL cover `gradientType`, `angle`, `stops.position`, `stops.color`, and `stops.opacity`. The palette collection SHALL cover `add`, `remove`, and `items`, including its limits, full-default add, sibling-preserving edit, preview and export effect, and whole-record removal.

#### Scenario: Gradient parts each drive output
- **WHEN** each declared gradient part is changed
- **THEN** the rendered output changes for that part

#### Scenario: Collection cardinality and edits are proved
- **WHEN** palette items are added to the limit, edited, and removed
- **THEN** each operation is proved against product output, with sibling items preserved across an edit

### Requirement: Declared export intent
`productReadiness.exportIntent` SHALL declare image as `toolcraft-default` and video as `user-requested` with the explicit user-request evidence recorded. Schema actions and settings sections SHALL correspond exactly to that resolved intent.

#### Scenario: Image and video layout
- **WHEN** the controls panel is inspected
- **THEN** `Image Export` appears immediately before `Video Export`, `Video Export` sits directly above the sticky actions, `Export Video` is the primary sticky action, and `Export PNG` is secondary

#### Scenario: Export actions use the runtime icon
- **WHEN** the sticky export actions render
- **THEN** both use the `upload-simple` icon matching runtime `Export Settings`

### Requirement: Image export settings and real output size
An `Image Export` section SHALL expose `export.image.format` (default `png`, options PNG and JPG) and `export.image.resolution` (default `4k`, options 2K, 4K, 8K) as two `select` controls in one compact two-column row. The selected resolution SHALL produce real 2048, 4096, or 8192 pixel long-edge output.

#### Scenario: 4K export produces real pixels
- **WHEN** the user exports PNG at 4K
- **THEN** the decoded file's long edge is 4096 pixels
- **AND** stripe pitch scales proportionally so the composition matches the screen rather than showing more stripes

#### Scenario: Aspect ratio comes from Setup
- **WHEN** the user wants a square or custom output shape
- **THEN** they set it through runtime Setup `Aspect ratio`, `Canvas width`, and `Canvas height`
- **AND** no product control duplicates canvas sizing

#### Scenario: Background honored
- **WHEN** Background is off and the user exports PNG
- **THEN** the PNG is transparent, while JPG remains opaque

### Requirement: Seamless-loop video export
`Export Video` SHALL be available with a `Video Export` section exposing `export.video.format` (default `mp4`, options MP4 and WebM) and `export.video.resolution` (default `current`, options Current and 4K). Duration SHALL follow runtime timeline duration, and the runtime's fixed 30 FPS offline schedule SHALL be used.

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

#### Scenario: Copying Couleur Additive as SVG
- **WHEN** the Couleur Additive engine is active with jitter at zero and no post FX enabled, and the user copies SVG
- **THEN** valid SVG markup with vector bands and separator lines matching the composition is placed on the clipboard with a confirmation

#### Scenario: SVG copy absent when not expressible
- **WHEN** jitter is non-zero, a post effect is active, or a shader-dependent engine is selected
- **THEN** the SVG copy action is absent through conditional applicability and the reason is stated in its section

### Requirement: GIF export is not provided
GIF SHALL NOT be offered, because the runtime encoder provides MP4 and WebM and product-owned encoders are forbidden. Seamless-loop delivery is covered by WebM.

#### Scenario: No GIF affordance
- **WHEN** export settings and sticky actions are inspected
- **THEN** no GIF format option or GIF action exists anywhere in the app

### Requirement: Export progress and failure
Runtime export actions SHALL own their Promise and report progress through the sticky footer indicator. Non-export copy actions SHALL return their real Promise from `onPanelAction` and report determinate progress where available. Oversized or empty scenes SHALL fail with visible typed feedback before canvas allocation.

#### Scenario: UI responsive during export
- **WHEN** a long video export is encoding
- **THEN** controls remain interactive and the sticky footer progress indicator updates

#### Scenario: Oversized export fails clearly
- **WHEN** a requested artifact exceeds 8192 pixels per edge or 67,108,864 pixels
- **THEN** export fails before allocation with typed `scene-export-too-large` feedback

