# post-fx-suite Specification

## Purpose
Recorded from the Croix10 change, archived at 110 of 219 tasks.

**Build status: none of this is built**, and the file is now half the size it
was. Audited against the app on 2026-08-17 (`outstanding` 1.1), which found the
largest block of unbuilt intent in the specs and a scope question it could not
settle: these requirements read as a general creative-coding toolkit — character
output, datamosh smear, scanline tearing — rather than as anything the rest of
the product is for.

**The owner settled it on 2026-08-21: split rather than keep or drop.** The file
turned out not to be one thing. Some of it is colour work wearing a post-effect
name, and some of it operates on pixels as data.

**Kept, because a chromatic instrument is what they are about.** Halftone is how
colour is separated and laid down in print, which is the tradition these
techniques come out of — and the spec already said line halftone should reuse
the shared stripe field, because it *is* the stripe field. Dot density following
luminance is the same reading of a source that `media-stylization` now performs.
Palette quantization is a colour operation by definition. RGB channel split
along the stripe axis is displacement of the primaries against each other, which
is the subject stated in the vocabulary of a glitch.

**Dropped, because they belong to a different product.** ASCII and ANSI
character output, datamosh-style smear, scanline tearing, and block
displacement. Each treats the frame as data to be disturbed; none of them is an
operation on colour, and none was depended on by anything in the specs. They are
removed rather than left pending, so this file stops reading as work in
progress for work nobody intends.

What remains is scheduled rather than built, and carried as `outstanding` 1a.3a
and 1a.3b.

## Requirements
### Requirement: Halftone modes
The halftone tool SHALL provide dot, line, and cross halftone modes with controllable cell size and angle, and the line mode SHALL reuse the shared stripe field rather than a separate implementation.

**Status: pending — scheduled.** Nothing of it is built. Kept because it is the
printing half of this subject rather than an effect over it: the reason line
halftone must reuse the stripe field is that a halftone line *is* a band, and a
second implementation would be a second answer to a question this product has
already answered.

#### Scenario: Line halftone reuses the stripe engine
- **WHEN** line halftone is selected
- **THEN** its lines are produced by the shared stripe field and respond to the stripe geometry parameters, including angle and jitter

#### Scenario: Dot halftone density follows luminance
- **WHEN** dot halftone is applied to a named luminance-ramp fixture
- **THEN** measured dot area across sampled cells is monotonic against source luminance

### Requirement: Pixelation with palette quantization
The pixel tool SHALL pixelate its source at a controllable block size and SHALL optionally quantize the result to the active palette.

**Status: pending — scheduled.** Kept for the quantization rather than the
pixelation: reducing an image to the inks actually in play is a colour
operation, and it is the same act `color-and-gradient-system` asks for when it
requires a gradient to be convertible to a band sequence. The block size is what
decides the grain that quantization is applied at.

#### Scenario: Pixelate and quantize
- **WHEN** block size is raised and palette quantization is enabled
- **THEN** the output consists of uniform blocks whose colors are drawn only from the active palette

### Requirement: Channel split along the stripe axis
The channel split SHALL displace the red, green, and blue channels along the current stripe axis, with an intensity control, and SHALL be deterministic.

**Status: pending — scheduled.** What was the first quarter of a glitch tool,
kept on its own terms. Displacing the primaries against each other along the
axis the field is read on is a chromatic operation: it is what a mis-registered
print does, and misregistration is one of the conditions these techniques were
built to exploit. The other three glitch effects — block displacement, scanline
tearing, datamosh smear — were dropped with the rest of the toolkit.

The seed and loop-periodicity scenarios went with them. Nothing that remains is
random: a channel split is a displacement by an amount the author sets, so there
is no noise to seed and nothing that could fail to close the loop.

#### Scenario: Channel split follows the stripe axis
- **WHEN** channel split is applied with a nonzero intensity
- **THEN** the red, green, and blue channels are displaced along the current stripe axis
- **AND** changing the stripe angle changes the split direction

#### Scenario: Zero intensity is a no-op
- **WHEN** the split intensity is zero
- **THEN** the output is pixel-identical to the unsplit render

### Requirement: Post FX composition order
Post FX SHALL apply to whatever the active tool renders, in a deterministic documented order, and SHALL be individually bypassable.

**Status: pending — scheduled, and smaller than it was.** With three effects
rather than five tools, the order is halftone, then quantization, then channel
split: the first two decide what the ink is, and the last displaces it. The
requirement survives the trim because it is the one that stops three
independently-correct effects from producing a frame nobody chose.

#### Scenario: Bypassing an effect
- **WHEN** an enabled effect is bypassed
- **THEN** the remaining effects still apply in the same relative order and the bypassed effect contributes nothing
