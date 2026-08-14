## ADDED Requirements

### Requirement: The gallery sets a starting state, not a fixed configuration
A user SHALL browse and select a shader before editing one. Selection SHALL reuse the runtime-owned control surface rather than a product-authored gallery UI, since product code cannot render its own panels.

Selecting an entry SHALL write ordinary control values, leaving every control live and editable afterwards. A gallery entry is where authoring begins; it MUST NOT lock the configuration it applied.

#### Scenario: Selecting a gallery entry replaces the rendered shader
- **WHEN** a different gallery entry is selected
- **THEN** the canvas renders that entry's shader
- **AND** the controls below it describe that entry's own uniforms

#### Scenario: The controls stay live after selection
- **WHEN** a gallery entry has been applied
- **AND** any control it set is then edited
- **THEN** the rendered shader follows the edit
- **AND** the assembled shader resolves the edited value rather than the entry's stored one

### Requirement: Controls map to uniforms by derivation
Every exposed control SHALL resolve to a uniform through the schema-derived mapping, never through hand-written wiring, so a control that cannot change the shader's output cannot be declared.

#### Scenario: A declared uniform has a control
- **WHEN** the schema is validated
- **THEN** every uniform the assembled program declares has exactly one schema control
- **AND** every numeric control has finite bounds and an in-range default

### Requirement: Every shader component is a layer
Stripes, gradients, shapes, and images SHALL all be layer types in one ordered stack. A layer's position in that stack SHALL decide where it composites, so an image can sit above, below, or between procedural components without being a special case.

`panels.layers` SHALL be enabled and own the layer list, its selection, visibility, grouping, and reordering. Per-layer editing SHALL use `selectedLayer.*` targets so the panel edits whichever layer is selected. Product code MUST NOT author its own layer list, ordering control, or visibility control, because those are runtime surfaces.

`interactionOwnership` SHALL assign layer management to Layers, so a media upload row does not restate reorder or transform claims the layer recipes already prove.

#### Scenario: Reordering a layer changes what covers what
- **WHEN** a layer is moved above another in the layer panel
- **THEN** the rendered output composites it over that layer
- **AND** the assembled shader reflects the same order

#### Scenario: Per-layer controls edit the selected layer
- **WHEN** a layer is selected and one of its controls is edited
- **THEN** only that layer's contribution to the output changes
- **AND** the other layers render unchanged

### Requirement: Layers animate individually
Each layer SHALL be animatable over the runtime timeline, so a stack can carry motion in more than one component at once. Loop seams SHALL hold per layer, since a stack whose layers close at different times does not close at all.

#### Scenario: Two layers animate independently
- **WHEN** two layers are given different animation rates
- **THEN** each advances at its own rate across the loop
- **AND** the frame at the end of the loop matches the frame at its start
