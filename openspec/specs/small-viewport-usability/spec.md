# small-viewport-usability Specification

## Purpose
TBD - created by archiving change usable-on-a-phone. Update Purpose after archive.
## Requirements
### Requirement: Every panel is reachable at any viewport the product opens in
No panel SHALL sit outside the viewport when the product loads. Where a panel's
persisted or default position would place it beyond the visible area, the product
SHALL return it through the runtime's own panel commands.

A panel that cannot be reached is worse than one that is badly placed: a user with no
way to bring it back has lost the control surface entirely, with nothing on the page
to tell them why.

#### Scenario: Nothing loads off screen
- **WHEN** the product is opened at a viewport narrower than the threshold
- **THEN** every enabled panel's box lies within the viewport

#### Scenario: Wide viewports are untouched
- **WHEN** the product is opened at a viewport wider than the threshold
- **THEN** no panel command is dispatched on load
- **AND** panel positions are whatever they were

### Requirement: A narrow viewport starts collapsed and shows one panel at a time
Below the threshold, every control section SHALL start collapsed, so the surface a
user meets is a list of headings rather than a column of inputs.

Below the threshold, at most one of Layers and Controls SHALL be shown at a time, so
the canvas is visible whenever neither is open. Showing one SHALL hide the other.

The product MUST NOT author its own control surface, layer list, or panel to achieve
this, and MUST NOT hide a runtime panel with styling. Whatever it does SHALL be done
through published panel commands, so the runtime remains the only owner of its own
surfaces.

#### Scenario: Sections start collapsed
- **WHEN** the product is opened at a narrow viewport
- **THEN** every control section is collapsed

#### Scenario: One panel at a time
- **WHEN** Layers is shown at a narrow viewport
- **THEN** Controls is hidden
- **AND** showing Controls hides Layers

#### Scenario: The runtime keeps its surfaces
- **WHEN** the product source is checked
- **THEN** no product module renders a control surface, layer list, or panel
- **AND** no product stylesheet hides a runtime panel

### Requirement: An arrangement the user made is never overridden
The product's layout adjustments SHALL apply only where the user has not arranged
things themselves. Once a user moves, hides, collapses, or expands a panel, the
product SHALL stop imposing its own arrangement for that session and afterwards.

A layout that re-imposes itself on every load is worse than a bad layout, because the
user can no longer fix it.

#### Scenario: A moved panel stays where the user put it
- **WHEN** a user moves a panel at a narrow viewport and reloads
- **THEN** the panel is where they left it
- **AND** the product dispatches no panel command on that load

#### Scenario: An expanded section stays expanded
- **WHEN** a user expands a section at a narrow viewport and reloads
- **THEN** that section is still expanded

