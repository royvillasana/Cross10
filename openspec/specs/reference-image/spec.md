# reference-image Specification

## Purpose
TBD - created by archiving change reference-image-and-artwork-presets. Update Purpose after archive.
## Requirements
### Requirement: A reference is loaded to author against

A user SHALL be able to load an image as a reference for the composition they are
building. The reference SHALL be displayed with the canvas at an adjustable
opacity and SHALL be dismissable without disturbing the composition.

The reference SHALL be chosen in a dialog rather than in a section of the control
surface, and that dialog SHALL be reachable from the onboarding flow and from the
editor afterwards. Choosing what to aim at is a decision taken before building and
revisited occasionally; it is not a control that shapes the work, and sitting in
the panel among controls that do gave it a weight it does not have.

Its strength and its comparison mode MAY remain in the control surface, because
those are adjusted while looking at the work rather than decided before it.

A reference MUST NOT be a layer. It SHALL NOT appear in the layer list, SHALL NOT
take part in compositing order, and SHALL NOT be selectable as a layer, because a
guide that can be reordered into the artwork is not a guide.

#### Scenario: A reference is visible with the composition

- **WHEN** an image is loaded as a reference
- **THEN** it is displayed with the canvas
- **AND** its opacity can be adjusted

#### Scenario: A reference is chosen in a dialog

- **WHEN** the control surface is read
- **THEN** it holds no section whose purpose is choosing which reference to show
- **AND** the reference can be chosen from a dialog reachable while editing

#### Scenario: A reference is not a layer

- **WHEN** an image is loaded as a reference
- **THEN** the layer list is unchanged
- **AND** no layer can be selected that corresponds to the reference

#### Scenario: Dismissing a reference leaves the composition alone

- **WHEN** a loaded reference is cleared
- **THEN** every layer and every layer value is exactly as it was before the reference was loaded

#### Scenario: Loading a reference does not resize the canvas

- **WHEN** a reference whose dimensions differ from the canvas is loaded
- **THEN** the canvas dimensions are unchanged
- **AND** the composition renders at the size it had before

#### Scenario: The reference sits on the composition

- **WHEN** a reference is shown at any zoom
- **THEN** it occupies the same box on screen as the composition it is a guide to

### Requirement: A reference reaches no artifact

A reference SHALL be absent from every artifact the product produces. An exported
image SHALL be identical whether or not a reference is loaded. An exported video
SHALL be identical whether or not a reference is loaded. The assembled deliverable
shader SHALL be identical whether or not a reference is loaded, and SHALL declare
no uniform, sampler, or chunk originating from the reference.

This is a correctness requirement rather than a convenience: the user may load an
image they do not own, and a tool that can publish what it was only asked to
display has done something the user did not ask for.

#### Scenario: Export ignores a loaded reference

- **WHEN** an image is exported with a reference loaded at any opacity
- **THEN** the exported artifact is pixel-identical to the export of the same composition with no reference loaded

#### Scenario: The delivered shader ignores a loaded reference

- **WHEN** the shader source is assembled with a reference loaded
- **THEN** the source is byte-identical to the source assembled with no reference loaded
- **AND** it declares no sampler or uniform belonging to the reference

#### Scenario: A reference is not part of transferred settings

- **WHEN** settings are exported with a reference loaded and imported elsewhere
- **THEN** the imported state carries the composition
- **AND** it carries no reference image data

### Requirement: A reference can be compared against, not just overlaid

The product SHALL offer at least one comparison beyond a plain overlay, so a user
can judge how far the composition is from the reference rather than only seeing
both at once.

Comparison SHALL be a display mode of the editor. It MUST NOT alter layer values,
and leaving comparison MUST leave the composition unchanged.

#### Scenario: A comparison mode is available

- **WHEN** a reference is loaded
- **THEN** at least one comparison beyond a plain overlay can be chosen

#### Scenario: Comparing changes nothing

- **WHEN** a comparison mode is entered and then left
- **THEN** every layer value is unchanged
- **AND** the rendered composition is unchanged

#### Scenario: Comparison is not exported either

- **WHEN** an image is exported while a comparison mode is active
- **THEN** the exported artifact shows the composition alone

