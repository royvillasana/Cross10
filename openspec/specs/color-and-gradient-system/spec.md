# color-and-gradient-system Specification

## Purpose
Recorded from the Croix10 change, archived at 110 of 219 tasks.

**Build status is stated per requirement.** Audited against the app on
2026-08-18 (`outstanding` 1.1). The palette survived in a simpler form than this
describes and most of the gradient *tooling* was never built — the studio has a
gradient layer, not a gradient tool.
## Requirements
### Requirement: Palette slots as a user-owned collection
The palette SHALL be a `collectionActions` control with a `color` `itemControl`, holding between 2 and 8 slots, since the user owns cardinality. Per-item labels SHALL be omitted because the colors form one shared palette bank. Engines SHALL adapt their band sequences to the current slot count.

**Status: satisfied in substance; one scenario deliberately still unmet.**

**The range is 2 to 8**, as asked. What was holding it at four was not a
judgement about palettes: the shader's ramp was a ladder of cases, one branch
per slot count written out for two, three and four, so a fifth ink meant another
branch in a function every body calls. The bank is an array now and the walk is
the same code for two inks and for eight, which turned "how many inks" from an
argument into a number. Engines adapt their sequence to the count as they always
did, and a reroll covers every slot rather than the first four.

**The oddity is gone.** An ink appears only once the count reaches it, so a
two-ink layer offers two colours rather than four, two of which changed nothing.
Lowering the count takes the control off the panel and the ink out of the cycle
together, and the value is kept rather than reset -- raising the count again
brings back the colour that was set.

**What is still unmet is the shape**, and only that. The palette is eight
`color` controls plus a `Colour slots` slider rather than a `collectionActions`
collection, so the *Cardinality has one owner* scenario below is false: the
count is a control beside the colours rather than the collection's own `+` and
`−`. That is a refactor of every preset in the library, which lists inks by
name, and it buys expression an author cannot see -- the same eight inks, added
a different way. It is recorded here rather than done, and the two scenarios
above it hold under the slider exactly as they would under a collection.

#### Scenario: Adding a slot extends the sequence
- **WHEN** the user presses the collection `+` and sets the new color
- **THEN** a slot is appended, the active engine's repeating sequence uses it in order, and the sequence period grows

#### Scenario: Removing a slot
- **WHEN** the user presses the collection `−`
- **THEN** the final slot is removed, the color no longer appears in the composition, and the period shortens

#### Scenario: Cardinality has one owner
- **WHEN** the palette control is inspected
- **THEN** no separate slot-count slider exists alongside it
- **NOTE** unmet: cardinality is owned by a `Colour slots` slider rather than by the collection

### Requirement: Cruz-Diez palette presets
Named palette presets SHALL be shipped, one per engine series, each verified against primary sources before delivery with the specific colour values recorded in the worklog. The working candidates — cadmium red / green / blue / black, orange / pink / crimson, blue / black horizontal bars, yellow / blue / ochre fine stripes — are drawn from description and are not yet confirmed. Applying a preset SHALL replace the palette collection contents and slot count only.

**Status: partly satisfied, and the unverified half is the important half.**
Palettes ship inside the nineteen gallery entries rather than as separate
palette-only presets, and applying an entry replaces more than the palette — it
replaces the stack, which is what an entry *is* here.

The colours are still **drawn from description rather than verified against
primary sources**, exactly as this requirement warns. That is recorded as
`outstanding` 2.3 and it is the one item in this file with a copyright edge:
the product owner's instruction is that these are our own constructions in our
own colours, not reproductions.

#### Scenario: Applying a palette preset
- **WHEN** the user selects a palette preset
- **THEN** the collection items are replaced by that palette's colors and count
- **AND** geometry, motion, and engine selection are unchanged

### Requirement: Harmony generator as a section action
Palette generation from a seed color SHALL be exposed through an `actions` control in the palette section, supporting at minimum complementary and triadic rules, writing results into the palette collection.

**Status: pending — not built.** No harmony generator, no seed, no
complementary or triadic rule anywhere in the product.

#### Scenario: Triadic generation
- **WHEN** the user picks a seed color and triggers the triadic action
- **THEN** the collection is filled with the seed plus colors at the triadic hue offsets

#### Scenario: Action label distinct from control label
- **WHEN** the harmony action renders
- **THEN** its button label is the command verb and the control label supplies context, and the two are not identical

### Requirement: Per-band color cycling offset
A color cycling offset SHALL rotate which palette color each band uses, and it SHALL be animatable.

**Status: superseded by something more general.** There is no palette-rotation
offset. `Offset` moves the whole field along its own axis, which changes which
band sits where — the visible result the rotation was for — and it is animatable
through `Travel per loop`. A separate rotation of *which ink* each band takes
would be a second way to shuffle the same appearance.

#### Scenario: Cycling offset rotates colors
- **WHEN** the offset advances by one whole step
- **THEN** each band takes the color previously used by its neighbor, wrapping at the end

#### Scenario: Animated cycling loops
- **WHEN** the offset is keyframed across the timeline duration
- **THEN** colors travel across the bands and the state at loop end equals the state at loop start

### Requirement: Gradient editing through the atomic gradient control
Gradients SHALL use the built-in `gradient` control, which owns gradient type, angle, the draggable stop track, and the stop list. Those owned fields MUST NOT be duplicated as sibling controls.

**Status: superseded, deliberately, and the trade is worth naming.** A gradient
here is a *layer*, not a control value: it carries the same angle, offset,
region, engine, treatment and drift as every other layer, and composites in the
same stack. The built-in `gradient` control owns a self-contained gradient with
its own stop track, which cannot be one member of a stack.

What is lost is the draggable stop track — the palette is four slots rather than
arbitrary stops at arbitrary positions. What is gained is that a gradient is a
first-class layer. For a product whose subject is fields interfering with one
another, the second is worth more.

#### Scenario: Gradient fields are not split
- **WHEN** the gradient section is inspected
- **THEN** no sibling control edits gradient angle, type, or individual stops

#### Scenario: Gradient animates over time
- **WHEN** gradient stops or angle are keyframed
- **THEN** the mapped output changes over playback and returns to its start state at loop end

### Requirement: Gradient mapping modes
The gradient SHALL be mappable along stripes, across stripes, or radially with a movable center, selected by a schema `select`.

**Status: satisfied.** `Transition shape` offers Linear, Radial and Angular.
The centre moves with the layer's own region rather than through a separate
control, because a gradient is a layer and a layer already has a position.

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

**Status: half satisfied, and the half that arrived came from somewhere else.**
`Only the layer's inks` was built for `post-fx-suite`, and applied to a gradient
it is exactly the conversion this asks for: with the slot count at seven, a
smooth ramp becomes seven flat regions with hard boundaries drawn from the
ramp's own stops, because the palette *is* the gradient's stops. The proof for
that control uses a three-slot ramp and asserts the frame carries no more than
three colours.

What is still missing is the second scenario: a quantized gradient usable as the
*active palette source* for another layer's engine. That is plumbing between
layers rather than a step inside one, and nothing carries a colour sequence from
one layer to another today.

#### Scenario: Quantizing a smooth gradient
- **WHEN** a smooth linear gradient is quantized to 7 bands
- **THEN** the output shows 7 flat colors sampled from the gradient with hard boundaries and no intermediate blending

#### Scenario: Quantized bands drive the engines
- **WHEN** a quantized gradient is set as the active palette source
- **THEN** the active stripe engine uses those band colors as its sequence

### Requirement: Interpolation space is explicit
Because mixing happens in linear light, gradient stop interpolation space SHALL be an explicit product control rather than a hidden choice. It SHALL be a separate schema control, since `gradient` does not own that field.

**Status: satisfied.** `How inks meet` is a per-layer control with three
options, and the decision it exposes was being made all along: everything
composites in linear light, so two inks walked through a middle nobody had
chosen.

Three rather than the two the scenario names, because there are three honest
answers and each is right at a different moment. **Light** mixes as light does,
which is what the product always did and what a beam of two colours actually
produces -- saturated opposites pass through a pale middle. **Screen** mixes the
way a display encodes, which is what an author predicts from two swatches and
keeps more chroma between them. **Even** mixes in Oklab, holding lightness
steady across the walk; Oklab rather than Lab or HSL because its lightness axis
tracks what an eye reports and its hues stay put -- a blue-to-white ramp in HSL
swings through violet.

None of the three is correct in general, which is the reason this is a control
rather than a better default. Which one an author wants depends on whether they
are describing light, ink or an impression, and this product is about all three.

It is a detour rather than a second pipeline: colours arrive and leave in linear
light whichever space is chosen, so the composite, the engines and the export
are untouched and only the walk between two inks changes. The proof asserts both
halves -- that the middle differs across all three options, and that the *ends*
are identical, since a space that moved the inks themselves would be a recolour
wearing this control's name.

#### Scenario: Switching interpolation space
- **WHEN** the user switches gradient interpolation between linear-light and perceptual
- **THEN** mid-gradient colors change accordingly and the choice is serialized with the scene

### Requirement: Standalone gradient tool output
The gradient tool SHALL produce linear, radial, conic, and banded gradients, and SHALL expose CSS and SVG output by clipboard copy. PNG delivery SHALL use the runtime image export path.

**Status: pending — and it describes a different product.** There is no
standalone gradient tool. Conic is not offered, and there is no CSS or SVG
output: what this product copies to the clipboard is assembled GLSL, because
what it makes is a shader rather than a web gradient. PNG delivery does use the
runtime export path, which is the one clause that holds.

#### Scenario: Copying CSS
- **WHEN** the user copies the gradient as CSS
- **THEN** valid CSS gradient syntax matching the on-screen result is placed on the clipboard with a confirmation

#### Scenario: PNG uses runtime export
- **WHEN** the user exports the gradient as PNG
- **THEN** the runtime image export action produces it, and no product code allocates a canvas or creates a download URL

