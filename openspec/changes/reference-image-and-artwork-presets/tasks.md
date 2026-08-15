## 1. Preset provenance and series

- [x] 1.1 Add `series` and a palette provenance of `verified` or `plausible` to `StudioPreset` in `studio-presets.ts`. **Three values, not two.** The change was written before the palettes were rewritten to be the studio's own; `studio` is not a weaker `plausible` but a different claim, and recording one as the other would put back exactly the false citation that rewrite removed. The spec delta was corrected to match.
- [x] 1.2 Assign a series to each of the ten existing presets and mark every one `studio`, which is what `studio-presets.ts` already says they are.
- [x] 1.3 Add the carry-or-evoke marking per series: Couleur Additive, Physichromie, Induction Chromatique and Chromointerférence are carried; Chromosaturation, Transchromie, Chromoscope and Couleur dans l'espace are evoked.
- [x] 1.4 Schema tests: every preset declares a series and a provenance, and every evoked-series preset is marked as an evocation.
- [x] 1.5 Surface provenance in the applicator so a plausible palette is never presented as verified. The picker item's own name carries the series and, for an evoked one, that it is an evocation; a verified palette is the only thing allowed to say so, and a test refuses to let anything else drift into saying it.

## 2. Correct the series list

- [x] 2.1 Replace the 8–12 total assertion with per-series coverage over the eight series. The cap lived only in the spec, never in a test, so what landed is the coverage assertion the cap was standing in for.
- [x] 2.2 Rename `Physichromie 500` and any other preset that names an individual catalogued work, to name its construction instead. It is now `Four-Ink Relief`; the thumbnail map is keyed by id, so the whole set was regenerated.
- [x] 2.3 Add a validation that no preset name or description asserts reproduction of an individual artwork.

## 3. Author the library

- [x] 3.1 Chromoscope and Couleur dans l'espace have no preset at all; author one each, marked as evocations.
- [x] 3.2 Couleur Additive: author the serigraph structure from the reference set — horizontal bands over a white ground, three to four saturated colours, stepped rectangular regions with a phase offset between them.
- [x] 3.3 Physichromie: author the dense four-colour field with thin dark separators and a region inset, in the amber/blue/black register and in a full-spectrum register.
- [x] 3.4 Induction Chromatique: author the tapered-band study — `taper` across horizontal bands with rectangular insets at differing `phase`, which is the recurring structure across most of the supplied references.
- [x] 3.5 Chromointerférence: author two superimposed stripe layers at slightly different `angle` and `count` so the moiré is the subject, and a variant masked to an `ellipse` over a gradient.
- [x] 3.6 Author a rotated-planes composition — several stripe layers at differing `angle` over a dark ground — for the scattered-planes structure in the reference set.
- [x] 3.7 Review every new preset for `maskSize: 0` where a whole-frame field is intended, per the existing note that a layer arrives confined to a shape. Asserted rather than reviewed: every layer of every entry must name its extent, so one left unset fails instead of landing as a quarter-size rectangle nobody notices.
- [x] 3.8 Browser proof that each new preset applies and renders, and that the gallery lists every series.

## 4. The reference image

- [x] 4.1 Add reference state outside the layer stack — not in the layer list, not in compositing order, not selectable. **The user's own file is not expressible and the reference is a built-in instead.** Every route the framework offers for reading a user's image goes through the runtime's media import, which creates a layer for every asset unconditionally, and a custom control may not stand in for the built-in uploader; recorded as issue 10 in `docs/upstream/toolcraft-0.0.18-issues.md`. What ships is the studio's own renders put *behind* the canvas rather than onto it, which keeps every property the requirement was protecting and gives up only the one the framework forbids.
- [x] 4.2 Loading, opacity, and clearing. Clearing must leave every layer value untouched. Zero opacity is how a reference is dismissed, and at zero the overlay is absent from the tree rather than transparent — an element that exists and cannot be seen is the shape a leak takes.
- [x] 4.3 Decide where the reference controls live in the control surface, authored together with the inventory re-cut in `engine-targeting-and-control-ia` rather than separately. Two sections after the gallery and before everything that changes the composition, which is the order the work happens in.
- [x] 4.4 Decide whether a loaded reference persists across reload (see design Open Questions) and implement accordingly. It does, and the objection in the design no longer applies: the three values persisted are an entry id, a number, and a mode. No image data is stored, because the picture is a built-in the product already ships.
- [x] 4.5 Confirm loading a reference of different dimensions does not resize the canvas. The overlay is placed from the canvas's own box and the picture is contained rather than fitted, so a study of another proportion is shown whole and the canvas keeps the dimensions the author chose.

## 5. Prove the reference never ships

- [x] 5.1 Browser proof: an image exported with a reference loaded is pixel-identical to the same composition exported with none. Both artifacts are downloaded and decoded; the comparison is over the decoded pixels rather than over the export UI.
- [x] 5.2 Browser proof: the same for video export. **Vacuous here and asserted as such**: this product exports no video, so the honest proof is that there is no video path — checked against the declared export intent, so the claim fails the day that changes rather than quietly describing a product that no longer exists.
- [x] 5.3 Unit proof: the assembled deliverable source is byte-identical with and without a reference, and declares no sampler or uniform belonging to it.
- [x] 5.4 Proof that exported settings carry the composition and no reference image data.
- [x] 5.5 Confirm the export path and the source assembler never receive the reference, rather than receiving it and skipping it. The scene the renderer draws has no field for a reference at all, asserted over the scene's own keys — a field that existed and happened to be empty would be one refactor from being populated.

## 6. Comparison

- [x] 6.1 Add a comparison mode beyond plain overlay; ship difference first unless the split reads better in practice. Difference, done as a CSS blend on the overlay: it composites against what is already painted and cannot reach the WebGL surface, the export frame, or the assembled source. The same effect inside the shader would have put the reference in the one place it must never be.
- [x] 6.2 Comparison writes no layer values; entering and leaving it changes nothing.
- [x] 6.3 Browser proof that exporting while comparison is active produces the composition alone.
- [x] 6.4 Acceptance rows for the reference and comparison controls, landing with the controls.

## 7. Verify and close

- [x] 7.1 Confirm this change's `scene-presets` delta was applied after `engine-targeting-and-control-ia`, and that the revertibility clause survived. It did: `engine-targeting-and-control-ia` closed first, and this delta opens with "Applying a preset SHALL be revertible" carried forward verbatim.
- [x] 7.2 Run `npm test` and check both halves, since the `&&` chain hides vitest when `node --test` fails. Docs pass, integrity passes at 650 files, `node --test` 556/557, vitest 604/605 — both failures are the recorded baseline.
- [x] 7.3 Confirm the only browser failures are the ones already red on untouched `main`. **The baseline is five, not two, and part of it rotates.** Stable across every run: three `app-browser-orientation-evidence` recipes, `app-browser-runtime-requirements` over `canvas.render-scale`, and `browser: starter canvas accepts media upload without product controls` — issues 3, 4 and 8 upstream. Beyond those, a rotating handful of framework self-tests fail only under two workers and pass alone: `app-browser-model-import-evidence`, `app-browser-model-appearance-evidence`, `app-browser-performance-probe`, and occasionally `browser: studio background color grounds preview and export alike`. Measured here at 224 passed, 7 failed; no product proof added by this change is among them.
- [x] 7.4 Confirm the integrity gate passes and that no reference image or artwork file was committed to the repository. 650 files, and no image file was added at all — the references are the renders the product already produces from its own library, which is also what makes them safe to ship.
