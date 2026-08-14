## ADDED Requirements

### Requirement: ASCII and ANSI rendering mode
The ASCII tool SHALL render images, video, or the live generative canvas as character output, with controls for character set, cell size, and color mode (mono, active palette, or source colors).

#### Scenario: ASCII over the live canvas
- **WHEN** the ASCII tool is enabled with the procedural generator as the source
- **THEN** the generative composition renders as characters and continues to animate

#### Scenario: Cell size controls density
- **WHEN** cell size is reduced
- **THEN** more, smaller characters are used and finer source detail is represented

#### Scenario: Color modes
- **WHEN** color mode is set to palette
- **THEN** each character is colored from the active palette rather than from the source or a single ink color

### Requirement: Pixelation with palette quantization
The pixel tool SHALL pixelate its source at a controllable block size and SHALL optionally quantize the result to the active palette.

#### Scenario: Pixelate and quantize
- **WHEN** block size is raised and palette quantization is enabled
- **THEN** the output consists of uniform blocks whose colors are drawn only from the active palette

### Requirement: Halftone modes
The halftone tool SHALL provide dot, line, and cross halftone modes with controllable cell size and angle, and the line mode SHALL reuse the shared stripe field rather than a separate implementation.

#### Scenario: Line halftone reuses the stripe engine
- **WHEN** line halftone is selected
- **THEN** its lines are produced by the shared stripe field and respond to the stripe geometry parameters, including angle and jitter

#### Scenario: Dot halftone density follows luminance
- **WHEN** dot halftone is applied to a named luminance-ramp fixture
- **THEN** measured dot area across sampled cells is monotonic against source luminance

### Requirement: Glitch effects
The glitch tool SHALL provide RGB channel split along the stripe axis, block displacement, scanline tearing, and datamosh-style smear, each with intensity and a seed control.

#### Scenario: Channel split follows the stripe axis
- **WHEN** RGB channel split is applied with a nonzero intensity
- **THEN** the red, green, and blue channels are displaced along the current stripe axis
- **AND** changing the stripe angle changes the split direction

#### Scenario: Seed makes glitch reproducible
- **WHEN** the same seed and intensity are set twice at the same timeline time
- **THEN** the resulting glitch pattern is identical
- **AND** the noise is derived from the seed plus `getToolcraftTimelineLoopTime`, never from a wall clock

#### Scenario: Glitch loops seamlessly
- **WHEN** glitch is active and playback crosses the loop boundary
- **THEN** the pattern is periodic over the timeline duration so the loop remains seamless

#### Scenario: Zero intensity is a no-op
- **WHEN** every glitch intensity is zero
- **THEN** the output is pixel-identical to the un-glitched render

### Requirement: Post FX composition order
Post FX SHALL apply to whatever the active tool renders, in a deterministic documented order, and SHALL be individually bypassable.

#### Scenario: Bypassing an effect
- **WHEN** an enabled effect is bypassed
- **THEN** the remaining effects still apply in the same relative order and the bypassed effect contributes nothing
