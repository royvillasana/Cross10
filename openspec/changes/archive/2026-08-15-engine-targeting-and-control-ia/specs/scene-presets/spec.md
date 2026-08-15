## MODIFIED Requirements

### Requirement: Built-in preset library
Between 8 and 12 built-in presets SHALL be shipped covering every engine series with its canonical palette, selectable through a schema control.

Applying a preset SHALL be revertible. The claim that a preset write "behaves
normally" under undo SHALL be read as covering the layer list as well as the
values, since a preset that restores its values onto a stack the user cannot get
back has not been undone in any sense the user recognises.

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
- **THEN** it writes schema targets through runtime commands, so reset and persistence behave normally

#### Scenario: Applying a preset can be taken back whole
- **WHEN** a preset is applied over an existing stack
- **AND** the restore action is taken
- **THEN** the previous layer list is present again, layer for layer
- **AND** each restored layer carries its previous values rather than the preset's

#### Scenario: A partial unwind is never a resting state
- **WHEN** a preset application is reverted
- **THEN** no intermediate stack — one with the preset's layers removed but the previous layers not yet restored — is reachable by the user
