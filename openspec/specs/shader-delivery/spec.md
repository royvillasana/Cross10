# shader-delivery Specification

## Purpose
How a composed shader leaves Shader Studio: as source the author can compile
elsewhere, delivered outside the artifact pipeline the runtime owns.

**Build status is stated per requirement**, on the same basis as
`shader-authoring`.

## Requirements
### Requirement: The artifact is the shader
**Status: satisfied.** Assembly emits the composed GLSL with the author's
current values baked in, compiles without the studio's chunk registry, and is
asserted to carry no watermark or injected identifier -- a test rather than a
convention. Unit tests cover every registered layer type and a mixed stack.

The product SHALL assemble the composed GLSL and the current uniform values into a standalone shader. The assembled source SHALL NOT contain a watermark, attribution comment, or any injected identifier, because a delivered shader is meant to be used unmodified.

#### Scenario: Assembled source is self-contained
- **WHEN** a shader is assembled for delivery
- **THEN** the source compiles without referencing the studio's chunk registry
- **AND** its uniform declarations and default values accompany it

### Requirement: Delivery happens outside the artifact pipeline
**Status: satisfied in the product, unproved at the gate.** The copy-source
action delivers through the clipboard, `exportIntent` still describes only the
image and video artifacts, and both have rows and browser proofs. What is
outstanding is `npm run verify:delivery`, which is blocked on operator
authorization rather than on the product (task 2.10 of the archived change).

Shader source SHALL leave the app through a clipboard action or the MCP package, never through `exportIntent`. Toolcraft's export contract covers image and video artifacts only, and the runtime owns that pipeline end to end.

#### Scenario: Artifact intent is unchanged by shader delivery
- **WHEN** shader delivery is exercised
- **THEN** the recorded `exportIntent` still describes only the image and video artifacts the app actually produces

