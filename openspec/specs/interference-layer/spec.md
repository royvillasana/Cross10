# interference-layer Specification

## Purpose
Recorded from the Croix10 change, archived at 110 of 219 tasks.

**Build status is stated per requirement.** Audited against the app on
2026-08-17 (`outstanding` 1.1). These requirements were written for Croix10,
where interference meant *a second stripe layer toggled inside an engine*. The
studio has an ordered stack instead, so several are satisfied by a more general
mechanism than the one they name, and one is a genuine gap. Each says which.
## Requirements
### Requirement: Optional second stripe layer
The system SHALL provide a second stripe layer that can be enabled or disabled independently of the primary layer, with its own pitch, angle, phase, width ratio, and speed.

The layer belongs to the Chromointerférence engine, whose entire grammar is the composite, so it is enabled by default under that engine and absent under the others. Its speed parameter lands with the Stage 3 timeline; every other parameter is static and shipped.

**Status: superseded.** There is no "second layer" to enable, because every
layer is a layer: an author adds a second stripes layer and it carries its own
pitch, angle, offset, width ratio and drift. What survives of this requirement
is the *beat* — `selectedLayer.enginePitch` under the Interference engine lays a
second band sequence at a different pitch within one layer, which is what the
Independent geometry scenario is really about, and it is proved by
`browser: studio drift closes the seam on a beating field` and
`browser: studio interference pitch changes the beat`. The disabled-cost
scenario has no subject: a layer that does not exist costs nothing, and a layer
that exists is drawn.

#### Scenario: Layer disabled removes its cost
- **WHEN** the second layer is disabled
- **THEN** the composition renders from the primary layer only
- **AND** the shader path for the second layer contributes no per-frame cost

#### Scenario: Independent geometry
- **WHEN** the second layer's pitch differs from the primary layer's by a known amount
- **THEN** a low-frequency component appears in the rendered output at the beat period predicted by the two pitches

### Requirement: Layer blend modes
Compositing of the second layer over the primary SHALL support normal, multiply, screen, difference, and additive blend modes, selected through a Toolcraft select.

**Status: partly satisfied, and this is a real gap.** Blending generalised well —
it is `selectedLayer.blendMode` on every layer rather than on a designated
second one, proved by `browser: studio blend mode changes how the layer meets
what it sits on`. But the modes shipped are normal, multiply, screen and
**overlay**. **Difference and additive are not built**, so both scenarios below
are unmet: neither the absolute-difference reading nor red-over-green yielding
yellow can be produced today. Overlay was added without being asked for. Carried
as `outstanding` 1.1a.

#### Scenario: Difference blending
- **WHEN** blend mode is set to difference
- **THEN** overlapping regions render the absolute per-channel difference of the two layers
- **AND** regions where the layers agree render as black

#### Scenario: Additive blending reproduces additive color mixing
- **WHEN** blend mode is set to additive with a red primary layer and a green second layer
- **THEN** overlap regions render as yellow, demonstrating additive mixing

### Requirement: Layer controls appear only when the layer is enabled
The enable `switch` SHALL stay in the same section as the controls it gates. Every dependent control SHALL declare `applicability: { mode: "conditional", all: [...] }` predicated on that switch, so inactive controls are absent while their values are preserved.

**Status: superseded in its subject, satisfied in its rule.** There is no enable
switch, so nothing gates a second layer's controls. The *rule* it states —
a gate sits in the section it gates, and dependents are absent rather than
disabled — is how the engine controls work today: `enginePitch`, `engineAmount`
and `engineCursor` are conditional on `selectedLayer.engine`, in its section.

#### Scenario: Dependent controls absent when disabled
- **WHEN** the second layer is disabled
- **THEN** its pitch, angle, phase, width ratio, speed, and blend mode controls are absent from the panel

#### Scenario: Values restored on re-enable
- **WHEN** the user re-enables the second layer
- **THEN** its previously configured values are restored unchanged

### Requirement: Independent layer motion
The second layer SHALL have its own speed parameter so its phase can drift relative to the primary layer, and that speed SHALL be animatable and LFO-assignable.

**Status: satisfied, except for the LFO.** Every layer carries `driftPhase` and
`driftAngle`, counted in whole cycles per loop, so two layers drift against each
other and both return at the seam — which is exactly the traveling-wave scenario
below, proved by `browser: studio returns two layers drifting at different
rates`. Setting the rate to zero freezes the layer, asserted in the same file.
**There is no LFO in this product** and none is planned; the timeline is the one
source of motion, which is what keeps a loop a loop.

#### Scenario: Relative drift produces traveling waves
- **WHEN** the second layer speed is nonzero and the primary layer is static
- **THEN** interference bands travel across the canvas continuously
- **AND** setting the speed to zero freezes the pattern in place

