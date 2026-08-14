# A reference to work against, and a library worth opening

## Why

The product asks a user to recreate a chromatic construction and gives them
nothing to check their work against. Authoring is done by eye, from memory, with
the thing being aimed at in another window. A reference image loaded beside or
behind the canvas turns that into a comparison, which is what the tool is
actually for.

The preset library has the second half of the same problem. Ten presets ship, and
`studio-presets.ts` says of them: *"The palettes are Croix10's, which recorded
them as plausible rather than verified. Checking them against primary sources is
its own task, and nothing here has done it."* They are a demonstration that the
stack can hold a composition, not a library anyone would open to learn the
vocabulary. A user who wants to see what the technique can do has nowhere to
start.

Research against the artist's own catalogue also shows the spec's series list is
wrong. `scene-presets` requires coverage of six series. There are **eight**:
Couleur Additive, Physichromie, Induction Chromatique, Chromointerférence,
Transchromie, Chromosaturation, **Chromoscope**, and **Couleur dans l'espace**.
Two are missing from a requirement that claims to enumerate them.

The same research shows a limit the current spec papers over. Couleur Additive,
Physichromie, Induction Chromatique and Chromointerférence are planar
constructions a canvas can genuinely carry. Chromosaturation is a walk-in chamber
of saturated light; Transchromie is juxtaposed coloured and transparent panels a
visitor moves through; Chromoscope and Couleur dans l'espace are environments.
A flat preset named `Saturation Chamber` is an evocation of one, not a rendering
of one, and the spec should say which of the two it is.

## What Changes

- **A reference image can be loaded and compared against.** It sits behind or
  beside the composition at an adjustable opacity, and it is a guide rather than
  content: it is not a layer, it does not composite into the artwork, and it
  reaches no artifact. **BREAKING** for nothing, because nothing currently exists.

- **The reference never leaves the editor.** It is absent from the exported image,
  absent from the exported video, and absent from the assembled deliverable
  shader. A reference the user does not own must not be capable of being
  published by the tool that displayed it.

- **The preset library grows past its cap and is organised by series.** The
  current requirement fixes the total between 8 and 12, which was right for a
  demonstration and is wrong for a library. **BREAKING**: the 8–12 total is
  replaced by a per-series coverage rule.

- **Presets carry honest provenance.** Each records which series it belongs to
  and whether its palette is verified against a primary source or recorded as
  plausible. The existing unverified palettes stay usable and stop being silently
  presented as accurate.

- **The series list is corrected to eight**, and each is marked as one a canvas
  can carry or one it can only evoke.

- **Presets are named for technique and series, not for individual catalogued
  works.** Cruz-Diez died in 2019 and the specific works remain in copyright. The
  techniques are not copyrightable and the series names are descriptive, so a
  preset may say what tradition it works in without claiming to be a reproduction
  of a particular piece.

## Capabilities

### New Capabilities

- `reference-image`: loading an image to author against, how it is displayed and
  compared, and the guarantee that it reaches no exported or delivered artifact.

### Modified Capabilities

- `scene-presets`: "Built-in preset library" changes — the 8–12 total is replaced
  by per-series coverage across the corrected list of eight series, presets carry
  series and provenance, and the spec distinguishes a series a canvas can carry
  from one it can only evoke.

## Impact

**Ordering.** This change's `scene-presets` delta supersedes the one in
`engine-targeting-and-control-ia`, which modifies the same requirement to make
applying revertible. That change lands first; this delta carries its text forward.
Applying these two in the other order loses the revertibility clause.

**Product code.** `studio-presets.ts` (the library, the series and provenance
fields), a new reference-image module, `studio-layer-sections.ts` or a new section
for the reference controls, `app-composition.tsx` (loading and clearing),
`studio-source.ts` and the export path (proving the reference is absent).

**Tests.** Acceptance rows and browser proofs for the reference controls; a proof
that an export with a reference loaded is pixel-identical to one without; a proof
that the assembled shader is unchanged by a loaded reference; per-series coverage
assertions over the library.

**Not affected.** The renderer pipeline — a reference is an editor surface, not a
pass. No new renderer pass is declared, so no new cost profile is owed.

**Framework.** No runtime changes. `src/toolcraft/**` stays signed and untouched,
as do `index.html` and `src/app/app-identity.ts`.
