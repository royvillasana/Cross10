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

**Status: satisfied.** `Screen` offers dot, line and cross with a cell and an
angle, per layer. The mark carries the layer's own colour and the space between
marks carries nothing, so what shows through is whatever sits beneath — the same
reading a band separator already has. A screen that painted its own paper would
be opaque white over the stack, which is a different picture from a screen.

The reuse is real rather than declared: `studioBandInk` was lifted out of the
stripe body and both now read through it, so a halftone line gives way exactly
where a band does. Line and cross are that one function read once and twice.

Two things the technique required and the obvious implementation would miss. Dot
radius comes from the *square root* of coverage, because area goes as the square
of the radius — without it the midtones come out far too light and the ramp
reads as a curve nobody chose. And cross is the union of its two screens rather
than the product: two screens laid over one another cover what either covers,
where multiplying thins the midtones toward nothing.

#### Scenario: Line halftone reuses the stripe engine
- **WHEN** line halftone is selected
- **THEN** its lines are produced by the shared stripe field and respond to the stripe geometry parameters, including angle and jitter

#### Scenario: Dot halftone density follows luminance
- **WHEN** dot halftone is applied to a named luminance-ramp fixture
- **THEN** measured dot area across sampled cells is monotonic against source luminance

### Requirement: Pixelation with palette quantization
The pixel tool SHALL pixelate its source at a controllable block size and SHALL optionally quantize the result to the active palette.

**Status: satisfied.** `Sample grain` reads the layer's field once per block
rather than once per pixel, and `Only the layer's inks` holds every colour it
draws to the slots in use.

Grain is applied *upstream of the body* rather than to what the body produced,
and that is the difference between pixelating the work and blurring it: a field
sampled once per block is genuinely read coarsely, where averaging the output
afterwards would be the same field with its detail smeared rather than absent.
It therefore necessarily precedes the screen and the quantization, which act on
what comes back — a refinement of the ordering requirement below rather than a
contradiction of it.

Quantization measures distance in Oklab rather than in linear light, which is
the difference between "nearest" meaning what an eye would say and what a
distance in a cube would: linear light puts most of its volume in the brights,
so a midtone would snap to whichever ink happens to be lightest rather than the
one it looks most like.

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
