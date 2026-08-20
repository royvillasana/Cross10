# shader-delivery Specification

## Purpose
How a composed shader leaves Shader Studio: as source the author can compile
elsewhere, delivered outside the artifact pipeline the runtime owns.

**Build status is stated per requirement**, on the same basis as
`shader-authoring`.

## Requirements
### Requirement: The artifact is the shader
The product SHALL assemble the composed GLSL and the current uniform values into a standalone shader. The assembled source SHALL NOT contain a watermark, attribution comment, or any injected identifier, because a delivered shader is meant to be used unmodified.

**Status: satisfied, with one exception that is now stated rather than hidden.**
Assembly emits the composed GLSL with the author's current values baked in,
compiles without the studio's chunk registry, and is asserted to carry no
watermark or injected identifier -- a test rather than a convention. Unit tests
cover every registered layer type and a mixed stack.

**A drawn region is the exception.** It used to travel inside the source: the
path was a list of `vec2` literals and a point-in-polygon test, so a delivered
shader carried the shape someone had drawn. That is also why a path could hold
only two dozen nodes -- every node was a line of program and an iteration *per
pixel*, so the cost of drawing was paid again on every pixel of every frame, and
curves were out of the question.

Raising that ceiling meant rasterizing the region into a mask the shader
samples, which makes per-pixel cost constant in the node count and lets a path
hold thousands of nodes with a bézier at each. The price is exactly this
requirement: a mask is an image, and an image cannot be a line of GLSL. A stack
containing a drawn region now declares `uniform sampler2D uStudioPathMask`, and
the assembled source says so in a comment at the declaration -- a recipient
supplies the mask or the region reads as empty.

Everything else in the source is unchanged and still self-contained. The trade
was made deliberately and in one direction only: an author who has not drawn a
region delivers exactly what they delivered before.

#### Scenario: Assembled source is self-contained
- **WHEN** a shader is assembled for delivery
- **THEN** the source compiles without referencing the studio's chunk registry
- **AND** its uniform declarations and default values accompany it

### Requirement: Delivery happens outside the artifact pipeline
Shader source SHALL leave the app through a clipboard action or the MCP package, never through `exportIntent`. Toolcraft's export contract covers image and video artifacts only, and the runtime owns that pipeline end to end.

**Status: satisfied in the product, unproved at the gate.** The copy-source
action delivers through the clipboard, `exportIntent` still describes only the
image and video artifacts, and both have rows and browser proofs. What is
outstanding is `npm run verify:delivery`, which is blocked on operator
authorization rather than on the product (task 2.10 of the archived change).

#### Scenario: Artifact intent is unchanged by shader delivery
- **WHEN** shader delivery is exercised
- **THEN** the recorded `exportIntent` still describes only the image and video artifacts the app actually produces

