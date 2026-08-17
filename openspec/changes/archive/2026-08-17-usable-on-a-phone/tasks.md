## 1. Measure the boundary rather than assume it

- [x] 1.1 Measure the Controls and Layers panels' real minimum usable width in the browser, and the width at which a canvas beside one stops being worth looking at. **Measured: Controls is 300x780, Layers 240x87, and the shell reports 1024 wide at every viewport below 1024 while `document.scrollWidth` equals the viewport.** The threshold is 1024 — the runtime's own shell minimum, which is exactly where clipping starts. 760 would have left the 760–1023 band clipped and unarranged.
- [x] 1.2 Decide whether collapsing sections and hiding a panel share one threshold or need two. **One**, because hiding was replaced by collapsing: a collapsed panel keeps the header you tap to open it, a hidden one needs another surface to bring it back, and a phone has no room for one.
- [x] 1.3 Reproduce the failure first, as a browser proof at a narrow viewport that fails today. It failed with the Controls panel measuring `[714,10,300,780]` in a 390px viewport.

## 2. Bring the panels back

- [x] 2.1 On load below the threshold, dispatch `panels.setOffset` so no panel lies outside the viewport. The delta is measured from where the panel actually is rather than re-derived from the runtime's shell width, panel width and margin — those are runtime numbers, and re-deriving them would be right today and silently wrong the first time one changed.
- [x] 2.2 Use published commands only. No styling of runtime DOM, no product-authored panel, no custom control standing in for one.
- [x] 2.3 Prove the load-time proof from 1.3 now passes, and that above the threshold no panel command is dispatched at all.

## 3. Collapsed, and one at a time

- [x] 3.1 Dispatch `panels.setSectionCollapsed` for every section below the threshold.
- [x] 3.2 Collapse both panels rather than hiding one, so the canvas sits between two headers and either can be opened by tapping it.
- [x] 3.3 Browser proofs for both, reading rendered height rather than panel state — a panel marked collapsed that still painted its body would pass a state check and fail the user.

## 4. Never override the user

- [x] 4.1 Never override the user. **The marker turned out to be needed for only half of it**: a rescue is planned only for a panel that is *unreachable*, so an arrangement that works is never touched and needs no guard. Only the collapse is marked, and the marker is a fact about the product rather than about an interaction.
- [x] 4.2 Browser proof: expand a panel at a narrow viewport, reload, and find it still expanded and still reachable.
- [x] 4.3 Covered by 4.2 — expanding the panel is the section-level choice, and the same reload proves it.

## 5. Say what this is not

- [x] 5.1 Do not describe this as a mobile layout in any label, comment, or acceptance row.
- [x] 5.2 Confirm upstream issue 11 names what blocks the real layout. **It now names the root cause rather than the symptom**: `minWidth: 1024` with `overflow-hidden` on the shell, which clips with no scroll, plus the two `panel-host-config.ts` constants.
- [x] 5.3 Record the rejected approach and why, so hiding the panels and drawing our own is not proposed a third time.

## 6. Verify and close

- [x] 6.1 Run `npm test` and confirm both halves. Docs pass, integrity 650 files, `node --test` 556/557, vitest 620/621 — both failures are the recorded baseline.
- [x] 6.2 Run the browser suite and compare against the baseline. **The baseline turned out not to be a number.** Four full runs, two of them on a tree with no product change: 8, 9, 9, 8 failures, with five stable and the rest rotating through a pool of the slowest proofs. Every rotating member passes alone and with three sibling specs. Filed as issue 13, because a count that is stable while its membership is not will read a regression as noise and noise as a regression.
- [x] 6.3 Confirm the integrity gate passes and that `index.html`, `src/app/app-identity.ts`, and `src/toolcraft/**` are untouched. 650 files, no protected path touched.
- [x] 6.4 Open the deployed site at a phone width and reach the controls. **Found a defect the proofs had passed over**: both panels were pinned to the same corner, so Controls was drawn over Layers and Layers was unreachable while measuring as perfectly placed. Rescued panels are stacked now, and the proof asks the rendered page what is *at* the header point rather than where the box is — checked against the broken code first, where it reports "covered".
