## ADDED Requirements

### Requirement: An edit can be taken back
Undo SHALL take back one author edit per press. The history stack is shared
between the runtime and the product, so state the product derives — the
per-layer record following the controls, the pointer position following the
pointer — MUST NOT be recorded on it. A derived write puts a patch between the
author and the thing they wanted back, and enough of them make Undo inert while
still leaving the button enabled.

A layer restored by undo SHALL come back with the settings it had. Values a
layer owned MUST NOT be discarded on delete while an undo can still restore the
layer itself, because a layer that returns as an empty shell reads as a working
undo until the restored layer is examined.

#### Scenario: One press takes back one edit
- **WHEN** a control is edited and Undo is pressed once
- **THEN** the control returns to the value it had
- **AND** the rendered output follows it

#### Scenario: A layer that was added is gone again
- **WHEN** a layer is added and Undo is pressed once
- **THEN** the layer list is the list that was there before

#### Scenario: A deleted layer comes back as itself
- **WHEN** a layer with edited settings is deleted
- **AND** Undo is pressed once
- **THEN** the layer is in the list again
- **AND** selecting it shows the settings it had rather than a new layer's defaults
