# toolcraft-app-shell Specification

## Purpose
Recorded from the Croix10 change, archived at 110 of 219 tasks.

**Build status here is not audited.** Unlike `shader-authoring` and
`shader-delivery`, no requirement in this file has been checked against the
Croix10 app in this pass, so it states intent rather than confirmed behaviour.
Auditing them is carried as a task in the `outstanding` change; until that is
done, treat every requirement below as a claim to verify rather than one to
rely on.
## Requirements
### Requirement: Toolcraft-native application shell
Croix10 SHALL be assembled through `defineToolcraft` and `ToolcraftApp`, supplying only `ToolcraftAppComposition` fields. Product code MUST NOT hand-compose runtime surfaces, render built-in control components directly, or import modules below `src/toolcraft/ui/components/controls/**`.

#### Scenario: Controls are declared, not rendered
- **WHEN** any visual parameter is exposed in the UI
- **THEN** it is declared in `src/app/app-schema.ts` with a `type` and `target` and rendered by the runtime
- **AND** no product module renders a control component or substitutes a native form element for a schema value model

#### Scenario: Styling stays local
- **WHEN** product styles are added
- **THEN** they live in locally imported `*.module.css` files with every selector anchored by a local class
- **AND** no global CSS, `:global`, host-attribute selector, or injected stylesheet exists

### Requirement: Product output confined to the canvas surface
`canvasContent` SHALL contain product output only. App UI, upload prompts, helper copy, placeholder artwork, and CTAs MUST NOT appear there, and the runtime canvas backing MUST remain visible behind product output.

#### Scenario: Neutral canvas before content
- **WHEN** the app loads with no imported source and no engine output yet
- **THEN** the canvas shows the neutral runtime-backed surface
- **AND** no invented placeholder artwork, sample output, or upload call-to-action is drawn

### Requirement: Entity-scoped control sections
An `appControlSectionInventory` SHALL be exported declaring every product section's stable `entityId`, human-readable `entity`, exact `targets`, and `groupingReason`. Each product control target SHALL appear exactly once. One entity SHALL stay in one section through ten controls; sections of eight to ten controls SHALL declare `semanticGroup` on every control; an entity above ten controls SHALL split into balanced two-to-ten-control sections sharing the same `entityId` with a unique `workflowStage` and concrete `splitReason`.

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

### Requirement: Section titles must not resemble their gating condition
A section title MUST NOT equal, contain, or be contained by the condition value or option label of a gate that lives in another section. Sections SHALL be titled by the entity they edit, not by the branch that reveals them.

#### Scenario: Branch-named sections rejected
- **WHEN** a section's controls are gated by a selector in another section
- **THEN** its title does not resemble that selector's condition value or option label
- **AND** titles name the edited entity, as in `Signal Damage` rather than `Glitch`, or `Character Grid` rather than `ASCII`

### Requirement: Gates live in the entity they gate
A gate control and every control it gates SHALL belong to the same inventory entity, because applicability cases are derived from the gate's own inventory-entry peers and a cross-entity gate derives no proof at all. The global engine and tool selectors are the sole exception; their branch behaviour SHALL be proved by named app-owned Playwright tests, and the exception SHALL be recorded in the worklog.

#### Scenario: Gate and dependents share an entity
- **WHEN** a switch or selector gates other controls
- **THEN** those controls belong to the same inventory entity, so applicability cases are derived for them

#### Scenario: Global selectors prove branches explicitly
- **WHEN** the engine or tool selector changes branch
- **THEN** a named app-owned Playwright test proves the resulting presence and absence, because the harness derives no cases across entities

### Requirement: Tool selection through a schema control
The nine tool modules SHALL be selected through a schema `tabs` control, because each selection replaces the workflow view below it and the Toolcraft `toolbar` is runtime-owned and not a product extension point. Engine selection SHALL use `select`. Shared scene parameters SHALL be preserved across tool and engine switches.

#### Scenario: Tools are not in the toolbar
- **WHEN** the app renders
- **THEN** the runtime toolbar exposes only its own history, radar, theme, and zoom controls
- **AND** tool selection is a product `tabs` control in the controls panel

#### Scenario: Engine selection cannot be segmented
- **WHEN** the six engines are exposed as a finite choice
- **THEN** a `select` control is used
- **AND** `segmented` is not used, since six options exceed its four-option and 24-character budgets

#### Scenario: Switching tools preserves parameters
- **WHEN** the user switches from the procedural generator to the image stylization tool
- **THEN** the active engine, palette, and geometry values are unchanged and the canvas re-renders through the new tool

### Requirement: Conditional applicability instead of disabling
Every product control SHALL declare `applicability` as `{ mode: "always" }` or `{ mode: "conditional", all: [...] }`. Inactive controls SHALL be absent while their values remain preserved. `disabled` and `disabledWhen` MUST NOT be used.

#### Scenario: Inapplicable controls are absent
- **WHEN** the Chromosaturation engine is active
- **THEN** stripe geometry controls the engine does not consume are absent from the panel rather than visible and inert

#### Scenario: Values survive absence
- **WHEN** the user selects a stripe engine again
- **THEN** the previously hidden geometry values are restored unchanged

### Requirement: Product keyboard shortcut
Randomize SHALL be reachable by pressing `R` when no text or code input has focus. Playback transport, undo, and redo SHALL remain runtime-owned and MUST NOT be rebound by product code.

#### Scenario: R randomizes
- **WHEN** the user presses `R` with no text input focused
- **THEN** randomization runs, honoring all current section locks

#### Scenario: Shortcut suppressed in the shader editor
- **WHEN** the user types `r` in the shader `code` control
- **THEN** the character is inserted and randomization does not occur

#### Scenario: No product transport controls
- **WHEN** the panel is inspected
- **THEN** it contains no Play, Pause, Animate, or Restart control
- **AND** transport is the runtime timeline's

### Requirement: Reset restores schema defaults
Every resettable control SHALL declare `defaultValue`, and section reset SHALL restore only that section's targets.

#### Scenario: Section reset is scoped
- **WHEN** the user triggers reset on the geometry section header
- **THEN** only that section's targets return to their `defaultValue` and other sections are untouched

