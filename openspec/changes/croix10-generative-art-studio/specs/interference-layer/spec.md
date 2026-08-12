## ADDED Requirements

### Requirement: Optional second stripe layer
The system SHALL provide a second stripe layer that can be enabled or disabled independently of the primary layer, with its own pitch, angle, phase, width ratio, and speed.

The layer belongs to the Chromointerférence engine, whose entire grammar is the composite, so it is enabled by default under that engine and absent under the others. Its speed parameter lands with the Stage 3 timeline; every other parameter is static and shipped.

#### Scenario: Layer disabled removes its cost
- **WHEN** the second layer is disabled
- **THEN** the composition renders from the primary layer only
- **AND** the shader path for the second layer contributes no per-frame cost

#### Scenario: Independent geometry
- **WHEN** the second layer's pitch differs from the primary layer's by a known amount
- **THEN** a low-frequency component appears in the rendered output at the beat period predicted by the two pitches

### Requirement: Layer blend modes
Compositing of the second layer over the primary SHALL support normal, multiply, screen, difference, and additive blend modes, selected through a Toolcraft select.

#### Scenario: Difference blending
- **WHEN** blend mode is set to difference
- **THEN** overlapping regions render the absolute per-channel difference of the two layers
- **AND** regions where the layers agree render as black

#### Scenario: Additive blending reproduces additive color mixing
- **WHEN** blend mode is set to additive with a red primary layer and a green second layer
- **THEN** overlap regions render as yellow, demonstrating additive mixing

### Requirement: Layer controls appear only when the layer is enabled
The enable `switch` SHALL stay in the same section as the controls it gates. Every dependent control SHALL declare `applicability: { mode: "conditional", all: [...] }` predicated on that switch, so inactive controls are absent while their values are preserved.

#### Scenario: Dependent controls absent when disabled
- **WHEN** the second layer is disabled
- **THEN** its pitch, angle, phase, width ratio, speed, and blend mode controls are absent from the panel

#### Scenario: Values restored on re-enable
- **WHEN** the user re-enables the second layer
- **THEN** its previously configured values are restored unchanged

### Requirement: Independent layer motion
The second layer SHALL have its own speed parameter so its phase can drift relative to the primary layer, and that speed SHALL be animatable and LFO-assignable.

#### Scenario: Relative drift produces traveling waves
- **WHEN** the second layer speed is nonzero and the primary layer is static
- **THEN** interference bands travel across the canvas continuously
- **AND** setting the speed to zero freezes the pattern in place
