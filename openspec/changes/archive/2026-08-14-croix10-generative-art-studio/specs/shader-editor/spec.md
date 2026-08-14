## ADDED Requirements

### Requirement: Shader hook editing through the built-in code control
The shader tool SHALL use the built-in `code` control with `textValueKind: "structured"`. It MUST NOT introduce a third-party code editor or a custom editor UI. Because the control caps at 12 visible lines with internal scrolling, the editable value SHALL be a self-contained user-hook chunk of the active engine's shader rather than the whole program.

#### Scenario: Editor holds the hook, not the program
- **WHEN** the user opens the shader tool with the Couleur Additive engine active
- **THEN** the `code` control contains that engine's editable hook chunk with its documented input and output contract
- **AND** the surrounding program, chunk includes, and boilerplate are not editable

#### Scenario: No custom editor
- **WHEN** product modules are inspected
- **THEN** no code-editor dependency is present and no custom textarea substitutes for the schema `code` control

#### Scenario: Long hook scrolls
- **WHEN** the hook exceeds 12 lines
- **THEN** it scrolls inside the control and the controls panel does not grow taller

### Requirement: Hot reload on successful compile
Editing the hook SHALL assemble and compile a new program and swap it onto the canvas, re-resolving uniform locations by name and preserving values for uniforms that persist.

#### Scenario: Successful edit takes effect
- **WHEN** the user edits the hook into a form that compiles
- **THEN** the new program renders on the canvas and current parameter values are preserved for surviving uniforms

#### Scenario: Applies while typing
- **WHEN** the user types in the `code` control
- **THEN** the value applies while typing per the control's behavior, with compilation coalesced so the render loop is never blocked

### Requirement: Compile error surface
Compilation failures SHALL surface the GLSL compiler message with a line number corrected for the injected preamble, and the last successfully compiled program SHALL keep rendering.

#### Scenario: Invalid source keeps the last good program
- **WHEN** the user introduces a syntax error
- **THEN** the message and corrected line number are displayed and the canvas continues rendering the last good program rather than going blank

#### Scenario: Line numbers map to the hook
- **WHEN** an error is reported
- **THEN** the reported line corresponds to the line the user sees in the `code` control, not to the assembled program

#### Scenario: Recovering from an error
- **WHEN** the user fixes the error
- **THEN** the error surface clears and the corrected program takes over

### Requirement: Uniform annotations become controls
Uniforms declared in the hook with a range annotation SHALL be registered as schema-backed controls in a namespace separate from the built-in parameters. Removing a declaration SHALL remove its control and stop its upload.

#### Scenario: Annotated uniform becomes a control
- **WHEN** the user declares a float uniform with a range annotation and it compiles
- **THEN** a slider for it appears in the shader section and drives the shader

#### Scenario: Removed uniform disappears
- **WHEN** the user deletes a uniform declaration and it compiles
- **THEN** its control is removed and no upload is attempted for it

#### Scenario: Namespaces stay separate
- **WHEN** the shader is reset
- **THEN** hook-registered controls are dropped while built-in parameters are untouched

### Requirement: Reset and transfer
An `actions` control SHALL restore the active engine's shipped hook source. The custom hook source and its annotated uniform values SHALL be included in Settings Transfer through declared additional value targets.

#### Scenario: Reset to shipped source
- **WHEN** the user triggers reset in the shader section
- **THEN** the control and the canvas return to the engine's shipped hook

#### Scenario: Custom hook survives transfer
- **WHEN** the user exports settings with a custom hook active and imports them again
- **THEN** the hook source and its uniform values are restored and the canvas matches
