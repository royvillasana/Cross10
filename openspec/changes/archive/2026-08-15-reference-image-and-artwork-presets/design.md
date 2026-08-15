## Context

Two additions that share a purpose: give the user something to aim at, and
something worth starting from.

**What the stack can already express.** A preset is an ordered list of layers,
each a `typeId` plus values keyed by uniform name. The stripes layer exposes
`angle`, `count`, `phase`, `widthRatio`, `separator`, `taper`, `jitterAmount`,
`jitterVariation`, `mirror`, `paletteSlots`, `engine`, `engineAmount`,
`enginePitch`, and four colours; every layer carries a mask shape from
`rectangle`, `ellipse`, `triangle`, `diamond`, `pentagon`, `hexagon`, `polygon`,
`free`, plus `maskSize`. Gradient and image layers complete the vocabulary.

That is enough for the structures in the supplied references: tapered horizontal
bands with rectangular insets at differing phase; dense four-colour fields with
thin separators; superimposed rotated stripe planes producing moiré; a stripe
field masked to an ellipse over a gradient. `taper` in particular is the wedge
band that recurs through the reference set. No new layer type is needed.

**What the library is today.** Ten presets, and `studio-presets.ts` is candid
about them: the palettes were "recorded as plausible rather than verified", and
checking them against primary sources "is its own task, and nothing here has done
it." The presets prove the stack works. They are not a library.

**What the research changed.** The artist's catalogue structures the work into
eight investigations, not the six `scene-presets` enumerates — Chromoscope and
Couleur dans l'espace are missing. It also makes a distinction the current spec
elides: four of the eight are planar constructions a canvas can carry, and four
are environments. A flat `Saturation Chamber` preset evokes a walk-in light
chamber; it does not render one.

## Goals / Non-Goals

**Goals:**

- Load an image to author against, compare with it, and never ship it.
- A preset library organised by series, past the current numeric cap.
- Honest provenance: which series, and whether the palette was checked.
- Correct the series list to eight and mark which the canvas can carry.

**Non-Goals:**

- Automatic matching. Nothing measures the composition against the reference and
  proposes parameters; the user does the reading. An auto-fit is a much larger
  problem and is not required for the reference to be useful.
- Reproducing individual catalogued artworks. Techniques are free; the specific
  works are in copyright until well into the next century.
- Verifying the existing palettes against primary sources. That remains its own
  task; this change makes the unverified state visible instead of silent.
- A new renderer pass. The reference is an editor surface.
- Shipping the supplied reference images in the repository.

## Decisions

### The reference is an editor surface, not a layer

**Chosen.** Hold the reference outside the layer stack entirely — not in the layer
list, not in compositing order, not selectable.

*Why not an image layer with an "exclude from export" flag?* Because every other
layer property is a rendering property, and a flag that removes a layer from the
artwork makes "layer" mean two things. It would also have to be defended at every
export path forever; one wrong path and the user publishes someone else's image.

*Why not a browser-side overlay outside the canvas?* Comparison needs the two
images registered against each other at the same scale and offset. An overlay
outside the canvas surface cannot follow pan and zoom without reimplementing them.

**The strong form of the guarantee** is that the export path and the source
assembler never see the reference at all, rather than seeing it and choosing to
skip it. The spec is written as byte- and pixel-identity against the
no-reference case so this is testable rather than asserted.

### Comparison beyond overlay

**Chosen.** At least one mode beyond a plain overlay — a difference blend and a
split/wipe are the obvious candidates, and a difference blend is the one that
answers "how far off am I".

*Why require more than opacity?* At 50% overlay every mismatch looks like a
mismatch, including ones that are only a brightness difference. A difference view
collapses "identical" to black, which is the reading the user actually wants.

Comparison is a display mode and writes no layer values, so leaving it restores
nothing because nothing changed.

### Provenance as data on the preset, not prose in a comment

**Chosen.** Add `series` and a palette provenance of `verified` or `plausible` to
`StudioPreset`, and assert both in the schema tests.

*Why not leave the honest note in the file comment, as now?* Because the user
never reads the file. The product currently presents ten palettes with equal
confidence while the source says they were guesses. Making it data means the
library can show it and a test can require it.

*Why keep unverified presets at all?* They are good constructions and the
technique is what the user is learning. Removing them to look rigorous would make
the library worse; labelling them makes it honest.

### Carry versus evoke

**Chosen.** Mark each series as one the canvas carries or one it evokes, and have
evoking presets say so.

Chromosaturation is a chamber the visitor stands inside; Transchromie is panels
they walk through; Chromoscope and Couleur dans l'espace are environments. Their
subject is the viewer's movement through space, which a fixed rectangle does not
have. A preset can evoke the chromatic condition; calling that a rendering of the
work misrepresents both.

### Naming for technique, not for catalogued works

**Chosen.** Presets name the technique and the series.

The distinction that makes this safe is real: methods and styles are not
copyrightable and the series names are descriptive terms the artist himself used
for categories of investigation, while the individual works are protected. The
existing `Physichromie 500` sits on the wrong side of that line and should be
renamed for what it does.

### Replacing the 8–12 cap with per-series coverage

**Chosen.** Withdraw the numeric total; require at least one preset per series.

The cap was a sensible bound on a demonstration. As a library rule it says the
twelfth good preset must displace one of the first eleven, which is not a rule
anyone wants. Per-series coverage keeps the property the cap was protecting —
that the library represents the whole body of work rather than the easy parts.

## Risks / Trade-offs

**A reference leaks into an artifact** → The tests are written as identity against
the no-reference case for image export, video export, settings transfer, and the
assembled source. Holding the reference outside the stack means the leak has to be
added deliberately rather than merely forgotten.

**Two changes modify `Built-in preset library`** → `engine-targeting-and-control-ia`
modifies it for revertibility and this change modifies it again. This delta carries
the revertibility clause forward verbatim, so applying that change first and this
one second is lossless. The other order drops revertibility. Recorded in the
proposal's Impact and as a task.

**Provenance fields make every existing preset fail validation at once** → All ten
are `plausible`; that is the truthful value and it is a one-line addition each.
The assertion lands with the field.

**A larger library costs section budget** → The library is one select control
however long it is, so growth costs nothing against the ten-control cap. It does
cost scanning effort, which the series grouping is there to absorb.

**Recreations may resemble specific works closely** → The technique is the point
and near-resemblance is inherent to working in a vocabulary. Naming for technique,
declining to assert reproduction, and marking provenance are what keep the library
an homage rather than a catalogue. If a preset does land very close to a
identifiable work, the honest fix is to name it for its construction.

**Palette provenance stays `plausible` indefinitely** → Labelling makes the gap
visible without closing it. Verification remains its own task; this change should
not be read as having done it.

## Migration Plan

1. Add `series` and palette provenance to `StudioPreset`; mark all ten existing
   presets `plausible` and assign their series. Assert both.
2. Withdraw the 8–12 assertion and replace it with per-series coverage over eight
   series. Expect a red suite until step 3 fills the missing series.
3. Author presets for the uncovered series and for the structures in the reference
   set, renaming any preset that names an individual work.
4. Land the reference image: loading, opacity, dismissal, and the four
   absent-from-artifact proofs.
5. Land comparison.

Steps 1–3 are independent of 4–5 and either half can ship alone.

## Open Questions

- Where does the reference live in the control surface? It is not a layer and not
  an export setting. It may want its own section, which costs a section against
  the inventory that `engine-targeting-and-control-ia` is already re-cutting —
  the two should be authored together.
- Does a loaded reference persist across reload? The composition does. A large
  image in persisted state has a cost, and a reference the user does not own
  arguably should not be stored at all.
- Should a reference be allowed to set the canvas aspect ratio on load, as an
  explicit opt-in action? Useful when recreating a work of known proportion, but
  it must stay an action the user takes rather than a side effect of loading.
- Which comparison mode ships first — difference or split? Difference answers the
  more useful question; split is easier to read at a glance.
