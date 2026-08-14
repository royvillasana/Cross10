# Croix10 — Cruz-Diez Generative Art Studio

## Why

There is no tool that treats Carlos Cruz-Diez's chromatic research as a *parametric, animatable system*. His work — Physichromie, Couleur Additive, Induction Chromatique, Chromointerférence, Transchromie, Chromosaturation — is built from a small set of rigorous rules (thin parallel line modules, additive mixing at stripe boundaries, moiré interference, viewer-dependent color) that map almost perfectly onto fragment-shader uniforms. Croix10 makes that mapping explicit: every element of the visual grammar becomes an inspectable, keyframeable parameter, so the language can be recreated, mutated, animated, and applied to imported images and video.

We build on the Toolcraft starter kit (`@pixel-point/toolcraft`) so the entire control surface — schema-driven controls, panel system, shared canvas surface, timeline/keyframes — comes from one system rather than a hand-rolled UI.

### Scope corrections from the Toolcraft contract

The app is scaffolded from `@pixel-point/toolcraft@0.0.18` and its contract docs have been read. Toolcraft owns considerably more than assumed, and five requirements in the original brief could not be built as stated. The accepted resolutions, detailed in `design.md` under Contract Reconciliation:

- **Stripe density is bounded by fidelity, not by frame rate.** Toolcraft classifies runtime quality clamping as a functional failure, so the requested "degrade stripe count before dropping frames" cannot be built. It also turns out not to be needed: a fragment shader costs the same per pixel at ten stripes or a thousand, so density was never the cost driver. The line-frequency maximum is instead derived from the Nyquist limit against pixel pitch — a computed fidelity bound, since what high frequency actually costs is aliasing.
- **GIF export is dropped**; seamless-loop WebM covers loop delivery. Runtime owns encoding and offers PNG/JPG and MP4/WebM only.
- **SVG export becomes a clipboard copy** rather than a file download, which is the form the contract permits.
- **Webcam input is dropped.** Nothing in the runtime exposes a `MediaStream`, and live input is incompatible with deterministic offline export. Imported video files remain.
- **The shader editor exposes a self-contained user-hook chunk**, not the whole program, because the built-in `code` control caps at 12 visible lines.

Additionally: there is no product toolbar (it is runtime-owned), so tools are a `tabs` control; preset import/export is the runtime's Settings Transfer; and panel sections are capped at ten controls per entity, so the control inventory is its own design deliverable.

## What Changes

- **New application.** A browser-based generative art studio, Croix10, scaffolded on the Toolcraft starter kit with a dark, token-driven UI: a hero canvas plus Toolcraft's collapsible controls panel. Sections are entity-scoped and capped at ten controls each, declared in an `appControlSectionInventory` authored before any schema code; runtime owns the `Setup` block and the sticky export footer.
- **WebGL2 rendering core.** A single main canvas driven by fragment shaders, with a uniform registry as the one source of truth for visual state. Three.js is used only where 3D is genuinely needed (the lamellae tool). No canvas2D fallback unless trivial.
- **Six chromatic engines** as first-class, selectable modes: Physichromie (virtual viewing angle uniform), Couleur Additive (band sequences separated by thin dark lines, per-band width), Induction Chromatique (high-frequency line pairs, complementary fringes), Chromointerférence (two stripe layers, traveling moiré, shapes revealed only by phase shift), Transchromie (translucent overlapping planes), Chromosaturation (full-field drifting color).
- **Everything is a parameter.** Every uniform is declared through Toolcraft schema controls, making it inspectable, animatable, and serializable by construction. Global controls cover stripe geometry (count, pitch, width ratio, gap, angle, phase, jitter amount/frequency, mirror/duplication), color (2–8 slots, Cruz-Diez palette presets, harmony generator, per-band cycling offset), gradients (full stop editor mapped along/across stripes or radially, animatable), a second interference layer with independent pitch/angle/speed and blend modes, and the virtual-viewer angle/parallax pair.
- **Presets and randomization.** 8–12 built-in presets covering each series with its canonical palette; scene state serialization, copy, and import are the runtime's Settings Transfer. A Randomize action with per-section lock toggles.
- **Nine tools selected through a `tabs` control.** Procedural graphics generator (incl. shapes as phase/width perturbations of the stripe field), gradient tools with quantize-to-bands, image stylization via `fileDrop`, imported-video effects, ASCII/ANSI rendering, pixel/halftone/glitch suite, a live fragment-shader hook editor, Three.js lamellae/parallax 3D experiments, and animation controllers.
- **Animation system.** Toolcraft's keyframes timeline over any animatable parameter, LFO modulators (sine, triangle, periodic noise) assignable to any uniform, and global speed as a discrete whole-cycle multiplier — continuous time scaling would split the loop seam. Loop length is the runtime timeline duration; seamless forward-only loops are the framework default.
- **Export.** Runtime-owned PNG/JPG at 2K/4K/8K with runtime Setup aspect ratio, and seamless-loop MP4/WebM at 30 FPS over the timeline duration, both drawn from one product `exportRenderer`. SVG copied to the clipboard for geometry-only engine states.
- **Keyboard and performance contract.** Playback transport and undo/redo are runtime-owned; `R = randomize` is the product shortcut. 60fps at 1080p on integrated GPU achieved through honest pass-cost modelling and optimization, never by degrading quality; no control ever blocks the render loop.

## Capabilities

### New Capabilities

- `toolcraft-app-shell`: Toolcraft scaffold, dark token UI, entity-scoped control sections and their inventory, `tabs` tool selection, conditional applicability, the `R` shortcut.
- `chromatic-render-core`: WebGL2 context inside the runtime scene surface, declared renderer pipeline, shader variant assembly and caching, resource lifecycle, and honest pass-cost declaration against the performance budget.
- `stripe-engines`: The six Cruz-Diez engines and their shared stripe field — geometry, jitter, mirroring, virtual viewing angle, embedded shapes as field perturbations.
- `parameter-schema-controls`: Declarative parameter definitions bound to Toolcraft controls; the contract that makes every uniform inspectable, animatable, and serializable.
- `color-and-gradient-system`: Color slots, Cruz-Diez palette presets, harmony generator, band cycling, gradient editor with stripe-relative/radial mapping, quantize-to-bands.
- `interference-layer`: Second stripe layer with independent pitch/angle/speed and blend modes (normal, multiply, screen, difference, additive).
- `scene-presets`: Built-in preset library, runtime Settings Transfer as the serialization boundary, reload persistence, randomization with per-section locks.
- `animation-system`: Runtime keyframes timeline and loop time, LFO modulators quantized to the timeline duration, global speed as a whole-cycle multiplier, seamless forward-only loops.
- `media-stylization`: Imported image and video sources re-rendered through the engines; luminance/motion driving stripe width or phase; sampling resolution and mapping modes. Webcam is out of scope.
- `post-fx-suite`: ASCII/ANSI mode, pixelation with palette quantization, halftone (dot/line/cross), and glitch effects (channel split, block displacement, scanline tearing, smear) with intensity and seed.
- `shader-editor`: Built-in `code` control over a self-contained engine hook chunk, compile-error surface, hot reload, annotated uniforms as controls.
- `lamellae-3d`: Three.js lamellae inside `canvasContent`, orbit through the runtime orientation gizmo, real parallax colour change, light/shadow toggle, and stripe shaders on cylinders and spheres.
- `export-pipeline`: Runtime-owned PNG/JPG and seamless-loop MP4/WebM driven by one product export renderer, plus SVG clipboard copy for geometry-only engine states.

### Modified Capabilities

None — `openspec/specs/` is empty; this is the first change in the project.

## Impact

- **Codebase**: greenfield. Introduces the Toolcraft app scaffold, a `shaders/` GLSL layer, a parameter/uniform registry, engine modules, tool modules, preset JSON, and export workers.
- **Dependencies**: `@pixel-point/toolcraft@0.0.18` (app shell, controls, panels, timeline, export, encoding) and Three.js (lamellae tool only). No code editor and no encoder are added — the built-in `code` control and the runtime's Mediabunny backend own those roles.
- **Browser APIs**: WebGL2 (hard requirement) used directly by product code. Clipboard (SVG/CSS copy) is a product action; media import, persistence, and encoding are reached only through runtime-owned surfaces.
- **Risk**: the real cost concentration is per-frame video upload through a multi-pass FX chain, not stripe density (see R31). High-frequency engines are bounded by aliasing rather than frame time, and no runtime quality clamping is available as a backstop.
- **Sequencing**: staged build order (canvas + Couleur Additive → remaining engines/presets → animation + export → media stylization/post FX → shader editor → 3D), with the app kept functional and visually verified at every stage.
