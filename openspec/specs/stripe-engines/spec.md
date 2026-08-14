# stripe-engines Specification

## Purpose
Recorded from the Croix10 change, archived at 110 of 219 tasks.

**Build status here is not audited.** Unlike `shader-authoring` and
`shader-delivery`, no requirement in this file has been checked against the
Croix10 app in this pass, so it states intent rather than confirmed behaviour.
Auditing them is carried as a task in the `outstanding` change; until that is
done, treat every requirement below as a claim to verify rather than one to
rely on.
## Requirements
### Requirement: Shared stripe field
All engines SHALL derive from one shared stripe field function parameterized by count, pitch, width ratio, gap, angle, phase offset, jitter amount, jitter frequency, and mirror/duplication. The field SHALL be resolution-independent and SHALL support arbitrary angles, not only vertical and horizontal.

#### Scenario: Arbitrary stripe angle
- **WHEN** the angle parameter is set to 37 degrees
- **THEN** stripes render at 37 degrees with unchanged pitch measured perpendicular to the stripe direction

#### Scenario: Jitter reproduces hand-cut wobble
- **WHEN** jitter amount is raised above zero
- **THEN** stripe boundaries acquire a continuous lateral wobble whose spatial rate is set by jitter frequency
- **AND** setting jitter amount back to zero yields perfectly straight boundaries

#### Scenario: Mirror duplication
- **WHEN** mirror/duplication is enabled
- **THEN** the stripe field is reflected about the composition axis so the two halves are symmetric

### Requirement: Couleur Additive engine
The Couleur Additive engine SHALL render parallel colored bands separated by thin dark separator lines, using a repeating band sequence drawn from the active palette with per-band width control and independent separator width and color.

#### Scenario: Canonical module renders
- **WHEN** the band sequence is set to green / black / red / black / blue
- **THEN** the canvas shows that sequence repeating across the composition at the configured pitch

#### Scenario: Per-band width
- **WHEN** the width of a single band in the sequence is increased
- **THEN** only that band widens and the remaining bands keep their widths, with the sequence period growing accordingly

#### Scenario: Separator lines are independent
- **WHEN** separator width is reduced to its minimum
- **THEN** the rendered separator measures its configured width in pixels, and adjacent band colours are separated by no more than that many pixels

### Requirement: Physichromie engine
The Physichromie engine SHALL render dense vertical strip modules whose apparent color depends on a virtual viewing-angle uniform, so that sweeping that uniform moves the composition through different color states as walking past the physical work would.

#### Scenario: Viewing angle changes color state
- **WHEN** the viewing-angle uniform is sampled at N evenly spaced values across its range
- **THEN** the mean frame colour changes at every step, and the maximum step-to-step mean-colour delta stays below a stated threshold, so no discontinuity exceeds the continuous sweep

### Requirement: Induction Chromatique engine
The Induction Chromatique engine SHALL render high-frequency line pairs tuned to induce afterimage color, and SHALL render complementary color fringes along edges within the composition.

#### Scenario: Complementary fringes
- **WHEN** the engine renders a field boundary
- **THEN** a fringe in the complement of the adjacent field color is drawn along that boundary
- **AND** fringe width and intensity are controllable parameters

#### Scenario: High frequency stays representable
- **WHEN** line frequency is at its maximum and the same timeline time is rendered at DPR 1 and DPR 2
- **THEN** the downsampled images differ by less than a stated mean-absolute-difference threshold
- **AND** no scanline contains more than a stated ratio of alternating full-black/full-white neighbouring pixels

### Requirement: Chromointerférence engine
The Chromointerférence engine SHALL composite two stripe layers with independent pitch, angle, and phase, and SHALL produce traveling moiré when their relative phase animates.

#### Scenario: Traveling moiré
- **WHEN** the second layer's phase is animated at a constant rate
- **THEN** moiré bands travel across the composition at a rate determined by the pitch difference between layers

#### Scenario: Shape revealed only by phase shift
- **WHEN** an embedded shape is placed in the composition
- **THEN** the shape is invisible as an outline or fill
- **AND** it becomes perceptible only through the local phase or width perturbation it imposes on the stripe field

### Requirement: Transchromie engine
The Transchromie engine SHALL render overlapping translucent color planes with selectable subtractive and additive blending, with per-plane color, opacity, offset, and rotation.

#### Scenario: Overlap produces a third color
- **WHEN** two translucent planes overlap under subtractive blending
- **THEN** the overlap region renders the blended result, distinct from either plane's own color

### Requirement: Chromosaturation engine
The Chromosaturation engine SHALL render full-field color immersion with slow gradients drifting across the whole canvas, with no stripe structure required.

#### Scenario: Slow full-field drift
- **WHEN** the Chromosaturation engine is active at its default drift speed
- **THEN** the entire canvas is filled, and the maximum first-difference along the gradient axis stays below a stated per-channel threshold, so no banding step is present
- **AND** the mean frame colour differs between two sampled timeline times

### Requirement: Density bounded by fidelity, not by frame rate
Stripe count and line frequency SHALL NOT be treated as performance dimensions, because per-pixel fragment cost does not vary with either. Their schema maxima SHALL be derived from the Nyquist limit against effective pixel pitch — the frequency above which the field can no longer be represented without aliasing — and that derivation SHALL be documented. Engines MUST NOT reduce density at runtime.

#### Scenario: Maximum is a computed fidelity limit
- **WHEN** the line-frequency maximum is set
- **THEN** it is derived from effective pixel pitch at the target resolution rather than from a frame-time measurement
- **AND** the derivation is recorded so it can be rechecked when render scale or resolution assumptions change

#### Scenario: Maximum density is representable
- **WHEN** stripe count and line frequency are at their schema maxima
- **THEN** distinct band colours remain measurable across a sampled scanline rather than averaging to a flat field
- **AND** no automatic density reduction occurs

### Requirement: Background is a schema colour
Engine output MUST NOT hardcode a background in a WebGL clear colour, CSS, or a Canvas fill. The background SHALL be a schema `color` target in an authored `Background` section paired with `export.includeBackground`, and live preview SHALL call `shouldIncludeToolcraftPreviewBackground(state)`.

#### Scenario: Background off hides product background
- **WHEN** Background is switched off in Setup
- **THEN** the bounded product-rendered background is hidden in live preview while stripe output remains

#### Scenario: Background colour drives output
- **WHEN** the user changes Background color
- **THEN** the rendered composition's background changes to that colour

### Requirement: Embedded procedural shapes as field perturbations
The engines SHALL support embedded shapes — circle, ellipse, rectangle, and split blocks — that exist only as phase or width perturbations of the stripe field rather than as drawn geometry.

#### Scenario: Shape has no independent fill
- **WHEN** an embedded circle is added with perturbation strength at zero
- **THEN** the composition is visually identical to having no shape at all

#### Scenario: Perturbation strength reveals the shape
- **WHEN** perturbation strength is raised
- **THEN** the circle emerges from the stripe field through local displacement of stripe phase or width, matching the behavior of the works where a sphere emerges from the lines

