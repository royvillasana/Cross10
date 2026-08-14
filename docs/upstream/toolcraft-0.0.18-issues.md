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
