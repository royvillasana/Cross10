## 1. Prove the dialog is allowed before building on it

- [ ] 1.1 Write a boundary test asserting the product may import `@/toolcraft/ui/components/composites/dialog` and may not import `@/toolcraft/ui` or `@/toolcraft/ui/components/controls/**`, so the finding this change rests on is enforced rather than remembered.
- [ ] 1.2 Correct the record in the archived `engine-targeting-and-control-ia` design, which states dialogs reach no product surface. Leave the sentence and mark it wrong with the reason; a design that quietly changes its mind teaches nothing.
- [ ] 1.3 Author the `builtInFitCheck` before the renderer: `capabilities` naming `custom-interaction`, `checkedBuiltIns` including `imagePicker` and `actions`, and `whyInsufficient` written against modality and sequencing. If it cannot be written truthfully, stop — the flow is not buildable and the rest of this change is void.

## 2. The flow, alongside the sections rather than replacing them

- [ ] 2.1 Add the flow's state as a product target: which step is showing, and nothing else. It is not a record of what the user chose — the choices write the same targets they already write.
- [ ] 2.2 Register one custom control renderer that owns a `Dialog` from `components/composites`, and place it so it renders whether or not the canvas has layers.
- [ ] 2.3 Open on the technique cards plus "start from nothing", with each card showing the render the gallery already generates and naming its series.
- [ ] 2.4 Make it dismissable, and prove dismissing leaves the product usable and creates nothing.
- [ ] 2.5 Key the opening off whether work exists rather than off a "seen it" marker (see design Open Questions), so a returning author lands on their composition.

## 3. Canvas setup as a step

- [ ] 3.1 Add the setup step: aspect ratio, width and height, resolution scale, background — written through the same runtime targets the Setup section writes.
- [ ] 3.2 Pre-fill from the chosen starting point, and decide what "start from nothing" pre-fills.
- [ ] 3.3 Create nothing until it is confirmed: no canvas, no layer, no value. Prove that leaving mid-step is indistinguishable from never having started.
- [ ] 3.4 Record honestly that these controls remain in the runtime Setup section, because a product cannot suppress it. File the gap upstream rather than describing the duplicate as intended.

## 4. Move the technique choice

- [ ] 4.1 Apply the chosen technique from the flow through `planStudioTechniqueChange`, so one code path decides whether it offers or acts.
- [ ] 4.2 Replace the two-press confirmation with a real one in the dialog, and retire `gallery.actions`'s three-button arrangement. The two presses existed only because there was no modal.
- [ ] 4.3 Keep the revert exactly as it is, and keep its proof. Confirmation and revertibility answer different failures.
- [ ] 4.4 Browser proof that a technique change over existing work asks, that declining changes nothing, and that confirming is still revertible — the same three claims, at the new surface.

## 5. Move the reference choice

- [ ] 5.1 Offer the reference in a dialog reachable from the flow and while editing.
- [ ] 5.2 Keep strength and comparison mode in the control surface — they are adjusted while looking at the work rather than decided before it.
- [ ] 5.3 Carry every guarantee across with its proof: not a layer, does not resize the canvas, reaches no exported image, byte-identical delivered source, and sits exactly on the composition at any zoom.

## 6. Remove the five sections

- [ ] 6.1 Delete `Gallery`, `Chosen composition`, `Previous Stack`, `Reference`, and `Reference View` from the schema and the inventory.
- [ ] 6.2 Delete their acceptance rows and browser proofs **one at a time**, checking for each that the guarantee it carried has a proof at the new surface. Deleting them as a batch is how a guarantee leaves with its test.
- [ ] 6.3 Declare the dialog's targets against the surface that owns them, and assert no target is claimed by both a dialog and a section.
- [ ] 6.4 Assert no section exists whose only purpose is starting a session.

## 7. The aim comes from where the application started

- [ ] 7.1 Delete `gallery.target` and the applicability that gated the two presses on it.
- [ ] 7.2 Derive the target from the surface: the selected layer, the selected group, or the canvas.
- [ ] 7.3 Drop the image-set target. It had no surface to be started from and nobody asked for it; say so rather than leaving it unmentioned.
- [ ] 7.4 Re-aim the layer and group proofs at the surfaces that start them, keeping the assertion that matters: the layers the aim did not name render pixel-for-pixel as they did.
- [ ] 7.5 Prove an application is not offered when the selection names no layer that could receive one.

## 8. Layer-row actions — blocked

- [ ] 8.1 File the upstream issue: `layers-panel-row.tsx` hardcodes visibility and delete at lines 262 and 277 with no product hook, and `shader-authoring` forbids a product-authored layer list, so a duplicate or settings action on a row cannot be built from the product side. Name both the requested icons and the operations that already exist behind them.
- [ ] 8.2 Do not approximate it. Record in this task why each approximation is worse than waiting: a product row list is forbidden, a per-layer panel control is what this change removes, and a gear opened from anywhere but the row is a second way to do one thing.
- [ ] 8.3 Leave the existing duplicate action working until the runtime offers the hook.

## 9. Verify and close

- [ ] 9.1 Run `npm test` and confirm both halves, since the `&&` chain hides vitest when `node --test` fails.
- [ ] 9.2 Run the browser suite and compare against the recorded baseline — five stable failures plus a rotating set of load-flaky framework self-tests. Add nothing to it.
- [ ] 9.3 Confirm the integrity gate passes and that `index.html`, `src/app/app-identity.ts`, and `src/toolcraft/**` are untouched.
- [ ] 9.4 Open the built site and walk the flow by hand: open, choose, set up, land, build, restyle a layer, restore. The last two changes each shipped a defect that every proof passed over and one look found.
