# animation-system Specification

## Purpose
Recorded from the Croix10 change, archived at 110 of 219 tasks.

**Build status here is not audited.** Unlike `shader-authoring` and
`shader-delivery`, no requirement in this file has been checked against the
Croix10 app in this pass, so it states intent rather than confirmed behaviour.
Auditing them is carried as a task in the `outstanding` change; until that is
done, treat every requirement below as a claim to verify rather than one to
rely on.
## Requirements
### Requirement: Runtime timeline as the animation transport
`panels.timeline` SHALL be enabled and used as the animation transport. An Animation Intent Inventory SHALL be recorded before animation controls are authored. Product code MUST NOT add panel-level Play, Pause, Animate, Restart, or transport controls, and MUST NOT author a product loop-length control.

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

#### Scenario: Non-animation targets are excluded
- **WHEN** the schema is validated
- **THEN** every target not in the recorded animation-target classification declares `keyframeable: false`
- **AND** no keyframe coverage is inferred for it

#### Scenario: Animation targets remain keyframeable
- **WHEN** a recorded animation target is inspected in the timeline
- **THEN** it exposes a keyframe row and its keyframes drive product output

### Requirement: Loop time from the runtime timeline
Playback renderers SHALL derive time from `getToolcraftTimelineLoopTime` or `getToolcraftTimelineLoopProgress`. Local wall-clock reads and fixed-duration phase math MUST NOT appear in the render path. Noise used for jitter and glitch SHALL be seeded from the declared seed plus that loop time.

#### Scenario: No wall clock in the render path
- **WHEN** the renderer computes a frame
- **THEN** its time input comes from the runtime loop-time helper and no `performance.now` or `Date` read occurs in that path

#### Scenario: Deterministic scrubbing
- **WHEN** the user scrubs away from a timeline time and back to it
- **THEN** the rendered frame is identical to the frame first shown at that time

### Requirement: Seamless forward-only loops
Loops SHALL be seamless forward-only cycles: first and last frames stitch and direction never reverses. Mirror, yoyo, and ping-pong behavior SHALL NOT be implemented without explicit user intent. `panels.timeline.defaultDurationSeconds` SHALL be set to the product-derived loop period with recorded evidence rather than left at the framework fallback.

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

