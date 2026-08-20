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

### Requirement: The gallery is served to agents

The library and its assembled source SHALL be reachable by an agent through an
MCP package that lives outside the signed app.

**Status: satisfied.** `mcp/` is a package of its own with its own dependency,
exposing three tools over stdio: list the compositions, describe one's layers
and parameters, and assemble its source with overrides applied.

**Outside the app deliberately.** The integrity manifest covers the runtime, and
anything inside it inherits an obligation to stay byte-identical to what was
signed; a delivery surface should be free to change with the things it delivers.
The package *imports* the product's library rather than restating it, so an
entry served is the same entry the studio draws and a corrected preset is
corrected here by rebuilding nothing.

Two things the tool surface insists on. The **carriage** of each entry is served
with it -- whether a flat rectangle carries that investigation or only evokes
it -- because it is the one thing an agent choosing between entries could
otherwise get wrong, four of the series being environments a visitor walks
through. And an unknown parameter is an **error naming what the composition
carries** rather than a silent no-op: source that looks right and is not what
was asked for is the worst thing this could return.

Proved at two levels, because they are different claims. The package's own tests
drive it as a process over stdio in JSON-RPC -- the protocol, not the functions
behind it. That what comes back *compiles* is proved separately in a browser:
every entry in the gallery is assembled through the package and compiled and
linked in a real WebGL2 context, against a vertex stage the source does not ship
with. A string that looks like a shader and a driver that accepts it are not the
same claim.

#### Scenario: An agent chooses and assembles
- **WHEN** an agent lists the compositions, names one, and asks for its source with a parameter overridden
- **THEN** it receives complete GLSL with the author's values baked in and the override applied, carrying no attribution or identifier

#### Scenario: A misspelled parameter fails loudly
- **WHEN** an override names a parameter the composition does not carry
- **THEN** the call reports an error listing the parameters it does carry, and no source is returned

### Requirement: Delivery happens outside the artifact pipeline
Shader source SHALL leave the app through a clipboard action or the MCP package, never through `exportIntent`. Toolcraft's export contract covers image and video artifacts only, and the runtime owns that pipeline end to end.

**Status: satisfied in the product, unproved at the gate.** The copy-source
action delivers through the clipboard, the MCP package delivers to an agent,
`exportIntent` still describes only the image and video artifacts, and all of
them have proofs. What is outstanding is `npm run verify:delivery`, which is
blocked on operator
authorization rather than on the product (task 2.10 of the archived change).

#### Scenario: Artifact intent is unchanged by shader delivery
- **WHEN** shader delivery is exercised
- **THEN** the recorded `exportIntent` still describes only the image and video artifacts the app actually produces

