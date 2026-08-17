## ADDED Requirements

### Requirement: A loop is the viewer moving, not the work changing
A Croix10 loop SHALL animate the parameters that stand for a viewer's movement past
a fixed work, and SHALL NOT animate the properties that constitute the work itself.

Phase, angle, and the pointer's position are the first kind: a body walking past a
banded relief sees its phase shift, its apparent angle change, and the induced
colour travel. Those SHALL be available to drift.

A layer's inks, its band count, its separators, and its region SHALL NOT drift by
default, because a field whose colours change is a different field rather than the
same one seen from elsewhere — and the whole subject of these techniques is that the
work is static and the colour is not.

A product MAY offer drift over a property of the work when an author asks for it
explicitly, but the default SHALL be the viewer's movement, and the distinction
SHALL be stated wherever drift is configured so an author knows which they are
choosing.

#### Scenario: Movement parameters may drift
- **WHEN** a layer's drift is configured
- **THEN** phase, angle, and pointer reach can each be given a whole-cycle rate

#### Scenario: The work's own properties hold still by default
- **WHEN** a layer is animated with no explicit request to the contrary
- **THEN** its colours, band count, separators, and region are unchanged across the loop
- **AND** only the movement parameters differ between frames

#### Scenario: A still frame is unchanged by the feature existing
- **WHEN** the timeline sits at the start of the loop
- **THEN** the composition renders exactly as it did before drift was available
- **AND** an exported still is identical to the one the same composition produced before

#### Scenario: The distinction is legible where drift is set
- **WHEN** drift is configured
- **THEN** the surface distinguishes a parameter that moves the viewer from one that changes the work
