## ADDED Requirements

### Requirement: The schema is the single parameter declaration site
`src/app/app-schema.ts` SHALL be the one place a parameter is declared. Each control SHALL declare `type`, `target`, `defaultValue`, `applicability`, and — for visible non-action controls — `performanceRole` and `performanceReason`. Uniform upload, animation targets, randomization ranges, persistence, and settings transfer SHALL all derive from that declaration. A parallel product-owned control registry MUST NOT exist.

#### Scenario: One declaration yields every behavior
- **WHEN** a numeric parameter is declared with a target, range, and default
- **THEN** the runtime renders its control, persists its value, includes it in settings transfer, makes it resettable, and exposes it as a keyframe target
- **AND** the renderer uploads it as a uniform without additional per-parameter registration

#### Scenario: Bounds are complete
- **WHEN** the schema is validated
- **THEN** every numeric parameter declares a finite `min`, `max`, `step`, and a `defaultValue` within range

#### Scenario: No orphan uniforms
- **WHEN** an engine shader declares a uniform other than a runtime-supplied per-frame value
- **THEN** a corresponding schema control exists
- **AND** a product test fails if it does not

### Requirement: Declared control intent
Each control SHALL declare the intent field its type requires: `sliderValueKind` for sliders, `textValueKind` for `text` and `code`, and `curveIntent` for `curves`. Intent SHALL reflect the product value model, not a visual preference.

#### Scenario: Counts are visually discrete
- **WHEN** stripe count, band count, or slot count is declared
- **THEN** it uses `sliderValueKind: "discrete"` with a `step`, so the runtime derives one marker per position

#### Scenario: Rates stay visually continuous
- **WHEN** speed, rate, frequency, intensity, or strength is declared
- **THEN** it uses `sliderValueKind: "continuous"` even when a `step` is present, because the range has too many positions for markers

#### Scenario: Easing curves are single-value maps
- **WHEN** an easing or response curve is declared
- **THEN** it uses `curveIntent: "single-value-map"` with `variant: "single"` and monotone interpolation, not RGB channel tabs

### Requirement: Exact built-in control owners
Each product value model SHALL bind to its exact built-in owner. Compound built-in controls SHALL remain atomic; their owned fields MUST NOT be split into neighboring schema controls. A custom control SHALL be introduced only after a recorded Control Selection Inventory documents the built-ins checked and why the closest one is insufficient.

#### Scenario: Gradients use the gradient control
- **WHEN** an adjustable gradient is exposed
- **THEN** a `gradient` control owns its type, angle, stop track, and stop list
- **AND** it is not reconstructed from separate color and angle controls

#### Scenario: Growable sets use collection actions
- **WHEN** the user owns how many items exist, as with palette color slots
- **THEN** `collectionActions` is used
- **AND** a count slider paired with hidden fixed item controls is not

#### Scenario: Source-owned arrays use source collection
- **WHEN** a runtime workflow owns the array length and the user edits only existing item values
- **THEN** `sourceCollection` is used with a built-in `itemControl`

#### Scenario: Custom control gate is recorded
- **WHEN** a custom control is proposed
- **THEN** the inventory records the product need, value model, built-ins checked, chosen option, and rejected alternatives before any custom UI exists

### Requirement: Runtime-owned targets are never redeclared
Product sections MUST NOT declare `runtime.settingsTransfer`, `canvas.infinity`, `canvas.aspectRatio`, `canvas.size.width`, `canvas.size.height`, `canvas.renderScale`, or `panels.timeline.extended`.

#### Scenario: Reserved targets absent from product sections
- **WHEN** the schema is validated
- **THEN** no product-authored section declares a reserved runtime target

### Requirement: Values live in runtime state
Final product settings SHALL be held in runtime schema state and mutated through runtime commands, not in isolated local React state. Editor-owned actions SHALL route through runtime commands such as `controls.reset`, `controls.resetTargets`, `media.import`, `media.delete`, and `canvas.center`.

#### Scenario: Reset reaches every parameter
- **WHEN** the user triggers global reset
- **THEN** every schema control returns to its `defaultValue` and the canvas re-renders accordingly

### Requirement: Driven parameters remain editable
A parameter driven by a keyframe track or an LFO SHALL display its current driven value with a driven indicator, and its base value SHALL remain editable during playback.

#### Scenario: Editing a driven parameter mid-playback
- **WHEN** the user edits the base value of an LFO-driven parameter while playback runs
- **THEN** modulation continues to apply relative to the new base value without interrupting the render loop

### Requirement: Module boundaries suit later-delivery ownership
Frequently changed defaults and domain logic SHALL live in product modules separate from the broad `app-schema.ts` assembly module, and `src/app/app-verification-impact.json` SHALL classify every product production module as `presentation`, `functional`, or `performance` with its nearest acceptance ids and, for performance owners, exact renderer pass ids.

#### Scenario: Narrow edits select narrow proof
- **WHEN** a palette default changes in its own module
- **THEN** the derived verification scope covers that module's acceptance ids rather than every acceptance id owned by the schema assembly
