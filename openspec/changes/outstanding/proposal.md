# Outstanding work from the archived changes

## Why

`shader-studio` was archived at 77 of 127 tasks and
`croix10-generative-art-studio` at 110 of 219. Archiving moved both out of the
active list and applied their requirements to the main specs, which is what
makes this change necessary: without it, fifty-odd decided-but-unbuilt items
would exist only inside an archive nobody reads, while the specs they came from
read as though the products satisfy them.

So this change is not a proposal for new work. It is the standing record of what
those two changes left behind, kept where `openspec list` will show it.

## What this is not

It does not re-scope anything. Every item below points at the archived change
that decided it, and the design decisions that governed them (R50–R71) live in
`archive/2026-08-14-shader-studio/design.md` rather than being restated here.

## The one delta it carries

Undo has a browser proof and an acceptance row and no requirement anywhere in
the specs, which is how it stayed broken across the whole product without a
single test noticing. `specs/shader-authoring/spec.md` here adds one: an edit
can be taken back, derived state is not history, and a restored layer keeps the
settings it had. It describes behaviour that already works, so archiving this
change applies a requirement the product satisfies rather than a promise.

## The three kinds of item

**Unbuilt features.** Groups 6, 9, 10 and 11 of Shader Studio — per-layer
animation, MCP delivery, preset corrections, and the final delivery gate. Each
was scoped and none was started. Group 6 is the one the main specs assert:
`shader-authoring` carries "Layers animate individually" as a pending
requirement.

**Blocked verification.** Five delivery-gate tasks (2.10, 3.5, 4.6, 5.5, 8.3)
are one blocker wearing five numbers: `npm run verify:delivery` runs the
performance specs, which need a fixture selector, resolution mode, nonce, pass
ids, path ids, request authority hash and source hash *together*. Those come
from an authorized operator or CI. A nonce or authority hash must not be
manufactured to make the gate green.

**Debts found while building.** Three of these were discovered by work that
succeeded, which is the reason they are written down rather than remembered: the
undo limitation, the acceptance rows whose automated tests do not exist, and the
impact inventory's rejected owners.

## Croix10

Its thirteen capability specs are now in the main specs and **none of them has
been checked against the app**. The first task below is that audit; until it is
done those files record intent, not behaviour.
