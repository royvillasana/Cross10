# color-and-gradient-system Specification

## Purpose
Recorded from the Croix10 change, archived at 110 of 219 tasks.

**Build status here is not audited.** Unlike `shader-authoring` and
`shader-delivery`, no requirement in this file has been checked against the
Croix10 app in this pass, so it states intent rather than confirmed behaviour.
Auditing them is carried as a task in the `outstanding` change; until that is
done, treat every requirement below as a claim to verify rather than one to
rely on.
## Requirements
### Requirement: Palette slots as a user-owned collection
The palette SHALL be a `collectionActions` control with a `color` `itemControl`, holding between 2 and 8 slots, since the user owns cardinality. Per-item labels SHALL be omitted because the colors form one shared palette bank. Engines SHALL adapt their band sequences to the current slot count.

#### Scenario: Adding a slot extends the sequence
- **WHEN** the user presses the collection `+` and sets the new color
- **THEN** a slot is appended, the active engine's repeating sequence uses it in order, and the sequence period grows

#### Scenario: Removing a slot
- **WHEN** the user presses the collection `−`
- **THEN** the final slot is removed, the color no longer appears in the composition, and the period shortens

#### Scenario: Cardinality has one owner
- **WHEN** the palette control is inspected
- **THEN** no separate slot-count slider exists alongside it

### Requirement: Cruz-Diez palette presets
Named palette presets SHALL be shipped, one per engine series, each verified against primary sources before delivery with the specific colour values recorded in the worklog. The working candidates — cadmium red / green / blue / black, orange / pink / crimson, blue / black horizontal bars, yellow / blue / ochre fine stripes — are drawn from description and are not yet confirmed. Applying a preset SHALL replace the palette collection contents and slot count only.

#### Scenario: Applying a palette preset
- **WHEN** the user selects a palette preset
- **THEN** the collection items are replaced by that palette's colors and count
- **AND** geometry, motion, and engine selection are unchanged

### Requirement: Harmony generator as a section action
Palette generation from a seed color SHALL be exposed through an `actions` control in the palette section, supporting at minimum complementary and triadic rules, writing results into the palette collection.

#### Scenario: Triadic generation
- **WHEN** the user picks a seed color and triggers the triadic action
- **THEN** the collection is filled with the seed plus colors at the triadic hue offsets

#### Scenario: Action label distinct from control label
- **WHEN** the harmony action renders
- **THEN** its button label is the command verb and the control label supplies context, and the two are not identical

### Requirement: Per-band color cycling offset
A color cycling offset SHALL rotate which palette color each band uses, and it SHALL be animatable.

#### Scenario: Cycling offset rotates colors
- **WHEN** the offset advances by one whole step
- **THEN** each band takes the color previously used by its neighbor, wrapping at the end

#### Scenario: Animated cycling loops
- **WHEN** the offset is keyframed across the timeline duration
- **THEN** colors travel across the bands and the state at loop end equals the state at loop start

### Requirement: Gradient editing through the atomic gradient control
Gradients SHALL use the built-in `gradient` control, which owns gradient type, angle, the draggable stop track, and the stop list. Those owned fields MUST NOT be duplicated as sibling controls.

#### Scenario: Gradient fields are not split
- **WHEN** the gradient section is inspected
- **THEN** no sibling control edits gradient angle, type, or individual stops

#### Scenario: Gradient animates over time
- **WHEN** gradient stops or angle are keyframed
- **THEN** the mapped output changes over playback and returns to its start state at loop end

### Requirement: Gradient mapping modes
The gradient SHALL be mappable along stripes, across stripes, or radially with a movable center, selected by a schema `select`.

#### Scenario: Mapping across stripes
- **WHEN** mapping is set to across-stripes
- **THEN** successive stripes take successive gradient samples, reading as a band progression rather than a smooth wash

#### Scenario: Mapping along stripes
- **WHEN** mapping is set to along-stripes
- **THEN** each stripe's color varies continuously down its own length

#### Scenario: Radial mapping centre is a vector
- **WHEN** mapping is set to radial
- **THEN** color is sampled by distance from a center authored through a `vector` control, and moving it moves the color field

### Requirement: Quantize gradients to bands
Any gradient SHALL be convertible to a discrete band sequence through a band-count control, and a quantized gradient SHALL be usable as the active palette source.

#### Scenario: Quantizing a smooth gradient
- **WHEN** a smooth linear gradient is quantized to 7 bands
- **THEN** the output shows 7 flat colors sampled from the gradient with hard boundaries and no intermediate blending

#### Scenario: Quantized bands drive the engines
- **WHEN** a quantized gradient is set as the active palette source
- **THEN** the active stripe engine uses those band colors as its sequence

### Requirement: Interpolation space is explicit
Because mixing happens in linear light, gradient stop interpolation space SHALL be an explicit product control rather than a hidden choice. It SHALL be a separate schema control, since `gradient` does not own that field.

#### Scenario: Switching interpolation space
- **WHEN** the user switches gradient interpolation between linear-light and perceptual
- **THEN** mid-gradient colors change accordingly and the choice is serialized with the scene

### Requirement: Standalone gradient tool output
The gradient tool SHALL produce linear, radial, conic, and banded gradients, and SHALL expose CSS and SVG output by clipboard copy. PNG delivery SHALL use the runtime image export path.

#### Scenario: Copying CSS
- **WHEN** the user copies the gradient as CSS
- **THEN** valid CSS gradient syntax matching the on-screen result is placed on the clipboard with a confirmation

#### Scenario: PNG uses runtime export
- **WHEN** the user exports the gradient as PNG
- **THEN** the runtime image export action produces it, and no product code allocates a canvas or creates a download URL

