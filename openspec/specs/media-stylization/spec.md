# media-stylization Specification

## Purpose
Recorded from the Croix10 change, archived at 110 of 219 tasks.

**Build status here is not audited.** Unlike `shader-authoring` and
`shader-delivery`, no requirement in this file has been checked against the
Croix10 app in this pass, so it states intent rather than confirmed behaviour.
Auditing them is carried as a task in the `outstanding` change; until that is
done, treat every requirement below as a claim to verify rather than one to
rely on.
## Requirements
### Requirement: Image import through fileDrop
Image import SHALL use a `fileDrop` control with `assetKind: "image"` in the controls panel. Upload UI MUST NOT appear on the canvas, and no custom file list, upload button, or sorting UI SHALL be built. Product renderers SHALL filter `state.mediaAssets` by `sourceTarget`.

#### Scenario: Importing an image
- **WHEN** the user drops a PNG or JPEG onto the `fileDrop` control or the canvas
- **THEN** the runtime attaches it as media and the stylized render appears
- **AND** the file is never sent to a server

#### Scenario: Upload affordance is not on the canvas
- **WHEN** no image is attached
- **THEN** the canvas stays neutral with no CTA, helper copy, or placeholder artwork
- **AND** the upload affordance lives only in the `fileDrop` control

#### Scenario: Clearing removes the source
- **WHEN** the user clears the attached image
- **THEN** it is removed from the renderer and canvas

#### Scenario: Transform actions come from the runtime
- **WHEN** exactly one image is attached
- **THEN** the runtime's `90°`, `Flip H`, and `Flip V` actions appear below the uploader
- **AND** the renderer consumes `state.mediaAssets[].transform` rather than product-owned transform state

### Requirement: Runtime generic media preview is suppressed
The composition SHALL set `renderDefaultCanvasMedia: false`, because a custom renderer replaces generic image and file preview. Without it the runtime draws and exports the uploaded image layer and adds its frame to the scene-bounds union, compositing the source on top of the product's own stylization of that same source.

#### Scenario: Source rendered exactly once
- **WHEN** an image is attached and stylized through an engine
- **THEN** the runtime generic media layer is suppressed in preview
- **AND** every exported artifact contains exactly one rendering of the source

#### Scenario: Scene bounds exclude the generic layer
- **WHEN** scene bounds are resolved with an image attached
- **THEN** the suppressed generic media frame does not contribute to the union

### Requirement: Source images do not change canvas size
An imported source image SHALL be drawn cover/crop inside the current canvas bounds, scaled proportionally until covered and cropped at the bounds. It MUST NOT change `canvas.size`, and Setup canvas controls SHALL remain visible.

#### Scenario: Portrait image in a landscape canvas
- **WHEN** a portrait image is imported into a 16:9 canvas
- **THEN** it is scaled to cover and cropped at the canvas bounds with no letterboxing and no aspect distortion
- **AND** `canvas.size` is unchanged

### Requirement: Image re-rendered through the stripe engines
An imported image SHALL be re-rendered through the active engine, with source luminance driving stripe width or stripe phase according to a mapping mode, and source color optionally quantized to the active palette.

#### Scenario: Luminance drives stripe width
- **WHEN** a named two-tone fixture is imported and the mapping mode is set to width
- **THEN** measured stripe width in the bright region exceeds measured stripe width in the dark region

#### Scenario: Luminance drives stripe phase
- **WHEN** the mapping mode is set to phase
- **THEN** stripe boundaries displace laterally in proportion to source luminance

#### Scenario: Color quantized to the palette
- **WHEN** palette quantization is enabled
- **THEN** every rendered pixel is one of the active palette colors, and editing the palette immediately recolors the output

### Requirement: Sampling resolution control
A sampling resolution parameter SHALL control the granularity at which the source is sampled, independent of output resolution, and SHALL be declared as a workload dimension.

#### Scenario: Coarse sampling
- **WHEN** sampling resolution is lowered
- **THEN** stylization responds to broader source regions, producing coarser modulation, while output resolution is unchanged

### Requirement: Imported video sources
The video tool SHALL accept an imported video file through a `fileDrop` control with `assetKind: "file"`, `multiple: false`, and `accept` narrowed to video MIME types and extensions. The decode surface SHALL be an imperatively created, never-mounted `<video>` element sourced from the blob URL returned by `useToolcraftMediaPresentationUrls`, retained and released through that hook's lifecycle. Product code MUST NOT read the binary repository, construct its own blob from state, or place the video element inside `canvasContent`.

#### Scenario: Video resolved through the sanctioned accessor
- **WHEN** a video file is attached
- **THEN** its blob URL comes from `useToolcraftMediaPresentationUrls` keyed by the asset id
- **AND** no product module reads IndexedDB, localStorage, or `resourceRef` directly

#### Scenario: Unavailable asset handled
- **WHEN** an attached video's `lifecycle` is `unavailable` after a reload
- **THEN** the tool reports that asset as unavailable and continues to function
- **AND** other restored state is unaffected

#### Scenario: Video playback drives stylization
- **WHEN** the user imports a video and plays the timeline
- **THEN** the stylized output follows the video, with `video.currentTime` derived deterministically from timeline loop time

### Requirement: Deterministic video sampling for export
Video frame selection SHALL be a deterministic function of timeline time in both preview and export. The `exportRenderer` frame callback SHALL await the seek before sampling, using its supported asynchronous return. Because `currentTime` seek precision is codec- and container-dependent, parity SHALL be asserted to nearest-frame tolerance rather than exact frame identity.

#### Scenario: Export awaits the seek
- **WHEN** the runtime calls the export frame callback with a scheduled time
- **THEN** the product seeks the video to the time derived from that scheduled time, awaits the seek, and only then samples and draws

#### Scenario: Export parity within tolerance
- **WHEN** an export frame and a preview frame at the same timeline time are compared
- **THEN** they show the same source content within nearest-frame tolerance

#### Scenario: Exported frames differ
- **WHEN** a video-source export is decoded
- **THEN** representative frames differ from one another, proving the source is actually advancing

#### Scenario: Unsupported file rejected
- **WHEN** the user drops a file that is neither a supported image nor a supported video
- **THEN** typed feedback names the supported types and the current scene is unchanged

### Requirement: Webcam capture is not provided
Live camera capture SHALL NOT be implemented. The runtime exposes no `MediaStream` source, media arrives as durable uploaded assets, and a live feed cannot be re-rendered deterministically at a scheduled export time.

#### Scenario: No webcam affordance
- **WHEN** the media and video tool sections are inspected
- **THEN** no camera source option, permission prompt, or `getUserMedia` call exists in product code

### Requirement: Motion modulation of stripe phase
Video sources SHALL support a motion-driven mode where inter-frame difference in the source modulates stripe phase, with a controllable strength.

#### Scenario: Motion drives phase
- **WHEN** motion modulation is enabled and the source contains movement
- **THEN** stripe phase displaces in the moving regions and settles where the source is static

#### Scenario: Motion modulation is deterministic
- **WHEN** the same timeline time is rendered twice
- **THEN** the motion field and resulting phase displacement are identical

