# scene-presets Specification

## Purpose
Recorded from the Croix10 change, archived at 110 of 219 tasks.

**Build status is stated per requirement.** Audited against the app on
2026-08-17 (`outstanding` 1.1).
## Requirements
### Requirement: Scene serialization is runtime Settings Transfer
Scene export and import SHALL be the runtime's `Export Settings` and `Import Settings` in Setup. Product code MUST NOT implement settings import/export through `panelActions`, route-local file inputs, or app-authored controls, and MUST NOT gate it by app complexity. Product-owned non-control state that belongs in a scene SHALL be opted in through `settingsTransfer.additionalValueTargets`.

**Status: satisfied.** Transfer is the runtime's, in Setup; the product authors
no save, load or import control anywhere. Five product-owned targets are opted
in through `settingsTransfer.additionalValueTargets` — the per-layer record, the
cursor, the vertex paths, the pen, and the stack snapshot — which is what makes
the round trip lossless rather than restoring a layer list of blanks.

The *Custom shader source transfers* scenario has no subject here and will not
acquire one: this product has no editable shader hook. Source leaves through a
clipboard action and never returns, which `shader-delivery` records as R55.

#### Scenario: Round trip is lossless
- **WHEN** the user exports settings and then imports the same file
- **THEN** the engine, every parameter value, and every opted-in product value are identical to before
- **AND** the rendered frame at the same timeline time is visually identical

#### Scenario: No product preset panel
- **WHEN** the controls panel is inspected
- **THEN** it contains no product-authored save, load, or import-JSON control
- **AND** settings transfer appears only in runtime Setup

#### Scenario: Custom shader source transfers
- **WHEN** a custom shader hook is active and settings are exported
- **THEN** the hook source is included through a declared additional value target and restored on import

### Requirement: Built-in preset library
The product SHALL ship a preset library that covers the artist's eight
investigations. Applying a preset SHALL be revertible.

The library SHALL be offered at two moments rather than one: when a session begins,
as the starting point for the whole canvas, and while editing, as something applied
to one layer or group. Both SHALL offer the same library, because a user who has
learned what an entry looks like at the start must find the same entry later.

The library SHALL be presented as pictures wherever it is offered. Its surface is
not fixed to a schema control: the starting choice belongs in the onboarding dialog
and the per-layer choice belongs with the layer it applies to, and neither is a
setting that shapes existing work.

**Status: satisfied.** Nineteen entries covering all eight series, offered at
both moments the requirement names — the onboarding dialog when a session
begins, and `Composition Source` while editing — from one library, presented as
pictures in both. Applying is revertible through the stack snapshot. The
palettes themselves are recorded as plausible rather than verified; checking
them against primary sources is `outstanding` 2.3.

The eight series SHALL be Couleur Additive, Physichromie, Induction Chromatique,
Chromointerférence, Transchromie, Chromosaturation, Chromoscope, and Couleur dans
l'espace. Each series SHALL have at least one preset.

Each preset SHALL record the series it belongs to and where its palette came
from: **verified** against a primary source, **plausible** — recorded by the
product as an approximation without checking — or the **studio's own**, chosen
here and claiming nothing about the artist's. Only a verified palette MAY be
presented as taken from a primary source; the other two SHALL be usable and MUST
NOT be presented as though they were.

Each series SHALL be marked as one the canvas can **carry** or one it can only
**evoke**. Couleur Additive, Physichromie, Induction Chromatique and
Chromointerférence are planar constructions the canvas carries. Chromosaturation
is a chamber of saturated light, Transchromie is juxtaposed coloured and
transparent panels a visitor moves through, and Chromoscope and Couleur dans
l'espace are environments; a flat preset for any of these is an evocation of the
phenomenon and SHALL say so rather than claim to render the work.

Presets SHALL be named for the technique and the series. A preset MUST NOT claim
to be a reproduction of an individual catalogued artwork, because the techniques
are free to use and the individual works are not.

The total number of presets is not fixed. The previous requirement of a total
between 8 and 12 is withdrawn: it described a demonstration that the stack could
hold a composition, and the library's purpose is now to show a user what the
vocabulary can do.

#### Scenario: The library is offered at both moments
- **WHEN** a session is started, and again while editing a layer
- **THEN** the same library is offered in both places
- **AND** each entry is shown as a picture of what it will make

#### Scenario: Every series represented
- **WHEN** the preset list is opened
- **THEN** at least one preset exists for each of Couleur Additive, Physichromie, Induction Chromatique, Chromointerférence, Transchromie, Chromosaturation, Chromoscope, and Couleur dans l'espace

#### Scenario: Loading a preset renders immediately
- **WHEN** the user selects a built-in preset and loads it
- **THEN** the canvas renders that composition and every panel control reflects its values

Selection and loading are two steps. A select that rewrote twenty other targets the moment it changed would make persistence dishonest — a reload would replay the preset over the user's later edits — and the runtime offers product code no hook for reacting to a control change, only for running a command.

#### Scenario: Presets write through runtime state
- **WHEN** a preset is applied
- **THEN** it writes schema targets through runtime commands, so reset and persistence behave normally

#### Scenario: Applying a preset can be taken back whole
- **WHEN** a preset is applied over an existing stack
- **AND** the restore action is taken
- **THEN** the previous layer list is present again, layer for layer
- **AND** each restored layer carries its previous values rather than the preset's

#### Scenario: A partial unwind is never a resting state
- **WHEN** a preset application is reverted
- **THEN** no intermediate stack — one with the preset's layers removed but the previous layers not yet restored — is reachable by the user

#### Scenario: Provenance is recorded and readable
- **WHEN** the preset library is validated
- **THEN** every preset declares its series
- **AND** every preset declares its palette as verified, plausible, or the studio's own

#### Scenario: An unverified palette is not presented as verified
- **WHEN** a preset whose palette is plausible is offered to the user
- **THEN** nothing in the product states or implies that its colours are taken from a primary source

#### Scenario: An evoked series says it is evoked
- **WHEN** a preset belonging to Chromosaturation, Transchromie, Chromoscope, or Couleur dans l'espace is offered
- **THEN** it is marked as an evocation of the phenomenon rather than a rendering of the work

#### Scenario: No preset claims to be a specific artwork
- **WHEN** the preset library is validated
- **THEN** no preset name or description asserts that it reproduces an individual catalogued artwork

### Requirement: Workspace persistence by reload
The app SHALL rely on default runtime workspace persistence, declaring `persistenceCoverage: "reload"`, `evidence: "persistence-state"`, and `persistenceSlices` exactly equal to the resolved `schema.persistence.include`. Product code MUST NOT read or write localStorage or IndexedDB directly.

**Status: satisfied.** Declared as required, with `persistenceSlices` derived
from the resolved schema rather than restated. No product module touches
`localStorage` or `indexedDB`; the only mentions are the schema declaring the
storage and the acceptance data reading that declaration.

#### Scenario: Workspace survives reload
- **WHEN** the user edits parameters and reloads the browser
- **THEN** the visible workspace, canvas state, and panel state are restored from the resolved persistence slices

#### Scenario: Reset restores defaults, not the persisted scene
- **WHEN** the user triggers global reset after a reload
- **THEN** every schema control returns to its `defaultValue`

### Requirement: Randomize with locks
Randomize SHALL assign new values within declared schema ranges, and every randomizable group SHALL have a lock `switch` that excludes its targets.

**Status: pending — not built.** There is no randomize command and no lock
switch in the product. All three scenarios below are unmet. The design reasoning
recorded here is still sound and worth keeping, because it is the part that
would otherwise be re-derived; what is missing is the building. Carried as
`outstanding` 1a.2.

The command and its locks live together in one Randomize section, as an `actions` control rather than a sticky `panelActions` one, because two framework rules make the original per-section sticky design unbuildable. A section holding a large compound control cannot also hold a lock: runtime splits the compound control into its own section, which duplicates section titles. And every acceptance row on a sticky `panelActions` control must cover every footer action, so adding Randomize to the footer would oblige the export proof and the randomize proof to each exercise both commands.

Randomize covers the stripe field, the palette, the immersive field, and the translucent planes, so every engine has something to randomize. Viewer parallax, the afterimage fringe, the interference relationship, and the embedded shape are deliberately excluded; extending randomize to them requires adding their locks in the same change.

#### Scenario: Locked palette survives randomization
- **WHEN** the palette lock is on and the user randomizes
- **THEN** the palette is unchanged while the stripe field takes new values

#### Scenario: Randomized values stay in range
- **WHEN** the user randomizes repeatedly
- **THEN** every value lies within its declared `min` and `max` and the render never becomes blank or degenerate

#### Scenario: Randomize is undoable
- **WHEN** the user randomizes and then triggers runtime undo
- **THEN** the previous parameter values are restored as one history step

