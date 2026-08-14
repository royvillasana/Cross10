## 1. Preset provenance and series

- [ ] 1.1 Add `series` and a palette provenance of `verified` or `plausible` to `StudioPreset` in `studio-presets.ts`.
- [ ] 1.2 Assign a series to each of the ten existing presets and mark every one `plausible`, which is what `studio-presets.ts` already says they are.
- [ ] 1.3 Add the carry-or-evoke marking per series: Couleur Additive, Physichromie, Induction Chromatique and Chromointerférence are carried; Chromosaturation, Transchromie, Chromoscope and Couleur dans l'espace are evoked.
- [ ] 1.4 Schema tests: every preset declares a series and a provenance, and every evoked-series preset is marked as an evocation.
- [ ] 1.5 Surface provenance in the applicator so a plausible palette is never presented as verified.

## 2. Correct the series list

- [ ] 2.1 Replace the 8–12 total assertion with per-series coverage over the eight series. Expect red until group 3 lands.
- [ ] 2.2 Rename `Physichromie 500` and any other preset that names an individual catalogued work, to name its construction instead.
- [ ] 2.3 Add a validation that no preset name or description asserts reproduction of an individual artwork.

## 3. Author the library

- [ ] 3.1 Chromoscope and Couleur dans l'espace have no preset at all; author one each, marked as evocations.
- [ ] 3.2 Couleur Additive: author the serigraph structure from the reference set — horizontal bands over a white ground, three to four saturated colours, stepped rectangular regions with a phase offset between them.
- [ ] 3.3 Physichromie: author the dense four-colour field with thin dark separators and a region inset, in the amber/blue/black register and in a full-spectrum register.
- [ ] 3.4 Induction Chromatique: author the tapered-band study — `taper` across horizontal bands with rectangular insets at differing `phase`, which is the recurring structure across most of the supplied references.
- [ ] 3.5 Chromointerférence: author two superimposed stripe layers at slightly different `angle` and `count` so the moiré is the subject, and a variant masked to an `ellipse` over a gradient.
- [ ] 3.6 Author a rotated-planes composition — several stripe layers at differing `angle` over a dark ground — for the scattered-planes structure in the reference set.
- [ ] 3.7 Review every new preset for `maskSize: 0` where a whole-frame field is intended, per the existing note that a layer arrives confined to a shape.
- [ ] 3.8 Browser proof that each new preset applies and renders, and that the gallery lists every series.

## 4. The reference image

- [ ] 4.1 Add reference state outside the layer stack — not in the layer list, not in compositing order, not selectable.
- [ ] 4.2 Loading, opacity, and clearing. Clearing must leave every layer value untouched.
- [ ] 4.3 Decide where the reference controls live in the control surface, authored together with the inventory re-cut in `engine-targeting-and-control-ia` rather than separately.
- [ ] 4.4 Decide whether a loaded reference persists across reload (see design Open Questions) and implement accordingly.
- [ ] 4.5 Confirm loading a reference of different dimensions does not resize the canvas.

## 5. Prove the reference never ships

- [ ] 5.1 Browser proof: an image exported with a reference loaded is pixel-identical to the same composition exported with none.
- [ ] 5.2 Browser proof: the same for video export.
- [ ] 5.3 Unit proof: the assembled deliverable source is byte-identical with and without a reference, and declares no sampler or uniform belonging to it.
- [ ] 5.4 Proof that exported settings carry the composition and no reference image data.
- [ ] 5.5 Confirm the export path and the source assembler never receive the reference, rather than receiving it and skipping it.

## 6. Comparison

- [ ] 6.1 Add a comparison mode beyond plain overlay; ship difference first unless the split reads better in practice.
- [ ] 6.2 Comparison writes no layer values; entering and leaving it changes nothing.
- [ ] 6.3 Browser proof that exporting while comparison is active produces the composition alone.
- [ ] 6.4 Acceptance rows for the reference and comparison controls, landing with the controls.

## 7. Verify and close

- [ ] 7.1 Confirm this change's `scene-presets` delta was applied after `engine-targeting-and-control-ia`, and that the revertibility clause survived.
- [ ] 7.2 Run `npm test` and check both halves, since the `&&` chain hides vitest when `node --test` fails.
- [ ] 7.3 Confirm the only browser failures are the two already red on untouched `main`.
- [ ] 7.4 Confirm the integrity gate passes and that no reference image or artwork file was committed to the repository.
