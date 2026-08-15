## Context

Two specs describe this change almost completely and neither is built.

`export-pipeline` already requires `Export Video` with `export.video.format`
defaulting to MP4, duration following the runtime timeline, and a fixed 30 FPS
offline schedule. It also requires `exportIntent` to declare video as
`user-requested` **with explicit user-request evidence recorded**. The product
declares `not-requested`, so today the product and its spec disagree; the user's
request is the evidence that settles it.

`animation-system` already requires the transport (`panels.timeline` in
`mode: "playback"`), the loop mathematics (whole cycles per loop, seamless
forward-only loops, LFO modulators quantized to the loop, a global speed
multiplier), and records why keyframes were staged separately: keyframe mode obliges
`timelineCoverage: "keyframes"` acceptance for every keyframe-capable control, which
here is every slider and colour in the panel.

So this change is mostly a build, not a design. What it genuinely has to decide is
**what moves**, and that decision is the one requirement it adds.

## Goals / Non-Goals

**Goals:**

- Video export at MP4, which is what the user asked for and what Instagram takes.
- A loop that reads as a viewer walking past a static work.
- A still that is byte-for-byte what it is today when the timeline sits at zero.

**Non-Goals:**

- Sharing. It cannot be built — see the proposal and upstream issue 12.
- Keyframes. `animation-system` staged them out deliberately and the reason still
  holds.
- `.mov`. The format list is MP4 and WebM; a third would need a runtime encoder.
- Animating the reference or anything else that is not the composition.

## Decisions

### Drift stands for the viewer, and the spec says which parameters those are

**Chosen.** Phase, angle, and pointer reach may drift. Colours, count, separators,
and region may not, by default.

*Why not let anything drift?* Because the technique is the subject. These works hold
still and the colour moves; a loop that changes the inks is a loop of a different
work each frame, which is a screensaver rather than a chromointerference. Making the
distinction a requirement rather than a convention is what keeps the default honest
when the next person adds a drift control.

*Why phase rather than a camera?* There is no camera — the product is a flat field.
Phase is what a viewer's movement actually changes about a banded relief: which part
of each lamella you can see. Angle is the second-order version of the same thing.

### Playback, not keyframes, and the reason is acceptance cost

**Chosen.** `mode: "playback"`, exactly as `animation-system` staged it.

The renderer already reads its values through the timeline evaluator, which returns
raw values while no keyframe groups exist — so nothing in the playback path has to be
rewritten to reach keyframes later. Taking keyframes now would oblige keyframe
coverage for every slider and colour in the panel, which is a change in its own right.

### The export renderer already exists and needs one more input

**Chosen.** `renderStudioExportFrame` already draws a deterministic scene at a given
size. Video adds the timestamp: the runtime drives the 30 FPS schedule and asks for a
frame at each one, and the product resolves drift at that time.

*The pointer needs care here.* The still export was deliberately changed to render at
the at-rest cursor, so two exports of one composition are the same composition. A
video whose subject is the viewer moving needs the pointer to *travel* — but along a
path the loop defines, not wherever the mouse was left. The at-rest rule stands for
stills and the loop supplies the path for video.

### The performance gates are the largest hidden cost

**Chosen.** Face it in the tasks rather than discovering it.

Playback means the renderer runs continuously instead of on edit. The declared
performance paths currently describe discrete control changes and viewport gestures;
a sustained animated path has to be declared and measured, and every workload
dimension the field already has — band count, path vertices, polygon sides, stack
depth — now interacts with a frame budget rather than an edit budget.

## Risks / Trade-offs

**Enabling a timeline obliges the full timeline acceptance recipe** → Duration,
scrub, pause/resume, keyframes, and loop each have a fixed helper and are required
once a timeline exists. There is no partial credit. Budget it as its own task group
rather than as a detail of video export.

**Video export changes the sticky footer's primary action** → `export-pipeline`
requires `Export Video` primary and `Export PNG` secondary. Users who only want
stills get a demoted button. That is the spec's call, not this change's, and it is
worth flagging to the user before it lands.

**A loop that drifts phase will beat against a field that already beats** →
Chromointerference entries have a moiré of their own; drifting phase over one is how
you get a pattern that crawls unpleasantly. The default rate should be slow and the
tasks should look at a moiré entry specifically rather than only at a plain field.

**The still must not change** → Asserted, not assumed: an export at timeline zero is
compared against an export from before drift existed.

## Migration Plan

1. Record the animation intent inventory and flip `exportIntent.video` to
   `user-requested` with the evidence. Nothing renders differently yet.
2. Enable the timeline in playback mode and satisfy the timeline acceptance recipe,
   with no drift declared. The product animates nothing and the transport works.
3. Add drift, one parameter at a time, with the still-unchanged proof standing
   throughout.
4. Enable video export and prove the artifact.

Step 2 is where the acceptance cost lands, and it ships on its own.

## Open Questions

- What is the default loop period? `animation-system` requires
  `defaultDurationSeconds` to equal the declared loop period and the intent to record
  its provenance, so this needs a reason rather than a number.
- Does drift belong to each layer or to the stack? Per-layer is more expressive and
  costs a control per layer; stack-level is one decision and cannot make two layers
  move against each other, which is the interference the technique is about.
- Should the pointer path be declared or implicit? A declared path is another control
  surface; an implicit sweep is one less decision and one less thing to prove.
- Does the reference overlay show during playback, and does it move? It is a guide to
  a still, so probably it holds — but nothing says so yet.
