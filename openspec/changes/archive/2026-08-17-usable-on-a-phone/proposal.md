# Reachable on a phone, through the panel system rather than around it

## Why

On a narrow viewport the product is not merely cramped, it is unreachable. Measured
at 386px: the Controls panel is off-screen entirely and the canvas reports
`left: -384.8`. Nothing a user can do from the page brings either back.

The requested fix — canvas above, panels stacked below, everything collapsed —
cannot be built, and the reason is two constants in the runtime rather than anything
in this product. `panel-host-config.ts` gives `controls` and `layers` the snap edges
`["left", "right"]`, so the two panels a phone needs at the bottom are the only two
that may not go there, and a `min-h-[560px]` floor means either one covers most of an
800px viewport. Filed as upstream issue 11 with the smallest fix.

What *is* available is the panel system's own commands. `panels.setOffset`,
`panels.resetOffset`, `panels.setHidden` and `panels.setSectionCollapsed` are all
published, and using them is using the runtime rather than working around it. They
cannot produce the requested layout. They can make the thing usable.

## What Changes

- **Panels are brought back on screen on a narrow viewport.** On load below a
  threshold, panel offsets are reset so nothing sits outside the viewport.

- **Every control section starts collapsed on a narrow viewport**, so the panel is a
  list of headings a thumb can scan rather than a column of inputs to scroll past.

- **One panel shows at a time.** Below the threshold, showing Layers hides Controls
  and the reverse, so the canvas is visible whenever neither is open.

- **The user's own arrangement is never overridden.** These apply on first load at a
  narrow width and stop applying the moment the user moves, hides, or expands
  anything themselves. A layout that re-imposes itself is worse than a bad one.

- **No product control surface is authored, and no runtime panel is hidden with
  CSS.** Both were considered and both are forbidden; the reasoning is recorded in
  the design so it is not proposed a third time.

## Capabilities

### New Capabilities

- `small-viewport-usability`: what the product does when it is opened on a screen too
  narrow for its panels, and the limits of what it may do about it.

### Modified Capabilities

_None._ No requirement changes; this adds behaviour where there was none.

## Impact

**This does not deliver the requested layout and must not be described as if it
does.** The canvas will not occupy more than half the screen with a panel open,
because a panel has a 560px floor. What the user gets is a product whose controls can
be reached at all, one panel at a time, with the canvas visible between them.

**Product code.** A small viewport module and its dispatches; `app-composition.tsx`
or the canvas module to run them once on load.

**Tests.** Browser proofs at a narrow viewport: every panel is within the viewport
after load, sections start collapsed, showing one panel hides the other, and a user's
own move survives a reload. Playwright can size a viewport, so these are ordinary
proofs rather than anything exotic.

**Not affected.** Every desktop behaviour. The threshold gates all of it, and above
the threshold nothing dispatches.

**Framework.** No runtime changes. `src/toolcraft/**` stays signed and untouched, as
do `index.html` and `src/app/app-identity.ts`.
