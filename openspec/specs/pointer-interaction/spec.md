# pointer-interaction Specification

## Purpose
TBD - created by archiving change engine-targeting-and-control-ia. Update Purpose after archive.
## Requirements
### Requirement: A pointer effect chooses which layers it moves

Pointer response SHALL take a subject of the selected layer or every layer,
rather than being available only on whichever layer happens to be selected. The
subject SHALL be readable from the control that sets it.

A pointer effect applied to every layer SHALL affect each layer through that
layer's own parameters, so layers of different kinds respond in their own terms
rather than through one shared displacement applied after compositing.

#### Scenario: The effect follows the selected layer only

- **WHEN** the pointer subject is the selected layer and the pointer moves across the canvas
- **THEN** only that layer's contribution changes
- **AND** the other layers render unchanged at every pointer position

#### Scenario: The effect reaches every layer

- **WHEN** the pointer subject is every layer and the pointer moves across the canvas
- **THEN** every layer with a non-zero pointer amount changes its contribution
- **AND** each responds through its own layer type's parameters

#### Scenario: Changing the selection does not move the effect

- **WHEN** the pointer subject is every layer and a different layer is selected
- **THEN** the set of layers responding to the pointer is unchanged

### Requirement: Pointer response falls off with distance and is exportable

Pointer response SHALL fall off with distance from the cursor, reaching nothing
at the falloff limit, so a pointer parked outside the frame contributes nothing.

An export SHALL be deterministic with respect to the pointer: a render taken with
no pointer present SHALL be identical to a render of the same state with the
pointer effect at rest. The pointer position MUST NOT be recorded on the undo
stack, because it changes on every press including the press of the Undo button
itself.

#### Scenario: Distance reduces the effect

- **WHEN** the pointer is near a region and then far from it
- **THEN** the near render differs from the at-rest render by more than the far render does

#### Scenario: A pointer outside the frame reaches nothing

- **WHEN** the pointer leaves the canvas
- **THEN** the render is identical to the at-rest render

#### Scenario: Export ignores the live pointer

- **WHEN** an image is exported while the pointer sits over the canvas
- **THEN** the exported artifact matches the at-rest render

#### Scenario: The pointer is not history

- **WHEN** the pointer moves across the canvas
- **THEN** no entry is added to the undo stack

### Requirement: Pointer displacement is part of the delivered shader

A pointer effect SHALL be expressed in the assembled shader through a declared
uniform, so a delivered shader carries the effect and its recipient can drive it.
The pointer uniform SHALL remain a uniform rather than being baked to a constant
when the source is assembled.

#### Scenario: The delivered shader carries the pointer uniform

- **WHEN** a stack using a pointer effect is assembled for delivery
- **THEN** the source declares the pointer uniform
- **AND** the pointer uniform is not baked to a constant

#### Scenario: Delivery carries no product identity

- **WHEN** a stack using a pointer effect is assembled for delivery
- **THEN** the source mentions no product name, attribution, or generator marker

