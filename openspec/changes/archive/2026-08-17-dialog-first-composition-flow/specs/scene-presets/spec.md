## MODIFIED Requirements

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
