## MODIFIED Requirements

### Requirement: Image export settings and real output size
An `Image Export` section SHALL expose `export.image.format` (default `png`, options PNG and JPG) and `export.image.resolution` (default `4k`, options 2K, 4K, 8K) as two `select` controls in one compact two-column row. The selected resolution SHALL produce real 2048, 4096, or 8192 pixel long-edge output.

Canvas sizing SHALL have exactly one owner. No product **control** SHALL duplicate
it: a width, height, or aspect control authored into the control surface beside the
runtime's own is two surfaces over one value, and they will disagree.

A product flow that runs **before a canvas exists** MAY set canvas sizing, provided
it writes the runtime's own `canvas.aspectRatio`, `Canvas width`, and `Canvas height`
targets rather than storing a size of its own. That is not a duplicate owner but the
same owner reached earlier, and it is the only way a size can be chosen before there
is work to reflow. Such a flow SHALL NOT persist a canvas size outside those targets.

Where a product offers named output shapes — sizes a destination expects, rather than
ratios — it SHALL set them through those same targets, and the names SHALL describe
the destination rather than claiming an affiliation with it.

#### Scenario: 4K export produces real pixels
- **WHEN** the user exports PNG at 4K
- **THEN** the decoded file's long edge is 4096 pixels
- **AND** stripe pitch scales proportionally so the composition matches the screen rather than showing more stripes

#### Scenario: Aspect ratio comes from Setup
- **WHEN** the user wants a square or custom output shape while editing
- **THEN** they set it through runtime Setup `Aspect ratio`, `Canvas width`, and `Canvas height`
- **AND** no product control in the control surface duplicates canvas sizing

#### Scenario: A pre-canvas flow may size the canvas
- **WHEN** a canvas is sized before it exists
- **THEN** the size is written to the runtime's own aspect, width, and height targets
- **AND** no canvas size is stored anywhere else

#### Scenario: Named output shapes set the real targets
- **WHEN** a named output shape is chosen
- **THEN** the runtime's aspect, width, and height carry that shape's real pixel dimensions
- **AND** the name describes where the output is going rather than claiming an affiliation

#### Scenario: Background honored
- **WHEN** Background is off and the user exports PNG
- **THEN** the PNG is transparent, while JPG remains opaque
