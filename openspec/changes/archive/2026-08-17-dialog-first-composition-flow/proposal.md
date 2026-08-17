# The work starts in a dialog, not in a sidebar

> **Unblocked by decision, not by discovery.** Group 1's gate failed as written: no
> decision contract permits a product modal, and upstream issue 14 records why. The
> product owner, told that, instructed that it be built regardless. So it is, in
> product code, using the runtime's own Dialog composite — which the boundary does
> permit importing — with the framework untouched and the integrity gate green.
>
> The deviation is recorded at the top of `studio-onboarding.ts` rather than buried
> here. It is a contract judgement, which can be revisited; the alternative on the
> table was editing signed framework source, which cannot.

## Why

The product opens on an empty canvas and a sidebar of nineteen sections. Everything
that decides what an author is about to make — which technique they are working in,
what to aim at, how big the canvas is — is buried in that sidebar at equal weight
with the controls that come after those decisions. A first-time user meets a wall of
inputs and no starting point.

The order is also wrong. Canvas size is chosen after the composition exists, so
changing it reflows work already done; the reference sits below the gallery even
though it is what you pick *before* you build; and the gallery, its aim, and the
restore action occupy three sidebar sections that are only touched at the beginning
and the end of a session.

## What Changes

- **The product opens on a dialog, not on the sidebar.** The first thing a user
  meets is the technique thumbnails as cards, plus a way to start from nothing.
  Choosing a card, or choosing a blank canvas, is what begins a session.

- **Canvas setup is a step in that flow, before the canvas exists.** Aspect ratio,
  width and height, resolution scale, and background are chosen once and confirmed,
  and only then does the author land on a canvas. Choosing them after the fact is
  what makes them feel like settings rather than decisions.

- **The gallery, the reference, and the restore action leave the sidebar.**
  **BREAKING** for the control surface: `Gallery`, `Chosen composition`,
  `Previous Stack`, `Reference`, and `Reference View` are removed as sections, and
  their targets move behind dialogs opened from the surfaces that own them.

- **A layer's own composition is applied from that layer.** Rather than selecting a
  layer and then aiming a sidebar control at it, the author opens a layer's settings
  and applies a composition there. **This depends on a framework capability that
  does not exist** — see Impact.

- **A layer can be duplicated from its row.** The product already has the operation;
  it is a sidebar button rather than a row action. **Same dependency.**

## Capabilities

### New Capabilities

- `composition-onboarding`: what a user meets when the product opens, the steps
  between opening it and having a canvas, and the guarantee that no work is
  destroyed or invented by that flow.

### Modified Capabilities

- `toolcraft-app-shell`: the control-surface inventory changes shape — sections are
  removed rather than re-cut, and the rule that every product control lives in a
  declared panel section has to account for controls that live in a dialog instead.
- `scene-presets`: the library is still the library, but the surface that offers it
  is a dialog rather than a panel section, and it is offered at two different moments
  (starting a session, and restyling one layer) rather than one.
- `reference-image`: same move — the reference is chosen in a dialog rather than in
  a panel section.
- `engine-application`: the aim moves from a sidebar select to the surface the author
  opened it from, so what an application targets is decided by *where* it was
  started rather than by a separate control.
`shader-authoring` is deliberately **not** listed. Layer-row actions would change
it, and they cannot be built — writing a requirement this change is unable to
satisfy would make the change un-completable and the spec a wish. It is carried as
a blocked task instead.

## Impact

**A framework capability is missing and two of these depend on it.**
`src/toolcraft/runtime/react/layers/layers-panel-row.tsx` hardcodes exactly two row
actions — visibility and delete — with no product extension point, and
`shader-authoring` currently requires that product code MUST NOT author its own
layer list or its controls. The duplicate icon and the gear icon cannot be built
until the runtime offers per-row product actions. This is recorded as an upstream
issue alongside the ten already filed, and the change should land its dialog work
without them rather than wait.

**The dialog itself is available, contrary to an earlier finding.** The
`engine-targeting-and-control-ia` design recorded that "the runtime's `dialog` and
`alert-dialog` composites are internal and reach no product surface". That was
wrong: the product-boundary policy bans `@/toolcraft/ui` and
`@/toolcraft/ui/components/controls/**`, and the dialog composite is under
`components/composites/**`, which is not banned. A custom control renderer is a
supported extension point and may own a dialog. The confirmation step built on that
earlier finding — two presses instead of a modal — should be revisited.

**Product code.** A new onboarding module and its dialog; `app-schema.ts` (five
sections removed, a custom control added); `app-acceptance-data.ts` and
`studio-acceptance-rows.ts` (rows removed, rows added, `builtInFitCheck` authored);
`studio-gallery-sections.ts` and `studio-reference-sections.ts` (deleted or reduced);
`app-composition.tsx` (the flow's commands).

**Tests.** Every acceptance row for a removed control goes with it, and its browser
proof with it. New proofs: the dialog is what opens, a session cannot start without
passing through it, declining the setup step leaves no canvas half-made, and the
existing guarantees — applying is revertible, the reference reaches no artifact —
survive the move to a dialog.

**Not affected.** The renderer, the layer stack, the preset library's contents, and
the delivered shader. This changes where decisions are made, not what they produce.

**Framework.** No runtime changes. `src/toolcraft/**` stays signed and untouched, as
do `index.html` and `src/app/app-identity.ts`.
