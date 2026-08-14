## ADDED Requirements

### Requirement: The artifact is the shader
The product SHALL assemble the composed GLSL and the current uniform values into a standalone shader. The assembled source SHALL NOT contain a watermark, attribution comment, or any injected identifier, because a delivered shader is meant to be used unmodified.

#### Scenario: Assembled source is self-contained
- **WHEN** a shader is assembled for delivery
- **THEN** the source compiles without referencing the studio's chunk registry
- **AND** its uniform declarations and default values accompany it

### Requirement: Delivery happens outside the artifact pipeline
Shader source SHALL leave the app through a clipboard action or the MCP package, never through `exportIntent`. Toolcraft's export contract covers image and video artifacts only, and the runtime owns that pipeline end to end.

#### Scenario: Artifact intent is unchanged by shader delivery
- **WHEN** shader delivery is exercised
- **THEN** the recorded `exportIntent` still describes only the image and video artifacts the app actually produces
