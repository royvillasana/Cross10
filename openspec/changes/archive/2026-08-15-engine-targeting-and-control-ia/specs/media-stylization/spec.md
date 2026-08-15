## ADDED Requirements

### Requirement: An imported image can be flipped

An image layer SHALL expose horizontal and vertical flip, driving the `flipX` and
`flipY` uniforms that the media path already applies in the picture's own axes
after rotation.

Flip SHALL be a transform of the layer rather than a re-import of the asset, so
flipping does not decode the source again and does not change the layer's size,
position, or the canvas dimensions.

#### Scenario: Flipping mirrors the picture

- **WHEN** a named asymmetric image fixture is imported and flipped horizontally
- **THEN** the pixel sampled from the left of the rendered region matches the one previously sampled from the right

#### Scenario: Flip composes with rotation in the picture's axes

- **WHEN** an imported image is rotated and then flipped vertically
- **THEN** the fold runs along the picture's own axis rather than the screen's

#### Scenario: Flip does not resize anything

- **WHEN** an imported image is flipped
- **THEN** the layer's size and position are unchanged
- **AND** the canvas dimensions are unchanged

#### Scenario: Flip does not re-decode the source

- **WHEN** an imported image is flipped
- **THEN** no new decode of the source asset is performed
