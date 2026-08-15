## 1. Declare the intent before building anything

- [ ] 1.1 Write the Animation Intent Inventory. `decision-contracts` requires it *before* animation controls are authored, and it has to name the loop period and where the period came from rather than picking a number.
- [ ] 1.2 Flip `productReadiness.exportIntent.video` from `not-requested` to `user-requested`, recording this request as the explicit evidence `export-pipeline` requires. Until now the product and its spec disagreed about video; note which one was wrong.
- [ ] 1.3 Confirm nothing renders differently yet. An intent is a declaration, and if the frame moves at this step something else changed too.

## 2. The transport, with nothing moving

- [ ] 2.1 Enable `panels.timeline` with `mode: "playback"` and `defaultDurationSeconds` equal to the declared period.
- [ ] 2.2 Author no transport. No play, pause, restart, animate, or loop-length control in the panel — the runtime owns all of it, and a product that adds one has two transports that disagree.
- [ ] 2.3 Satisfy the timeline acceptance recipe in full: duration, scrub, pause/resume, keyframes, and loop each have a fixed helper and none is optional once a timeline exists. **This is the largest cost in the change and it lands here, before anything animates.**
- [ ] 2.4 Prove the Setup `Timeline` switch is presentation only: playback state, product values, and export behaviour are unchanged by toggling it.
- [ ] 2.5 Declare the sustained performance path playback introduces, and measure it. The existing paths describe discrete edits and viewport gestures; a renderer that runs continuously is a different claim against the same workload dimensions.

## 3. Drift

- [ ] 3.1 Add drift rates as whole cycles per loop, so the last frame meets the first. A rate that is not a whole number is a visible jump on repeat, which is the one thing a loop must not have.
- [ ] 3.2 Expose drift for phase, angle, and pointer reach only.
- [ ] 3.3 Refuse drift over colours, band count, separators, and region by default, and make the surface say which kind of parameter an author is looking at — a work that changes its own inks is a different work each frame, not the same one seen from elsewhere.
- [ ] 3.4 Decide per-layer against stack-level (see design Open Questions). Two layers drifting against each other is the interference these techniques are built on, which argues for per-layer.
- [ ] 3.5 Assert a still is unchanged: an export at timeline zero is compared against an export taken before drift existed, not merely inspected.
- [ ] 3.6 Look at a moiré entry specifically. Drifting phase over a field that already beats is how a pattern starts to crawl, and a plain band field will not show it.

## 4. Video export

- [ ] 4.1 Add the `Video Export` section with `export.video.format` (MP4 default, MP4 and WebM) and `export.video.resolution` (Current default, Current and 4K), placed where `export-pipeline` requires: immediately after `Image Export`, directly above the sticky actions.
- [ ] 4.2 Make `Export Video` the primary sticky action and `Export PNG` secondary, per the same requirement. **Tell the user before this lands** — a still-only user gets a demoted button, and that is the spec's decision rather than this change's.
- [ ] 4.3 Give the export renderer the timeline's timestamp and resolve drift at it. The renderer already draws a deterministic scene at a size; time is the one input it lacks.
- [ ] 4.4 Keep the still's at-rest pointer rule intact while letting the loop supply a pointer path for video. Two exports of one composition must still be the same composition.
- [ ] 4.5 Prove the artifact: duration and packet count follow the timeline, the cadence is the 30 FPS schedule regardless of render cost, editing duration changes the artifact, the last frame meets the first, and the background survives with Background off.
- [ ] 4.6 Assert the product allocates no export canvas, calls no `toBlob` or `toDataURL`, creates no object URL, instantiates no encoder, and downloads nothing. The runtime owns delivery and this is the line that says so.

## 5. Sharing — blocked

- [ ] 5.1 Do not build a share action. The encoded artifact never reaches product code: there is no completion callback, no blob hand-off, and no filename, and `export-pipeline` forbids the product from producing one itself. A share button would have nothing to share.
- [ ] 5.2 Confirm upstream issue 12 states the smallest fix that would unblock it — the artifact and its filename handed back after the runtime has encoded and downloaded it — so the ask is recorded as a framework gap rather than as a product decision not to do it.
- [ ] 5.3 Tell the user that MP4 is what lands and that sharing is two taps from the file on a phone, rather than leaving the request looking granted.

## 6. Verify and close

- [ ] 6.1 Run `npm test` and confirm both halves, since the `&&` chain hides vitest when `node --test` fails.
- [ ] 6.2 Run the browser suite and compare against the recorded baseline — five stable failures plus a rotating set of load-flaky framework self-tests. Timeline and video coverage add many proofs; none of them may join that list.
- [ ] 6.3 Confirm the integrity gate passes and that `index.html`, `src/app/app-identity.ts`, and `src/toolcraft/**` are untouched.
- [ ] 6.4 Export a video by hand, play it on a loop, and watch the seam. A packet count matching a duration is not the same claim as a loop that does not jump, and only one of them is checkable by eye.
