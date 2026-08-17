## Context

The product's control surface currently opens with nineteen sections, five of which
exist only to start or end a session: `Gallery`, `Chosen composition`,
`Previous Stack`, `Reference`, and `Reference View`. Everything a user decides
*before* building sits beside everything they use *while* building, at the same
weight, in the same column.

**What was believed impossible and is not.** `engine-targeting-and-control-ia`
recorded: *"The requested shape was a large dialogue of cards shown before work
begins. That specific shape is not available … the runtime's `dialog` and
`alert-dialog` composites are internal and reach no product surface."* Re-checked
against the enforcement rather than the prose:

- `scripts/toolcraft-product-boundary-module-policy.mjs:89-97` bans exactly two
  things — the bare `@/toolcraft/ui` entry and anything under
  `@/toolcraft/ui/components/controls/**`.
- `src/toolcraft/ui/components/composites/dialog.tsx:270` exports `Dialog` and its
  parts, and `composites/**` appears in no ban.
- `decision-contracts.ts:61` lists `controlRenderers` as a *supported* extension
  point for true custom controls.
- `component-contracts.media-custom.ts:129` forbids custom controls that recreate
  "built-in controls, runtime panels, toolbar, timeline, layers, canvas, or sticky
  panel actions". A dialog is none of those.

So the modal the user asked for twice is buildable. The earlier finding was drawn
from a contract sentence about *panels* and generalised to dialogs.

**What is genuinely blocked.** `src/toolcraft/runtime/react/layers/layers-panel-row.tsx`
renders exactly two row actions, at lines 262 and 277 — hide/show and delete — with
no product hook. `shader-authoring` also states product code MUST NOT author its own
layer list or its controls. A duplicate icon and a gear icon on a layer row cannot be
built from the product side at all.

**A dialog is also the only surface a phone can use.** The panels are floating,
draggable, viewport-snapped surfaces with no breakpoint anywhere in their path, and
`ToolcraftAssemblySchema.panels` takes four enable flags and nothing about placement,
order, or size. At 386px the Controls panel sits off-screen and the canvas measures
`left: -384.8`. A product cannot fix that — but a dialog is full-screen by nature, so
every decision this change moves into one is a decision that becomes reachable on a
phone. That is a side effect worth naming, not a substitute: the editor itself stays
unusable at that width until the runtime grows a stacked layout (upstream issue 11).

## Goals / Non-Goals

**Goals:**

- The first thing a user meets is what they could make, not a column of inputs.
- The canvas is sized before it exists, not reflowed after.
- Controls that decide what to make leave the panel; controls that shape what was
  made stay.
- An application's target comes from where it was started, not from a separate aim.

**Non-Goals:**

- Layer-row actions. Blocked upstream; carried as a task that records the block.
- Changing the preset library's contents, the renderer, or the delivered shader.
- Re-opening the reference's own compromise. It stays a built-in study, per the
  decision taken in `reference-image-and-artwork-presets`.
- A tour, tips, or any first-run teaching beyond showing the work itself.
- Fixing the editor on small screens. The dialog helps because it is full-screen;
  the panel layout behind it is runtime-owned and out of reach.
- Moving export into a dialog. `panelActions` is contracted for sticky-footer actions
  and `defineToolcraft` hoists it there automatically, so only the format and
  resolution selects could move — splitting one action across two surfaces, which is
  worse than leaving it. Recorded as upstream issue 12.

## Decisions

### The dialog is a custom control renderer, not a new shell surface

**Chosen.** Register one custom control through `controlRenderers`, whose renderer
owns a `Dialog` from `components/composites`, and whose schema target holds *which
step the flow is on*.

*Why a control rather than `canvasContent`?* The canvas surface is bounded product
output and is the wrong owner for something that must cover the app and exist before
a canvas does. A control has a value, and the flow's state — closed, choosing,
setting up — is a value.

*Why not a runtime panel?* Product code may not author one. That half of the earlier
finding was correct and stands.

**The `builtInFitCheck` has to be honest, and the honest argument is narrow.** The
card grid is close to `imagePicker` and the step buttons are close to `actions`; if
the fit check claimed those were insufficient it would be claiming something false.
What no built-in represents is a *sequence of decisions taken before work exists*,
rendered over the app and gating entry. `capabilities` is `custom-interaction`, and
`whyInsufficient` names modality and sequencing rather than layout or styling — the
contract explicitly rejects icons, layout, compactness and custom buttons as
justification.

### Setup writes the runtime's own targets, and cannot remove them from the panel

**Chosen.** The setup step dispatches against `canvas.aspectRatio`, the canvas size
targets, `canvas.renderScale`, `appearance.background`, and `export.includeBackground`.

*The consequence to state plainly:* those are **runtime Setup** targets, placed by
the runtime in the Setup section, and the product cannot remove them from the panel.
The user asked for these not to appear in the sidebar afterwards. What this change
can deliver is that they are *decided* in the flow and *duplicated* in Setup — not
that they disappear. Anything stronger needs a runtime capability to suppress the
Setup section, which does not exist. Recorded as an open question and an upstream
note rather than quietly delivered as less than was asked.

Product-owned sections *can* be removed, and are: all five of them.

### The aim is inferred from the surface, not set by a control

**Chosen.** Delete `gallery.target`. An application started from the layer settings
targets that layer; one started from a group targets that group; one started from the
onboarding flow targets the canvas.

*Why this is better than the aim control it replaces*: the aim was a value that had
to be read, set, and remembered before a press, and it made the destructive press and
the additive press neighbours under one label. Starting from a place carries the
target with no state to get wrong. It also deletes the applicability machinery that
gated the two presses on it — and with it eight evidence obligations.

*What is lost*: applying to "the pictures" as a set. That target had no surface to be
started from, and no user asked for it. It goes.

### The confirmation becomes a real one

**Chosen.** The two-press confirmation exists only because there was no modal. There
is one now, so a technique change over existing work asks in a dialog, and
`gallery.actions`'s three-button arrangement is retired.

The revert stays exactly as it is. Confirmation and revertibility answer different
failures, which is the reasoning `engine-application` already carries.

### Layer-row actions are proposed upstream, not worked around

**Chosen.** File the runtime gap, build nothing in its place.

*Why not approximate it?* The approximations are all worse than the current state: a
product-authored row list is forbidden outright; a per-layer control in the panel is
what this change is removing; and a gear that opens a dialog from *somewhere else*
than the row is not what was asked for and would leave two ways to do one thing. The
existing `stack.actions` duplicate button keeps working meanwhile.

## Risks / Trade-offs

**A dialog that blocks the app is worse than a sidebar** → It is dismissable, and
dismissing leaves the product usable rather than blank. The spec carries that as a
scenario rather than leaving it to judgement.

**Removing five sections deletes their acceptance rows and browser proofs** → The
guarantees they protected do not go with them. Applying is revertible, the reference
reaches no artifact, and the library covers eight series — each keeps a proof, moved
to the surface that now owns it. The task list names them one by one so a deletion
cannot quietly take a guarantee with it.

**The custom control's fit check is the likeliest thing to fail review** → It is
written against modality and sequencing, which no built-in has, rather than against
appearance, which the contract rejects. If it fails, the honest response is that the
flow cannot be built, not a rewording.

**Setup targets stay in the panel** → Stated above rather than hidden. The user asked
for them to leave; half of that is not expressible.

**The onboarding value is persisted, so a returning user meets the dialog again** →
The flow keys off whether work exists, not off a "seen it" flag. A user with a
composition lands on their composition; a user with an empty canvas is a user who has
not started.

## Migration Plan

1. Land the custom control and the dialog with the flow reading and writing existing
   targets, while the five sections still exist. Nothing is removed yet, so the app
   is never half-migrated.
2. Move the technique and reference choices into it, and prove the moved guarantees.
3. Remove the five sections, their rows, and their proofs in one step.
4. Delete `gallery.target` and the applicability it gated; re-aim the application
   proofs at the surfaces that start them.
5. File the layer-row gap upstream.

Steps 1–2 are independently shippable. Step 3 is the breaking one.

## Open Questions

- Can the runtime Setup section be suppressed or reordered by a product? If it can,
  the setup step stops being a duplicate. If not, this ships as a duplicate and the
  gap is upstream.
- Does the flow key off "no layers" or off an explicit session marker? "No layers" is
  simpler and needs no new state, but an author who deletes every layer mid-session
  would meet the dialog again.
- Should the per-layer application live in the layer's own dialog once row actions
  exist, or in a dialog opened from the selected layer meanwhile? The second is
  buildable now; the first is what was asked for.
- Does the technique's own proportion pre-fill canvas size, and what does it pre-fill
  for "start from nothing"?
