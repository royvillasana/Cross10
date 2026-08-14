## MODIFIED Requirements

### Requirement: The gallery sets a starting state, not a fixed configuration
A user SHALL browse and select a shader before editing one, and applying what
they selected SHALL take a target and SHALL be revertible.

**Status: amended again (R72).** R71 established that *selecting* does not apply,
because a select that applied on change would store a claim about the stack that
the first edit makes false. That split stands. What changes is the other half of
the action: applying no longer always means replacing the stack, and applying is
no longer irreversible.

A user SHALL browse and select a shader before editing one. Selection SHALL reuse the runtime-owned control surface rather than a product-authored gallery UI, since product code cannot render its own panels.

Selecting an entry SHALL write ordinary control values, leaving every control live and editable afterwards. A gallery entry is where authoring begins; it MUST NOT lock the configuration it applied.

Applying an entry SHALL take a target — the selected layer, the selected group,
or the canvas — and SHALL affect only that target. Applying SHALL be revertible
through the applicator's own restore action, whose contract lives in
`engine-application`. An entry MUST NOT replace layers the chosen target does not
name.

#### Scenario: Selecting a gallery entry replaces the rendered shader
- **WHEN** a different gallery entry is selected
- **THEN** the canvas renders that entry's shader
- **AND** the controls below it describe that entry's own uniforms

#### Scenario: The controls stay live after selection
- **WHEN** a gallery entry has been applied
- **AND** any control it set is then edited
- **THEN** the rendered shader follows the edit
- **AND** the assembled shader resolves the edited value rather than the entry's stored one

#### Scenario: Applying respects the chosen target
- **WHEN** an entry is applied with a target narrower than the canvas
- **THEN** only the layers that target names change
- **AND** the rest of the stack renders unchanged

#### Scenario: An applied entry can be taken back
- **WHEN** an entry has been applied over an existing stack
- **AND** the restore action is taken
- **THEN** the stack that existed before the application is rendered again

### Requirement: Every shader component is a layer
Stripes, gradients, shapes, and images SHALL all be layer types in one ordered
stack, and every layer type SHALL expose a horizontal and a vertical flip.

**Status: satisfied, with shapes read differently (R64) and flip added (R73).** Stripes, gradients and
images are layer types; *shapes* are not a fourth type but the form every layer
already has -- a vocabulary of seven named forms plus a pen-drawn path, shaped
on the canvas. R63 planned a shape layer type and R64 replaced it with the
user's own reading, that the region **is** the shape. An image composites above,
below and between procedural layers, which has its own proof.

R73 adds flip as a transform every layer type carries, because a layer that can
be turned but not folded is a layer the user cannot place.

Stripes, gradients, shapes, and images SHALL all be layer types in one ordered stack. A layer's position in that stack SHALL decide where it composites, so an image can sit above, below, or between procedural components without being a special case.

`panels.layers` SHALL be enabled and own the layer list, its selection, visibility, grouping, and reordering. Per-layer editing SHALL use `selectedLayer.*` targets so the panel edits whichever layer is selected. Product code MUST NOT author its own layer list, ordering control, or visibility control, because those are runtime surfaces.

`interactionOwnership` SHALL assign layer management to Layers, so a media upload row does not restate reorder or transform claims the layer recipes already prove.

Every layer type SHALL expose a horizontal and a vertical flip, applied in the
layer's own axes after any rotation, so folding and turning compose predictably.
Flip controls MUST NOT be named such that they can be read as the stripe field's
`Mirror`, which reflects the pattern within a layer rather than the layer itself.

#### Scenario: Reordering a layer changes what covers what
- **WHEN** a layer is moved above another in the layer panel
- **THEN** the rendered output composites it over that layer
- **AND** the assembled shader reflects the same order

#### Scenario: Per-layer controls edit the selected layer
- **WHEN** a layer is selected and one of its controls is edited
- **THEN** only that layer's contribution to the output changes
- **AND** the other layers render unchanged

#### Scenario: Flip folds the layer in its own axes
- **WHEN** a layer is rotated and then flipped horizontally
- **THEN** the fold runs along the layer's own axis rather than the screen's
- **AND** flipping twice returns the layer to its unflipped appearance

#### Scenario: Flip is available to every layer type
- **WHEN** the schema is validated
- **THEN** every layer type exposes both a horizontal and a vertical flip

#### Scenario: Flip and the stripe mirror stay distinct
- **WHEN** the control surface is read
- **THEN** the layer flip and the stripe `Mirror` carry names that cannot be read as each other
- **AND** changing one does not change the other
