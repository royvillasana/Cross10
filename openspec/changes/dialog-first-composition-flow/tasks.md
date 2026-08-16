## 1. Prove the dialog is allowed before building on it

- [x] 1.1 Boundary test asserting the product may import `@/toolcraft/ui/components/composites/dialog` and may not import `@/toolcraft/ui` or `@/toolcraft/ui/components/controls/**`. Landed as `src/app/studio-dialog-boundary.test.ts`; the import is permitted.
- [x] 1.2 Correct the record in the archived `engine-targeting-and-control-ia` design. The wrong sentence is kept and marked, with both halves of the correction: the import is allowed, and the conclusion was right anyway.
- [x] 1.3 Author the `builtInFitCheck` before the renderer. **It could not be written truthfully, and the owner instructed that the flow be built anyway.** An onboarding flow's value is "which step", which a `select` holds; its cards are an `imagePicker`; its presses are `actions`. The only thing no built-in offers is modality, which `custom-controls.md` rules out as justification. So no custom control is declared and no fit check is claimed — the dialog is rendered from product code with the runtime's own composite, and the deviation is recorded in `studio-onboarding.ts` rather than dressed up as compliance. Upstream issue 14 asks for the surface that would make it legitimate.

## 2. The flow, alongside the sections rather than replacing them

- [x] 2.1 Add the flow's state as a product target: which step is showing, and nothing else. It is not a record of what the user chose — the choices write the same targets they already write.
- [x] 2.2 Render the `Dialog` from product code rather than through a custom control renderer, so no `builtInFitCheck` is claimed for something that has none. Portalled into the shell root: a portal outside React's root receives none of React's delegated events, and every handler in it silently did nothing while Playwright reported successful clicks.
- [x] 2.3 Open on the technique cards plus "start from nothing", with each card showing the render the gallery already generates and naming its series.
- [x] 2.4 Make it dismissable, and prove dismissing leaves the product usable and creates nothing.
- [x] 2.5 Key the opening off whether work exists **and whether the user has answered**. The layer count alone was not enough: "start from nothing" finishes the flow and leaves nothing, so it reopened forever on the canvas it had just made. That also settles the open question about deleting every layer mid-session.

## 3. Canvas setup as a step

- [x] 3.1 Add the setup step: aspect ratio, width and height, resolution scale, background — written through the same runtime targets the Setup section writes.
- [x] 3.2 Pre-fill from the chosen starting point, and decide what "start from nothing" pre-fills.
- [x] 3.3 Offer named output shapes so nobody has to know the numbers: square (1080x1080), portrait (1080x1350), and vertical (1080x1920). Set them by writing the runtime's own aspect, width and height rather than storing a size — one owner, reached earlier.
- [x] 3.4 Note that **1080x1350 has no runtime aspect preset**. `canvas-aspect-ratio-presets.ts` ships 1:1, 3:2, 16:9, 3:4, 9:16, 2:3 and 4:3, and 4:5 is not among them — which is why these are set as real dimensions rather than as a ratio. Check what the Setup aspect select shows once a size lands outside its list, and file it upstream if the answer is misleading rather than merely blank.
- [x] 3.5 Name the shapes for the shape, not for the company: "Portrait (4:5)" rather than a platform's name. The dimensions are facts about a picture, and a product that brands them takes on a claim it cannot keep when the platform changes its mind.
- [x] 3.6 Create nothing until it is confirmed: no canvas, no layer, no value. Prove that leaving mid-step is indistinguishable from never having started.
- [x] 3.7 Record honestly that these controls remain in the runtime Setup section, because a product cannot suppress it. File the gap upstream rather than describing the duplicate as intended.

## 4. Move the technique choice

- [x] 4.1 Apply the chosen technique from the flow, through the same planner the gallery used, so one code path decides what applying a technique means.
- [x] 4.2 Replace the two-press confirmation with a real one in the dialog, and retire `gallery.actions`'s three-button arrangement. The pair of planners went with it rather than being left unused -- two ways to confirm one thing would have meant the panel one was the one nobody saw.
- [x] 4.3 Keep the revert exactly as it is, and keep its proof.
- [x] 4.4 Browser proof that a technique change over existing work asks, that declining changes nothing and returns to the cards, and that confirming is still revertible.

## 5. Move the reference choice

- [x] 5.1 Offer the reference in the flow, reachable from the panel while editing.
- [x] 5.2 Keep strength and comparison mode in the control surface -- they are adjusted while looking at the work rather than decided before it.
- [x] 5.3 Carry every guarantee across with its proof: not a layer, does not resize the canvas, reaches no exported image, byte-identical delivered source, and sits exactly on the composition at any zoom.

## 6. Remove the five sections

- [x] 6.1 Delete `Gallery`, `Chosen composition`, `Previous Stack`, `Reference`, and `Reference View` as they were. What replaced them is four narrower sections: the door into the flow, the source a narrow application pushes, what it is aimed at, and the way back from a replacement.
- [x] 6.2 Delete their acceptance rows and browser proofs one at a time, checking for each that the guarantee it carried has a proof at the new surface.
- [x] 6.3 Declare the dialog's targets against the surface that owns them. **Partly deferred and said so**: the flow's own step and choice are uncontrolled product targets outside the section inventory, which the inventory has no vocabulary for. The `toolcraft-app-shell` delta asks for that vocabulary; until it exists they are declared in the impact inventory and in `studio-onboarding.ts` rather than nowhere.
- [x] 6.4 Assert no section exists whose only purpose is starting a session. The panel's remaining door *opens* the flow and decides nothing itself.

## 7. The aim comes from where the application started

- [x] 7.1 Delete `gallery.target` and the applicability that gated the two presses on it.
- [x] 7.2 Derive the target from the surface: the selected layer, the selected group, or the canvas.
- [x] 7.3 Drop the image-set target from the canvas aim. The canvas aim itself went with the technique change; what is left is the narrow half, which is where aiming belonged.
- [x] 7.4 Re-aim the layer and group proofs at the surfaces that start them, keeping the assertion that matters: the layers the aim did not name render pixel-for-pixel as they did.
- [x] 7.5 Prove an application is not offered when the selection names no layer that could receive one. **Half of this is not expressible and the proof says so.** An applicability predicate may only name a rendered control's target, and what the layers panel has selected is runtime state with no control of its own -- so the press cannot be hidden or disabled on it. What is proved is that pressing it is inert: nothing created, frame unchanged. Verified against a build that fell back to applying across the canvas.

## 8. Layer-row actions — blocked

- [x] 8.1 File the upstream issue: `layers-panel-row.tsx` hardcodes visibility and delete at lines 262 and 277 with no product hook, and `shader-authoring` forbids a product-authored layer list, so a duplicate or settings action on a row cannot be built from the product side. Name both the requested icons and the operations that already exist behind them.
- [x] 8.2 Do not approximate it. Record in this task why each approximation is worse than waiting: a product row list is forbidden, a per-layer panel control is what this change removes, and a gear opened from anywhere but the row is a second way to do one thing.
- [x] 8.3 Leave the existing duplicate action working until the runtime offers the hook.

## 9. Verify and close

- [ ] 9.1 Run `npm test` and confirm both halves, since the `&&` chain hides vitest when `node --test` fails.
- [ ] 9.2 Run the browser suite and compare against the recorded baseline — five stable failures plus a rotating set of load-flaky framework self-tests. Add nothing to it.
- [ ] 9.3 Confirm the integrity gate passes and that `index.html`, `src/app/app-identity.ts`, and `src/toolcraft/**` are untouched.
- [ ] 9.4 Open the built site and walk the flow by hand: open, choose, set up, land, build, restyle a layer, restore. The last two changes each shipped a defect that every proof passed over and one look found.
