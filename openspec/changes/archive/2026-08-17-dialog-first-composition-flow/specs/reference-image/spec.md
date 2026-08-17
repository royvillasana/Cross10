## MODIFIED Requirements

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
