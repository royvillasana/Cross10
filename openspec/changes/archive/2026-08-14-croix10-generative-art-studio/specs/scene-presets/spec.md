## ADDED Requirements

### Requirement: Scene serialization is runtime Settings Transfer
Scene export and import SHALL be the runtime's `Export Settings` and `Import Settings` in Setup. Product code MUST NOT implement settings import/export through `panelActions`, route-local file inputs, or app-authored controls, and MUST NOT gate it by app complexity. Product-owned non-control state that belongs in a scene SHALL be opted in through `settingsTransfer.additionalValueTargets`.

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
Between 8 and 12 built-in presets SHALL be shipped covering every engine series with its canonical palette, selectable through a schema control.

#### Scenario: Every series represented
- **WHEN** the preset list is opened
- **THEN** at least one preset exists for each of Physichromie, Couleur Additive, Induction Chromatique, Chromointerférence, Transchromie, and Chromosaturation
- **AND** the total is between 8 and 12

#### Scenario: Loading a preset renders immediately
- **WHEN** the user selects a built-in preset and loads it
- **THEN** the canvas renders that composition and every panel control reflects its values

Selection and loading are two steps. A select that rewrote twenty other targets the moment it changed would make persistence dishonest — a reload would replay the preset over the user's later edits — and the runtime offers product code no hook for reacting to a control change, only for running a command.

#### Scenario: Presets write through runtime state
- **WHEN** a preset is applied
- **THEN** it writes schema targets through runtime commands, so undo, reset, and persistence all behave normally

### Requirement: Workspace persistence by reload
The app SHALL rely on default runtime workspace persistence, declaring `persistenceCoverage: "reload"`, `evidence: "persistence-state"`, and `persistenceSlices` exactly equal to the resolved `schema.persistence.include`. Product code MUST NOT read or write localStorage or IndexedDB directly.

#### Scenario: Workspace survives reload
- **WHEN** the user edits parameters and reloads the browser
- **THEN** the visible workspace, canvas state, and panel state are restored from the resolved persistence slices

#### Scenario: Reset restores defaults, not the persisted scene
- **WHEN** the user triggers global reset after a reload
- **THEN** every schema control returns to its `defaultValue`

### Requirement: Randomize with locks
Randomize SHALL assign new values within declared schema ranges, and every randomizable group SHALL have a lock `switch` that excludes its targets.

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
