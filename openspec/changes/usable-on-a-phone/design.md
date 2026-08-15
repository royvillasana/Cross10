## Context

Measured on the deployed site at a 386px viewport: the product output canvas reports
`getBoundingClientRect().left === -384.8` and the Controls panel is not on screen.
There is no gesture that brings it back, because the panel is positioned outside the
draggable area.

The runtime has no breakpoint. The only `matchMedia` calls in it are for colour scheme
and reduced motion, and `timeline-panel-responsive-layout.ts` — the one file that
sounds like an exception — is collision avoidance between panels, not a layout.

## Goals / Non-Goals

**Goals:**

- Every panel reachable at any width the product opens in.
- A narrow viewport that starts collapsed, so the surface can be scanned.
- The canvas visible when no panel is open.
- The user's own arrangement respected permanently once they make one.

**Non-Goals:**

- The requested layout. Canvas above and panels stacked below cannot be built; see
  Decisions.
- A product-authored mobile control surface. Forbidden; see Decisions.
- Touch gestures, pinch zoom, or anything else about *interacting* on a phone. This
  change is about reaching the controls, not about using them well once reached.

## Decisions

### Use the panel commands, because they are published and this is what they are for

**Chosen.** `panels.setOffset`, `panels.resetOffset`, `panels.setHidden`, and
`panels.setSectionCollapsed` are all in `ToolcraftCommand`, and "runtime commands" is
a listed supported extension point.

This is the whole mechanism. No new surface, no styling of runtime DOM, no duplicated
control, and nothing that breaks when the runtime's internals change.

### The requested layout is two constants away, and neither is ours

**Rejected, with the reason recorded.** `panel-host-config.ts` declares:

```ts
controls: { snapEdges: ["left", "right"], stageClassName: "min-h-[560px]" },
layers:   { snapEdges: ["left", "right"], stageClassName: "min-h-[560px]" },
```

The two panels a phone needs at the bottom are the only two that may not snap there —
`timeline` and `toolbar` both already allow `["top", "bottom"]`. And a 560px floor
means a panel covers most of an 800px viewport, so canvas-above-panels-below does not
fit even if the snap were permitted.

`panels.update` takes `{ collapsed, extended, hidden, offset, snapEdge }` and no size,
so the floor cannot be relaxed from the product either.

Upstream issue 11 asks for exactly these two: `"bottom"` added to those snap edges,
and the floor made a viewport-relative clamp.

### Hiding the panels and drawing our own is rejected, and the reasoning is kept

**Rejected.** The proposal was: detect a narrow viewport, hide the runtime panels with
a media query, and render product-authored mobile controls instead.

*Three of the four steps are actually fine*, which is why it is worth writing down
rather than dismissing. Viewport detection is trivial. Hiding is mechanically
available — `src/styles.css` is product-owned and unprotected, and the panels carry
stable `data-toolcraft-controls-panel-shell`, `data-toolcraft-layers-panel`, and
`data-panel-type` hooks. Rendering full-viewport interactive product UI is already
done in this product: `StudioRegionHandles` is `position: fixed; inset: 0`, is
interactive, and passes every gate today.

*The fourth step is the whole point and it is forbidden three times over.*

- `decision-contracts.ts:78` — the canvas carries "real product result, source
  material, renderer output derived from current state, and valid product editing
  handles". A stack of sliders and a layer list is none of those. A *handle* is a
  direct-manipulation affordance on the artwork; a control surface is not one.
- `component-contracts.media-custom.ts:129` and `:143` — a custom control may not
  recreate built-in controls, runtime panels, the layers panel, or the canvas, and the
  ban names Slider, Select, Color, ImagePicker and the rest individually.
- `toolcraft-app-shell` — "Each product control target SHALL appear exactly once" in
  an inventory validated statically, with no viewport in scope. "This copy only exists
  below 760px" is not something the inventory can express, so a mobile duplicate of
  every control is a second declaration of every target.

Beyond the rules, it would double the acceptance surface: every duplicated control
needs its own row, its own browser proof, and its own applicability, and the two
copies would drift.

**What survives from the idea.** The permitted version of "mobile handlers" is canvas
*handles* — and that is already this product's established pattern. Shape geometry
moved from four sliders to canvas handles under an `interactionOwnership` entry that
records why. Extending handles to cover more of the common edits is legitimate, works
at any viewport because the product positions them itself, and needs no duplication —
because a handle *replaces* a control rather than copying it. It is a separate change,
and it does not make colours, layer kind, or export reachable.

### Apply once, then never again

**Chosen.** The adjustments run on load, at a narrow viewport, and only while the user
has not arranged anything themselves.

Panel state is persisted, so a product that re-applied on every load would undo the
user's own arrangement every time they returned — which is the failure mode that makes
opinionated layouts hated. A single marker recording "the user has taken over" is
enough, and it is set by the first panel move, hide, collapse, or expand.

## Risks / Trade-offs

**It reads as a fix and is not one** → The proposal says so explicitly and this design
repeats it. The canvas will not be more than half the screen with a panel open. The
honest claim is "reachable", not "good".

**The threshold is a guess** → 760px was the number asked for and is a reasonable
tablet-portrait boundary, but it should be checked against the panel's actual width
rather than kept because it was suggested. If a panel needs 360px and a canvas needs
360px, the real boundary is where those stop fitting side by side.

**Detecting "the user has taken over" is the fiddly part** → Panel state arrives from
persistence and from the user identically. The marker has to be set by the interaction
rather than inferred from the state, or a restored session looks like a user
preference and a genuine preference looks like a restore.

**One panel at a time is a real loss on a tablet** → At 760px both may well fit. The
threshold for hiding one should be lower than the threshold for collapsing sections
rather than shared out of convenience.

## Open Questions

- Where is the real boundary — measured from panel width plus a usable canvas, rather
  than taken from the request?
- Should the two thresholds differ: collapse sections below one width, hide a panel
  below a narrower one?
- Does the onboarding dialog from `dialog-first-composition-flow` change the answer?
  It is full-screen by nature, so on a phone it may be the primary surface and the
  panels the secondary one — which would make this change smaller.
- Is there any signal that distinguishes a restored panel position from one the user
  just set, or does the marker have to be written by the interaction?
