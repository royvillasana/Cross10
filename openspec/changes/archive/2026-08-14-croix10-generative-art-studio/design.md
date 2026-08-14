# Design — Croix10

## Context

Greenfield, now scaffolded from `@pixel-point/toolcraft@0.0.18`.

**How to read this document.** Decisions D1–D16 were written *before* the Toolcraft contract docs existed in the repo, against Toolcraft's assumed *role* rather than its real API. They are retained for their rationale and rejected alternatives. The **Contract Reconciliation** section at the end is authoritative: R1–R32 supersede or amend the decisions they name, and C1–C5 record the five places where the original brief and the contract could not both hold, together with the resolutions the user accepted. Where a decision and its reconciliation disagree, the reconciliation wins.

The domain constraint is unusual and shapes everything: Cruz-Diez's effects are *perceptual*, produced at boundaries between thin parallel elements. That means (a) sub-pixel accuracy at stripe boundaries matters more than almost anything else, (b) high spatial frequency is the point rather than something to smooth away, and (c) correctness is judged by eye, so visual regression testing is the primary safety net.

Constraints carried in from the proposal: WebGL2 fragment shaders as the rendering substrate, every visual parameter a uniform, Toolcraft's own components for all controls, 60fps at 1080p on integrated GPU, and a staged build order where the app is functional and visually verified after every stage.

## Goals / Non-Goals

**Goals:**

- One shared stripe field that all six engines specialize, so geometry parameters behave identically everywhere and line-halftone can reuse it rather than reimplement it.
- A single parameter declaration site that is simultaneously the source for controls, uniform upload, animation targets, randomization ranges, and serialization — adding a parameter should be a one-line change. **See R5:** that site is `app-schema.ts` itself.
- Analytically antialiased stripe boundaries, so high-frequency engines stay stable instead of shimmering.
- Deterministic time: the frame at time *t* is a pure function of (scene state, *t*), which is what makes scrubbing, seamless loops, and frame-stepped video export all fall out of the same mechanism. **See R7:** the runtime supplies *t*.
- Frame-rate protection that never misrepresents the user's parameter values. **Superseded by R9/R31/C1:** density is not a cost driver at all, so the mechanism is honest pass-cost modelling plus a Nyquist fidelity bound — not runtime degradation, and not a measured density cap.

**Non-Goals:**

- No canvas2D fallback. WebGL2 is a hard requirement with an explicit unsupported message; a CPU path for these shaders would not be trivial and would not hit the budget.
- No server-side rendering, accounts, cloud storage, or collaboration. All media stays local to the browser.
- No WebGPU. WebGL2 coverage is sufficient and the shader-editor tool targets one GLSL dialect.
- No node-graph editor. The parameter model is flat plus modulators, not arbitrary routing.
- No physically-based color science (spectral rendering, ICC profiles). Additive/subtractive mixing is done in a documented working space, not measured colorimetry.

## Decisions

### D1. Rendering: one full-screen fragment pass per stage, composited through ping-pong framebuffers

Each engine is a single fragment shader over a full-screen triangle. Tools and post FX are additional passes over ping-pong FBOs, applied in a fixed documented order: **source (engine | image | video) → interference composite → stylization (ASCII / pixel / halftone) → glitch → present**.

*Why:* the whole visual language is per-pixel field math, so a fragment pass is the natural unit; a fixed pass order makes the Post FX spec's determinism requirement trivial to satisfy; FBO ping-pong is the cheapest way to get bypassable effects (a bypassed pass is simply skipped, not neutralized with an identity computation).

*Alternatives:* one mega-shader with every effect behind uniform branches — rejected because branch cost is paid even when effects are off, and the shader editor would present an unreadable source. Instanced quad geometry per stripe — rejected because it forfeits analytic antialiasing and scales badly with stripe count.

### D2. Shader assembly: `#include`-style composition from GLSL chunks, compiled per (engine × feature-flag) variant and cached

Shaders are assembled at runtime from chunks — `stripe_field.glsl`, `palette.glsl`, `blend.glsl`, `shapes.glsl`, `noise.glsl` — plus one engine chunk. Variants are keyed by feature flags (interference layer on/off, shapes on/off, media source present) and cached by key.

*Why:* the shared-stripe-field requirement demands exactly one implementation of the field; feature-flag variants let the second layer cost literally nothing when disabled, as `interference-layer` requires; a chunk registry is also what the shader editor needs to hand the user a readable, self-contained source.

*Alternatives:* one shader per engine written by hand — rejected, the field math would drift between six copies.

### D3. The stripe field: signed distance to the nearest boundary, antialiased with `fwidth`

The field is computed in stripe space: rotate by angle, apply jitter as a lateral displacement `jitterAmount * noise(coord * jitterFrequency)`, take the coordinate modulo the sequence period, and resolve band index plus a signed distance to the nearest band boundary. Boundaries are resolved with `smoothstep` over `fwidth(distance)`.

*Why:* analytic antialiasing from screen-space derivatives is what keeps Induction Chromatique's top-of-range frequencies stable, satisfying its no-shimmer scenario, and it costs one derivative instead of N samples. Signed distance is also the natural hook for the boundary effects the domain needs — separator lines, complementary fringes, and additive mixing at boundaries are all functions of distance-to-boundary.

*Alternatives:* supersampling — rejected, cost scales with sample count exactly where we are already tightest. Mipmapped stripe texture — rejected, arbitrary angle and jitter make a prebaked texture wrong.

### D4. Sequence period, not stripe count, is the primitive

Bands have per-band widths, so the field's natural primitive is the **sequence period** (sum of band widths plus separators). Stripe count and pitch are derived, user-facing views onto it, and are normalized against canvas width so pitch is resolution-independent.

*Why:* this is what makes the `stripe-engines` per-band-width scenario ("only that band widens, the period grows accordingly") correct by construction, and it is what makes PNG 4x export scale the composition rather than multiply the stripe count.

### D5. Parameter registry: one TypeScript declaration array, everything derived

A parameter declares `{ id, label, type, uniform, default, min, max, step, group, engines, animatable }`. From that single declaration the system derives the Toolcraft control, the uniform upload, the animation target, the randomization range, and the preset field. A build/test-time validator asserts that every shader uniform has a registry entry and that every numeric parameter has finite bounds and an in-range default.

*Why:* "everything is a parameter" only holds if there is one place to add one. The validator is what stops the registry and the shaders from silently diverging — that is the `chromatic-render-core` no-orphan-uniforms requirement.

*Alternatives:* deriving the registry by parsing GLSL — rejected, GLSL cannot carry labels, groups, or curve semantics. Deriving shaders from the registry — rejected, it would fight the shader-editor tool.

**pin-on-read:** the mapping from declared type to concrete Toolcraft control component, and how Toolcraft expects panel groups to be registered.

### D6. Engine-scoped visibility hides but never discards

`engines` on each declaration drives visibility. Values for hidden parameters stay in the store.

*Why:* directly required by `parameter-schema-controls` — switching to Chromosaturation and back must restore stripe geometry untouched.

### D7. Time is an explicit input, never `performance.now()` inside the render path

The render function takes an explicit `time` in loop-normalized units. A clock advances it during playback; scrubbing sets it; video export steps it in fixed increments. Nothing downstream reads a wall clock, and noise used for jitter and glitch is seeded by `(seed, time)`.

*Why:* this one decision satisfies four separate requirements at once — deterministic scrubbing, reproducible seeded glitch, frame-stepped video export, and seamless loops. It is the highest-leverage constraint in the design, and it must be enforced from the first commit because retrofitting it later means auditing every shader.

### D8. Perfect loops by rate quantization at evaluation time

Given loop length *L*, every LFO's effective rate is quantized to the nearest whole number of cycles within *L* (minimum one). Noise LFOs use a periodic noise function with period *L*. Keyframe tracks are evaluated over normalized loop time with the end state pinned to the start state.

*Why:* the `animation-system` spec requires loops to be seamless *by construction*, including for noise. Quantizing at evaluation rather than mutating the user's rate value means the requested rate survives in the preset — the user sees their number, the renderer uses the loop-safe one, and the UI shows the quantized value alongside.

*Alternatives:* crossfading the loop boundary — rejected, it visibly softens exactly the hard-edged compositions this app exists to make.

### D9. Adaptive quality reduces *effective* values behind the user's values

> **SUPERSEDED — see R9 and C1.** Toolcraft classifies runtime quality clamping as a functional failure. Retained for the rationale trail only; do not implement.

A quality controller watches a rolling frame-time average and steps a quality level down (effective stripe count first, then render scale) when over budget, and back up after sustained headroom. Effective values are applied at uniform-upload time; the store's user-facing values never change, and a quality indicator surfaces the degradation.

*Why:* the performance budget says degrade stripe count before dropping frames, and `scene-presets` requires round-trip fidelity — a controller that mutated the store would corrupt presets on a slow machine. Hysteresis on both thresholds prevents oscillation.

### D10. Color: linear-light working space, sRGB only at present

All mixing, blending, and gradient interpolation happen in linear light; conversion to sRGB happens once in the present pass.

*Why:* additive mixing at stripe boundaries is the central perceptual claim of Couleur Additive, and blending in gamma space gets it visibly wrong — red plus green would not read as the yellow the `interference-layer` additive scenario demands. Palettes are authored as sRGB hex (that is how the canonical works are documented) and converted on upload.

*Trade-off:* linear-space gradient interpolation can look washed out in the middle compared to designer expectation; gradient stop interpolation therefore gets an explicit space toggle rather than a silent choice.

### D11. Media sources are textures behind one sampler interface

> **AMENDED — see R11 and C3.** The sampler interface stands; webcam is dropped and import goes through `fileDrop`.

Images, video elements, and webcam streams all become a `sampler2D` plus a resolution/transform uniform. Video and webcam re-upload per frame; images upload once. Motion detection keeps one previous-frame texture and takes an absolute luminance difference.

*Why:* one interface means every engine gains image and video support at once instead of per-engine work, which is what `media-stylization` assumes when it says any engine can be applied to any source.

*Trade-off:* per-frame video upload is a real cost at 1080p; sampling resolution is exposed partly as a genuine creative control and partly as the pressure valve for it.

### D12. Shader editor: swap the program, remap uniforms by name, keep the last good program

> **AMENDED — see R12 and C4.** Swap-and-preserve stands; the editor is the built-in `code` control over a hook chunk, not CodeMirror over the whole program.

On edit, compile into a new program. On success, swap and re-resolve uniform locations by name, preserving values for uniforms that persist. On failure, keep the current program and surface the compiler log with line numbers, offset to account for the injected preamble. Uniforms the user adds are picked up from an annotation comment (`// @param min max default`) and registered dynamically.

*Why:* `shader-editor` requires the canvas never to go blank on a compile error, and requires new uniforms to become controls. Annotations are the minimum viable way to get range metadata out of GLSL, which cannot express it.

### D13. 3D is a separate Three.js renderer on its own canvas, sharing the parameter store

> **AMENDED — see R13.** Three.js stands, but its canvas lives inside `canvasContent` and orbit is the runtime gizmo's.

The lamellae tool mounts a Three.js scene in its own canvas rather than sharing the WebGL2 context, reading the same parameter store. Lamellae are instanced boxes; parallax color change comes from real geometry and real occlusion, not a shader trick.

*Why:* sharing one raw WebGL2 context with Three.js means fighting over state; a separate canvas swapped in with the tool is far simpler. Real geometry is required — `lamellae-3d` explicitly demands genuine occlusion rather than a simulated shift, which is the whole point of contrasting it with Physichromie's simulated angle.

*Trade-off:* two renderers to maintain, and the 3D tool cannot be composited with the 2D post FX chain. Accepted; it is a distinct experiment, last in the build order.

### D14. Export: re-render into an offscreen target at export dimensions; encode off the main thread

> **SUPERSEDED — see R14 and C2.** Runtime owns export end to end; product code supplies one `exportRenderer`. Retained for the rationale trail only; do not implement.

PNG export renders into an FBO at the requested pixel size with pitch scaled proportionally, then reads back. Video export steps `time` across exactly one loop, encoding with WebCodecs `VideoEncoder` where available and a wasm encoder as fallback; GIF quantizes and encodes in a worker.

*Why:* re-rendering rather than upscaling the screen canvas is what makes 4x export show the same composition at higher fidelity instead of a blurred enlargement. Frame-stepping instead of realtime capture is what makes the loop exact and independent of the machine's actual frame rate. Workers keep the UI responsive as `export-pipeline` requires.

**pin-on-read:** whether the loop-length control and timeline scrubbing come from Toolcraft's timeline component or need a thin adapter.

### D15. SVG export is a per-engine capability flag

Each engine declares whether it can emit vectors, and the flag is additionally gated at runtime by state (jitter non-zero, or any post FX active, disables it). Couleur Additive, Transchromie, and simple Chromointerférence emit rects and paths; the rest report why they cannot.

*Why:* `export-pipeline` requires SVG "where feasible" with a stated reason otherwise, and feasibility genuinely depends on runtime state, not just engine identity.

### D16. Visual regression testing is the primary correctness net

> **AMENDED — see R16.** The framework acceptance harness is the gate; unit tests for pure layers remain.

Each engine and preset gets a golden-image test at a fixed time and fixed size, compared with a perceptual diff and a small tolerance. Unit tests cover the pure layers: field math, sequence-period arithmetic, loop quantization, preset round-trip, and registry validation.

*Why:* these outputs are perceptual, and a stripe-phase regression is invisible to an assertion but obvious in a diff. The determinism from D7 is what makes golden images stable enough to be worth having.

**pin-on-read:** Toolcraft's own visual-testing and performance instructions, which govern how these tests are wired.

## Risks / Trade-offs

- **Toolcraft's real API differs from the assumed shape (highest risk — it gates everything).** → Stage 0 reads the scaffold and its contract docs before any engine work, and reconciles every **pin-on-read** decision. The parameter registry is deliberately UI-agnostic so only the type-to-control mapping layer changes if the API differs.
- **The starter kit may not be the public `@pixel-point/toolcraft` package.** → Open question below; blocks Stage 0 rather than being worked around.
- **Induction Chromatique and dual-layer Chromointerférence are the fidelity stress cases.** → Analytic antialiasing (D3) instead of supersampling, and feature-flag variants (D2) so unused paths cost nothing. Per R31 their cost does not scale with frequency; the risk is aliasing, bounded by the Nyquist-derived maximum.
- **Per-frame 1080p video upload plus a multi-pass FX chain is the real cost concentration.** → Sampling resolution downsamples the source independently of output, and the FX chain skips bypassed passes entirely. No quality clamping is available as a backstop (R9), so this must be solved by pass cost and invalidation.
- **Aliasing on high-frequency line pairs remains the most likely visible defect even with `fwidth`.** → Golden-image tests at multiple resolutions and DPRs for the Induction engine specifically, plus a documented maximum frequency clamped against effective pixel pitch.
- **Linear-light mixing may surprise users editing gradients.** → Explicit interpolation-space toggle on gradients (D10) rather than a hidden choice.
- **Dynamic shader uniforms from the editor can desync the registry.** → Editor-registered parameters live in a separate namespace, are dropped when the shader is reset, and are serialized with the custom source so presets stay round-trip-clean.
- **MP4 export support is uneven across browsers.** → WebM is the primary target; MP4 goes through WebCodecs where the codec is available and is otherwise disabled with a stated reason rather than silently producing a broken file.
- **13 capabilities is a wide surface; late stages could destabilize early ones.** → The staged build order with golden-image tests added per stage means each stage locks in its own visual contract before the next begins.

## Migration Plan

Greenfield, so no data or API migration. Deployment is the staged sequence itself, each stage independently shippable and visually verified:

1. Toolcraft scaffold, contract docs read, render core, parameter registry, Couleur Additive, Geometry and Color panels.
2. Remaining five engines, embedded shapes, interference layer, gradient system, preset library, randomize with locks.
3. Animation system (timeline, keyframes, LFOs, loop quantization) and the export pipeline.
4. Imported image and video stylization; ASCII, pixel, halftone and glitch.
5. Shader editor.
6. 3D lamellae.

Rollback is per stage: each stage ends at a green, visually verified state, so reverting to the previous stage's commit always yields a working app.

## Open Questions

1. ~~**Which starter kit exactly?**~~ **Resolved.** `@pixel-point/toolcraft@0.0.18` is the public npm scaffolder (`create-toolcraft-app`). The app is scaffolded; `AGENTS.md` and `docs/toolcraft/` ship with it and are signed, framework-owned files.
2. ~~Timeline ownership?~~ **Resolved: runtime owns it.** See R7/R8.
3. ~~Code editor for the shader tool?~~ **Resolved: built-in `code` control.** See R12.
4. ~~Visual-testing harness?~~ **Resolved: the framework owns proof.** See R16.
5. Confirm the canonical palettes against primary sources before shipping the preset library — the proposal lists them from description, and getting these right is the difference between homage and approximation.
6. Should Physichromie's simulated viewing angle and the 3D tool's real camera parallax be linkable, so orbiting the 3D scene drives the 2D angle uniform? Deferred until Stage 6.
7. ~~How does product code obtain decoded bytes for an uploaded video asset?~~ **Resolved: imported video is viable.** See R29.
8. ~~Does anything in the runtime expose a live `MediaStream`?~~ **Resolved: no.** Confirmed by inspection — the only media path is durable uploaded assets resolved to blob URLs. C3 stands.
9. **How frame-exact is `video.currentTime` seeking for export?** Seek precision is codec- and container-dependent, so nearest-frame rather than exact-frame sampling may be the realistic guarantee. See R29's risk note. Affects only the strictness of the video-source export assertion, not viability.

---

## Control section decomposition (C5 deliverable)

Authored at Stage 0. This is the design contract; `appControlSectionInventory` in `app-acceptance-data.ts` is populated **per stage, alongside the schema sections it describes**, because `control-section-inventory.ts` validates in both directions — an inventory entry with no rendered section fails just as a section with no entry does. 26 entries, none over ten controls.

Titles obey R33 (never resemble the gating branch) and grouping obeys R34 (gates share an entity with what they gate). Renames forced by R33 are marked.

| id | entity / stage | title | targets | notes |
|---|---|---|---|---|
| `chromatic-engine` | chromatic-engine | Chromatic Engine | `engine.active` | Global selector; R34 exception |
| `workspace-tool` | workspace-tool | Workspace Tool | `tool.active` | Global selector; R34 exception |
| `stripe-module` | stripe-field / module-layout | Stripe Module | `stripe.count`, `.pitch`, `.widthRatio`, `.gap`, `.angle` | Split 1 of 2 |
| `stripe-variation` | stripe-field / field-variation | Stripe Variation | `stripe.phase`, `.jitterAmount`, `.jitterFrequency`, `.mirror` | Split 2 of 2 |
| `band-sequence` | band-sequence | Band Sequence | `bands.widths`, `.separatorWidth`, `.separatorColor` | |
| `palette` | palette | Palette | `palette.slots`, `.preset`, `.harmony`, `.cyclingOffset` | `Palette` is not a banned title; `Color` would be |
| `chromatic-ramp` | chromatic-ramp | Chromatic Ramp | `ramp.source`, `.gradient`, `.interpolationSpace`, `.mapping`, `.phase`, `.driftCycles`, `.radialCenter`, `.quantizeEnabled`, `.bandCount` | **Renamed** from `Gradient Mapping` — would contain tool label `Gradient`. Nine targets; `semanticGroup` required at eight or more (R43) |
| `interference-layer` | interference-layer | Interference Layer | `interference.enabled`, `.pitch`, `.angle`, `.phase`, `.widthRatio`, `.speed`, `.blendMode` | Gate co-located; already the model case |
| `embedded-shape` | embedded-shape | Embedded Shape | `shape.kind`, `.strength`, `.size`, `.center`, `.splitOffset` | Broad-title list is anchored, so `Embedded Shape` passes where `Shape` would not |
| `viewer-parallax` | viewer-parallax | Viewer Parallax | `viewer.angle`, `viewer.parallax` | |
| `translucent-planes` | translucent-planes | Translucent Planes | `planes.items`, `planes.blendMode` | Transchromie |
| `field-immersion` | field-immersion | Field Immersion | `immersion.spread`, `.driftSpeed` | Chromosaturation |
| `modulation` | modulation | Modulation | `modulation.target`, `.waveform`, `.rate`, `.amplitude`, `.phase`, `.offset`, `.globalSpeed` | `Motion` avoided — broad title |
| `background` | background | Background | `export.includeBackground`, `appearance.background` | Relocated to Setup by runtime; still budgeted here |
| `still-source` | still-source | Still Source | `source.image`, `.mapping`, `.samplingResolution`, `.quantizeToPalette` | **Renamed** from `Source Image` — would contain tool label `Image` |
| `clip-source` | clip-source | Clip Source | `source.clip`, `.motionEnabled`, `.motionStrength` | |
| `character-grid` | character-grid | Character Grid | `ascii.charset`, `.cellSize`, `.colorMode` | **Renamed** from `ASCII` |
| `mosaic` | mosaic | Mosaic | `pixelate.blockSize`, `.quantizeToPalette` | **Renamed** from `Pixelate` |
| `dot-screen` | dot-screen | Dot Screen | `halftone.pattern`, `.cellSize`, `.angle` | **Renamed** from `Halftone` |
| `signal-damage` | signal-damage | Signal Damage | `glitch.channelSplit`, `.blockDisplacement`, `.scanlineTearing`, `.smear`, `.seed` | **Renamed** from `Glitch` |
| `fragment-hook` | fragment-hook | Fragment Hook | `shader.hookSource`, `shader.reset` | **Renamed** from `Shader Hook` — would contain tool label `Shader` |
| `extruded-fins` | extruded-fins | Extruded Fins | `lamellae.depth`, `.surface`, `.lighting`, `view.orbit` | **Renamed** from `Lamellae`; owns the gizmo pose target |
| `randomization` | randomization | Randomization | six `randomize.lock*` switches | Collected so locks do not consume each governed section's budget |
| `scene-preset` | scene-preset | Scene Preset | `preset.active` | One-control section, valid as the entity's complete surface |
| `image-export` | image-export | Image Export | `export.image.format`, `.resolution` | Ordinary product controls; consume budget |
| `video-export` | video-export | Video Export | `export.video.format`, `.resolution` | Placed immediately after Image Export |

**R40 — Product mode is mandatory here and cannot land alone.** `isNeutralTemplateProject` is false for any folder not named `starter`/`toolcraft-template` that carries a generated manifest, so starter readiness is *invalid* in this repo — the scaffold ships with `npm run test` already failing on that one check. But switching to product mode requires `schemaHasProductSurface` and, because image export defaults on, an `Image Export` section plus an `export-image` action, which then obliges acceptance rows and passing browser proof for every visible control. The flip is therefore the first coherent schema-plus-acceptance batch, not an isolated declaration.

## Control selection inventory (task 0.9)

Recorded before any schema code, per `core/control-selection.md`. Grouped by **value model** rather than by control, because ~90 controls collapse into a dozen distinct models; every high-confidence wrong-substitution case from `acceptance-testing.md` is covered explicitly.

| Product need | Value model | Built-ins checked | Chosen | Why | Rejected |
|---|---|---|---|---|---|
| Stripe count, band count, palette slot count, lamella count | bounded integer with meaningful positions | `slider`, `rangeSlider`, `text` | `slider` + `sliderValueKind: "discrete"` | Semantic integer domain where markers help choose a position | `text` — no range affordance; `rangeSlider` — single value, not a range |
| Pitch, width ratio, gap, angle, phase, jitter, speed, rate, amplitude, strength, intensity | continuous scalar over many positions | `slider`, `rangeSlider`, `vector` | `slider` + `sliderValueKind: "continuous"` | Too many positions for markers even where a `step` exists | `variant: "discrete"` — would produce marker noise |
| Palette colour bank, 2–8 slots | user-owned array cardinality of one homogeneous value | `collectionActions`, `sourceCollection`, repeated `color` | `collectionActions` with `color` `itemControl` | The **user** owns how many colours exist | `sourceCollection` — no add/remove, and no runtime workflow owns the length; count slider + fixed controls — explicitly named as a wrong substitution |
| Translucent plane list | user-owned array of a multi-field record | `collectionActions` with `itemControls`, `sourceCollection` | `collectionActions` + `itemControls` | Two or more built-in fields form one logical record added and removed atomically | `itemControl` — cannot express a compound record |
| Gradient with stops, angle, type | adjustable gradient | `gradient`, paired `color`, `curves` | `gradient` | Exact owner; owns type, angle, stop track, and stop list atomically | Two `color` controls — named wrong substitution; splitting angle into a sibling — violates compound atomicity |
| Background colour, separator colour | free hex colour for one entity | `color`, `colorOpacity`, `palette` | `color` | No opacity belongs to these entities, and they are not design tokens | `colorOpacity` — would invent an unused opacity part with mandatory coverage; `palette` — reserved for family+shade tokens |
| Engine choice (6) | finite exclusive mode that replaces the view below | `tabs`, `select`, `segmented`, `imagePicker` | `select` — see 0.9a | Two stacked tab rows would read as competing navigation | `segmented` — 6 options exceeds the 4-option / 24-char budget; `imagePicker` — no meaningful thumbnail per engine at selection time |
| Tool choice (9) | finite exclusive mode that replaces the workflow view | `tabs`, `select`, `segmented` | `tabs` | Documented exact owner for a choice that replaces the content below it; runtime overflows to `Select` on narrow widths without changing the value | `segmented` — far over budget; `select` — would hide the app's primary navigation in a dropdown |
| Blend mode, mapping mode, halftone pattern, surface mode, colour mode, export format/resolution | finite compact setting leaving the view unchanged | `segmented`, `select`, `tabs` | `select` | Option labels exceed the segmented character budget in each case | `segmented` — `Difference`/`Multiply`/`Additive` alone breaks 24 chars; `tabs` — the view below does not change |
| Enable switches, locks, lighting, quantize, motion, `export.includeBackground` | boolean | `switch`, `checkbox` | `switch` | On/off state for a product capability; labels carry no `Enable` prefix | `checkbox` — reserved for list-item selection semantics |
| Radial gradient centre, shape centre | stable user-authored two-axis parameter | `vector`, paired `slider` | `vector` | Exact owner for a manually authored 2-axis position | Paired sliders — named wrong substitution. **Not** used for animation phase, motion, or simulated position, which the contract explicitly forbids |
| Keyframe segment easing | single-value response curve | `curves`, `slider` | `curves` with `variant: "single"`, `curveIntent: "single-value-map"`, monotone | Semantic 1-D easing map; overshoot unsafe | RGB `curves` — channel tabs are for colour correction only |
| Shader hook source | long structured multiline text | `code`, `text`, custom editor | `code`, `textValueKind: "structured"` | Base multiline editor for shader code; caps at 12 lines and scrolls | `text` — single-line only; custom editor — recreates a built-in, and C4 already scoped the value to a hook chunk |
| Image source, video source | source-material upload | `fileDrop`, custom uploader | `fileDrop` (`assetKind: "image"` / `"file"` with `accept`) | Exact owner; runtime owns bytes, transforms, order, and lifecycle | Custom file list or upload button — named wrong substitution; canvas-placed upload UI — forbidden |
| Lamellae view rotation | 3D view orientation | `orientationGizmo`, `vector`, paired sliders | `orientationGizmo` | Exact owner whenever a visible model rotates in 3D | `vector`, paired angle sliders, axis buttons, custom gizmo — all named wrong substitutions |
| Harmony generate, shader reset, SVG/CSS copy | local command scoped to the nearby entity | `actions`, `panelActions` | `actions` | Affects only the section's entity; button label is the verb, control label the context | `panelActions` — reserved for final product delivery actions |
| Export PNG, Export Video, Randomize | final product delivery action | `panelActions`, `actions` | `panelActions` | Sticky footer product actions; export roles are typed and runtime-executed | `actions` — would place delivery actions in the panel body |
| Scene preset choice | finite named state bundle | `select`, `imagePicker`, `tabs` | `select` | 8–12 named presets, no thumbnails available before render | `imagePicker` — would require generating and shipping preview images |
| Scene serialization | portable settings JSON | runtime `settingsTransfer` | runtime `settingsTransfer` | Runtime-owned; implementing it as product controls is explicitly forbidden | Product save/load controls, `panelActions` JSON copy — forbidden as a substitute |

**No custom controls are required.** Every product value model above binds to a built-in, so `controlRenderers` stays empty and no `builtInFitCheck` / `customControlCoverage` obligation is incurred.

### 0.9a — Engine selection: `tabs` vs `select`

`tabs` is the documented owner for a finite choice that replaces the content or workflow view below it, and engine selection does change the controls below it (R6 makes them engine-conditional). It is therefore a genuine candidate and ruling out `segmented` alone would not justify `select`.

**Chosen: `select`.** Tool selection already occupies the one `tabs` row as the app's primary navigation. A second tab row directly beneath it would read as competing navigation at the same visual weight, when the two choices are hierarchically different — the tool decides *which workflow* is on screen, the engine decides *which chromatic grammar* that workflow renders. `select` also carries six option labels (`Physichromie`, `Couleur Additive`, `Induction Chromatique`, `Chromointerférence`, `Transchromie`, `Chromosaturation`) that would overflow a tab row into the runtime's `Select` fallback on any realistic panel width, so `tabs` would present as a select most of the time anyway while claiming tab semantics.

*Recorded because `acceptance-testing.md` treats control-selection substitution as a high-confidence failure class; this is the required documented fit check, not a default.*

## Animation intent inventory (task 0.11)

**Mode: keyframes timeline, reached in two stages.** Users edit property animation over time — the brief asks for keyframes over any parameter — and video export is explicitly requested, which independently requires the top Toolcraft timeline. Autonomous no-timeline animation is unavailable: it is permitted only for decorative motion with no transport and no video export.

**AMENDED at Stage 3 (R40).** Stage 3 ships `mode: "playback"`. Both modes give the same transport, the same loop semantics, and the same time source; `keyframes` adds per-target tracks, and with them a framework obligation that `control-acceptance-coverage.ts:236` enforces: every keyframe-capable control — which is every `slider`, `color`, and `vector` in the panel — must carry `timelineCoverage: "keyframes"` acceptance proving its diamond creates a keyframe row and changes evaluated output. That is roughly thirty further browser proofs, and `control-acceptance-policy.ts:101` closes the escape hatch by rejecting `keyframeable: false` on a capable control while the mode is `keyframes`, so task 11.0's plan to classify targets out of scope is unbuildable as written in that mode. The motion Stage 3 owes — travelling moiré and a drifting wash — is parameter drift over a runtime-owned loop, which playback expresses exactly. Keyframes therefore becomes its own change rather than a rider on this one. The render path does not move when it lands: values are already read through `evaluateToolcraftTimelineValues`, which returns raw values while no groups exist.

| Aspect | Decision |
|---|---|
| Transport | Runtime top timeline only. No product Play/Pause/Restart control anywhere in the panel |
| Loop | Seamless forward-only, the framework default. No mirror/yoyo/ping-pong |
| Time source | `getToolcraftTimelineLoopTime` / `getToolcraftTimelineLoopProgress`; no wall clock in the render path |
| Keyframed values | Read through evaluated-value helpers; never raw `state.values`, never `valueLabel` |
| Speed | Whole-cycle multiplier, not a time scale (R32) |

**`defaultDurationSeconds`: 8.** Source: the slowest intended modulation is a full viewing-angle sweep through the Physichromie colour states, which needs to read as a deliberate walk-past rather than a flicker; 8 s gives roughly 2 s per perceptible colour state across four states. Evidence to be recorded in the worklog once the sweep is visible on canvas. This is a product-derived period, not the framework's `8s` fallback — the coincidence is noted so it is not mistaken for an unset default, and it must be re-derived if the sweep reads wrong.

## Renderer technique decision matrix (task 0.12)

| Field | Value |
|---|---|
| `sourceRepresentation` | Schema parameter values plus optional imported image/video textures. No vector or document source |
| `productRepresentation` | A continuous per-pixel colour field. Composition is defined by field math, not by discrete objects |
| `previewRenderer` | `webgl` — WebGL2 fragment shaders into a product canvas in `canvasContent` |
| `exportRenderer` | `webgl`, composited into the runtime-supplied `CanvasRenderingContext2D` (R30). Same passes, same registration |
| `rendererStrategy` | `webgl` |
| `whyNotAlternativeStrategies` | **Canvas 2D** — the output is per-pixel field math with analytic antialiasing from screen-space derivatives; a 2D path would need per-pixel JS or per-stripe geometry, losing `fwidth` AA at exactly the frequencies the product exists to render (see 0.16a). **SVG/DOM** — cannot express the interference, moiré, or luminance-modulated fields at all, and only the geometry-only engine states are vector-expressible, which is why SVG is a clipboard copy rather than a renderer. **WebGPU** — no coverage advantage, and the shader hook tool targets one GLSL dialect |
| `fidelityRisks` | Aliasing at maximum line frequency is the primary risk, bounded by the Nyquist derivation in 0.13 and mitigated by analytic AA. Linear-light mixing may surprise gradient authors, mitigated by the explicit interpolation-space control |
| `performanceRisks` | Per-frame 1080p video texture upload through a multi-pass chain is the real cost concentration. Stripe density is **not** a cost driver (R31). No quality clamping is available as a backstop (R9) |
| `intentionalRasterizationReason` | The product is a raster colour field by nature; there is no vector original being rasterized. The geometry-only engine states are the exception and are offered as SVG clipboard output |

## Nyquist density derivation (task 0.13)

Computed, not measured. This is a **fidelity** bound: per-pixel fragment cost does not vary with stripe count (R31), so density is limited by what a pixel grid can represent, not by frame time.

Assumptions, taking the worst representable case so the bound holds everywhere:

- Composition width 1920 CSS px (the 16:9 default).
- `canvas.renderScale` is user-selectable 1–2; the bound uses **1**.
- `devicePixelRatio` 1.
- Therefore 1920 backing pixels across the composition width.

Derivation:

- One *cycle* of the stripe field is one sequence period. Nyquist gives an absolute floor of 2 backing px per cycle, at which point the field is representable but has zero antialiasing headroom and moirés badly at any angle off 0°/90°.
- Analytic AA via `fwidth` needs roughly **4 backing px per cycle** to keep boundary gradients stable at arbitrary angles → 1920 / 4 = **480 cycles** across the width.
- For an alternating two-band field a cycle is 2 bands → **960 bands**.
- Jitter locally compresses bands below their nominal width, so reserve ~20% headroom.

Schema endpoints:

| Parameter | Max | Rationale |
|---|---|---|
| `stripe.count` | **800** | 960 representable bands less ~20% jitter headroom |
| Induction line frequency | **400** cycles across the width | 480 representable cycles less ~20% headroom |
| Minimum band width | **2 backing px** at scale 1 | The invariant the two maxima above are derived from |

Re-derive if the default composition width changes, if the minimum render scale rises above 1, or if jitter's maximum displacement changes. The invariant to preserve is minimum band width in backing pixels, not the two counts.

## Keyboard accelerator check (task 0.18a)

Inspected the signed runtime for global key handling. Claimed keys:

| Owner | Keys |
|---|---|
| `toolcraft-root.tsx:101–114` | `Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`, `Ctrl+Y` (history) |
| `timeline-panel.tsx:302` | `Escape` |
| `sidebar.tsx:112` | `Cmd/Ctrl` + the sidebar shortcut key |

**Unmodified `R` is unclaimed**, so there is no conflict. The only prohibition in `AGENTS.md` is against route-local *undo/redo* listeners; a product accelerator for a product command is not forbidden, and a keydown listener is not one of the runtime surfaces that must not be rebuilt.

Decisions:

- **Permissible.** `R` fires Randomize, suppressed whenever a text or `code` input has focus.
- **No acceptance row.** Acceptance `kind` is only `canvas-handle | control | runtime`, none of which describes an accelerator. The Randomize *command* already has a `control` row through its sticky `panelActions`; the shortcut is an alternate trigger for that same command and is proved by a named app-owned Playwright test in `e2e/product-shell.spec.ts`.
- **No separate `interactionOwnership` entry.** The capability set (`command`) is already claimed by the panel-owned Randomize action. Declaring the accelerator separately would risk the "one operation mirrored across surfaces" failure for no benefit.
- Space is *not* rebound — playback transport stays with the runtime timeline, and `S`/`F` were dropped earlier (R19, R20).

# Contract Reconciliation (Stage 0)

Read: `AGENTS.md`, `docs/toolcraft/README.md`, `workflow.md`, `core/runtime-boundary.md`, `core/setup-export.md`, `core/control-selection.md`, `core/layout.md`, `core/timeline-animation.md`, `core/performance.md`, `core/media-upload.md`, `schema-reference.md`, `component-rules.md`, `renderer-technique.md`, `assembly-workflow.md`. Deferred by the routing table to their own phase: `decision-contract.md`, `custom-controls.md`, `performance.md` (Implementation), `acceptance-testing.md` (Verification).

Every runtime helper named below was verified present in the signed `src/toolcraft` copy.

Toolcraft is far more prescriptive than the pre-read design assumed. It owns the export pipeline end to end, the timeline and its clock, canvas sizing, background, render scale, and all control rendering. The corrections below supersede the named decisions.

## Reconciled decisions

| # | Was | Now |
|---|---|---|
| **R1** | Fragment passes composited through ping-pong FBOs | Unchanged, but the whole chain lives inside `canvasContent`, sized by `useToolcraftProductSceneFrame()` — never from `canvas.size` in infinite mode. The pass order must additionally be declared as a compiled `rendererPipelineRegistration`, and `assessToolcraftRenderPlan` must return no structural errors **before any renderer code is written**. |
| **R2** | GLSL chunk composition | Unchanged. |
| **R3** | Signed distance + `fwidth` antialiasing | Unchanged, and now load-bearing: R9 removes runtime quality degradation, so analytic AA is the only headroom mechanism left. |
| **R4** | Sequence period as primitive | Unchanged. |
| **R5** | One TS parameter-declaration array | **The schema *is* the registry.** `src/app/app-schema.ts` via `defineToolcraft` is the single declaration site. Product code cannot render controls — runtime does, from `type` + `target`. Each control additionally requires `applicability`, `performanceRole`/`performanceReason`, and per-type intent fields (`sliderValueKind`, `textValueKind`, `curveIntent`). Keep frequently-edited defaults and domain logic in separate modules from `app-schema.ts`, because later-delivery ownership derives verification scope per module. |
| **R6** | Hide-but-preserve via engine scoping | Same behavior, framework mechanism: `applicability: { mode: "conditional", all: [...] }`. `disabled`/`disabledWhen` are forbidden. Runtime already preserves hidden values. |
| **R7** | Product owns an explicit `time` input | **Runtime owns the clock.** Renderers call `getToolcraftTimelineLoopTime` / `getToolcraftTimelineLoopProgress`; local wall-clock phase math is forbidden. Keyframed targets are read through evaluated-value helpers, never from raw `state.values`. The determinism property survives — it is now the runtime's guarantee rather than ours, which is strictly better. |
| **R8** | Product-owned loop-length control | **Runtime owns loop length** as timeline duration; set `panels.timeline.defaultDurationSeconds` to the product-derived period with recorded evidence. Seamless forward-only loops are already the framework default. LFO rate quantization against the duration stays product-side (R9 does not touch it). Do **not** author a product loop-length control, and do not put Play/Pause in a panel. |
| **R9** | Adaptive quality controller degrading stripe count, then render scale | **Deleted.** See **C1** and **R31** — the framework forbids runtime quality clamping, and density was never the cost driver anyway. The budget is met through honest pass-cost declaration, invalidation, cache lifetime, scheduling, and execution location; density is bounded by a Nyquist fidelity limit, not a measured cap. `canvas.renderScale` is runtime-resolved (`min 1`, `default 2`, `max 2`); product code may set only `step`. |
| **R10** | Linear-light working space | Unchanged, with one addition: the background color must be a schema `color` target inside an authored `Background` section paired with `export.includeBackground`. Hardcoding a WebGL clear color is forbidden. Live preview calls `shouldIncludeToolcraftPreviewBackground(state)`. |
| **R11** | Unified media sampler | Images: `fileDrop` with `assetKind: "image"`, drawn cover/crop inside current canvas bounds without changing `canvas.size`. Upload UI may not go on the canvas, and the pre-content canvas must stay neutral — no placeholder artwork. Video: see **C3** and Open Question 7. |
| **R12** | CodeMirror for the shader editor | **Built-in `code` control** (`CodeTextarea`), `textValueKind: "structured"`. No new dependency. Caps at 12 visible lines with internal scroll — see **C4**. The compile-error surface becomes schema `description` plus product output, not an editor gutter. |
| **R13** | Three.js on its own swapped canvas | **A `<canvas data-toolcraft-product-output>` inside `canvasContent`**, sized by `useToolcraftProductSceneFrame()`. `modelPresentation` does not apply — the lamellae are procedural, not an uploaded model. Because it is a visible editable spatial scene, `viewInteraction.mode: "orbit"` is mandatory with a matching schema `orientationGizmo` target; a hand-rolled orbit camera is not permitted. Preview and export may differ only with a recorded `previewExportDifferenceReason`. |
| **R14** | Product-owned PNG readback, WebCodecs, worker GIF encoder | **Deleted.** Runtime owns export entirely: it resolves the scene frame, allocates backing, composites background and media, awaits one `exportRenderer.renderFrame`, encodes, downloads, and reports progress. Product code may not allocate export canvases, call `toBlob`/`toDataURL`, create object URLs, or instantiate `MediaRecorder`/`VideoEncoder`/Mediabunny. PNG scale is the runtime `Image Export` `2K`/`4K`/`8K` select, not 1x/2x/4x; aspect ratio is runtime Setup. Video is `MP4`/`WebM` at a fixed 30 FPS offline schedule. GIF and SVG: see **C2**. |
| **R15** | Per-engine SVG capability flag | Superseded by **C2**. |
| **R16** | Golden-image tests as the primary net | **The framework owns proof.** `app-acceptance-data.ts`, `app-performance.ts`, `app-verification-impact.json`, and `npm run verify:delivery` are the gate; `app-acceptance.ts` and the harness are framework-owned and uneditable. Product-specific Vitest/Playwright files may be added alongside. Unit tests for the pure layers (field math, period arithmetic, loop quantization) remain valid and valuable. |

## New constraints the design did not account for

- **R17 — There is no product toolbar.** `toolbar` is runtime-owned (history, radar, theme, zoom). The nine tools cannot live there. Tool selection becomes a schema `tabs` control (it replaces the workflow view below it); engine selection becomes `select`. `segmented` is impossible for both: it caps at 4 options, ≤9 chars each, ≤24 chars total.
- **R18 — Panel grouping must be rebuilt.** Sections are per-entity with a stable `entityId`, `entity`, exact `targets`, and `groupingReason`, declared in an exported `appControlSectionInventory`. Hard maximum ten controls per entity; eight to ten requires `semanticGroup` on every control; above ten splits into balanced two-to-ten-control `workflowStage` sections sharing the same `entityId`. The proposed seven groups fail on two counts: `Color` is a banned title, and Geometry alone exceeds ten controls. Motion loses transport to the runtime timeline.

Corrected against `src/app/acceptance/section-title-rules.ts`: banned titles are `control(s)`, `setting(s)`, `parameter(s)`, `option(s)`, `configuration`, `config`, `adjustment(s)`, plus control-type names including `color(s)`. **`Export` is not banned** — an earlier version of this entry said otherwise and was wrong. Separately, `control-layout-section-rules.ts:16` treats `animation`, `export`, `motion`, `output`, `scene`, `shape(s)`, `text`, `typography`, `visual(s)` as *broad* titles, which are permitted only below eight controls or fewer than three semantic clusters — so `Motion` and `Export` are usable but constrained.

**`Image Export`, `Video Export`, and `Background` each need an inventory entry.** `src/app/acceptance/controls.ts:isToolcraftProductSectionControl` excludes only `panelActions`, `settingsTransfer`, and the seven reserved Setup targets. `export.image.format`, `export.image.resolution`, `export.video.format`, `export.video.resolution`, and `export.includeBackground` are therefore ordinary product controls that consume their section's ten-control budget. Only the sticky `panelActions` control is exempt.
- **R19 — Preset save/load is `settingsTransfer`.** Runtime owns `Export Settings` / `Import Settings` in Setup, and implementing settings import/export through `panelActions` or app-authored controls is explicitly forbidden. Built-in presets remain product-owned; the user's "copy preset JSON to clipboard / import preset JSON" is the runtime feature, so the `S = save preset` shortcut and a custom preset panel both disappear. Clipboard copy may still exist as an *additional* action.
- **R20 — Keyboard shortcuts shrink.** Runtime history owns undo/redo shortcuts; Space/play-pause belongs to the timeline transport; `S` is superseded by R19. Only `R = randomize` (a `panelActions`/`actions` command) and `F = fullscreen` remain plausibly product-owned, and both need checking against the runtime before being specified.
- **R21 — Randomize is a schema action.** `actions` for per-section randomize (e.g. randomize palette), `panelActions` for a global one. Per-panel lock toggles are ordinary `switch` controls, but each lock consumes one of the ten-control budget in its section.
- **R22 — Color slots are `collectionActions`.** Users own cardinality (2–8), so `collectionActions` with a `color` `itemControl` is the exact owner — not eight conditional color controls. Per-item labels are omitted for a shared palette bank.
- **R23 — Gradient and curves are atomic compound controls.** `gradient` owns type, angle, stop track, and stop list; splitting owned fields into sibling controls is forbidden. The gradient interpolation-space toggle from R10 must therefore be a separate product control or an upstream kit extension, not a field grafted into `gradient`.
- **R24 — Canvas defaults to 16:9 / 1920×1080** in `editable-output` mode. That matches the 1080p performance target exactly.
- **R25 — `canvas.renderScale` obliges one acceptance row** targeting it with `renderScaleCoverage.kind: "selected-backing-pixels"` and states `["interaction", "playback", "steady"]` (sorted, `playback` included because timeline is enabled).
- **R26 — The worklog is a delivery gate.** `docs/toolcraft/agent-worklog.md` must carry `Mode: product` and one Decision Trail entry per delivery batch, or `npm run test` fails. Every other file added under `docs/toolcraft` is rejected.
- **R27 — Product styling is `*.module.css` only**, every selector locally anchored. No global CSS, no `:global`, no host-attribute selectors.
- **R28 — Product modules must form an acyclic graph** and may not import anything below `src/toolcraft/ui/components/controls/**`.

## Post-reconciliation findings

Recorded after resolving Open Question 7 by direct inspection of the signed runtime.

### R29 — Imported video is viable through the file media path

The runtime carries no bytes in state: `ToolcraftMediaAsset` holds only `mimeType` plus an opaque `resourceRef` and a `lifecycle` of `ready | restoring | unavailable`. The sanctioned accessor is `useToolcraftMediaPresentationUrls(assets)`, exported from the public `@/toolcraft/runtime/react` entry, which returns a `ReadonlyMap<assetId, url>` with retain/release lifecycle. It accepts **any non-model asset kind** — not images only — and builds each URL as `URL.createObjectURL(new Blob(bytes, { type: contentType }))`. A blob URL carrying a video MIME type is directly playable by a `<video>` element.

The working path is therefore:

1. A `fileDrop` with `assetKind: "file"`, `multiple: false`, and `accept` narrowed to video MIME types and extensions.
2. `useToolcraftMediaPresentationUrls([asset])` to obtain the blob URL.
3. An imperatively created, never-mounted `<video>` element as the decode surface — not app UI, and not inside `canvasContent`.
4. `texImage2D` from that element, with `video.currentTime` derived deterministically from loop time.

No storage API is touched and no boundary is crossed. **Risk:** `currentTime` seek precision depends on codec and container, so nearest-frame sampling may be the practical guarantee rather than exact-frame. The protected video acceptance requires only *distinct* decoded product frames, so this satisfies the gate; the product's own export-parity assertion should be written to that tolerance. See Open Question 9.

### R30 — The export surface is a 2D context, and passes run through the supplied pipeline client

`renderFrame` receives `{ context: CanvasRenderingContext2D, frame, pixelRatio, rendererPipeline, state, timeSeconds, timelineProgress }` and returns `PromiseLike<void> | void`.

Three consequences the design did not anticipate:

- **Async is explicitly supported.** Awaiting a video seek, or any real work, per export frame is legal. This is what makes R29's deterministic sampling possible at all.
- **The artifact surface is Canvas 2D, not WebGL.** A WebGL product renders into its own render target and composites into the supplied 2D context. This is *not* the forbidden "product-owned export canvas" — the prohibition covers allocating the artifact canvas, choosing encoders, and owning download mechanics, none of which this does. Confirm the exact boundary against `decision-contract.md` during the Implementation phase before writing export code.
- **`rendererPipeline` is supplied to the export frame**, so GPU passes during export run through the same compiled registration as preview. That is the mechanism keeping preview and export semantically equivalent, and it is why one shared pipeline registration matters.

- **`timeSeconds` and `timelineProgress` are both supplied**, so time-derived state needs no product-side clock reconstruction during export.

### R31 — Pass cost is constant with respect to the stripe dimensions

`performance-render-plan-pass-assessment.ts:236` requires a kernel benchmark when a pass runs at `frame` or `interaction` frequency **and** either its `relationship` is `quadratic`, `product`, or `benchmark`, **or** the relationship is non-`constant` while the pass `kind` is `pixel-transform`, `rasterize`, or `composite`.

The 2D chain is entirely `pixel-transform` and `composite` at frame frequency, so whether a benchmark fires depends solely on the declared relationship — and the truthful relationship with respect to stripe count and line frequency is **`constant`**. Per-pixel cost does not vary with either. The real cost drivers are pixel count (canvas size × render scale, both runtime-owned and therefore not product workload dimensions) and the number of enabled passes (discrete, feature-flagged).

Consequences:

- The 2D passes declare `relationship: "constant"` for stripe dimensions. No kernel benchmark fires for them, and the apparent conflict between `workflow.md:117` ("resolve benchmarks before accepting the renderer") and `core/performance.md` ("keep pending through functional delivery") never lands on the 2D renderer.
- The **3D lamellae `rasterize` pass is the one legitimate exception**: lamella count genuinely drives instance count, so its relationship is `linear` and a kernel benchmark requirement is expected. That is Stage 6, and the deferred-validation policy lets it remain pending through functional delivery.
- Declaring the 2D passes as scaling with stripe count would be a modelling error, not a conservative choice. It would encode a false cost model and leave a permanent pending benchmark requirement.

### R32 — Global speed is a whole-cycle multiplier, not a time scale

Continuous time scaling is incompatible with seamless loops: LFO rates quantize to whole cycles per timeline duration, so a 0.5× multiplier turns N cycles into N/2 and splits the loop seam. Since runtime timeline duration already owns loop length, speed must mean something orthogonal to it.

Global speed therefore multiplies each LFO's **whole-cycle count** within the loop — 2× means twice as many complete cycles in the same duration. It is authored as a `sliderValueKind: "discrete"` slider over an integer domain, which is the honest control for that value model anyway. Loops remain seamless at every reachable value.

*Alternatives:* a continuous multiplier — rejected, it breaks the framework's seamless-forward-loop default and would fail the loop proof. Deleting the control and letting duration own speed — rejected, it collapses "faster motion" and "shorter loop" into one knob when the brief asked for both.

## Post-critique corrections (R33–R39)

Added after an independent critique verified the plan against `src/app/acceptance/` — the framework-owned validators, which are stricter than the prose docs.

### R33 — A section title must not resemble the condition that gates its controls

`src/app/acceptance/control-layout-dependency-rules.ts:44` errors when a control's gate lives in another section **and** the section title equals, contains, or is contained by the gate's condition value or option label. So a `Glitch` section gated by `tool == "glitch"`, an `ASCII` section, a `Halftone` section, a `Lamellae` section, and every per-engine section are all rejected.

Sections are therefore titled by the **entity they edit**, never by the branch that reveals them: `Signal Damage` not `Glitch`, `Character Grid` not `ASCII`, `Dot Screen` not `Halftone`, `Extruded Fins` not `Lamellae`. This is the single highest-reach constraint on the C5 decomposition.

### R34 — Every gate lives in the same inventory entity as what it gates

`src/app/acceptance/control-applicability-cases.ts:getSemanticPeerTargets` derives applicability cases from the targets of the control's **own inventory entry**. A control gated by a selector in a different entity generates *zero* cases, so the harness proves neither its presence nor its absence.

Rule: a gate and everything it gates share one inventory entity. The two global mode selectors — engine and tool — are the deliberate exception, because they cross every entity by nature; their branch behaviour is proved by named app-owned Playwright tests rather than derived cases, and that exception is recorded in the worklog. `specs/interference-layer` already models the general rule correctly.

### R35 — The product scene is a fixed world rect, independent of `canvas.size`

`sceneBoundsProvider` must return exact-state world rectangles, `canvas.size` is dormant and forbidden as a source in infinite mode, and infinite video export unions the provider across every scheduled frame — so the answer must be constant over the timeline. A full-field shader has no intrinsic extent.

Decision: the product composition occupies a **fixed world rect of constant dimensions anchored at the world origin**, declared as a product constant rather than a control. It does not vary with `canvas.mode`, playback time, or parameter values. Finite mode renders it at the finite frame; infinite mode renders it at the same world rect. This satisfies exact-state resolution, cross-frame stability, and the ban on reading dormant size. *Worth confirming with the user, since it fixes the aspect of infinite-mode output.*

### R36 — Keyframeable is opt-out, and the classification is explicit

`acceptance-testing.md` requires keyframe coverage — diamond creation, expanded rows, update on control change, scrub and playback evaluation, product output change — **for every inferred keyframe-capable control**. With ~100 parameters that is ~100 browser proofs.

Every target is therefore classified before Stage 3, and everything that is not a genuine animation target carries `keyframeable: false`: seeds, mode and engine and tool selectors, sampling resolution, section locks, export format and resolution selects, palette cardinality, and the shader hook source. "Everything is a parameter" remains true of inspectability and serialization; it is deliberately *not* true of keyframeability.

### R37 — The WebGL2-unsupported message is product text inside `canvasContent`

`runtime-boundary.md` forbids app UI, CTAs, and helper copy in `canvasContent`, and product code has no other surface — so the unsupported message has no obviously legal home. Decision: render it as DOM product text inside `canvasContent` marked `data-toolcraft-product-text`, which is the documented marker for product text and is defensible because a WebGL2 failure means there is no product output to show and this *is* the output. Recorded here so it is not left to the implementer.

### R38 — `baseFileName` is required

`src/toolcraft/runtime/export/product-export-renderer.ts:20` types `baseFileName` as required and `:58` rejects a blank value. The composition supplies a non-blank product name.

### R39 — The media blob URL needs an explicit bridge to `renderFrame`

`useToolcraftMediaPresentationUrls` resolves asynchronously and releases its handles on unmount, while `exportRenderer.renderFrame` is a plain callback that cannot call a hook. The bridge is a module-scoped retained-handle ref written by a hook mounted inside `canvasContent` and read by `renderFrame`, with defined behaviour when export begins before the retain resolves or after release. An 8s export at 30 FPS implies ~240 seeks, so the seek path needs a timeout policy rather than an unbounded await.

### R40 — Playback first, keyframes as its own change

See the amendment to the Animation intent inventory above. Stage 3 ships `panels.timeline` in `playback` mode with parameter drift; `keyframes` mode is deferred because it obliges keyframe acceptance coverage for every keyframe-capable control and forbids opting any of them out.

### R41 — Drift rates are integers, not quantized continuous rates

Task 11.5 planned to accept a continuous rate, quantize it to the loop at evaluation time, keep the user's requested value in state, and surface the corrected one. The simpler construction is to make the domain integers: whole cycles per loop, `step: 1`. Every reachable rate then loops by construction, there is no corrected value to surface, and nothing in state disagrees with what renders. The unit differs per parameter and is a property of that parameter's own periodicity — for the stripe field it is the sequence period, `lcm(2, paletteLength)` bands, because a one-band shift changes both the palette index and the side of the width alternation. For a parameter with no spatial period, such as the immersion balance, the drift is a sine sweep, which closes at every whole cycle for the same reason.

### R42 — Scene parameters must be referentially stable across playback ticks

`use-toolcraft-pipeline-pass.ts:50` compares its cache input one level deep, so a `sceneParameters` object rebuilt with identical contents reads as a new input. That was harmless while state only changed on an edit. Under playback the runtime dispatches a transient state every frame, so without a stability gate a scene with no drift would redraw at frame rate to produce identical pixels. `croix10-canvas.tsx` holds the previous object while its serialisation is unchanged.

### R43 — The ramp is one entity, drift included, because the source gates the drift (task 9A.0)

The plan in 9A.0 was to give the ramp's animation targets their own `ramp-drift` entity, on the reasoning that `chromatic-ramp` was already at six targets. Writing it out shows that split is not available.

`ramp.source` decides whether the stripe field takes its colour from the palette or from the ramp. When it is on the palette, the ramp's phase and drift rate change nothing, so both must be conditional on it — and R34 puts a gate in the same inventory entity as the controls it gates. A `ramp-drift` section would place the gate in `chromatic-ramp` and the gated controls somewhere else, which is exactly the arrangement R34 exists to reject. Drift therefore stays with the ramp.

That makes nine targets. Under ten, so the split rule does not force a division, but eight or more obliges `semanticGroup` (task 20.4), which is the honest description anyway: this section holds a colour source, a colour definition, a spatial mapping, and a motion over that mapping.

Three naming constraints follow, and they are tighter than they look:

- **R33 forbids the obvious option labels.** `ramp.source` gates controls in its own section, so no section title may equal, contain, or be contained by one of its option labels. `Ramp` is out — `Chromatic Ramp` contains it. `Gradient` is out for the reason the section was renamed in the first place. The labels are **`Palette`** and **`Continuous`**, which describe what the colour does rather than which control produced it, and collide with no title in the inventory.
- **The palette path must survive.** 4.6 proved the canonical green / black / red / black / blue module at a configured pitch. A ramp that replaced the palette silently would invalidate that proof, so `ramp.source` defaults to `Palette` and the ramp is opt-in.
- **Drift reuses R41 unchanged.** `ramp.driftCycles` is whole cycles per loop over an integer domain, zero byte-identical to static. The ramp's period is the mapping's own extent — one full traversal of the ramp across the field — so a whole cycle returns it to itself and the seam closes without a quantization step.

The `radialCenter`, `quantizeEnabled`, and `bandCount` targets stay in the table as group 9's remaining scope; the first ramp batch ships `source`, `gradient`, `interpolationSpace`, `phase`, and `driftCycles`.

**The mapping control does not exist, and that is R23 rather than a cut.** The plan above listed `ramp.mapping` as a sibling select choosing whether the ramp ran across or along the bands. The `gradient` control already owns that choice as its `gradientType`, along with its `angle`, and R23 forbids splitting a compound control's owned fields into siblings. The framework enforces it directly: declaring the control obliges `controlPartCoverage` for every semantic part — `gradientType`, `angle`, `stops.position`, `stops.color`, `stops.opacity` — and a part the renderer ignored could not be proved. So the ramp consumes all five. Type selects linear, radial, angular, or diamond distribution; angle rotates it; stop opacity is coverage over the support, the same reading the separators already carry.

### R44 — The cursor hotspot is committed state, not a live pointer read (tasks 9B.0–9B.2)

Requested behaviour: the ramp responds to the cursor approaching. The three open questions 9B raised are settled together, because the answer to the first decides the other two.

**9B.0 — the hotspot is product state.** Transient was the cheaper reading, and it is the wrong one here. `exportRenderer.renderFrame` is a pure function of state, `timeSeconds`, and `timelineProgress` (5.1), so a transient cursor cannot reach an export at all: the artifact would silently lose an effect the preview showed, and every export would differ from what the user was looking at. Committing the hotspot keeps one function serving both paths, which is the property the whole renderer is built around.

The cost is honest and small: a hotspot in state persists across reload and restores where the user left it. That is a feature for a composition tool — the scene reopens as it was — rather than the stale-hotspot problem a *live* cursor position in state would create.

**9B.1 — the canvas owns it, and nothing else may.** `interaction-surface-ownership` is an invariant, and a panel `vector` editing the same position would be the same capability on two surfaces. `component-rules.md:137` independently forbids a pad for pointer movement. So the hotspot target has **no panel control**: the canvas writes it through `controls.setValue`, which is the same dispatch the `R` accelerator already uses to write ordinary targets. The panel owns only the field's shape — radius, falloff, strength — which is a different capability from where the field is centred.

A target with no control is not a hidden control: it is state the canvas authors, the way a scroll position or a committed crop is. It carries no acceptance coverage obligation because coverage attaches to *visible* controls, and it reaches Settings Transfer through `additionalValueTargets`.

**9B.2 — commit on gesture end, and export reads the commit.** While the pointer is over the canvas the preview follows it, because a proximity effect that only appeared on release would not read as proximity at all. On pointer-up — or pointer-leave, which ends the gesture just as definitely — the position is written to state in one history group, so undo takes the hotspot back in a single step.

Preview during an active gesture therefore shows a value that state does not hold yet. That is not a preview/export divergence: it is exactly what dragging a slider does before release, and `previewExportDifferenceReason` is not needed. Export renders the committed hotspot, which is the last thing the user actually placed.

**What this forbids.** No `vector` control for the hotspot. No live write on pointer-move — that would put a value in history sixty times a second and make undo useless. No reading `event.clientX` inside `renderFrame`.

### R45 — The shape collection's shape is decided by what `itemControls` accepts (tasks 9C.0, 9C.1, 9C.7, 9C.10, 9C.11)

Three planning assumptions in group 9C do not survive contact with the collection rules. Recording them before code, because each changes what gets built.

**The three-section split does not exist.** 9C.0 planned to divide the shape entity into placement, fill, and shadow sections, "so no section exceeds ten controls". Those are per-shape fields, and per-shape fields are `itemControls` inside one compound record — they are not sections and the ten-control section budget never applies to them. Runtime also splits a large compound control into its own section, which is why `transchromie.planes` already sits alone. So the collection is **one** section holding **one** control, and the budget question was never real. This is the same mistake 9A.0 made: planning a split the framework's own structure forbids.

**Per-shape gradients cannot be gradients.** `component-rules.md:91` fixes the item types a collection accepts — `checkbox`, `color`, `colorOpacity`, `fontPicker`, `rangeInput`, `rangeSlider`, `segmented`, `select`, `slider`, `switch`, `text`, `vector` — and "unknown item types fail schema validation". `gradient` is not among them. A gradient per shape is therefore not expressible as an item field, and no amount of arranging changes that.

The resolution keeps the request and fits the rules: shapes sample **the chromatic ramp that already exists**, each at its own offset and scale, declared as ordinary `slider` item fields. A shape then reads as gradient-filled, its fill is related to the composition's own colour rather than an unrelated second palette, and 9A's ramp does the work twice. A per-shape solid tint stays available as a `color` item for shapes that should not take the ramp at all.

**Uploaded shapes have a purpose-built route.** The same rule describes a multiple file-kind `fileDrop` with `variant: "collection-actions"` that "may declare `itemControls` to render built-in settings directly below each attached file and persist per-file values keyed by `mediaId`". That is exactly an uploaded-shape list with per-shape placement below each file, so 9C.5 does not need a parallel mechanism bolted to a `collectionActions` array — the upload *is* the collection. Analytic shapes stay a separate `collectionActions` array, because a shape with no file has no `mediaId` to key on.

**The canvas may own dragging, and 9B already proved the route.** 9C.10 asked whether a product-authored canvas handle has a schema route, given `controls-panel-renderer-registry.ts:49` maps only `orientationGizmo` to the `canvas-handle` renderer kind. It does not — but R44 established the working alternative: the canvas owns a pointer interaction, writes the target through `controls.setValue` on gesture end, and is proved by named app-owned Playwright tests rather than an acceptance `kind` that does not fit. Shape dragging takes that route, with one history group per completed drag.

**9C.11's ownership resolution follows from it.** The canvas owns placement outright. There is no panel `vector` for a shape's centre, for the same reason the cursor hotspot has none: it would mirror one capability across two surfaces. Per-shape *size*, *rotation*, and fill stay in the panel, which is a different capability from where the shape sits.

### R46 — Shape positions are a canvas-owned array beside the collection, not a field inside it (task 9C.2)

R45 put placement on the canvas and refused a panel `vector` for a shape's centre. Writing the record out shows those two decisions collide, and the collision has to be resolved before the migration rather than during it.

A `collectionActions` record is exactly its declared `itemControls`: `component-contracts.choices.ts:275` requires proving that add "creates every declared default field in one runtime record", and `component-rules.md:91` rejects unknown item types outright. So a centre carried inside the record has only two forms, and both are wrong:

- **Declared as a `vector` item.** The record is then well-formed and add-coverage works — but a rendered vector is editable by definition, so the panel and the canvas would both set position. That is one capability mirrored across two surfaces, which `interaction-surface-ownership` forbids as an invariant.
- **Undeclared, written only by the canvas.** No mirroring, but the record no longer matches its declaration: a shape added by plus would have no centre until someone dragged it, and the add proof cannot cover a field the schema does not declare.

**Positions therefore live outside the collection**, in a `shapes.centers` array with no control at all — the `proximity.center` pattern from R44 generalised from one point to many. The collection holds what the panel owns (kind, size, strength, mode, fill), the array holds what the canvas owns, and each is complete on its own surface. `shapes.centers` joins `persistence.additionalValueTargets`, and the canvas writes it through `controls.setValue` on drag end.

Two consequences to build against. Adding a shape appends to the collection while the position array is still short, so **a missing entry has to mean the composition centre** rather than an error — a new shape appears in the middle and is dragged from there, which is also the behaviour a person expects. And removing a shape has to drop the matching position, so the two stay index-aligned; the removal proof covers both or the arrays silently diverge.

**Keyframe classification (task 9A.6), recorded but not yet flagged.** `ramp.phase` and `ramp.driftCycles` are genuine animation targets. `ramp.source` and `ramp.interpolationSpace` are mode selectors and are not. `ramp.gradient` is keyframe-capable by control type but is not an animation target in this delivery — the ramp's motion is drift, which has its own scalar. The `keyframeable: false` flags are deliberately not written yet: `control-acceptance-policy.ts:101` only rejects them while the timeline is in `keyframes` mode, so today they would be flags nothing validates, and task 11.0 owns the whole-product classification. They land with the keyframes change (R40).

## Conflicts requiring a decision

These are places where the user's stated requirements and the framework contract cannot both hold. Each needs an explicit call before the affected stage.

- **C1 — "Degrade stripe count before dropping frames" cannot be implemented, and its premise was wrong.** Two separate problems. First, runtime quality clamping is forbidden: `core/setup-export.md` and `core/performance.md` both classify a quality clamp or lower-resolution stretch as *a functional failure*, and bar meeting a budget by reducing selected quality, backing resolution, or product range. So D9 must go. Second — and this is the part the original resolution got wrong — **stripe count was never the cost driver.** A fragment shader evaluating a stripe field costs the same per pixel whether there are ten stripes or a thousand; stripe count is a divisor in the field math, not a loop bound. See R31. **Accepted resolution:** delete D9, and stop treating density as a performance dimension at all. The line-frequency maximum becomes a *fidelity* bound derived from Nyquist against effective pixel pitch — computed, not measured — because what high frequency actually costs is aliasing, not frame rate. The earlier plan to cap density by measurement at Stage 0 was doubly wrong: it modelled the cost incorrectly, and it scheduled a measurement the delivery lifecycle does not authorize.
- **C2 — GIF and SVG export are not available.** Runtime owns artifact export and offers exactly image (PNG/JPG) and video (MP4/WebM via Mediabunny). Product-owned encoders and object-URL downloads are explicitly forbidden, so neither a GIF encoder nor an SVG file download can be built. **Recommended resolution:** drop GIF (WebM covers seamless-loop delivery), and expose SVG as a clipboard *copy* action, which the contract permits as an additional product action. Anything more requires a custom encoder plus full acceptance and performance coverage, i.e. an upstream kit change.
- **C3 — Webcam input has no framework affordance, and live video conflicts with export.** Media arrives through `fileDrop` as durable uploaded assets; nothing exposes a `MediaStream`. Worse, runtime export re-renders deterministically from immutable state at scheduled timeline times — a live camera feed cannot be re-rendered at time *t*. **Recommended resolution:** support imported video files (pending Open Question 7) and drop webcam, or accept that webcam is preview-only and excluded from export. This is a genuine architectural incompatibility, not a gap I can code around.
- **C4 — The shader editor is capped at 12 visible lines.** The `code` control scrolls internally rather than growing. A full engine fragment shader is far longer, so "preloaded with the current engine's shader" means editing a substantial program through a 12-line viewport. **Recommended resolution:** expose only a marked, self-contained *user hook* chunk (the colour/field function) rather than the whole program. This preserves the creative intent — hacking uniforms and math directly — within a usable control.
- **C5 — Nine tools plus six engines plus every parameter will not fit the section budget.** With a ten-control hard cap per entity and mandatory workflow-stage splitting, this app needs on the order of fifteen to twenty-five sections. That is legal but demands a deliberate entity decomposition, authored as `appControlSectionInventory` **before** any schema code. **Recommended resolution:** treat the inventory as its own design deliverable at the start of Stage 1, and consider narrowing the initial tool set — the staged build order already defers most tools, so the inventory can grow per stage.

## Revised stage 0

Stage 0 is complete except for the decisions above. Concretely done: package identified and scaffolded (`--name croix10`, skills installed for `claude-code`), contract docs read, runtime helpers verified, pin-on-read decisions reconciled. Still required before Stage 1 code, in order:

1. Resolve C1–C5.
2. Switch `app-acceptance-data.ts` to `mode: "product"` with `productName`, `productSummary`, `requestedBehavior`, `exportIntent` (image `toolcraft-default`; video `user-requested` — the brief explicitly asks for WebM/MP4, which is the required evidence), `interactionOwnership`, and `viewInteraction`.
3. Author `appControlSectionInventory` (C5) and the Control Selection Inventory.
4. Write the Animation Intent Inventory (keyframes timeline) and the Renderer Technique Decision Matrix.
5. Declare `workloadEnvelope` and `rendererPipelineRegistration`; run `assessToolcraftRenderPlan` clean.
6. Only then write renderer code.
