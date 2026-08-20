# Croix10 MCP

Serves the Croix10 gallery, and the shader source for any entry in it, to an
agent over MCP.

## Why this exists

This studio's artifact is the shader, not the picture. A composition leaves as
GLSL that compiles somewhere else, and the app delivers that to a person through
a clipboard action. This delivers it to an agent: ask what the library holds,
pick an entry, override a parameter, get source back — no browser, no canvas, no
human in the loop.

## Why it is a separate package

The app ships under an integrity manifest, and anything inside it inherits an
obligation to stay byte-identical to what was signed. A delivery surface should
be free to change with the things it delivers, so this lives outside the app
with its own dependency.

It *imports* the product's library rather than restating it — the gallery, the
layer types, the uniform defaults and the assembler are all the app's. There is
no second copy to drift: a preset corrected in the product is corrected here
without rebuilding anything.

## Install

```sh
cd mcp
npm install
```

Then register it with your MCP client. For Claude Code:

```sh
claude mcp add croix10 -- npx tsx /absolute/path/to/mcp/src/server.ts
```

Any client that speaks MCP over stdio works the same way — the command is
`npx tsx src/server.ts`, run from this directory.

## The tools

### `list_compositions`

Every entry in the gallery: id, label, the series it works in, its layers, and
**whether a flat rectangle carries that investigation or only evokes it**.

That last field is the one worth reading. Four of the series are environments —
a chamber the visitor stands inside, panels they walk between — and a picture of
one is not a rendering of it. Entries drawn from those are marked `evoke`.

Palettes are the studio's own. They do not reproduce any artist's palette and do
not claim to.

### `describe_composition`

One entry's layers in draw order, bottom first, with every parameter each layer
carries and its current value. The names are the ones an override uses, so this
is what to read before changing anything.

### `assemble_shader`

The assembled GLSL for an entry, with the author's values baked in as constants
and any overrides applied.

```json
{
  "id": "additive-bands",
  "overrides": [
    { "layer": 1, "name": "count", "value": 37 },
    { "layer": 1, "name": "colorA", "value": "#ff0000" }
  ]
}
```

Values are written the way a control holds them — a hex string for a colour, an
option's own string for a select, a number for a slider — and are normalised on
the way in by the same function a control edit goes through.

A misspelled parameter is an error naming what the composition actually carries,
never a silent no-op: source that looks right and is not what you asked for is
the worst thing this could hand back.

## What comes back

A complete fragment shader. It declares `#version 300 es`, takes `vUv` from a
vertex stage, and needs a full-screen triangle and the uniforms it declares —
nothing else. It carries no attribution, no watermark and no identifier naming
the studio, because a delivered shader is meant to be used unmodified.

A composition containing a **drawn region** is the one exception: a hand-drawn
path is rasterized into a mask the shader samples, so such a source declares
`uniform sampler2D uStudioPathMask` and a host must supply it. No gallery entry
uses one.

## Tests

```sh
npm test
```

Drives the server as a process over stdio, in JSON-RPC — the protocol, not the
functions behind it. That the returned source *compiles* is proved separately,
in `e2e/product-mcp-delivery.spec.ts` at the repository root, which assembles
every entry through this package and compiles and links each one in a real
WebGL2 context. A string that looks like a shader and a driver that accepts it
are different claims.
