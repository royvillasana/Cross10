## 1. Declare the intent before building anything

- [x] 1.1 Write the Animation Intent Inventory. `decision-contracts` requires it *before* animation controls are authored, and it has to name the loop period and where the period came from rather than picking a number.
- [x] 1.2 Flip `productReadiness.exportIntent.video` from `not-requested` to `user-requested`, recording this request as the explicit evidence `export-pipeline` requires. Until now the product and its spec disagreed about video; note which one was wrong.
- [x] 1.3 Confirm nothing renders differently yet. An intent is a declaration, and if the frame moves at this step something else changed too.

## 2. The transport, with nothing moving

- [x] 2.1 Enable `panels.timeline` with `mode: "playback"` and `defaultDurationSeconds` equal to the declared period.
- [x] 2.2 Author no transport. No play, pause, restart, animate, or loop-length control in the panel — the runtime owns all of it, and a product that adds one has two transports that disagree.
- [x] 2.3 Satisfy the timeline acceptance recipe in full: duration, scrub, pause/resume, keyframes, and loop each have a fixed helper and none is optional once a timeline exists. **This is the largest cost in the change and it lands here, before anything animates.**
- [ ] 2.4 Prove the Setup `Timeline` switch is presentation only: playback state, product values, and export behaviour are unchanged by toggling it.
- [ ] 2.5 Declare the sustained performance path playback introduces, and measure it. The existing paths describe discrete edits and viewport gestures; a renderer that runs continuously is a different claim against the same workload dimensions.

## 3. Drift

- [x] 3.1 Add drift rates as whole cycles per loop, so the last frame meets the first. A rate that is not a whole number is a visible jump on repeat, which is the one thing a loop must not have.
- [ ] 3.2 Expose drift for phase, angle, and pointer reach only. *Phase and angle are in; pointer reach is not, because the pointer is the one parameter a **viewer** drives and a drifting pointer would be the product pretending someone is there.*
- [x] 3.3 Refuse drift over colours, band count, separators, and region by default, and make the surface say which kind of parameter an author is looking at — a work that changes its own inks is a different work each frame, not the same one seen from elsewhere.
- [x] 3.4 Decide per-layer against stack-level (see design Open Questions). Two layers drifting against each other is the interference these techniques are built on, which argues for per-layer.
- [x] 3.5 Assert a still is unchanged: an export at timeline zero is compared against an export taken before drift existed, not merely inspected.
- [ ] 3.6 Look at a moiré entry specifically. Drifting phase over a field that already beats is how a pattern starts to crawl, and a plain band field will not show it.

## 4. Video export

- [x] 4.1 Add the `Video Export` section with `export.video.format` (MP4 default, MP4 and WebM) and `export.video.resolution` (Current default, Current and 4K), placed where `export-pipeline` requires: immediately after `Image Export`, directly above the sticky actions.
- [x] 4.2 Make `Export Video` the primary sticky action and `Export PNG` secondary, per the same requirement. **Tell the user before this lands** — a still-only user gets a demoted button, and that is the spec's decision rather than this change's.
- [x] 4.3 Give the export renderer the timeline's timestamp and resolve drift at it. The renderer already draws a deterministic scene at a size; time is the one input it lacks.
- [x] 4.4 Keep the still's at-rest pointer rule intact while letting the loop supply a pointer path for video. Two exports of one composition must still be the same composition.
- [x] 4.5 Prove the artifact: duration and packet count follow the timeline, the cadence is the 30 FPS schedule regardless of render cost, editing duration changes the artifact, the last frame meets the first, and the background survives with Background off.
- [ ] 4.6 Check the loop period against what the common destinations accept — a vertical video is usually watched on a phone where anything past a minute or so is a different kind of post — and make the declared period a reason rather than a round number. MP4 is already the specified default and is the format those destinations take, so nothing here needs a new format.
- [x] 4.7 Assert the product allocates no export canvas, calls no `toBlob` or `toDataURL`, creates no object URL, instantiates no encoder, and downloads nothing. The runtime owns delivery and this is the line that says so.

## 5. Posting is the user's, and nothing here does it

- [x] 5.1 Build no share action, and do not treat that as a gap this change is leaving. The ask was for output *shaped* for where it is posted; the user downloads the file and uploads it themselves. MP4 at a phone-shaped canvas is the whole of it.
- [x] 5.2 Confirm the shapes land in `dialog-first-composition-flow` group 3 rather than here, since they are canvas dimensions rather than export settings, and that nothing in the export surface duplicates them.
- [x] 5.3 Leave upstream issue 12 filed anyway. A share *integration* is still impossible for the reason recorded there, and the day someone asks for one it should be a known gap rather than a fresh discovery.

## 6. Verify and close

- [ ] 6.1 Run `npm test` and confirm both halves, since the `&&` chain hides vitest when `node --test` fails.
- [ ] 6.2 Run the browser suite and compare against the recorded baseline — five stable failures plus a rotating set of load-flaky framework self-tests. Timeline and video coverage add many proofs; none of them may join that list.
- [ ] 6.3 Confirm the integrity gate passes and that `index.html`, `src/app/app-identity.ts`, and `src/toolcraft/**` are untouched.
- [ ] 6.4 Export a video by hand, play it on a loop, and watch the seam. A packet count matching a duration is not the same claim as a loop that does not jump, and only one of them is checkable by eye.
