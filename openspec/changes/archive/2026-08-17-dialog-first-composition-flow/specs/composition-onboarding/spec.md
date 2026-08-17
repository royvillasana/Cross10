## ADDED Requirements

### Requirement: A session begins in a dialog, not in the control surface
The product SHALL present a dialog when it is opened with no work in progress, and
that dialog SHALL be the first thing a user meets. It SHALL offer the available
techniques as cards showing what each one looks like, and SHALL offer starting from
nothing beside them, so a user who wants a blank canvas does not have to decline a
technique to get one.

The control surface MUST NOT be the place a session is started from. Controls that
only decide what is about to be made SHALL be reached through this flow rather than
sitting in the panel at equal weight with the controls that come after those
decisions.

The dialog SHALL be dismissable, and dismissing it SHALL leave the product usable
rather than blocked, because a user who already knows what they want must not be
held by an introduction.

#### Scenario: Opening the product opens the dialog
- **WHEN** the product is opened with no work in progress
- **THEN** the dialog is shown
- **AND** it presents the techniques as cards and an option to start from nothing

#### Scenario: A card says what it will make
- **WHEN** the techniques are presented
- **THEN** each card shows a render of the construction choosing it will apply
- **AND** each names the series it belongs to

#### Scenario: The panel is not the entry point
- **WHEN** the control surface is read
- **THEN** it holds no section whose only purpose is starting a session

#### Scenario: Dismissing leaves the product usable
- **WHEN** the dialog is dismissed without a choice
- **THEN** the product is usable
- **AND** no composition has been created or destroyed

### Requirement: The canvas is set up before it exists
Choosing a starting point SHALL lead to a step that sets the canvas up — its aspect
ratio, its dimensions, its resolution scale, and its background — and the canvas
SHALL be created only when that step is confirmed. Setting these before there is
work is the point: chosen afterwards they reflow a composition that already exists.

The step SHALL be pre-filled from the starting point that was chosen, so a technique
with a proportion of its own arrives with that proportion rather than with a default
the user must correct.

Leaving the flow before confirming SHALL create nothing. A half-finished setup MUST
NOT leave a canvas partly configured, because a state nobody chose is worse than the
state they started in.

#### Scenario: Setup precedes the canvas
- **WHEN** a starting point is chosen
- **THEN** the canvas setup step is shown before any canvas is created
- **AND** the aspect ratio, dimensions, resolution scale, and background can each be set

#### Scenario: Confirming lands the author on the canvas
- **WHEN** the setup step is confirmed
- **THEN** the canvas is created at those settings
- **AND** the chosen starting point is rendered on it

#### Scenario: Abandoning setup creates nothing
- **WHEN** the setup step is left without confirming
- **THEN** no canvas has been created
- **AND** nothing that existed before has changed

### Requirement: Starting a session never destroys work silently
Beginning a new session over existing work SHALL be confirmed, and the confirmation
SHALL state that the current work will be replaced. Declining SHALL leave every
layer and every layer value as it was.

Confirming SHALL remain revertible through the restore action whose contract lives
in `engine-application`, because agreeing to proceed is not agreeing to lose the
work.

#### Scenario: Starting over existing work asks first
- **WHEN** a starting point is chosen and work already exists
- **THEN** the product states that the current work will be replaced
- **AND** nothing changes until it is confirmed

#### Scenario: Declining changes nothing
- **WHEN** the replacement is declined
- **THEN** every layer and every layer value is exactly as it was

#### Scenario: A confirmed replacement is still revertible
- **WHEN** the replacement is confirmed
- **AND** the restore action is taken
- **THEN** the stack that existed before is rendered again

### Requirement: A dialog is a product surface, not a recreated built-in
A product-authored dialog SHALL be rendered through a supported extension point and
MUST NOT recreate a built-in control, a runtime panel, the toolbar, the timeline,
the layers panel, the canvas, or the sticky panel actions. What it may own is the
*flow* — which step comes next, and what a step means — because no built-in
represents a sequence of decisions taken before work begins.

Values the dialog sets SHALL be written through ordinary runtime commands against
the same targets the control surface uses, so persistence, reset, and history
behave exactly as they do for any other edit.

#### Scenario: The dialog writes through runtime state
- **WHEN** the dialog sets a value
- **THEN** it writes the same schema target the control surface writes
- **AND** reset and persistence behave as they do for any other edit

#### Scenario: No built-in is recreated
- **WHEN** the schema and its custom renderers are validated
- **THEN** the dialog recreates no built-in control, runtime panel, toolbar, timeline, layer list, canvas, or sticky panel action
