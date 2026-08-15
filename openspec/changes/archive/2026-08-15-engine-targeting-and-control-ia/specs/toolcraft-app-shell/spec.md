## MODIFIED Requirements

### Requirement: Entity-scoped control sections
An `appControlSectionInventory` SHALL be exported declaring every product section's stable `entityId`, human-readable `entity`, exact `targets`, and `groupingReason`. Each product control target SHALL appear exactly once. One entity SHALL stay in one section through ten controls; sections of eight to ten controls SHALL declare `semanticGroup` on every control; an entity above ten controls SHALL split into balanced two-to-ten-control sections sharing the same `entityId` with a unique `workflowStage` and concrete `splitReason`.

A control and the controls it is read with SHALL sit in the same section, and
sections that continue one another SHALL be adjacent. `groupingReason` SHALL
state what the user is doing when they need those controls together, not which
module the values happen to live in. Specifically: the colours of one layer SHALL
NOT be split across sections; a layer's kind and the media that kind requires
SHALL be reachable without crossing an unrelated section; and a layer's geometry,
including its flip, SHALL be one section.

#### Scenario: Inventory covers every control
- **WHEN** the schema is validated
- **THEN** every product control target appears exactly once in the inventory
- **AND** only `panelActions`, `settingsTransfer`, and the seven reserved Setup targets are exempt

#### Scenario: Export and Background settings consume budget
- **WHEN** `Image Export`, `Video Export`, and `Background` are authored
- **THEN** each has its own inventory entry, and `export.image.format`, `export.image.resolution`, `export.video.format`, `export.video.resolution`, and `export.includeBackground` each count against their section's ten-control budget

#### Scenario: Oversized entity splits into workflow stages
- **WHEN** the stripe geometry entity requires more than ten controls
- **THEN** it is split into balanced sections that share one `entityId` and declare distinct `workflowStage` values
- **AND** no split section is left holding a single control

#### Scenario: Banned section titles rejected
- **WHEN** section titles are authored
- **THEN** no section is titled with a generic name (`Control(s)`, `Setting(s)`, `Parameter(s)`, `Option(s)`, `Configuration`, `Config`, `Adjustment(s)`) or a control-type name (including `Color`, `Colors`)
- **AND** each title names the product thing it edits

#### Scenario: Broad titles stay within their limit
- **WHEN** a broad title such as `Motion`, `Export`, `Scene`, or `Shape` is used
- **THEN** that section holds fewer than eight controls and fewer than three semantic clusters

#### Scenario: One layer's colours are not split
- **WHEN** the inventory is validated
- **THEN** every colour target belonging to one layer sits in a single section

#### Scenario: A layer's kind and its media stay together
- **WHEN** a layer kind that requires media is selected
- **THEN** the control that sets the kind and the control that supplies the media are in the same section or in adjacent sections

#### Scenario: Continuing sections are adjacent
- **WHEN** two sections share an `entityId`
- **THEN** they are adjacent in the rendered order
