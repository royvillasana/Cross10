# animation-system Specification

## Purpose
Recorded from the Croix10 change, archived at 110 of 219 tasks.

**Build status is stated per requirement.** Audited against the app on
2026-08-19 (`outstanding` 1.1). The product took the *playback* half of this file
and declined the *keyframes and LFO* half — a decision, not an omission, and the
last requirement here is the reason for it.
## Requirements
### Requirement: Runtime timeline as the animation transport
`panels.timeline` SHALL be enabled and used as the animation transport. An Animation Intent Inventory SHALL be recorded before animation controls are authored. Product code MUST NOT add panel-level Play, Pause, Animate, Restart, or transport controls, and MUST NOT author a product loop-length control.

**Status: satisfied.** The timeline is enabled in `playback` mode and the intent
was recorded *before* any drift control existed — a whole commit that changed no
pixels, which is what "before animation controls are authored" asks for. No
product transport of any kind: no play, pause, restart, or loop-length control.
The Setup `Timeline` switch is the runtime's and shows or hides its panel;
`browser: studio timeline switch is presentation only` proves it changes nothing
else.

The transport SHALL ship in two stages. Stage 3 delivers `mode: "playback"`, which is what parameter drift needs: a loop the runtime owns, over rates the product declares. `mode: "keyframes"` — and every requirement below that names keyframes — lands in a later change, because the framework obliges `timelineCoverage: "keyframes"` acceptance for every keyframe-capable control, which here is every slider and colour in the panel, and that coverage is a change in its own right rather than a detail of this one. Nothing in the playback path has to be rewritten to get there: the renderer already reads its values through the timeline evaluator, which returns raw values while no keyframe groups exist.

#### Scenario: Playback mode is the shipped transport
- **WHEN** the schema is validated
- **THEN** `panels.timeline` declares `mode: "playback"` with `defaultDurationSeconds` equal to the declared loop period
- **AND** `appTransferMode.animationIntent` declares `timeline-playback` with that same period and its provenance

#### Scenario: Transport is runtime-owned
- **WHEN** the app renders
- **THEN** playback, scrubbing, duration, and loop UI appear only in the top Toolcraft timeline

#### Scenario: Timeline switch is presentation only
- **WHEN** the user toggles the runtime `Timeline` switch in Setup
- **THEN** the timeline changes between compact Play-only and extended presentation
- **AND** playback state, keyframes, product values, and export behavior are unchanged

### Requirement: Keyframes over any animatable parameter
Any parameter declared animatable SHALL be keyframeable, with segment interpolation editable through the runtime curve UI. Renderers SHALL read keyframed values through Toolcraft evaluated-value helpers and hooks. Product code MUST NOT parse timeline `valueLabel` strings or read raw `state.values` for keyframed targets.

**Status: not applicable — no parameter is keyframed.** The timeline is
`mode: "playback"` rather than keyframes, so there are no tracks, no curve UI and
no evaluated values to read. The prohibitions hold vacuously and would hold
anyway: nothing parses a `valueLabel`.

The next requirement explains why keyframes were not taken, and it is worth
reading before adding them.

#### Scenario: Keyframing an arbitrary parameter
- **WHEN** the user adds keyframes to the stripe angle at two times with different values
- **THEN** playback interpolates between them and the canvas updates each frame

#### Scenario: Renderer reads evaluated values
- **WHEN** the renderer resolves a keyframed parameter for the current frame
- **THEN** it uses the evaluated-value helper rather than the raw state value

#### Scenario: Editing a selected keyframe
- **WHEN** a keyframe point is selected and the user edits that parameter
- **THEN** the selected point is updated rather than a new point created, unless the user explicitly adds one

#### Scenario: Multiple tracks play together
- **WHEN** tracks exist on viewing angle, cycling offset, and second-layer phase simultaneously
- **THEN** all three parameters change together across sampled timeline times

### Requirement: Keyframeable is opt-out and classified
Every schema target SHALL be classified as a genuine animation target or not, and everything that is not SHALL declare `keyframeable: false` — seeds, mode and engine and tool selectors, sampling resolution, section locks, export format and resolution selects, palette cardinality, and the shader hook source. The classification SHALL be recorded, because keyframe acceptance coverage is required for every inferred keyframe-capable control.

**Status: not applicable, but the classification exists in stronger form.** No
control declares `keyframeable: false`, because with no keyframe mode there is
nothing to opt out of and the framework infers no keyframe-capable controls.

What this requirement is really asking — *decide, per property, whether it should
move* — was answered and is enforced. `studio-motion.ts` names the properties a
loop may never move (colours, band count, separators, region) and a unit test
fails if a drift control is ever offered over any of them. That is the same
classification with teeth, arrived at from the other direction.

#### Scenario: Non-animation targets are excluded
- **WHEN** the schema is validated
- **THEN** every target not in the recorded animation-target classification declares `keyframeable: false`
- **AND** no keyframe coverage is inferred for it

#### Scenario: Animation targets remain keyframeable
- **WHEN** a recorded animation target is inspected in the timeline
- **THEN** it exposes a keyframe row and its keyframes drive product output

### Requirement: Loop time from the runtime timeline
Playback renderers SHALL derive time from `getToolcraftTimelineLoopTime` or `getToolcraftTimelineLoopProgress`. Local wall-clock reads and fixed-duration phase math MUST NOT appear in the render path. Noise used for jitter and glitch SHALL be seeded from the declared seed plus that loop time.

**Status: satisfied.** Loop position comes from
`getToolcraftTimelineLoopProgress`; there is no `Date.now`, no
`performance.now`, and no local `%` anywhere in the render path. A hand-rolled
version existed briefly and was replaced for the reason the contract gives —
hand-rolled phase is how reverse and yoyo playback get invented by accident.

The noise clause is unmet in letter and moot in practice: jitter is seeded from
its own variation control rather than from the loop, because jitter does not
drift. If it ever does, the seed has to include loop time or the field will
re-scatter every frame.

#### Scenario: No wall clock in the render path
- **WHEN** the renderer computes a frame
- **THEN** its time input comes from the runtime loop-time helper and no `performance.now` or `Date` read occurs in that path

#### Scenario: Deterministic scrubbing
- **WHEN** the user scrubs away from a timeline time and back to it
- **THEN** the rendered frame is identical to the frame first shown at that time

### Requirement: Seamless forward-only loops
Loops SHALL be seamless forward-only cycles: first and last frames stitch and direction never reverses. Mirror, yoyo, and ping-pong behavior SHALL NOT be implemented without explicit user intent. `panels.timeline.defaultDurationSeconds` SHALL be set to the product-derived loop period with recorded evidence rather than left at the framework fallback.

**Status: satisfied, and this is the most-proved claim in the product.** The
duration is `STUDIO_LOOP_SECONDS`, derived rather than defaulted, with the
reasoning recorded where the constant is: under about four seconds a phase drift
reads as flicker rather than travel, over about eight it stops reading as a
single pass.

Forward-only and seamless are proved three ways — the preview seam closes, it
closes on a *beating* field at an incommensurate pitch where a pattern would
otherwise crawl, and the exported file carries exactly one duration's worth of
frames so it does not hold both ends of the loop and hitch once per cycle. No
mirror, yoyo or ping-pong exists.

#### Scenario: Loop boundary is seamless
- **WHEN** playback crosses the loop boundary
- **THEN** motion continues with no visible jump and the frame at loop end matches the frame at loop start

#### Scenario: Direction never reverses
- **WHEN** playback runs continuously
- **THEN** every parameter advances forward through the cycle and no reverse segment occurs

#### Scenario: Duration edits keep the design stable
- **WHEN** the user edits timeline duration
- **THEN** the loop length changes while animation settings and the scene design remain stable, and the loop stays seamless and forward-only

### Requirement: Parameter drift as whole cycles per loop
Motion that advances a parameter over the loop SHALL be declared as a whole number of cycles per loop, over an integer control domain, so that every reachable rate stitches at the seam by construction. A drift rate of zero SHALL render identically at every instant of the loop. A drifting parameter SHALL remain within its own declared range. The rate SHALL NOT be expressed as a continuous speed that then has to be quantized at evaluation time and reported back to the user.

**Status: satisfied, clause by clause.** `Travel per loop` and `Turns per loop`
are discrete integer sliders — whole cycles, never a speed, so nothing is
quantized behind the author's back.

Zero renders identically at every instant, and that is asserted rather than
assumed: an undrifted composition is pinned to loop zero so its scene is
byte-identical frame to frame, and an export at timeline zero is byte-identical
to one taken before drift existed. Both were verified against deliberately
broken code.

"Remains within its own declared range" is the clause that caught a real defect.
The gradient's drift translated a ramp that has an end, so a layer went black
mid-loop while its seam still closed — invisible to every single-layer proof.
The drift now wraps; the author's own Offset still translates.

The two motions this delivers are the travelling moiré — the second interference layer advancing whole sequence periods, where a sequence period is the least common multiple of the palette length and the two-band width alternation — and the drifting Chromosaturation wash, whose transition centre sweeps sinusoidally and so closes on itself at every whole cycle.

#### Scenario: A drifting parameter closes the loop
- **WHEN** any drift rate is set and the field is sampled at the loop's first and last instant
- **THEN** the two renders are byte-identical in the backing buffer

#### Scenario: Zero is static rather than slow
- **WHEN** a drift rate is zero and the playhead is moved to any other time
- **THEN** the rendered field is byte-identical to the field at time zero

#### Scenario: Drift stays inside the declared range
- **WHEN** a drifting parameter is evaluated at any point in the loop
- **THEN** its value lies within the minimum and maximum its own control declares

### Requirement: LFO modulators quantized to the loop
Sine, triangle, and periodic-noise LFOs SHALL be assignable to any animatable parameter, each with rate, amplitude, phase, and offset. Effective rate SHALL be quantized at evaluation time to a whole number of cycles within the timeline duration, with a minimum of one. The user's requested rate SHALL be preserved in state while the quantized value is displayed.

**Status: pending — not built, and superseded in intent.** There is no LFO.
What this requirement wants — periodic motion that cannot break the seam — is
what whole-cycle drift already guarantees, by construction rather than by
quantizing at evaluation time and reporting a different number back to the
author. The requirement above says a rate must not work that way; this one
describes a mechanism that does.

Sine and triangle *shapes* are genuinely absent: drift is linear, so a viewer
passes at constant speed rather than easing. That is the part worth building if
anyone wants it. Carried as `outstanding` 1a.13.

#### Scenario: Sine LFO on viewing angle
- **WHEN** a slow sine LFO is assigned to the viewing angle
- **THEN** the composition sweeps continuously through its color states as the angle oscillates

#### Scenario: Noise LFO loops
- **WHEN** a noise LFO is active
- **THEN** its signal is periodic over the timeline duration so the loop remains seamless

#### Scenario: Rate quantization preserves the request
- **WHEN** the user sets a rate that would not complete a whole cycle in the duration
- **THEN** the evaluated rate is quantized to the nearest whole-cycle value, the stored value remains the user's, and the control surfaces the quantized result

#### Scenario: LFO combined with keyframes
- **WHEN** a parameter has both a keyframe track and an assigned LFO
- **THEN** the rendered value is the keyframed value modulated by the LFO, clamped to the declared range

#### Scenario: Requantization after a duration edit
- **WHEN** the user changes timeline duration while an LFO is active
- **THEN** the effective rate requantizes to the new duration and the loop remains seamless

### Requirement: Global speed as a whole-cycle multiplier
Global speed SHALL multiply each LFO's whole-cycle count within the timeline duration rather than scaling time, because continuous time scaling would split the loop seam. It SHALL be a `sliderValueKind: "discrete"` slider over an integer domain, and loops SHALL remain seamless at every reachable value. A continuous speed multiplier MUST NOT be offered.

**Status: not applicable, and its prohibition is honoured.** No global speed
exists because there are no LFOs to multiply. The part that matters — no
continuous speed multiplier anywhere — is true, and the per-layer drift rates are
exactly the discrete integer sliders this describes.

#### Scenario: Doubling speed doubles cycles
- **WHEN** global speed is set to 2
- **THEN** every LFO completes twice as many whole cycles within the same timeline duration, with relative phase relationships preserved

#### Scenario: Every reachable speed loops seamlessly
- **WHEN** playback crosses the loop boundary at any reachable speed value
- **THEN** the frame at loop end matches the frame at loop start

#### Scenario: Speed is independent of loop length
- **WHEN** the user changes global speed
- **THEN** the timeline duration is unchanged, and motion becomes faster within the same loop

#### Scenario: No continuous speed control
- **WHEN** the motion controls are inspected
- **THEN** the speed control has an integer domain with markers and no fractional value is reachable

### Requirement: A loop is the viewer moving, not the work changing
A Croix10 loop SHALL animate the parameters that stand for a viewer's movement past
a fixed work, and SHALL NOT animate the properties that constitute the work itself.

**Status: satisfied, and it is the reason for half the decisions above.** Drift
moves phase and angle — where you are along the work and which direction you read
it from. Colours, band count, separators and region are refused, and the refusal
is enforced by a test rather than left to judgement.

The browser proof for this is the one that had to be rewritten honestly. It first
asserted the *palette* was unchanged mid-loop, which is false and should be: what
lies between the bands is induced colour, and in a chromointerference it moves
because that movement is the phenomenon. The claim is now made where it is true —
the stored composition is untouched by scrubbing, and the frame mid-loop is
exactly the frame the author would have got by setting Offset there by hand.

Phase, angle, and the pointer's position are the first kind: a body walking past a
banded relief sees its phase shift, its apparent angle change, and the induced
colour travel. Those SHALL be available to drift.

A layer's inks, its band count, its separators, and its region SHALL NOT drift by
default, because a field whose colours change is a different field rather than the
same one seen from elsewhere — and the whole subject of these techniques is that the
work is static and the colour is not.

A product MAY offer drift over a property of the work when an author asks for it
explicitly, but the default SHALL be the viewer's movement, and the distinction
SHALL be stated wherever drift is configured so an author knows which they are
choosing.

#### Scenario: Movement parameters may drift
- **WHEN** a layer's drift is configured
- **THEN** phase, angle, and pointer reach can each be given a whole-cycle rate

#### Scenario: The work's own properties hold still by default
- **WHEN** a layer is animated with no explicit request to the contrary
- **THEN** its colours, band count, separators, and region are unchanged across the loop
- **AND** only the movement parameters differ between frames

#### Scenario: A still frame is unchanged by the feature existing
- **WHEN** the timeline sits at the start of the loop
- **THEN** the composition renders exactly as it did before drift was available
- **AND** an exported still is identical to the one the same composition produced before

#### Scenario: The distinction is legible where drift is set
- **WHEN** drift is configured
- **THEN** the surface distinguishes a parameter that moves the viewer from one that changes the work

