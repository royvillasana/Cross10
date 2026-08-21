# shader-editor Specification

## Purpose
Recorded from the Croix10 change, archived at 110 of 219 tasks.

**Build status: none of this is built. The owner decided on 2026-08-21 to keep
it**, and deciding that dissolved the objection this file was carrying.

The objection was that the product had gone the other way: `shader-delivery` R55
assembles the composed GLSL for the stack an author built and hands it out
through `Copy shader source`, so source leaves and never returns. Editing a hook
*inside* the studio looked like the alternative to that rather than a complement
— one makes a shader editor, the other an instrument whose output happens to be
readable.

**That is only true if the hook lives outside the assembled program, and it does
not have to.** A hook that is a chunk of the program the studio assembles is
carried by delivery rather than opposed to it: source still leaves complete,
and what leaves now includes whatever the author wrote by hand. The instrument
stays an instrument, its output stays readable, and the readable output gains a
part its author typed. Delivery is one-way as before; the hook is upstream of
it, not a second path.

**Two requirements below are restated to fit this product rather than the one
they were written for**, in the same way `post-fx-suite` was:

- The hook is **applied to the composite**, not to "the active engine". This
  product has no active engine — it has a stack in which every layer carries its
  own engine — so a single editable hook belongs at the one place a single thing
  can be: after the layers have composited. Reset restores the shipped
  pass-through rather than "the engine's shipped hook".
- **Annotated uniforms becoming controls conflicts with a static schema**, which
  is what this app has and what its acceptance machinery is built on: every
  control target must appear in a signed inventory and carry an acceptance row.
  Registering controls that exist only because someone typed a declaration is a
  different shape of product, and it is scheduled separately so that it is
  decided rather than absorbed.

Carried as `outstanding` 1a.4a (the hook, hot reload, errors, reset and
transfer) and 1a.4b (annotated uniforms).
## Requirements
### Requirement: Shader hook editing through the built-in code control
The shader tool SHALL use the built-in `code` control with `textValueKind: "structured"`. It MUST NOT introduce a third-party code editor or a custom editor UI. Because the control caps at 12 visible lines with internal scrolling, the editable value SHALL be a self-contained user-hook chunk of the active engine's shader rather than the whole program.

**Status: satisfied.** `Your own code` is the runtime's own `code` control, and
what it holds is a self-contained chunk with a documented contract — the
composited colour, the frame coordinate, and where the loop has got to — rather
than the program. No editor dependency was added.

The twelve-line cap shaped the feature rather than being worked around. An
editor big enough for the program would invite editing the parts that hold the
stack together; a chunk small enough to read at a glance is one an author can
own without owning the assembly.

Restated against this product: the chunk is applied to the **composite**, not to
"the active engine". Every layer here carries its own engine, so there is no
single active one — the place a single editable chunk belongs is where a single
thing exists, after the layers have composited.

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

**Status: satisfied.** The chunk is part of the stack's cache key, so an edit
assembles and compiles a new program and the next draw uses it. Uniform
locations are resolved by name on every draw, as they always were, so values
survive a swap without anything having to preserve them — the program changes
and the names do not.

#### Scenario: Successful edit takes effect
- **WHEN** the user edits the hook into a form that compiles
- **THEN** the new program renders on the canvas and current parameter values are preserved for surviving uniforms

#### Scenario: Applies while typing
- **WHEN** the user types in the `code` control
- **THEN** the value applies while typing per the control's behavior, with compilation coalesced so the render loop is never blocked

### Requirement: Compile error surface
Compilation failures SHALL surface the GLSL compiler message with a line number corrected for the injected preamble, and the last successfully compiled program SHALL keep rendering.

**Status: satisfied, and it is the requirement that mattered most.** This is
the only value in the product that can be *wrong* — every other control has a
domain the schema guarantees — so a failure has to be survivable rather than
fatal.

The renderer keeps the last program that compiled and goes on drawing it, and
the compiler's message is shown over the canvas with its line numbers moved back
into the editor's frame. A message pointing at line 412 of a program nobody
wrote is worse than none: it tells an author the mistake is somewhere they
cannot look. The failing source is deliberately *not* cached, so the next
keystroke tries again rather than being told the same failure from memory.

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

**Status: pending — scheduled as `outstanding` 1a.4b, and separated on
purpose.** This is the requirement that conflicts with a static schema. Every
control target in this app appears in a signed inventory and carries an
acceptance row; a control that exists because someone typed a declaration has
neither, and cannot be given them by anything the build can check. It needs a
decision about how a control surface that is not known until runtime is proved,
which is a different question from the rest of this file.

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

**Status: satisfied for the source; the uniform values are 1a.4b's.** `Restore
the shipped code` puts the pass-through back, and the chunk is declared as an
additional value target so it is persisted and transferred with the composition
it is part of — a hook that vanished on reload would be the one part of a work
that did not survive being saved.

The shipped chunk is written out rather than left empty. A blank editor says
"type something" and nothing about what: the contract, the names in scope, what
a return value means. Four lines that do nothing teach all three, and the first
edit is to a working program rather than to a blank one. Blank and shipped mean
the same thing to the assembler, and neither is emitted — a stack nobody has
edited assembles exactly as it did before this existed.

#### Scenario: Reset to shipped source
- **WHEN** the user triggers reset in the shader section
- **THEN** the control and the canvas return to the engine's shipped hook

#### Scenario: Custom hook survives transfer
- **WHEN** the user exports settings with a custom hook active and imports them again
- **THEN** the hook source and its uniform values are restored and the canvas matches

