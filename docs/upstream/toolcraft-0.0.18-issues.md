# Toolcraft 0.0.18 — framework issues found building Croix10 and Shader Studio

Report for `@pixel-point/toolcraft` maintainers. Issues 1–5 were reproduced in a generated
app (`croix10`, WebGL2 raster product, timeline enabled in `playback` mode) on macOS 15.5 /
Node 22 / 8-core machine. Issue 6 was found generating a second app (`shader-studio`) from
the same version. `0.0.18` is `latest`, so none of these can be resolved by upgrading.

Issues 1 and 2 have local workarounds and are annoyances. **Issues 3 and 4 are
contradictions between two framework-owned files that no product change can resolve.**
**Issue 6 makes a freshly generated app fail its own integrity check before a line of
product code is written.**

They do not block `verify:delivery` — the delivery executor greps only the titles derived
from the product's own acceptance matrix, so a framework self-test is never selected. They
do make `npm run test:browser` permanently red for any product that trips them, which
costs a generated app its whole-suite signal.

---

## 1. Playwright worker oversubscription on WebGL products

`playwright.config.ts` sets `fullyParallel: false` but never sets `workers`, so Playwright
defaults to 50% of cores — 4 on an 8-core machine. For a product whose every test drives a
real WebGL2 context, the workers contend for the GPU and the suite degrades superlinearly.

Measured on the same machine and suite:

| Configuration | Wall clock |
|---|---|
| single spec file | 43.2s |
| full suite, 2 workers | 1.3m |
| full suite, 4 workers | 5.5m, then timeout |

The delivery gate is unaffected — `scripts/toolcraft-delivery-executor.mjs:222` already
passes `--workers=1`. Only the `test:browser` dev loop is exposed.

**Suggested fix:** set a conservative default `workers` in the generated
`playwright.config.ts`, or key it off whether the product declares a GPU renderer.

**Local workaround:** a sibling npm script passing `--workers=2`. `package.json` is not
protected, and `check-toolcraft-integrity.mjs` accepts new script names.

---

## 2. Keep-alive close race causes intermittent ECONNRESET

The Vite dev/preview server inherits Node's 5s default `keepAliveTimeout`, advertises
`Keep-Alive: timeout=5`, and closes idle sockets at ~6007ms. The signed proof session
(`e2e/browser-proof-session.ts:104`) calls `page.request.get()` against
`/.toolcraft/server-identity.json` before every action. When a poll lands in the close
window, it reuses a socket the server is tearing down and fails `ECONNRESET`.

Reproduced with a keep-alive agent against the generated app's own dev server:

| Idle gap | Unpatched | `keepAliveTimeout = 120s` |
|---|---|---|
| 5995ms | 0/8 failed | 0/8 failed |
| 6000ms | **2/6 failed** | 0/12 failed |

This one *does* reach the delivery gate, which runs in `preview` mode against the same
server.

**Suggested fix:** either set `server.keepAliveTimeout` above the proof session's polling
interval in the generated `vite.config.ts`, or retry once on `ECONNRESET` in
`readToolcraftServerIdentity`. Either is a one-line change.

**Local workaround:** a `NODE_OPTIONS=--require` preload patching
`http.Server.prototype.listen`. Playwright merges `process.env` into its `webServer`
environment, so it reaches the spawned Vite process. See
`tools/toolcraft-keepalive-preload.cjs`.

---

## 3. Orientation self-tests assume the product renders no timeline transport

**Blocking. No product-side fix exists.**

`e2e/app-browser-orientation-evidence.spec.ts` navigates to the real app (`page.goto("/")`),
then *appends* synthetic playback buttons into the live app root:

```js
root.append(fixture);   // app-browser-orientation-evidence.spec.ts:86
```

`expectPausedPlaybackWhenPresent` (`e2e/browser-orientation-gizmo-live-preconditions.ts:15`)
then counts every button named `Play playback` / `Pause playback` **inside that same root**
and requires the total to be exactly 1, with `Play` visible.

Any product that enables `panels.timeline` renders its own transport, so the count is the
product's button plus the fixture's. Three tests fail:

| Test | Expected error | Actual |
|---|---|---|
| `validates paused maximum-quality proof state` | `/must be paused.*Play playback/` | `exactly one standard playback action` — Expected 1, Received 2 |
| `retains proof for products without optional playback or render scale` | pass | `must be paused` — Expected 1, Received 0 |
| `recipes require shared pose/output changes…` | `/rendered product pixels must change…/` | `must be paused` |

The second case is not about the fixture at all: it asserts against the bare app, and
requires `Play playback` to be visible — i.e. **paused**. But
`src/toolcraft/runtime/state/create-template-state.ts:56` hardcodes `isPlaying: true`, and
`ToolcraftTimelinePanelSchema` (`runtime/schema/types.ts:203`) exposes only
`defaultDurationSeconds`, `enabled`, and `mode`. A product cannot start paused.

**Suggested fix:** scope the button query to the injected fixture rather than the app root,
and either pause the app in the precondition or expose an initial play state on the timeline
schema.

---

## 4. `renderScaleCoverage` rows can never satisfy `app-browser-runtime-requirements`

**Blocking. No product-side fix exists.**

`e2e/app-browser-runtime-requirements.spec.ts:10` asserts that every browser acceptance row
derives a requirement whose `requirementId` equals the row id, and calls the derivation
**without a schema**:

```js
const requirements = deriveToolcraftBrowserRuntimeRequirements(appAcceptance);
```

In `e2e/browser-runtime-evidence-requirements.ts`, a row carrying `renderScaleCoverage` is
explicitly denied its base evidence type (line 194):

```js
if (baseEvidenceType && entry.renderScaleCoverage === undefined && exportArtifactCoverage.length === 0)
```

and its coverage is emitted only under suffixed ids (line 269):

```js
requirementId: `${entry.id}#${state}`
```

The only remaining path to a plain-id requirement is `segmented-control-layout` /
`discrete-slider-layout`, which resolves through `controlsByTarget` — built from the schema
that the test does not pass.

Measured on the generated app, derivation of the `canvas.render-scale` row:

| Call | Plain-id requirements |
|---|---|
| `derive(acceptance)` — as the test calls it | **0** |
| `derive(acceptance, schema)` | 1 |

Meanwhile `docs/toolcraft/schema-reference.md:54` and `core/setup-export.md:57` *require*
enabling `canvas.renderScale` to declare exactly such a row. The framework mandates a row
shape that its own self-test rejects.

**Suggested fix:** pass the schema in the self-test, or emit a plain-id requirement for
`renderScaleCoverage` rows.

---

## 5. Previously reported: `toolcraft-product-control-boundary.test.mjs` fails on the bare scaffold

Recorded earlier in `docs/toolcraft/agent-worklog.md`. A signed synthetic test that builds
its own fixture and never reads the generated app, failing on an untouched scaffold — so
`npm run test` cannot reach a green exit in a freshly generated project.

---

## 6. The scaffolder installs skills as symlinks its own integrity check forbids

Severity: **blocks a generated app at generation time**, before any product code exists.

`npx @pixel-point/toolcraft@0.0.18 create <name>` reports success and exits 0. The very next
command a generated app is meant to run then fails:

```
Toolcraft verification inputs must not contain symbolic links: .claude/skills/brainstorming
```

Six skills are installed as symlinks — `brainstorming`, `browser`, `figma`,
`figma-implement-design`, `systematic-debugging`, `writing-plans` — and the integrity check
rejects symbolic links anywhere in its verification inputs. So the scaffolder's skill
installer and the scaffolder's integrity check disagree about the same directory, and the
default output of `create` is invalid against its own gate.

This is version- or environment-dependent rather than universal: `croix10`, generated from
the same version, has zero symlinks in that directory. Whatever selects between a symlink
and a copy is not something the generated app controls.

**Workaround**, applied in `shader-studio`, which restores a passing integrity check:

```bash
cd .claude/skills
for link in *; do
  if [ -L "$link" ]; then
    target=$(readlink "$link"); rm "$link"; cp -R "$target" "$link"
  fi
done
```

**Suggested fix**: have the skill installer copy rather than link, or exclude
`.claude/skills` from verification inputs. Either one closes the contradiction; the first is
preferable, since a skill directory that is verified is a skill directory that cannot be
swapped underneath a signed app.

---

## 7. `layers.*` commands carry no history grouping, so a multi-layer edit cannot be undone

`ToolcraftCommand` in `src/toolcraft/runtime/state/types.ts` gives `history` and
`historyGroup` to exactly two members:

```ts
| { history?: ToolcraftHistoryMode; historyGroup?: string; …; type: "controls.setValue" }
| { history?: ToolcraftHistoryMode; historyGroup?: string; …; type: "canvas.applySettings" }
```

Every layer command carries neither:

```ts
| { insertIndex?: number; layer?: ToolcraftLayerDraft; type: "layers.add" }
| { layerId: string; type: "layers.delete" }
| { layerId: string; type: "layers.select" }
| { layers: ToolcraftLayer[]; selectedLayerId?: string | null; type: "layers.reorder" }
```

Each therefore commits its own patch through `commitToolcraftStatePatch`, and a product has
no expression for "these commands are one edit".

Any product operation that rebuilds the layer stack is affected. Applying a preset in this
app dispatches `layers.delete` ×N, `layers.add` ×M, `controls.setValue`, `layers.select`.
Measured in the deployed build, starting from a one-layer stack and applying a five-layer
composition:

| Presses of Undo | Resulting stack |
|---|---|
| 0 | the applied composition |
| 1 | the applied composition (unchanged) |
| 2 | **empty** |

The stack that existed before the application is not reachable at any press count. The
first Undo unwinds the record write; the second walks into the layer mutations and past the
previous stack, because the deletes that removed it are separate entries further down.

This is easy to miss from inside a product, and our own test suite missed it. A history test
asserting that apply writes are recorded rather than skipped passes — the *record* write is
recorded. The layer-list mutations are not control writes, so the assertion never looked at
them. A green suite over an unrecoverable operation is the part worth flagging: the gap is
invisible to the obvious test.

Note that `panels.layers` being runtime-owned is what makes this unavoidable rather than
merely inconvenient. The runtime owns layer identity, order, name, visibility and parentage,
so a product cannot route the rebuild through `controls.setValue` instead — restoring values
onto a layer list whose layers no longer exist restores nothing, and recreating the list
requires the very `layers.add` calls that cannot be grouped.

**Suggested fix:** accept `history` and `historyGroup` on `layers.add`, `layers.delete`,
`layers.select`, `layers.reorder`, `layers.moveToGroup`, `layers.rename`,
`layers.toggleVisibility`, and `layers.toggleCollapsed`, and coalesce commands sharing a
`historyGroup` into one entry — the same treatment `controls.setValue` already receives.

**Local workaround:** a product-owned snapshot of the stack taken before the application and
a product-owned restore action, which is what this app now does. It is not a real fix: the
restore sits beside the global Undo rather than inside it, so a user who reaches for Undo
after an apply still walks the individual layer mutations. Two undo mechanisms for one
operation is a UX cost the product is absorbing on the framework's behalf, and the workaround
should be retired when the commands accept grouping.

---

## 8. `app-controls.spec.ts` requires the generic media preview a custom renderer must suppress

The generated starter suite asserts that dropping a file on the canvas shows the runtime's
own preview of it:

```ts
// e2e/app-controls.spec.ts
await page.getByRole("application", { name: "Canvas viewport" })
  .dispatchEvent("drop", { dataTransfer: upload });
await expect(page.getByRole("img", { name: "starter-fixture.svg" })).toBeVisible();
```

Any product with a custom renderer that draws the uploaded media itself must set
`renderDefaultCanvasMedia: false` — otherwise the runtime composites the raw source on top
of the product's own rendering of that same source, and adds the generic frame to the
scene-bounds union, so the artifact contains the picture twice. That is not an optional
preference; it is what a media-consuming renderer is for.

Setting it is therefore correct, and it makes this self-test unsatisfiable. The two cannot
both hold: the test wants the generic `img` element, and the flag exists to remove it.

Same shape as issues 3 and 4 — a framework self-test that a legitimate product
configuration can never pass — and with the same cost, which is that the whole-suite signal
is permanently red for the products most likely to need the flag.

**Suggested fix:** skip or invert this assertion when the composition sets
`renderDefaultCanvasMedia: false`. The runtime already knows the value; the test does not
consult it.

**Local workaround:** none applied. The test is framework-owned and the flag is required, so
the failure is recorded here and excluded by inspection rather than by a grep filter that
would also hide real product regressions.

---

## 9. Applicability can only read control values, so eligibility is not expressible

`control-applicability.ts` requires every predicate target to be a **rendered control**:

```ts
// src/app/acceptance/control-applicability.ts:257
`${control.target} predicate target "${predicate.target}" does not exist.`
```

and the runtime evaluates predicates by reading `state.values[target]`. Together those mean a
control can be gated on *what another control is set to* and on nothing else.

Several product conditions are not control values. The two this app met are both about the
runtime's own layer selection:

- whether the selected layer is a **group**
- whether any layer carries **imported media**

`toolcraft-app-shell` requires "conditional applicability instead of disabling" — a target
that cannot receive an operation must be *unavailable*, not present and inert. For a
condition the runtime owns, that requirement cannot be satisfied. `state.selectedLayerId` and
`state.mediaAssets` are both in state and both readable by `getToolcraftTargetValue`'s own
`state.values` fallback — they simply are not control targets, so the acceptance check rejects
naming them before the runtime ever gets the chance.

The two ways out are both worse than the problem. A product can invent a rendered control that
mirrors the selection purely so a predicate can read it, which puts a control in the panel
that exists for the schema rather than for the user and lies the moment anyone edits it; or it
can leave the target present and do nothing when it is pressed, which is exactly the disabled
behaviour the rule forbids.

**Suggested fix:** allow predicates to name runtime-derived targets — at minimum a selection
kind and a per-layer asset presence — or let a product register a named predicate the runtime
evaluates against state. The evaluation path already falls back to `state.values`, so the
missing piece is the vocabulary rather than the mechanism.

**Local workaround:** partial, and the remainder is recorded rather than hidden. Croix10's
gallery names its aim in a rendered select (`gallery.target`) and gates the two presses on it,
so the destructive press is genuinely absent whenever the aim is narrower than the canvas and
the additive press is absent when it is not — that half is real conditional applicability.
What is not expressible is the second half: with the aim set to the selected group and no
group selected, the press is offered and does nothing. It does not fall back to a wider
target, which is the part that would be dangerous.

---

## 10. Every image a user loads becomes a layer, so a guide image is not expressible

`media-reducer.ts` creates a layer for every imported asset, unconditionally:

```ts
// src/toolcraft/runtime/state/media-reducer.ts:203-222
for (const { draft, layerId, layerName, mediaId } of items) {
  importedAssets.push(createImportedMediaAsset({ draft, layerId, mediaId, ... }));
  importedLayers.push({ displayName: layerName, id: layerId, kind: "layer", ... });
}
const layers = [...baseLayers, ...importedLayers];
const selectedLayerId = importedLayers.at(-1)?.id ?? state.selectedLayerId;
```

There is no branch on `assetKind`, on `sourceTarget`, or on whether `panels.layers`
is enabled. Importing also selects the new layer, and `layers.delete` prunes the
media asset with it (`layers-reducer.ts:143`), so a product cannot import an image
and then remove the layer to keep the asset.

That closes every route to an image that is *not* content:

- **`fileDrop`** is the only sanctioned uploader, and it goes through this reducer.
- **A custom control** cannot stand in for it: `component-contracts.media-custom.ts:143`
  forbids using a custom control to recreate a built-in FileDrop.
- **`media.defaultAssets`** are product-shipped, not user-loaded, and become layers too.

A reference image — one loaded to author *against*, which must never composite into
the artwork and must never reach an artifact — therefore cannot be held anywhere the
framework offers. Croix10 needs exactly this: the product asks a user to recreate a
chromatic construction and can give them nothing to check their work against.

The distinction the framework is missing is between **source material**, which is
content and should be a layer, and a **guide**, which is not content and must not be.
Onion-skinning, tracing references, and colour-match targets are all the second kind,
and they are ordinary features of drawing and design tools.

**Suggested fix:** either an `assetKind` or an import flag that allocates the media
asset without a layer, or a first-class reference-image surface on the canvas schema
with its own opacity and comparison modes. The asset system already keys assets by
`sourceTarget`, so the smaller of the two is close to free: skip the `importedLayers`
push when the import is marked as a guide, and let the product bind the texture itself.

**Local workaround:** none is possible for the requirement as written. The options
open to a product are all compromises — accept the layer and exclude it from the
artwork, or offer a built-in image instead of a user's own — and which compromise to
take is a product decision rather than an engineering one.

---

## 11. The panel shell has no mobile layout, and a product cannot supply one

At a 386px viewport Croix10 is unusable. The Controls panel sits off-screen, the
Layers panel collapses to a dropdown, and the canvas is scrolled somewhere the user
cannot see. Measured, not estimated: `getBoundingClientRect()` on the product output
returned `left: -384.8` on a fresh load.

The panels are floating, draggable, snapping surfaces owned by
`runtime/react/panel-host/panel-host.tsx`, positioned against the visual viewport.
Nothing in that path has a breakpoint: the only `matchMedia` calls in the runtime are
for colour scheme and reduced motion.

A product cannot correct it. `ToolcraftAssemblySchema.panels` takes exactly four
fields — `controls`, `layers`, `timeline`, `toolbar` — and each is an enable flag or
a contract, with no placement, order, size, split, or collapsed-by-default. Panel
position is runtime state a *user* drags. `component-contracts` forbids product code
from authoring panels, and `decision-contracts.ts:61` forbids importing or rendering
low-level runtime surfaces, so styling them from outside is the same violation with
extra steps.

What a product *can* do about narrow screens is reduce how much is in the panel and
use `layoutGroups` to pack controls — real but marginal. It cannot put the canvas on
top and the panels below, which is what a phone needs.

**The root cause is one style on the shell, and it is worse than a layout gap.**
`toolcraft-app.tsx:86-102`:

```tsx
className={cn("relative min-h-[640px] w-full overflow-hidden ...")}
style={{ ...style, minWidth: toolcraftMinAppWidthPx }}   // 1024
```

Below 1024px the shell stays 1024 wide and its overflow is **hidden**, so everything
past the viewport edge is clipped with no scroll to reach it. Measured at a 390px
viewport: `[data-slot="toolcraft-runtime-app"]` is 1024 wide, `document.scrollWidth`
is 390, and the Controls panel sits at `left: 714` — inside the shell, outside the
viewport, unreachable by any gesture. The panel is not mispositioned; the surface it
lives on is wider than the screen and cannot be scrolled.

The product cannot override it. `ToolcraftAppProps` accepts `style`, but `minWidth` is
applied *after* the spread, so a product value is discarded, and an inline style beats
any class a product could pass through `className`.

**Two more constants block the requested arrangement**, in `panel-host-config.ts`:

```ts
controls: { snapEdges: ["left", "right"], stageClassName: "min-h-[560px]", ... },
layers:   { snapEdges: ["left", "right"], stageClassName: "min-h-[560px]", ... },
```

The two panels a phone needs *below* the canvas are the only two that may not snap to
`bottom` — `timeline` and `toolbar` both already allow `["top", "bottom"]`. And a
560px floor means either panel covers most of an 800px-tall viewport, so "canvas
above, panels below" cannot fit even if the snap were allowed.

**Suggested fix, smallest first:** let the 1024px minimum yield to the viewport, or
allow the product's `minWidth` to win, or drop `overflow-hidden` so what does not fit
can at least be scrolled to. Any one of the three turns "unreachable" into "cramped".
Then add `"bottom"` to the `controls` and `layers` snap edges and make the 560px floor
a maximum-height clamp against the viewport. That
alone would let a product arrange the stacked layout through the panel commands it
already publishes. A `panels.layout` schema field, or a breakpoint-driven stacked
layout in the shell, would be the fuller fix.

**Local workaround: partial, through runtime commands rather than around them.**
`panels.setOffset`, `panels.resetOffset`, `panels.setHidden`,
`panels.setSectionCollapsed` and `canvas.setViewport` are published commands, so a
product can pull an off-screen panel back into the visible strip, collapse every
section, show one panel at a time, and place the artwork where it can be seen. Offsets
have to be computed against the **1024px shell** rather than the viewport, which is
the detail that makes this non-obvious. That makes a phone *usable*. It cannot produce the requested layout,
because of the two constants above.

**A workaround that does not work, recorded so it is not tried twice.** Hiding the
runtime panels with a media query and rendering a product-authored mobile control
surface instead: the hiding half is fine — `src/styles.css` is product-owned and the
panels expose stable `data-toolcraft-*` and `data-panel-type` hooks — and product code
can already render full-viewport interactive UI, which this product does for its
region handles. The content is what fails. `decision-contracts.ts:78` allows the
canvas to carry "real product result, source material, renderer output derived from
current state, and valid product editing handles" and a control surface is none of
those; `component-contracts.media-custom.ts:129` forbids custom controls that recreate
built-in controls or runtime panels; and `toolcraft-app-shell` requires each product
control target to appear exactly once in an inventory validated statically, with no
viewport, so "this copy only exists on small screens" cannot be declared.

---

## 12. A product can never hold its own artifact, so it cannot share one

`decision-contracts.ts:61` and `:220` put the whole delivery path in the runtime:
settings, scene crop, background semantics, "exact timestamped encoding, download,
progress, and typed failures", and app code "must not ... instantiate encoders, or
own artifact download mechanics". The product contributes pixels through
`exportRenderer.renderFrame` and never sees the encoded result — there is no
completion callback, no blob hand-off, and no `navigator.share` anywhere in the
runtime.

Sharing an export to a social network therefore cannot be built. It is not that the
product is discouraged from owning the download; it is that the bytes never arrive.

The placement rule compounds it. `panelActions` is contracted for "sticky footer
product actions such as Generate, Export, Copy, or Download" and `defineToolcraft`
"hoists panelActions into the controls panel sticky footer automatically", so the
export press is structurally bound to the footer. A product that wants export to live
in a dialog can move only the format and resolution selects, leaving the press
elsewhere — which splits one action across two surfaces and is worse than not moving
it.

**Suggested fix:** an optional completion hand-off on the export contract — the
artifact `Blob` and its filename, delivered after the runtime has encoded and
downloaded it — would let a product offer `navigator.share` without owning encoding
or download. Separately, allowing an `export-image`/`export-video` role outside the
sticky footer would let export live where a product's flow puts it.

**Local workaround:** none for sharing. Users export a file and share it themselves.

---

## 13. The browser suite is not deterministic at two workers, and the count hides it

Four full runs of `test:browser:stable` on the same machine, two of them on a tree
with no product change at all:

```
no change:          8 failed, 223 passed
change + its tests: 9 failed, 226 passed
change + its tests: 9 failed, 226 passed
change, tests off:  8 failed, 223 passed
```

Five failures are stable and are issues 3, 4 and 8. The rest rotate. Across those four
runs the additional failures were drawn from a pool — `studio undo reverts an edit`,
`studio gallery aims an entry at one layer`, `studio gallery confirms before it
replaces the work`, `studio reference shows behind the work`, `studio reference
compares by difference`, `studio background color grounds preview and export alike`,
`app-browser-performance-probe`, `app-browser-model-import-evidence`,
`app-browser-model-appearance-evidence` — and no two runs drew the same set. Every one
of them passes alone, and passes with three sibling specs at the same worker count.

They are the slowest proofs in the suite: readback loops with stability windows, and
4K export downloads that decode a real artifact. Under two workers on a loaded machine
they exceed a window rather than fail an assertion.

**Why this matters more than the flakiness itself.** The only signal a developer has is
the failure count, and the count is stable at 8–9 while the membership is not. A run
that goes 8 → 9 looks like a regression and is not; a run that stays at 8 while a
genuine regression displaces a flaky test looks clean and is not. Telling those apart
costs a stash and two more ten-minute runs, which is what it cost here.

**Suggested fix:** mark the stability-window and artifact-download recipes as
retryable, or give them a budget that scales with worker count, so a timing failure
reports as a retry rather than as a result. Failing that, a run summary that names
which failures are new against a recorded baseline would let the count be trusted.

**Local workaround:** compare membership rather than count, and confirm any new
failure alone and in a small group before believing it.

---

## 14. The dialog composites are importable, and no product surface may render one

These two facts are both true and together they block a modal entirely.

**A product may import the dialog.** `toolcraft-product-boundary-module-policy.mjs`
bans exactly the bare `@/toolcraft/ui` entry and `@/toolcraft/ui/components/controls/**`.
`src/toolcraft/ui/components/composites/dialog.tsx` is under `components/composites/**`
and is named by no rule.

**No product surface may present it.** Every extension point in `decision-contracts.ts:61`
excludes it for a different reason:

- `controlRenderers` needs a `builtInFitCheck`, and `custom-controls.ts:143` requires
  one of `custom-interaction`, `custom-value-model`, or `custom-visualization`. An
  onboarding flow has none: its value is "which step", which a `select` holds; its
  cards are an `imagePicker`; its presses are `actions`. The only thing no built-in
  offers is **modality** — and `custom-controls.md` states that a custom control may
  not be justified by "icons, layout, styling, compactness, or custom buttons alone".
  Modality is placement, so the honest fit check cannot be written.
- `canvasContent` is banned outright from carrying it: *"canvasContent must not contain
  buttons, forms, CTAs, helper text, upload prompts, menus, settings UI"*
  (`decision-contracts.ts:76`).
- `infiniteCanvasContent` is "reserved for preview-only product environments … without
  … pointer input".
- `onPanelAction` runs commands and renders nothing.

So the runtime ships a Dialog, lets a product import it, and gives it nowhere to put
it. A generated app can present no modal at all — not a confirmation, not an
onboarding step, not a destructive-action guard — which is why this product's
technique change is a two-press arrangement rather than a question.

**Worth stating plainly because it cost two designs.** The first recorded the composites
as unreachable, which is false and led to a workaround. The second checked the import,
found it permitted, and planned a flow around it — and the flow is still impossible,
for a reason two contracts away from where the first looked.

**Suggested fix:** a `ToolcraftAppComposition.dialogContent` surface, or an
`overlay`/`modal` control placement that renders outside the panel, or simply naming
modality as a legitimate `custom-interaction` justification in `custom-controls.md`.
Any of the three would make the requested onboarding flow buildable; today none of them
exists.

**Local workaround:** none. Every product decision that wants a modal is expressed as
a second press in the panel instead.

---

## 15. Playback is a performance path the derivation does not produce

A product may declare `panels.timeline` with `mode: "playback"`, and the runtime
will then drive the renderer continuously for as long as the transport runs.
That is a different cost profile from anything the workload envelope currently
describes: the existing derived paths are `initial-render`, `control-change`,
`control-drag`, `viewport-drag`, `viewport-zoom` and `export` — a discrete edit,
a gesture, and a batch. None of them is *sustained*.

`deriveToolcraftPerformancePaths` contains no playback interaction, so no such
path is derived, and the gate that requires exactly one scenario per derived
path is satisfied by a product that has never measured its own animation. The
gap is not that the gate is wrong — it is enforcing what it was told — but that
a product cannot declare the measurement even if it wants to: authoring a
scenario whose `interaction` is `"playback"` fails the same gate, because there
is no path for it to cover.

**Effect here.** Croix10 animates, and its sustained cost is unmeasured in the
declared sense. The frames it produces are checked (the timeline recipe, the
video packet schedule), but "does a six-second loop hold its frame budget on a
dense stack" is a question this product currently cannot ask through the
framework's own machinery. The change that introduced motion recorded the task
and left it open rather than inventing a path id that the derivation would not
recognise, or weakening the scenario until it fitted a path that means something
else.

**What would fix it.** A `sustained` profile beside `interactive-continuous`,
derived when the schema declares a playback timeline, with the workload
dimensions the preview path already names. The measurement helpers exist; what
is missing is the declaration that makes them addressable.

## 16. A layer row takes exactly two actions, and a product cannot add a third

`layers-panel-row.tsx` renders the row's action cluster itself: a visibility
toggle and a delete, hardcoded as two `<Button>` elements with `onToggleVisibility`
and `onDelete` wired straight to runtime handlers. There is no `layerRowActions`
prop, no slot, no composition point — the set is closed at two.

The obvious workaround is closed too. `shader-authoring` forbids a
product-authored layer list, so a product cannot render its own rows and put the
actions where it wants them; the runtime panel is the only layer list a product
of this kind is allowed to have.

**What was asked for here.** Two icons on each row: duplicate, and a gear that
opens the composition application aimed at that layer. Both operations already
exist and both already work — `duplicate-layer` and the aimed application are
product panel actions today. The gap is not capability. It is that neither can
be reached from the row the author is looking at, which is the only place either
one means anything: "duplicate *this*" and "apply to *this*" are questions about
a specific row, and a control that lives elsewhere has to be told which row
first, which is the whole problem it was meant to solve.

**Why no approximation was shipped.** Three were considered and each is worse
than the gap:

- *A product-authored row list.* Forbidden outright, and it would fork layer
  selection, drag ordering, group nesting and keyboard handling away from the
  runtime that owns them.
- *A per-layer control in the panel.* This is precisely what the dialog-first
  change removed. Putting it back to serve a row action would undo the change
  that motivated the request.
- *A gear opened from somewhere other than the row.* Two ways to do one thing,
  and the second way is the one that already existed and was found wanting.

So the existing duplicate action stays where it is, working, until the row can
hold it.

**What would fix it.** A `layerRowActions` composition point taking the same
shape a panel section's `actions` already takes — label, icon, value, dispatched
back through `onPanelAction` with the row's layer id. The product side of that is
already written.

## 17. Setup is unconditional, so a product-owned setup step is a duplicate

`runtime-setup-section.ts` always renders Aspect ratio, Canvas width, Canvas
height, Resolution scale and Background into the Setup section. A product has no
way to hide any of them: there is no flag on the schema that suppresses a runtime
section or an individual runtime control within one.

That is right for a product whose sizing is incidental. It is wrong for one whose
sizing is a *decision made before there is anything to size*. Croix10 was asked
for a flow that opens on a dialog, asks what to make and how big, and then lands
the author on a canvas — with those questions gone from the sidebar afterwards,
because they have been answered.

The first half is buildable and was built. The second half is not. The flow
writes through the runtime's own targets — `canvas.setSize`, the aspect target,
the background target — precisely so there is one owner rather than two, and the
result is that the same five controls are still sitting in Setup after the flow
closes. An author who has just answered "how big" finds the question again, in a
panel, phrased differently.

**This is a duplicate, not a design.** Describing it as "the dialog for setup,
the panel for adjustment" would be a rationalisation written after the fact: the
panel controls were not chosen for adjustment, they are simply the ones the
runtime always shows. The product's own setup section was removed; the runtime's
remains.

**What would fix it.** Either a per-control suppression on the runtime Setup
section, or — better, because it states the reason rather than the mechanism — a
schema declaration that setup is product-owned, which the runtime honours by
withholding the controls whose answers the product has taken responsibility for.

## Current effect on these apps

**Croix10.** Full browser suite, 2 workers, with the local workarounds for 1 and 2 applied:

```
217 passed, 4 failed (13.1m)   —   0 ECONNRESET
```

All 4 failures are issues 3 and 4 above. Confirmed pre-existing: the same 4 fail with the
workarounds removed.

The delivery gate is unaffected. A bare `npm run verify:delivery` on the same tree exits 0
with 50 browser proofs passing in 14.8m, and `verify:receipt` reports the delivery authority
current and valid. So the practical cost of issues 3 and 4 is not a blocked delivery — it is
that a generated app can never show a green browser suite, which is the signal a developer
actually watches while working.

**Shader Studio.** Hit issue 6 on generation. With the workaround above applied, the
integrity check passes at 650 files and code health passes. Issues 1–4 are expected to apply
here identically once this app declares a timeline, which is why the same `tools/` preload
and `test:browser:stable` script were carried across rather than rediscovered.
