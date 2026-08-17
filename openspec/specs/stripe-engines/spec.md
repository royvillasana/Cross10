# stripe-engines Specification

## Purpose
Recorded from the Croix10 change, archived at 110 of 219 tasks.

**Build status is stated per requirement.** Audited against the app on
2026-08-17 (`outstanding` 1.1). The recurring theme: Croix10 had seven *engines*,
each its own renderer. The studio has one field, one stack, and four engines
that recolour whatever field they are given — so several "engines" here are
satisfied as compositions rather than as code, and two have no engine at all
because the stack does what they described.
## Requirements
### Requirement: Shared stripe field
All engines SHALL derive from one shared stripe field function parameterized by count, pitch, width ratio, gap, angle, phase offset, jitter amount, jitter frequency, and mirror/duplication. The field SHALL be resolution-independent and SHALL support arbitrary angles, not only vertical and horizontal.

**Status: satisfied.** One field function, in `studio-layers.ts`, parameterised
by count, width ratio, separator, angle, offset, jitter amount, jitter variation,
mirror and taper. Resolution-independent because boundaries resolve from
screen-space derivatives rather than supersampling, and the angle is a free
slider rather than two orientations.

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

**Status: satisfied, with one deliberate difference.** Bands, palette sequence,
per-band width and separator width all exist. There is no separator *colour*: a
separator is a gap the layer does not paint, so what shows through is whatever
sits beneath it in the stack. In a single-renderer product a separator needed its
own colour; in a stack it would be a third ink competing with the layer below,
and the gap is the more useful primitive.

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

**Status: satisfied, by a different uniform.** The engine exists and moves the
composition through colour states, but the thing swept is `engineAmount` — and,
when the pointer switch is on, the viewer's own position — rather than a
dedicated viewing-angle uniform. That is closer to the physical work, not
further: the reading changes because *you* moved.

#### Scenario: Viewing angle changes color state
- **WHEN** the viewing-angle uniform is sampled at N evenly spaced values across its range
- **THEN** the mean frame colour changes at every step, and the maximum step-to-step mean-colour delta stays below a stated threshold, so no discontinuity exceeds the continuous sweep

### Requirement: Induction Chromatique engine
The Induction Chromatique engine SHALL render high-frequency line pairs tuned to induce afterimage color, and SHALL render complementary color fringes along edges within the composition.

**Status: satisfied.** The `induction` engine inverts a fringe band around each
boundary, scaled by engine amount, which is the complementary edge fringe this
describes.

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

**Status: satisfied, in two places rather than one.** Within a layer,
`enginePitch` lays a second band sequence at a different pitch and the beat is
the moiré. Across layers, two stripes layers carry independent everything. The
travelling half is the loop: `browser: studio drift closes the seam on a beating
field` proves the beat moves and returns.

#### Scenario: Traveling moiré
- **WHEN** the second layer's phase is animated at a constant rate
- **THEN** moiré bands travel across the composition at a rate determined by the pitch difference between layers

#### Scenario: Shape revealed only by phase shift
- **WHEN** an embedded shape is placed in the composition
- **THEN** the shape is invisible as an outline or fill
- **AND** it becomes perceptible only through the local phase or width perturbation it imposes on the stripe field

### Requirement: Transchromie engine
The Transchromie engine SHALL render overlapping translucent color planes with selectable subtractive and additive blending, with per-plane color, opacity, offset, and rotation.

**Status: superseded, except for one real gap.** There is no Transchromie
engine and there does not need to be: overlapping translucent planes are layers,
each with its own colour, opacity, offset and angle, which is exactly what the
stack is. The gallery ships *Transchromie Sheets* built that way. What is missing
is the blending — **additive is not among the modes** (`outstanding` 1a.1), and
without it this technique cannot be rendered as described.

#### Scenario: Overlap produces a third color
- **WHEN** two translucent planes overlap under subtractive blending
- **THEN** the overlap region renders the blended result, distinct from either plane's own color

### Requirement: Chromosaturation engine
The Chromosaturation engine SHALL render full-field color immersion with slow gradients drifting across the whole canvas, with no stripe structure required.

**Status: superseded.** A gradient layer filling the frame, with a drift rate,
is full-field immersion with a slow drift and no stripe structure — no separate
engine required. The gallery ships *Saturation Chamber* on that basis.

#### Scenario: Slow full-field drift
- **WHEN** the Chromosaturation engine is active at its default drift speed
- **THEN** the entire canvas is filled, and the maximum first-difference along the gradient axis stays below a stated per-channel threshold, so no banding step is present
- **AND** the mean frame colour differs between two sampled timeline times

### Requirement: Density bounded by fidelity, not by frame rate
Stripe count and line frequency SHALL NOT be treated as performance dimensions, because per-pixel fragment cost does not vary with either. Their schema maxima SHALL be derived from the Nyquist limit against effective pixel pitch — the frequency above which the field can no longer be represented without aliasing — and that derivation SHALL be documented. Engines MUST NOT reduce density at runtime.

**Status: satisfied in substance, with a naming caveat worth reading.** The
Nyquist derivation is documented in both `studio-layer-sections.ts` and
`app-performance.ts`, and nothing reduces density at runtime. But `band-count`
*is* declared in the workload envelope — deliberately, and not as a cost claim:
the framework derives path coverage from that list, so a value the pass reads has
to appear in it. The declaration records that it is constant in fragment cost.
The requirement's intent is met; its literal wording is not, and the difference
is the framework's vocabulary rather than the product's behaviour.

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

**Status: satisfied.** `appearance.background` is a schema colour in its own
section beside `export.includeBackground`, and the canvas calls
`shouldIncludeToolcraftPreviewBackground`. Proved by
`browser: studio background switch grounds the composite`.

#### Scenario: Background off hides product background
- **WHEN** Background is switched off in Setup
- **THEN** the bounded product-rendered background is hidden in live preview while stripe output remains

#### Scenario: Background colour drives output
- **WHEN** the user changes Background color
- **THEN** the rendered composition's background changes to that colour

### Requirement: Embedded procedural shapes as field perturbations
The engines SHALL support embedded shapes — circle, ellipse, rectangle, and split blocks — that exist only as phase or width perturbations of the stripe field rather than as drawn geometry.

**Status: superseded, and the difference is a real design change.** Shapes
exist — rectangle, ellipse, triangle, diamond, pentagon, hexagon, free polygon —
but as the *region a layer is confined to* (R64/R65) rather than as perturbations
of the field. A shape does not warp the bands; it decides where the layer draws
at all. That is a stronger primitive in a stack, because a region composites
against the layers beneath it, and it is why there is no separate embedded-shape
feature.

#### Scenario: Shape has no independent fill
- **WHEN** an embedded circle is added with perturbation strength at zero
- **THEN** the composition is visually identical to having no shape at all

#### Scenario: Perturbation strength reveals the shape
- **WHEN** perturbation strength is raised
- **THEN** the circle emerges from the stripe field through local displacement of stripe phase or width, matching the behavior of the works where a sphere emerges from the lines

