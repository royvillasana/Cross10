# engine-application Specification

## Purpose
TBD - created by archiving change engine-targeting-and-control-ia. Update Purpose after archive.
## Requirements
### Requirement: A technique is chosen from a visual picker before anything else

The product SHALL present the available techniques as a set of thumbnails, so the
first thing a user meets is what the techniques look like rather than a list of
their names. Choosing one SHALL set the canvas to that technique's construction,
which the user then edits freely — adding, removing, and changing layers.

The picker SHALL be the built-in `imagePicker` control, which owns thumbnail
layout and takes the item list only. Product code MUST NOT author its own gallery
panel, dialog, or thumbnail grid, because runtime panels, dialogs, and the canvas
are runtime surfaces and a custom control may not recreate a built-in.

Every thumbnail SHALL be actionable in the context it is shown in, and each SHALL
depict the technique it selects.

#### Scenario: Techniques are shown as thumbnails

- **WHEN** the product is opened
- **THEN** the available techniques are presented as thumbnails
- **AND** each thumbnail depicts the construction it will apply

#### Scenario: Choosing a technique starts the work

- **WHEN** a technique thumbnail is chosen and applied
- **THEN** the canvas renders that technique's construction
- **AND** every control that construction uses is live and editable

#### Scenario: The construction is a starting point, not a lock

- **WHEN** a technique has been applied
- **AND** layers are added, removed, or edited
- **THEN** the rendered output follows those edits
- **AND** nothing restores the technique's own values over them

#### Scenario: The picker is a built-in

- **WHEN** the schema is validated
- **THEN** the technique picker is the built-in `imagePicker`
- **AND** no product-authored grid, panel, or dialog recreates it

### Requirement: Changing the technique is confirmed before it destroys work

Changing the technique SHALL replace the canvas, and the product SHALL obtain an
explicit confirmation before it does. The confirmation SHALL state that the
current work will be replaced. Declining SHALL leave the composition exactly as it
was, including the technique that was already chosen.

Confirmation SHALL be expressed through built-in controls — a deliberate second
action rather than a single press. A single-press control MUST NOT be the whole of
a destructive technique change, and the runtime offers product code no modal
dialog to raise.

Confirmation does not replace revertibility. A confirmed technique change SHALL
still be revertible, because a user who confirms is agreeing to proceed rather
than agreeing to lose the work.

#### Scenario: Changing technique asks first

- **WHEN** a different technique is chosen over existing work
- **THEN** the product states that the current work will be replaced
- **AND** the canvas is unchanged until the change is confirmed

#### Scenario: Declining changes nothing

- **WHEN** a technique change is offered and declined
- **THEN** every layer and every layer value is exactly as it was
- **AND** the previously chosen technique is still the current one

#### Scenario: A confirmed change is still revertible

- **WHEN** a technique change is confirmed
- **AND** the restore action is taken
- **THEN** the stack that existed before the change is rendered again

#### Scenario: The first technique needs no confirmation

- **WHEN** a technique is chosen and no work exists to replace
- **THEN** it applies without asking

### Requirement: An engine applies to a layer, a group, or an image

Within the chosen technique, an engine SHALL be applicable to a target: the
selected layer, the selected group, or an image layer. Applying an engine to a
target SHALL change only that target and SHALL NOT replace the canvas or ask for
confirmation, because it adds to the work rather than discarding it.

The technique names the construction the canvas is working in; the engine names
what is applied within it. These two SHALL share their vocabulary, since they name
the same phenomena, and the surface SHALL make clear which is the canvas's context
and which is being applied to a target.

A target that cannot receive an engine — a group target with no group selected, an
image target with no image layer — SHALL be unavailable rather than silently
redirected.

#### Scenario: Applying an engine to a layer leaves its neighbours alone

- **WHEN** an engine is applied with the target set to the selected layer
- **THEN** that layer renders the engine
- **AND** every other layer in the stack renders exactly as it did before

#### Scenario: Applying an engine to a group leaves layers outside it alone

- **WHEN** an engine is applied with the target set to the selected group
- **THEN** every layer within that group renders the engine
- **AND** no layer outside the group changes

#### Scenario: Applying an engine to an image restyles the picture

- **WHEN** an engine is applied with the target set to an image layer
- **THEN** that image renders through the engine
- **AND** no other layer changes

#### Scenario: Applying an engine never asks for confirmation

- **WHEN** an engine is applied to any target
- **THEN** no confirmation is requested
- **AND** the canvas is not replaced

#### Scenario: An impossible target is not offered

- **WHEN** no group is selected
- **THEN** the group target is unavailable
- **AND** applying does not fall back to a different target

#### Scenario: Context and application are distinguishable

- **WHEN** the control surface is read
- **THEN** the control that sets the canvas's technique and the control that applies an engine to a target are distinguishable as context and application
- **AND** neither can be mistaken for the other despite sharing vocabulary

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

