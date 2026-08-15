# The work moves, and leaves as a video

## Why

The product exports a still. The works it is built in the tradition of are not
still — their subject is a viewer walking past, and the colour that appears is the
one their movement makes. A PNG of a chromointerference field is a photograph of an
event, not the event.

The user has now asked for video export, which is the evidence `export-pipeline`
has been waiting for: it requires `exportIntent` to declare video as
`user-requested` **with the explicit user-request evidence recorded**, and the
product currently declares `not-requested`. The spec and the product disagree, and
the user's request settles which one is wrong.

Two specs already describe all of this and neither is built. `export-pipeline`
requires `Export Video` with `export.video.format` defaulting to MP4, and
`animation-system` requires a runtime timeline in playback mode with parameter
drift quantized to whole cycles per loop. This change builds them.

## What Changes

- **`exportIntent.video` becomes `user-requested`**, with this request recorded as
  its evidence. **BREAKING** for the export surface: `Video Export` appears, and
  `Export Video` becomes the primary sticky action with `Export PNG` secondary,
  which is the layout `export-pipeline` already specifies.

- **The runtime timeline is enabled in playback mode.** Product code authors no
  transport — no play, pause, restart, or loop-length control — because the runtime
  owns all of it.

- **Layers drift.** Each layer declares which of its parameters move and how many
  whole cycles they complete per loop, so a loop's last frame meets its first with
  no jump.

- **What drifts is chosen to stand for the viewer, not for the artwork.** Phase,
  angle, and the pointer's reach are movements a body walking past a static work
  produces. Colour and count are properties of the work itself and SHALL NOT drift
  by default, because a work whose inks change is a different work rather than the
  same one seen from elsewhere.

- **Sharing to a social network is not included, because it cannot be built.** See
  Impact.

## Capabilities

### New Capabilities

_None._ Everything here is already specified; what is missing is the build.

### Modified Capabilities

- `animation-system`: gains one requirement — what a Croix10 loop is a loop *of*,
  and which parameters may drift by default. The transport, the loop mathematics,
  and the quantization are already specified and unchanged.

## Impact

**Sharing cannot be built and is not proposed.** `export-pipeline` requires that
product code "MUST NOT allocate export canvases, call `toBlob` or `toDataURL`,
create object URLs, download artifacts, instantiate `MediaRecorder` or
`VideoEncoder`, call `canvas.captureStream()`, or import an encoder library", and
the runtime hands the product no completion callback, no blob, and no filename —
the encoded artifact never reaches product code at all. There is no
`navigator.share` in the runtime either. A share button would have nothing to
share. Recorded as upstream issue 12, with a suggested hand-off that would make it
possible. Until then a user exports the file and shares it themselves, which on a
phone is two taps.

**MP4 is available; `.mov` is not.** `export.video.format` is specified with exactly
two options, MP4 and WebM. MP4 is the default and is what Instagram accepts, so the
request is met; `.mov` would need a runtime encoder that does not exist.

**Every slider becomes a workload dimension.** Playback means the renderer runs
continuously rather than on edit, so the performance gates that currently measure
discrete control changes gain a sustained path. This is the largest hidden cost in
the change and is the reason `animation-system` staged keyframes separately.

**Product code.** `app-schema.ts` (timeline panel, video export section);
`app-acceptance-data.ts` (`exportIntent`, `animationIntent` and its inventory);
`studio-export-sections.ts` (the video settings and the action roles);
`studio-layers.ts` and the scene builder (drift rates as uniforms);
`app-composition.tsx` (the export renderer already draws frames and needs the
timeline's timestamp).

**Tests.** Timeline acceptance is a fixed recipe — duration, scrub, pause/resume,
keyframes, loop — and every one is required once a timeline exists. Video export
adds artifact proofs: duration and packet count match the timeline, the last frame
meets the first, and the background survives.

**Not affected.** The preset library, the reference, the delivered shader, and the
still export. A composition at rest renders exactly as it does today.

**Framework.** No runtime changes. `src/toolcraft/**` stays signed and untouched, as
do `index.html` and `src/app/app-identity.ts`.
