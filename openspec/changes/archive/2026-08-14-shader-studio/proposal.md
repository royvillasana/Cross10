# Shader Studio — a shader gallery whose artifact is the shader

## Why

The tools in this space are galleries of parameterised shaders: you browse them, turn knobs, add an image layer or two, animate, and then take the shader into your own project. The taking-it-away step is the point. One of the existing tools watermarks its output, which is exactly the thing that makes a delivered shader unusable.

Croix10 already contains most of the engine for that and none of the delivery. Its Cruz-Diez framing produced, incidentally, a general shader-composition system: a GLSL chunk registry with feature-flag variant assembly and caching, a uniform registry derived from schema controls rather than hand-wired, and a runtime timeline whose whole-cycle drift is proven seamless at the loop seam. What it does not have is any way for a shader to leave the app.

This change builds the delivery product on that engine. Croix10 stays as it is, with its delivery gate green and its six chromatic engines becoming the gallery's first collection rather than being discarded.

## What Changes

- **New application, reusing Croix10's rendering core.** The uniform mapping, timeline transport, and media work are consumed rather than rewritten. The chunk registry carries over as the basis for a **per-layer-type generator library** — its chunks already are the layer types, but assembly changes from one variant per engine to one program composed from an ordered stack with blending between layers. The Cruz-Diez engines ship as gallery content.
- **A gallery as the entry surface.** Browsing and selecting a shader is the app's first act, but selection only sets the starting state: the full control surface stays live and editable afterwards. Croix10's preset library supplies the selection model.
- **Croix10's entire control surface, plus more.** Every control the studio exposes today is needed here, and a further set specific to authoring shaders for delivery is added on top. The existing surface is the floor.
- **A layer stack, where every component is a layer.** Stripes, gradients, images, and shapes are all layer types, composited in order and individually animatable. This is the largest divergence from Croix10, where an engine is one monolithic shader variant with its components fixed: here the program is assembled from an ordered stack the user builds. The runtime owns the layer list and the selected-layer control surface; the product supplies the types.
- **Timeline animation**, reusing the playback transport and whole-cycle drift already proven, so a delivered shader can carry a seamless loop.
- **Shader source assembly.** The composed GLSL plus the current uniform values resolved into a standalone, dependency-free shader — the artifact this product exists to produce. No watermark, no attribution injected into the source.
- **MCP delivery.** A separate package exposing the gallery and the assembled shader to an agent, so a shader reaches a project without a copy-paste step.

## Constraints already established

These are not open questions. They were settled while building Croix10 and carry directly.

- **Toolcraft cannot export a shader as an artifact.** `exportIntent` is a typed contract over image and video only, and the runtime owns the export pipeline end to end. Shader source therefore leaves through a clipboard action — which `core/setup-export.md` permits as an additional product action that never substitutes for artifact intent — or through the MCP, which is outside the app entirely. **The MCP is the primary delivery path; the app is the authoring surface.**
- **Every visible control obliges acceptance coverage and passing browser proof in the same batch.** Product mode does not accept a control declared ahead of its proof, so schema, inventory, acceptance rows, and browser tests land together or not at all.
- **A canvas-owned interaction has no schema route and does not need one.** Product code owns the pointer gesture, writes its target through `controls.setValue` on gesture end, and is proved by named app-owned Playwright tests. Established as R44 in the Croix10 change and working there.
- **Compound collection records are exactly their declared `itemControls`**, and `gradient` is not an accepted item type. Anything richer than the accepted scalar types has to live beside a collection rather than inside it (R45, R46).
- **Two framework defects make the full browser suite permanently red** for any product with a timeline, without affecting the delivery gate. Documented in `docs/upstream/toolcraft-0.0.18-issues.md`; the local workarounds in `tools/` and the `test:browser:stable` script apply here too.

## Open questions

1. ~~**What is a gallery entry?**~~ **Resolved: a preset.** The gallery is a `select` over the preset library Croix10 already ships — eleven entries spanning the six engines, applied through runtime commands so undo and reset behave normally. This is the answer that costs least and reuses most: the selection model, the apply path, and the acceptance shape all exist and are proved. It also settles the surface question, because a `select` over named states is a control the runtime already renders, so no product-authored gallery UI is needed.

   **A preset is a starting point, not the product.** Selecting an entry sets where you begin; the full control surface stays live and editable from there, which is already how Croix10 presets behave — they write ordinary control values through runtime commands rather than locking a configuration. Every control Croix10 exposes today is a control this product needs, for the same reason: a gallery of shaders you cannot turn the knobs on is a gallery of pictures.

   **And the surface grows.** Shader Studio needs Croix10's controls *plus a further set of settings* specific to authoring a shader for delivery rather than an image. That set is not yet enumerated — see open question 5 — and it is additive: nothing in the existing control surface is dropped because a preset selected it.

   The assembled shader for an entry is therefore that engine's variant with the *current* uniform values resolved in — whatever the user has edited them to — not the preset's stored values. That distinction matters for open question 2.

   **Deferred:** several presets need correcting before they are gallery-worthy. Scheduled at the end of the change rather than up front, since neither the selection model nor the control surface depends on the stored values being right.
2. **What exactly does the assembled shader contain?** A bare fragment shader, or a runnable module with its uniform declarations and default values? The MCP's usefulness depends on which.
3. ~~**How do image layers travel?**~~ **Resolved, and it reshapes the architecture: every component is a layer.** Stripes are a layer. A gradient is a layer. An image is a layer. A second set of stripes is another layer, a second gradient another, a shape another. They composite in order, and each one animates. The image was never a special case — it is one layer type among several, which dissolves the question of what it is ordered *against*: everything sits in one ordered stack.

   **The runtime supports this natively.** `panels.layers` covers "multiple editable objects, media objects, groups, visibility, selection, or reorder" (`schema-reference.md:130`), and `component-contracts.runtime.ts:294` establishes `selectedLayer.*` schema targets whose controls edit the currently selected layer's output. So the layer list, its selection, its visibility, its reordering, and the per-layer control surface are all runtime-owned. The product supplies layer *types* and what each one renders; it does not author a layer panel.

   `interactionOwnership` must assign layer management to Layers, which also keeps a `fileDrop` row from duplicating reorder claims the layer recipes already prove (`component-contracts.media-custom.ts:72`).

4. **Does the gallery need its own persistence**, or is a delivered shader stateless once assembled?
5. **What is the additional set of settings?** Croix10's control surface is the floor, not the ceiling. Shader Studio adds settings that serve authoring-for-delivery rather than authoring-an-image, and they need enumerating before the schema is designed — each one obliges acceptance coverage and browser proof in the batch that declares it.

## Impact

- Affected specs: `shader-authoring`, `shader-delivery`
- Reuses from `croix10-generative-art-studio`: `chromatic-render-core`, `parameter-schema-controls`, `animation-system`, `media-stylization`, `shader-editor`
- New surface: MCP package, shader source assembly
- Croix10 itself: unchanged
