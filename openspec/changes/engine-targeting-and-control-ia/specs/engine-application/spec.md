## ADDED Requirements

### Requirement: One applicator, one vocabulary

The product SHALL expose exactly one surface that applies a named engine or
composition. Two controls MUST NOT offer overlapping engine vocabulary in
different sections, because a user reading `Physichromie` cannot tell from the
option label which of two things they are about to change.

The applicator SHALL name what is applied and where it lands in one place, so the
scope of the action is readable before it is taken rather than inferred from its
result.

#### Scenario: The engine vocabulary appears once

- **WHEN** the schema is validated
- **THEN** no two product controls offer option labels drawn from the same engine vocabulary
- **AND** the engine names reachable from the applicator are the only engine names in the control surface

#### Scenario: Scope is visible before applying

- **WHEN** the applicator is read
- **THEN** the entry to apply and the target it will land on are both visible without opening another section

### Requirement: An application chooses its target

An application SHALL take a target of the selected layer, the selected group, or
the canvas. Applying to the selected layer SHALL change only that layer's
contribution. Applying to the selected group SHALL change only the layers within
that group. Applying to the canvas SHALL replace the stack.

A target that cannot receive an application — a group target with no group
selected, a layer target with no layer selected — SHALL be unavailable rather
than silently redirected to a different target.

#### Scenario: Applying to a layer leaves its neighbours alone

- **WHEN** a composition is applied with the target set to the selected layer
- **THEN** that layer renders the applied entry
- **AND** every other layer in the stack renders exactly as it did before

#### Scenario: Applying to a group leaves layers outside it alone

- **WHEN** a composition is applied with the target set to the selected group
- **THEN** every layer within that group renders the applied entry
- **AND** no layer outside the group changes

#### Scenario: Applying to the canvas replaces the stack

- **WHEN** a composition is applied with the target set to the canvas
- **THEN** the stack is replaced by the entry's own layers

#### Scenario: An impossible target is not offered

- **WHEN** no group is selected
- **THEN** the group target is unavailable
- **AND** applying does not fall back to a different target

### Requirement: An application is revertible

An application SHALL capture the stack it is about to overwrite and SHALL expose
an action that restores it. Restoring SHALL return the layer list, each layer's
values, and the selection to what they were immediately before the application.

The snapshot SHALL be product-owned state rather than a claim on the runtime
history stack, because `layers.add`, `layers.delete`, `layers.select`, and
`layers.reorder` carry no `history` or `historyGroup` field and therefore cannot
be fused into one undo entry. Restoring MUST NOT depend on the number of layers
the application added or removed.

#### Scenario: Reverting restores the previous stack exactly

- **WHEN** a stack is applied over and the revert action is taken
- **THEN** the layer list matches the one that existed before the application, layer for layer
- **AND** each restored layer carries the values it had before, not the applied entry's values
- **AND** the selection is the layer that was selected before

#### Scenario: Reverting does not depend on stack size

- **WHEN** an application replaces a stack of one layer with a stack of five
- **THEN** a single revert restores the stack of one

#### Scenario: An application never silently discards work

- **WHEN** an application would overwrite layers
- **THEN** a snapshot of those layers exists before the first layer is removed

#### Scenario: The snapshot survives the render it caused

- **WHEN** an application completes and the canvas has rendered the result
- **THEN** the snapshot is still available to restore
