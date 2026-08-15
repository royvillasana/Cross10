## 1. Measure the boundary rather than assume it

- [ ] 1.1 Measure the Controls and Layers panels' real minimum usable width in the browser, and the width at which a canvas beside one stops being worth looking at. The threshold comes from those two numbers; 760px was the suggestion, not the measurement.
- [ ] 1.2 Decide whether collapsing sections and hiding a panel share one threshold or need two. At a tablet width both panels may fit, and hiding one there is a loss rather than a help.
- [ ] 1.3 Reproduce the failure first, as a browser proof at a narrow viewport that fails today: assert every enabled panel's box lies within the viewport. It should fail with the Controls panel off screen, so what follows is fixing something demonstrated rather than something described.

## 2. Bring the panels back

- [ ] 2.1 On load below the threshold, dispatch `panels.resetOffset` or `panels.setOffset` so no panel lies outside the viewport.
- [ ] 2.2 Use published commands only. No styling of runtime DOM, no product-authored panel, no custom control standing in for one — the reasoning is in the design and it should not need rediscovering.
- [ ] 2.3 Prove the load-time proof from 1.3 now passes, and that above the threshold no panel command is dispatched at all.

## 3. Collapsed, and one at a time

- [ ] 3.1 Dispatch `panels.setSectionCollapsed` for every section below the threshold, so the surface is a list of headings a thumb can scan.
- [ ] 3.2 Show at most one of Layers and Controls below the narrower threshold, with showing one hiding the other, so the canvas is visible whenever neither is open.
- [ ] 3.3 Browser proofs at a narrow viewport for both, and a proof that the canvas is actually visible with neither panel open — a panel that is `hidden` in state but still painted would pass the state check and fail the user.

## 4. Never override the user

- [ ] 4.1 Set a marker when the user moves, hides, collapses, or expands anything, and stop applying the arrangement once it is set. **Write it from the interaction, not from the state** — panel state arrives from persistence and from the user identically, so a restored session would otherwise look like a preference and a preference like a restore.
- [ ] 4.2 Browser proof: move a panel at a narrow viewport, reload, and find it where it was left, with no command dispatched on that load.
- [ ] 4.3 Browser proof: expand a section, reload, find it still expanded.

## 5. Say what this is not

- [ ] 5.1 Do not describe this as a mobile layout in any label, comment, or acceptance row. The canvas will not exceed half the screen with a panel open, because a panel has a 560px floor the product cannot reach. "Reachable" is the claim; "usable layout" is not.
- [ ] 5.2 Confirm upstream issue 11 names the two constants that block the real layout — `snapEdges: ["left", "right"]` and `min-h-[560px]` on `controls` and `layers` — so the ask is a two-line change rather than a vague complaint.
- [ ] 5.3 Record the rejected approach and why, so hiding the panels and drawing our own is not proposed a third time. Three of its four steps work; the fourth is forbidden by the canvas-content rule, the recreate-a-built-in rule, and the inventory's exactly-once rule.

## 6. Verify and close

- [ ] 6.1 Run `npm test` and confirm both halves, since the `&&` chain hides vitest when `node --test` fails.
- [ ] 6.2 Run the browser suite and compare against the recorded baseline. Nothing here touches a desktop path, so a new failure means the threshold is firing when it should not.
- [ ] 6.3 Confirm the integrity gate passes and that `index.html`, `src/app/app-identity.ts`, and `src/toolcraft/**` are untouched.
- [ ] 6.4 Open the deployed site on a real phone, not an emulated viewport. Reach the controls, change a colour, and export. If any of those three is impossible the change has not done its job, whatever the proofs say.
