/**
 * Per-layer control sections.
 *
 * Split from `app-schema.ts` for the reason Croix10 splits its sections: that
 * file is the schema assembly, and it holds its line budget only while section
 * bodies live beside the entities they describe.
 *
 * Several sections over one entity, because an entity above ten controls must
 * divide into explicit workflow stages. It began as one — at nine controls that
 * was obligatory rather than chosen — and each stage since has been forced by
 * the same rule as the surface grew.
 *
 * **How the divisions are cut is not forced, and was wrong.** The rule says an
 * oversized entity divides; it does not say where, and the earlier cuts followed
 * the order the controls were built in rather than the order an author asks for
 * them. Two consequences, both fixed here:
 *
 * - The layer's first two colours sat with its placement and the rest sat in
 *   `Layer Palette`, four sections apart, so "what colours is this layer" was a
 *   question answered in two places. Every ink is now in one.
 * - `Layer kind` offers *Image*, and the control that supplies the image was
 *   three sections below it. `Layer Media` now follows `Layer Pattern`
 *   immediately, so choosing the kind and feeding it are adjacent.
 *
 * What is left in the first section is placement: how much of the layer reaches
 * the composite, which way it is turned, and which way round it is folded.
 * Turning and folding are the same kind of question, which is why flip sits with
 * angle rather than with the field controls it visibly affects.
 *
 * That settles where the gate goes. `selectedLayer.type` has to sit beside the
 * controls it gates (R34, which is scoped to the section rather than the
 * entity), so it lives in `Layer Pattern` with them.
 *
 * Every control declares a `semanticGroup`, so cohesion is checked from typed
 * intent rather than guessed from labels: composition, colour, pattern, region,
 * treatment.
 *
 * What is *not* here is as deliberate as what is. A shape's placement, size and
 * proportion were four sliders until 14.1 and are now driven only by the canvas
 * handles — one operation, one owning surface — leaving `Layer Shape` with the
 * form itself, how it is turned, and which side of it the layer draws on.
 *
 * Titles name the entity, never the branch. None equals, contains, nor is
 * contained by "Stripes" or "Gradient", which are the gate's option labels (R33).
 */

const STRIPES_APPLICABILITY = {
  all: [{ oneOf: ["stripes"], target: "selectedLayer.type" }],
  mode: "conditional",
} as const;

const GRADIENT_APPLICABILITY = {
  all: [{ oneOf: ["gradient"], target: "selectedLayer.type" }],
  mode: "conditional",
} as const;

/**
 * Both procedural kinds, for the controls whose operation exists in each.
 *
 * Not `always`: an image layer draws a picture and has no field of its own to
 * shift, so a control offered there would be one that does nothing.
 */
const FIELD_APPLICABILITY = {
  all: [{ oneOf: ["stripes", "gradient"], target: "selectedLayer.type" }],
  mode: "conditional",
} as const;

/**
 * The band count's numeric domain, exported because `app-performance.ts` builds
 * the `band-count` workload dimension from it. A schema-backed workload boundary
 * must equal the schema endpoint, so the two cannot be allowed to drift: one
 * literal, read by both the control and the envelope.
 */
/**
 * The polygon side count's domain, exported for the same reason the band count
 * is: `app-performance.ts` builds the `polygon-sides` workload dimension from
 * it, and a schema-backed boundary must equal the schema endpoint.
 */
export const STUDIO_REGION_SIDES = {
  defaultValue: 8,
  max: 12,
  min: 3,
} as const;

export const STUDIO_BAND_COUNT = {
  defaultValue: 24,
  max: 200,
  min: 1,
} as const;

export const STUDIO_LAYER_SECTIONS = [
  {
    controls: {
      opacity: {
        semanticGroup: "composition",
        applicability: { mode: "always" },
        defaultValue: 1,
        label: "Opacity",
        max: 1,
        min: 0,
        performanceReason:
          "Opacity folds into the composite weight the blend already applies.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "selectedLayer.opacity",
        type: "slider",
      },
      angle: {
        semanticGroup: "composition",
        applicability: { mode: "always" },
        defaultValue: 0,
        label: "Angle",
        max: 180,
        min: 0,
        performanceReason:
          "The angle rotates a coordinate inside the existing per-pixel body.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 1,
        target: "selectedLayer.angle",
        type: "slider",
      },
      // Beside Angle, because turning a layer and folding it are the same kind
      // of question and an author asks them together.
      //
      // `always`, and every layer type carries it -- which is also what keeps it
      // in this section. A control gated on `selectedLayer.type` would have to
      // live beside that selector in Layer Pattern, and Layer Pattern is already
      // at the ten-control cap.
      //
      // An image gets this *as well as* the runtime's media transform, not
      // instead of it. Those buttons fold the asset, which travels with the
      // picture; this folds the layer, like its angle. The image body combines
      // them exclusive-or, so each stays a toggle rather than one silently
      // winning.
      //
      // Named for the fold rather than for a mirror, because Layer Pattern
      // already has `Mirror` and it is a different operation: that one reflects
      // the field about its centre and leaves two symmetric halves, this one
      // reverses the whole field and keeps it entire.
      flipX: {
        semanticGroup: "composition",
        applicability: { mode: "always" },
        defaultValue: false,
        label: "Flip horizontally",
        performanceReason:
          "Negates a coordinate already computed inside the per-pixel body; no new sampling or branch.",
        performanceRole: "responsiveness",
        target: "selectedLayer.flipX",
        type: "switch",
      },
      flipY: {
        semanticGroup: "composition",
        applicability: { mode: "always" },
        defaultValue: false,
        label: "Flip vertically",
        performanceReason:
          "Negates a coordinate already computed inside the per-pixel body; no new sampling or branch.",
        performanceRole: "responsiveness",
        target: "selectedLayer.flipY",
        type: "switch",
      },
      duplicate: {
        semanticGroup: "composition",
        applicability: { mode: "always" },
        // A local command on the entity this section already names, which is
        // what an Actions control is for. Not the sticky footer: that surface
        // is for delivering the product, and copying a layer delivers nothing.
        //
        // The control's label is a context rather than a repeat of the button,
        // which a single-button Actions control is required to be.
        //
        // The target is `stack.actions` rather than a `selectedLayer.*` one on
        // purpose. R51 obliges every selectedLayer target to prove it edits the
        // *selected* layer's output, and duplicating edits no layer at all --
        // it adds one. Naming it selectedLayer would have been a claim the
        // command cannot make.
        actions: [{ icon: "copy", label: "Duplicate", value: "duplicate-layer" }],
        label: "Current layer",
        performanceReason:
          "One command that copies a record entry already in memory; no field is re-resolved.",
        performanceRole: "responsiveness",
        target: "stack.actions",
        type: "actions",
      },
    },
    id: "selected-layer",
    title: "Selected Layer",
  },
  {
    controls: {
      type: {
        semanticGroup: "composition",
        applicability: { mode: "always" },
        defaultValue: "stripes",
        // The runtime layer model has no field for a product layer type
        // (R56), so this control is where a layer's type actually lives.
        label: "Layer kind",
        options: [
          { label: "Stripes", value: "stripes" },
          { label: "Gradient", value: "gradient" },
          // Reachable by importing rather than by choosing: dropping a picture
          // on the canvas creates the layer that draws it. Listed so the panel
          // can say what such a layer is instead of naming a kind it is not.
          { label: "Image", value: "image" },
        ],
        // Not `workload`, for two reasons that agree. Structurally, a select
        // over string options is not a numeric schema source — it declares no
        // finite `min`/`max`/numeric default — so it cannot back a workload
        // dimension, and every explicit workload control must map to exactly
        // one. Substantively, the reason below is the argument against it: each
        // body is a constant per-pixel cost, so the kind changes *which* work
        // happens, never *how much*. Switching kind must stay responsive, which
        // is what this role claims.
        performanceReason:
          "The kind selects which body the assembled program calls; each is a constant per-pixel cost.",
        performanceRole: "responsiveness",
        target: "selectedLayer.type",
        type: "select",
      },
      count: {
        semanticGroup: "pattern",
        applicability: STRIPES_APPLICABILITY,
        defaultValue: STUDIO_BAND_COUNT.defaultValue,
        label: "Band count",
        max: STUDIO_BAND_COUNT.max,
        min: STUDIO_BAND_COUNT.min,
        // Boundaries resolve analytically from the screen-space derivative
        // rather than by supersampling, so per-pixel cost does not vary with
        // the count. The ceiling is the Nyquist limit against pixel pitch, not
        // a performance bound.
        performanceReason:
          "Band count changes the field's frequency, not the work per pixel.",
        performanceRole: "workload",
        sliderValueKind: "discrete",
        step: 1,
        target: "selectedLayer.count",
        // Stepped continuous rather than `variant: "discrete"`: 200 positions
        // would render 200 tick markers, which reads as noise rather than as
        // the whole-number steps the value actually takes.
        type: "slider",
      },
      mirror: {
        semanticGroup: "pattern",
        applicability: STRIPES_APPLICABILITY,
        defaultValue: false,
        label: "Mirror",
        performanceReason:
          "Folding the coordinate costs the same whether the switch is on or off; there is no branch.",
        performanceRole: "responsiveness",
        target: "selectedLayer.mirror",
        type: "switch",
      },
      separator: {
        semanticGroup: "pattern",
        applicability: STRIPES_APPLICABILITY,
        defaultValue: 0,
        label: "Band separator",
        max: 0.4,
        min: 0,
        performanceReason:
          "The gap is one smoothstep against the distance already computed for the band edge.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "selectedLayer.separator",
        type: "slider",
      },
      jitterAmount: {
        semanticGroup: "pattern",
        applicability: STRIPES_APPLICABILITY,
        defaultValue: 0,
        label: "Jitter",
        max: 0.9,
        min: 0,
        performanceReason:
          "One hash and one add inside the body already computing the position.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "selectedLayer.jitterAmount",
        type: "slider",
      },
      jitterVariation: {
        semanticGroup: "pattern",
        applicability: STRIPES_APPLICABILITY,
        defaultValue: 12,
        // Which arrangement, not how much: the amount above says how far a band
        // is displaced, and this says which bands go which way. Named for that
        // rather than for Croix10's "Wobble rate", whose noise ran along the
        // band; here the displacement is per band index and hashed, so there is
        // no rate left to set and a control calling itself one would lie.
        label: "Jitter variation",
        max: 20,
        min: 1,
        performanceReason:
          "Scales the index the existing hash already reads; one multiply inside a body that was computing it anyway.",
        performanceRole: "responsiveness",
        sliderValueKind: "discrete",
        step: 1,
        target: "selectedLayer.jitterVariation",
        type: "slider",
        // Twenty whole-number positions, because each is a different
        // arrangement rather than more of anything. A continuous track would
        // suggest an ordering the values do not have.
        variant: "discrete",
      },
      taper: {
        semanticGroup: "pattern",
        applicability: STRIPES_APPLICABILITY,
        defaultValue: 0,
        label: "Taper",
        max: 1,
        min: -1,
        performanceReason:
          "One multiply and add against a coordinate the body already has.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "selectedLayer.taper",
        type: "slider",
      },
widthRatio: {
        semanticGroup: "pattern",
        applicability: STRIPES_APPLICABILITY,
        defaultValue: 0.5,
        label: "Band width",
        max: 0.95,
        min: 0.05,
        performanceReason:
          "The ratio moves one threshold inside the existing band lookup.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "selectedLayer.widthRatio",
        type: "slider",
      },
      phase: {
        semanticGroup: "pattern",
        // Both field kinds, because both have an axis to slide along: a band
        // sequence moves across its own, a ramp along its own. One operation,
        // one control -- a second slider for the gradient would have been the
        // same edit under another name, and it could not have lived here
        // anyway, since a control gated by the kind must share the section
        // holding the gate and this one is full.
        applicability: FIELD_APPLICABILITY,
        defaultValue: 0,
        label: "Offset",
        // Signed for the gradient's sake. A band sequence repeats, so sliding
        // it forward by a whole cycle is the same picture and a domain from
        // zero says everything there is to say; a ramp does not repeat, so the
        // two directions are different pictures and both have to be reachable.
        max: 1,
        min: -1,
        performanceReason:
          "The offset shifts the field's own lookup coordinate inside the existing body -- the band index for a stripe field, the ramp position for a gradient.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "selectedLayer.phase",
        type: "slider",
      },
      rampType: {
        semanticGroup: "pattern",
        applicability: GRADIENT_APPLICABILITY,
        defaultValue: "linear",
        label: "Transition shape",
        options: [
          { label: "Linear", value: "linear" },
          { label: "Radial", value: "radial" },
          { label: "Angular", value: "angular" },
        ],
        performanceReason:
          "Each shape is one coordinate expression inside the same body.",
        performanceRole: "responsiveness",
        target: "selectedLayer.rampType",
        type: "select",
      },
    },
    id: "selected-layer-pattern",
    title: "Layer Pattern",
  },
  {
    controls: {
      media: {
        semanticGroup: "region",
        applicability: { mode: "always" },
        assetKind: "image",
        // A button as well as a drop target. Dropping on the canvas already
        // worked, but it is not discoverable and it is not reachable from a
        // file manager the author has not opened -- a control renders the
        // browse affordance the canvas cannot.
        //
        // Still the runtime's import rather than a product one: this declares
        // the surface, and the runtime reads the file, allocates the asset, and
        // creates the layer that draws it.
        label: "Import image",
        performanceReason:
          "Decoding happens once per import, off the render path; the draw binds a texture it already has.",
        performanceRole: "responsiveness",
        target: "media.image",
        type: "fileDrop",
      },
      /**
       * The same act for a moving source, and a separate control because the
       * runtime routes an import by what the file is.
       *
       * Its importer matches an image batch only when every file decodes as a
       * picture, and its file importer matches only a control that declares
       * `assetKind: "file"`. Those two facts together mean one surface cannot
       * take both: a video offered to the picture control matches no importer
       * at all and fails, and a picture offered to a file control loses the
       * decode that gives it a size and the rotate and flip actions that come
       * with it. The registry that would let a product add a third importer is
       * signed, so this is the shape the runtime leaves available rather than
       * the shape a single "Media" button would want.
       *
       * What the product does with the result is the same either way: the asset
       * carries bytes and a layer, and the canvas binds a frame of it as the
       * texture an image layer already draws.
       */
      video: {
        semanticGroup: "region",
        applicability: { mode: "always" },
        accept: "video/mp4,video/webm,video/ogg,video/quicktime",
        assetKind: "file",
        label: "Import video",
        // One clip per layer, like one picture per layer: the layer is what
        // draws it, so a second file would have nowhere to go that is not a
        // second layer.
        multiple: false,
        performanceReason:
          "Decode is the browser's, on its own thread; the draw uploads the frame the element already holds.",
        performanceRole: "responsiveness",
        target: "media.video",
        type: "fileDrop",
      },
    },
    // Its own section because a file drop renders as a surface rather than a
    // field, and titled so it collides with none of the layer-kind option
    // labels, which now include "Image" (R33).
    id: "selected-layer-media",
    title: "Layer Media",
  },
  {
    controls: {
      // How an imported picture is read: as itself, or as the thing that
      // decides where a band field's boundaries fall.
      //
      // Its own section rather than beside the file drop, because these are
      // adjusted while looking at the work and the drop zone is used once. The
      // drop zone also hides itself when empty, and these should not vanish
      // with it once a picture exists.
      mapping: {
        semanticGroup: "source",
        applicability: { mode: "always" },
        defaultValue: "picture",
        label: "Read the picture as",
        options: [
          { label: "The picture", value: "picture" },
          { label: "Band width", value: "width" },
          { label: "Band phase", value: "phase" },
        ],
        performanceReason:
          "Selects a branch in a body that already samples the texture; no extra fetch and no new pass.",
        performanceRole: "responsiveness",
        target: "selectedLayer.sourceMapping",
        type: "select",
      },
      count: {
        semanticGroup: "source",
        applicability: { mode: "always" },
        defaultValue: 48,
        label: "Bands across the picture",
        max: 200,
        min: 2,
        performanceReason:
          "Scales a coordinate the body already computes; per-pixel cost is constant in it, and the ceiling is the Nyquist limit against pixel pitch.",
        performanceRole: "responsiveness",
        sliderValueKind: "discrete",
        step: 1,
        target: "selectedLayer.sourceCount",
        type: "slider",
      },
      widthRatio: {
        semanticGroup: "source",
        applicability: { mode: "always" },
        defaultValue: 0.5,
        label: "Balance",
        max: 0.95,
        min: 0.05,
        performanceReason:
          "One comparison against a value already in hand.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "selectedLayer.sourceWidthRatio",
        type: "slider",
      },
      strength: {
        // How far the picture is allowed to move the field. At zero the field
        // is regular and the picture has vanished from it entirely, which is
        // the honest bottom of this scale rather than a disabled state.
        semanticGroup: "source",
        applicability: { mode: "always" },
        defaultValue: 1,
        label: "How much the picture drives it",
        max: 2,
        min: 0,
        performanceReason:
          "A multiply on a luminance the body already reads from the sample it already took.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.05,
        target: "selectedLayer.sourceStrength",
        type: "slider",
      },
    },
    id: "selected-layer-source",
    title: "Layer Source",
  },
  {
    controls: {
      maskShape: {
        semanticGroup: "region",
        applicability: { mode: "always" },
        defaultValue: "rectangle",
        label: "Shape",
        // The vocabulary R64 asks for, as named forms rather than as the two
        // constructions underneath them. A square is Rectangle at equal
        // extents and a circle is Ellipse at equal extents, so neither is its
        // own entry: the extents are handle-driven, and a form that named
        // itself a square would stop being one the moment a handle moved.
        options: [
          { label: "Rectangle", value: "rectangle" },
          { label: "Ellipse", value: "ellipse" },
          { label: "Triangle", value: "triangle" },
          { label: "Diamond", value: "diamond" },
          { label: "Pentagon", value: "pentagon" },
          { label: "Hexagon", value: "hexagon" },
          { label: "Polygon", value: "polygon" },
          // Offered now that the pen can author one (14.4). R65 kept it out
          // while nothing could draw it, which was right then and is not now.
          { label: "Free", value: "free" },
        ],
        performanceReason:
          "Selects among tests of the same two half-extents; the polygon folds its angle into one wedge, so no form is cheaper than another.",
        performanceRole: "responsiveness",
        target: "selectedLayer.maskShape",
        type: "select",
      },
      maskSides: {
        semanticGroup: "region",
        // The general case behind the five named polygons. Gated to the form
        // that reads it: left always applicable it would sit at eight beside a
        // triangle and appear to be lying about the shape on screen.
        applicability: {
          all: [{ oneOf: ["polygon"], target: "selectedLayer.maskShape" }],
          mode: "conditional",
        },
        defaultValue: STUDIO_REGION_SIDES.defaultValue,
        label: "Sides",
        max: STUDIO_REGION_SIDES.max,
        min: STUDIO_REGION_SIDES.min,
        // `workload` because it is the magnitude of a declared dimension, which
        // is what that role marks -- not because cost grows with it. It does
        // not: the angle folds into a single wedge, so a twelve-sided shape
        // reads the same one atan, one mod and one cos a triangle does. Same
        // shape of claim as `band-count`, and the envelope says so too.
        performanceReason:
          "The side count folds into one angle test, so a twelve-sided shape costs what a triangle does.",
        performanceRole: "workload",
        sliderValueKind: "discrete",
        step: 1,
        target: "selectedLayer.maskSides",
        type: "slider",
        // Ten whole-number positions, so the ticks are the value rather than
        // noise: a side count is countable in a way a band count of 200 is not.
        variant: "discrete",
      },
      // `Shape rotation` retired here with 15.3, for the reason 14.1 retired
      // the four extent sliders: the canvas grip turns the shape, and one
      // operation answers to one surface. It stayed this long because it was
      // the only way to rotate at all, which is exactly what 15.2 changed.
      pen: {
        semanticGroup: "region",
        applicability: { mode: "always" },
        // Starts a drawing rather than toggling a tool: pressing it clears the
        // layer's path and hands the canvas to the pen, and closing the path on
        // the canvas hands it back. A tool that stayed on would be a mode the
        // sidebar owns and the canvas has to remember.
        actions: [{ label: "Draw", value: "draw-shape" }],
        label: "Free shape",
        performanceReason:
          "Starts a canvas gesture; the path it collects is uploaded once when the shape is closed.",
        performanceRole: "responsiveness",
        target: "stack.pen",
        type: "actions",
      },
      maskInvert: {
        semanticGroup: "region",
        applicability: { mode: "always" },
        defaultValue: false,
        label: "Outside the shape",
        performanceReason: "Selects between two coverage values already computed.",
        performanceRole: "responsiveness",
        target: "selectedLayer.maskInvert",
        type: "switch",
      },
    },
    id: "selected-layer-region",
    title: "Layer Shape",
  },
  {
    controls: {
      colorA: {
        semanticGroup: "colour",
        applicability: { mode: "always" },
        defaultValue: "#ffffff",
        label: "First colour",
        performanceReason: "A colour uploads as one vec3 read once per pixel.",
        performanceRole: "responsiveness",
        target: "selectedLayer.colorA",
        type: "color",
      },
      colorB: {
        semanticGroup: "colour",
        applicability: { mode: "always" },
        defaultValue: "#000000",
        label: "Second colour",
        performanceReason: "A colour uploads as one vec3 read once per pixel.",
        performanceRole: "responsiveness",
        target: "selectedLayer.colorB",
        type: "color",
      },
      paletteSlots: {
        semanticGroup: "colour",
        applicability: { mode: "always" },
        defaultValue: 2,
        label: "Colour slots",
        max: 8,
        min: 2,
        performanceReason:
          "Selects among colours already uploaded; the work per pixel does not change with the count.",
        performanceRole: "responsiveness",
        sliderValueKind: "discrete",
        step: 1,
        target: "selectedLayer.paletteSlots",
        variant: "discrete",
        type: "slider",
      },
      mixSpace: {
        semanticGroup: "colour",
        applicability: { mode: "always" },
        defaultValue: "linear",
        // The decision this makes visible was always being made -- everything
        // composites in linear light, and an author mixing two inks got a
        // result that depended on a choice nobody had told them about.
        //
        // Beside the slots rather than in a section of its own, because it is
        // the same question the slots ask from the other side: how many inks,
        // and what happens between them.
        label: "How inks meet",
        options: [
          { label: "Light", value: "linear" },
          { label: "Screen", value: "srgb" },
          { label: "Even", value: "perceptual" },
        ],
        performanceReason:
          "Selects among three conversions of two colours already uploaded; the branch is per pixel and constant in every control.",
        performanceRole: "responsiveness",
        target: "selectedLayer.mixSpace",
        type: "select",
      },
      colorC: {
        semanticGroup: "colour",
        // Rendered only once the slot count reaches it.
        //
        // Every ink used to be present whatever the count said, so a two-ink
        // layer offered four colours and two of them changed nothing. That is
        // the specific confusion this gate removes: a control on screen is a
        // control that does something, and the count is what decides how many
        // of these do.
        applicability: {
          all: [{ greaterThanOrEqual: 3, target: "selectedLayer.paletteSlots" }],
          mode: "conditional",
        },
        defaultValue: "#FF0000",
        label: "Third colour",
        performanceReason: "A colour uploads as one vec3 read once per pixel.",
        performanceRole: "responsiveness",
        target: "selectedLayer.colorC",
        type: "color",
      },
      colorD: {
        semanticGroup: "colour",
        // Rendered only once the slot count reaches it.
        //
        // Every ink used to be present whatever the count said, so a two-ink
        // layer offered four colours and two of them changed nothing. That is
        // the specific confusion this gate removes: a control on screen is a
        // control that does something, and the count is what decides how many
        // of these do.
        applicability: {
          all: [{ greaterThanOrEqual: 4, target: "selectedLayer.paletteSlots" }],
          mode: "conditional",
        },
        defaultValue: "#0000FF",
        label: "Fourth colour",
        performanceReason: "A colour uploads as one vec3 read once per pixel.",
        performanceRole: "responsiveness",
        target: "selectedLayer.colorD",
        type: "color",
      },
      colorE: {
        semanticGroup: "colour",
        // Rendered only once the slot count reaches it.
        //
        // Every ink used to be present whatever the count said, so a two-ink
        // layer offered four colours and two of them changed nothing. That is
        // the specific confusion this gate removes: a control on screen is a
        // control that does something, and the count is what decides how many
        // of these do.
        applicability: {
          all: [{ greaterThanOrEqual: 5, target: "selectedLayer.paletteSlots" }],
          mode: "conditional",
        },
        defaultValue: "#FFD400",
        label: "Fifth colour",
        performanceReason: "A colour uploads as one vec3 read once per pixel.",
        performanceRole: "responsiveness",
        target: "selectedLayer.colorE",
        type: "color",
      },
      colorF: {
        semanticGroup: "colour",
        // Rendered only once the slot count reaches it.
        //
        // Every ink used to be present whatever the count said, so a two-ink
        // layer offered four colours and two of them changed nothing. That is
        // the specific confusion this gate removes: a control on screen is a
        // control that does something, and the count is what decides how many
        // of these do.
        applicability: {
          all: [{ greaterThanOrEqual: 6, target: "selectedLayer.paletteSlots" }],
          mode: "conditional",
        },
        defaultValue: "#00A0A0",
        label: "Sixth colour",
        performanceReason: "A colour uploads as one vec3 read once per pixel.",
        performanceRole: "responsiveness",
        target: "selectedLayer.colorF",
        type: "color",
      },
      colorG: {
        semanticGroup: "colour",
        // Rendered only once the slot count reaches it.
        //
        // Every ink used to be present whatever the count said, so a two-ink
        // layer offered four colours and two of them changed nothing. That is
        // the specific confusion this gate removes: a control on screen is a
        // control that does something, and the count is what decides how many
        // of these do.
        applicability: {
          all: [{ greaterThanOrEqual: 7, target: "selectedLayer.paletteSlots" }],
          mode: "conditional",
        },
        defaultValue: "#FF7A00",
        label: "Seventh colour",
        performanceReason: "A colour uploads as one vec3 read once per pixel.",
        performanceRole: "responsiveness",
        target: "selectedLayer.colorG",
        type: "color",
      },
      colorH: {
        semanticGroup: "colour",
        // Rendered only once the slot count reaches it.
        //
        // Every ink used to be present whatever the count said, so a two-ink
        // layer offered four colours and two of them changed nothing. That is
        // the specific confusion this gate removes: a control on screen is a
        // control that does something, and the count is what decides how many
        // of these do.
        applicability: {
          all: [{ greaterThanOrEqual: 8, target: "selectedLayer.paletteSlots" }],
          mode: "conditional",
        },
        defaultValue: "#8000FF",
        label: "Eighth colour",
        performanceReason: "A colour uploads as one vec3 read once per pixel.",
        performanceRole: "responsiveness",
        target: "selectedLayer.colorH",
        type: "color",
      },
    },
    id: "selected-layer-palette",
    title: "Layer Palette",
  },
  {
    controls: {
      engine: {
        semanticGroup: "engine",
        applicability: { mode: "always" },
        defaultValue: "none",
        label: "Chromatic engine",
        // The three Cruz-Diez techniques that are ways of *colouring a banded
        // field* rather than ways of building one (R67). Order is the contract
        // with the branch order in the stripes body.
        options: [
          { label: "None", value: "none" },
          { label: "Induction", value: "induction" },
          { label: "Physichromie", value: "physichromie" },
          { label: "Interference", value: "chromointerference" },
        ],
        performanceReason:
          "Each engine is a handful of operations on the band the body has already resolved; none of them samples the field a second time.",
        performanceRole: "responsiveness",
        target: "selectedLayer.engine",
        type: "select",
      },
      engineAmount: {
        semanticGroup: "engine",
        // Gated to the engines that read it rather than to stripes: at None
        // there is nothing for an amount to be the amount of.
        applicability: {
          all: [
            {
              oneOf: ["induction", "physichromie", "chromointerference"],
              target: "selectedLayer.engine",
            },
          ],
          mode: "conditional",
        },
        defaultValue: 0.25,
        label: "Engine amount",
        max: 1,
        min: 0,
        performanceReason:
          "One multiply inside the engine branch already taken.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "selectedLayer.engineAmount",
        type: "slider",
      },
      engineCursor: {
        semanticGroup: "engine",
        applicability: {
          all: [
            {
              oneOf: ["induction", "physichromie", "chromointerference"],
              target: "selectedLayer.engine",
            },
          ],
          mode: "conditional",
        },
        defaultValue: false,
        label: "Follow the pointer",
        performanceReason:
          "One distance and one mix against a coordinate the engine already has; the cost is the same on or off.",
        performanceRole: "responsiveness",
        target: "selectedLayer.engineCursor",
        type: "switch",
      },
      enginePitch: {
        semanticGroup: "engine",
        applicability: {
          all: [
            { oneOf: ["chromointerference"], target: "selectedLayer.engine" },
          ],
          mode: "conditional",
        },
        defaultValue: 1.2,
        label: "Interference pitch",
        max: 2,
        min: 0.5,
        // The beat period is what the ratio sets, and it is a property of the
        // field rather than of the work per pixel: the second structure is
        // resolved from the coordinate the body already has.
        performanceReason:
          "The second structure reads the coordinate the body already resolved; its pitch changes the beat, not the work.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.05,
        target: "selectedLayer.enginePitch",
        type: "slider",
      },
    },
    id: "selected-layer-engine",
    title: "Layer Engine",
  },
  {
    controls: {
      // Whole cycles per loop, which is why this is a discrete count rather than
      // a speed. A rate that is not a whole number leaves the last frame
      // somewhere the first is not, and a loop with a visible jump is the one
      // thing a loop must not have.
      //
      // Phase is the viewer moving along the work: which part of each lamella is
      // presented as you pass it. It is the drift these techniques were built
      // for, and the one to reach for first.
      driftShape: {
        semanticGroup: "motion",
        applicability: { mode: "always" },
        defaultValue: "steady",
        /*
         * How the loop is walked, which is the shape of the travel rather than
         * a second source of it.
         *
         * The rates below say how far the viewer goes; this says how they get
         * there. Steady is the walk this always had -- one constant speed, and
         * a velocity that jumps at the seam the way a looping pan gives itself
         * away. Eased starts and ends at rest, so the seam is smooth in speed
         * as well as in position. Swing goes out and comes back inside one
         * loop, which is the honest reading of the oscillator the spec asked
         * for: it returns by shape rather than by counting cycles.
         *
         * Every shape lands on a whole number of cycles at the end of the loop,
         * so none of them can break the seam -- which is why this is a shape
         * control and not an LFO with a rate of its own.
         */
        label: "How it travels",
        options: [
          { label: "Steady", value: "steady" },
          { label: "Eased", value: "eased" },
          { label: "Swing", value: "swing" },
        ],
        performanceReason:
          "One branch and at most one cosine on the shared loop position; constant in every control.",
        performanceRole: "responsiveness",
        target: "selectedLayer.driftShape",
        type: "select",
      },
      driftPhase: {
        semanticGroup: "motion",
        applicability: { mode: "always" },
        defaultValue: 0,
        label: "Travel per loop",
        max: 4,
        min: -4,
        performanceReason:
          "One multiply and one add on values the body already reads; the loop position is a single uniform shared by the whole stack.",
        performanceRole: "responsiveness",
        sliderValueKind: "discrete",
        step: 1,
        target: "selectedLayer.driftPhase",
        type: "slider",
        // Nine whole-number positions, and each is a different loop rather than
        // more of one: two cycles is not "more travel" than one, it is a
        // different journey that happens to end in the same place.
        variant: "discrete",
      },
      // Angle is the second-order version of the same movement: not only where
      // you are along the work but which way you are facing it from.
      driftAngle: {
        semanticGroup: "motion",
        applicability: { mode: "always" },
        defaultValue: 0,
        label: "Turns per loop",
        max: 2,
        min: -2,
        performanceReason:
          "One multiply and one add before the coordinate is rotated, which the body does anyway.",
        performanceRole: "responsiveness",
        sliderValueKind: "discrete",
        step: 1,
        target: "selectedLayer.driftAngle",
        type: "slider",
        // Five positions, for the same reason, plus the one that matters most:
        // the ticks are exactly the values that return to where they started.
        variant: "discrete",
      },
    },
    // Its own section because what it edits is not the layer's appearance but
    // how a viewer passes it. The work holds still; these say how the looking
    // moves -- which is why no colour, count or separator has a rate beside it.
    id: "selected-layer-motion",
    title: "Layer Motion",
  },
  {
    controls: {
      // Its own section because its entity is the pointer, not the selected
      // layer. Every other control in the layer sections edits whichever layer
      // is selected; this one says which layers a gesture reaches, which is a
      // claim about the stack and would be a false neighbour among them.
      subject: {
        semanticGroup: "pointer",
        applicability: { mode: "always" },
        defaultValue: "per-layer",
        label: "Pointer reaches",
        options: [
          { label: "Layers that follow it", value: "per-layer" },
          { label: "Every layer", value: "every-layer" },
        ],
        performanceReason:
          "Selects between two values already uploaded per layer; no pass, program, or sampling changes.",
        performanceRole: "responsiveness",
        target: "stack.pointerSubject",
        type: "select",
      },
      // How hard, beside what it reaches, because the two are one question --
      // an author deciding a gesture decides both at once.
      push: {
        semanticGroup: "pointer",
        applicability: { mode: "always" },
        defaultValue: 0,
        label: "Pointer push",
        max: 1,
        min: 0,
        performanceReason:
          "One length and one normalise against a coordinate the body already has; the cost is the same at zero.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "stack.pointerPush",
        type: "slider",
      },
    },
    id: "pointer",
    title: "Pointer",
  },
  {
    controls: {
      hue: {
        semanticGroup: "treatment",
        applicability: { mode: "always" },
        defaultValue: 0,
        label: "Hue shift",
        max: 180,
        min: -180,
        performanceReason:
          "One matrix built and applied per pixel, the same cost at every setting including none.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 1,
        target: "selectedLayer.hue",
        type: "slider",
      },
      saturation: {
        semanticGroup: "treatment",
        applicability: { mode: "always" },
        defaultValue: 1,
        label: "Saturation",
        max: 2,
        min: 0,
        performanceReason: "Scales a mix the treatment already computes.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "selectedLayer.saturation",
        type: "slider",
      },
      contrast: {
        semanticGroup: "treatment",
        applicability: { mode: "always" },
        defaultValue: 1,
        label: "Contrast",
        max: 2,
        min: 0,
        performanceReason: "Scales a difference the treatment already computes.",
        performanceRole: "responsiveness",
        sliderValueKind: "continuous",
        step: 0.01,
        target: "selectedLayer.contrast",
        type: "slider",
      },
      blendMode: {
        semanticGroup: "treatment",
        applicability: { mode: "always" },
        defaultValue: "normal",
        label: "Blend mode",
        options: [
          { label: "Normal", value: "normal" },
          { label: "Multiply", value: "multiply" },
          { label: "Screen", value: "screen" },
          { label: "Overlay", value: "overlay" },
          // Ordered to match the branch order in `studioBlend`, which is the
          // contract the shader reads this uniform through.
          { label: "Difference", value: "difference" },
          { label: "Additive", value: "additive" },
        ],
        performanceReason:
          "Selects among four expressions of the two colours the composite already holds.",
        performanceRole: "responsiveness",
        target: "selectedLayer.blendMode",
        type: "select",
      },
    },
    id: "selected-layer-treatment",
    title: "Layer Treatment",
  },
  {
    controls: {
      /*
       * How the layer is printed, as distinct from how it is coloured.
       *
       * These are reprographic rather than chromatic: a screen decides how much
       * of a mark is there, a grain decides how coarsely the field is sampled,
       * and quantization decides which of the layer's own inks a colour
       * becomes. They are the printing half of this subject, which is the
       * tradition these techniques come out of -- a Physichromie is a printed
       * and assembled object before it is an optical one.
       *
       * Their own section because they act on the layer *after* it is drawn,
       * where the treatment acts on what sits beneath it and the engine acts on
       * the field itself.
       */
      halftone: {
        semanticGroup: "treatment",
        applicability: { mode: "always" },
        defaultValue: "none",
        label: "Screen",
        options: [
          { label: "None", value: "none" },
          { label: "Dot", value: "dot" },
          { label: "Line", value: "line" },
          { label: "Cross", value: "cross" },
        ],
        performanceReason:
          "One cell lookup per pixel whichever mode is chosen; the cost does not vary with cell size or angle.",
        performanceRole: "responsiveness",
        target: "selectedLayer.halftone",
        type: "select",
      },
      halftoneCell: {
        semanticGroup: "treatment",
        applicability: {
          all: [{ notOneOf: ["none"], target: "selectedLayer.halftone" }],
          mode: "conditional",
        },
        defaultValue: 12,
        label: "Screen cell",
        max: 64,
        min: 2,
        performanceReason:
          "Scales the coordinate the screen is cut from; the work per pixel is the same at every cell size.",
        performanceRole: "responsiveness",
        sliderValueKind: "discrete",
        step: 1,
        target: "selectedLayer.halftoneCell",
        type: "slider",
      },
      halftoneAngle: {
        semanticGroup: "treatment",
        applicability: {
          all: [{ notOneOf: ["none"], target: "selectedLayer.halftone" }],
          mode: "conditional",
        },
        defaultValue: 0,
        label: "Screen angle",
        max: 90,
        min: 0,
        performanceReason: "One rotation of the screen coordinate per pixel.",
        performanceRole: "responsiveness",
        sliderValueKind: "discrete",
        step: 5,
        target: "selectedLayer.halftoneAngle",
        // Nineteen positions in five-degree steps, which the runtime renders
        // with tick markers: a screen angle is chosen from a handful of
        // conventional ones rather than dialled continuously.
        variant: "discrete",
        type: "slider",
      },
      pixelBlock: {
        semanticGroup: "treatment",
        applicability: { mode: "always" },
        defaultValue: 0,
        // Zero is off rather than a separate switch: a grain of no pixels is
        // the same statement as "do not do this", and a switch beside a slider
        // would be two controls for one decision.
        label: "Sample grain",
        max: 64,
        min: 0,
        performanceReason:
          "Snaps the coordinate before the body reads it; one floor per pixel and no extra sampling.",
        performanceRole: "responsiveness",
        sliderValueKind: "discrete",
        step: 1,
        target: "selectedLayer.pixelBlock",
        type: "slider",
      },
      quantize: {
        semanticGroup: "treatment",
        applicability: { mode: "always" },
        defaultValue: false,
        label: "Only the layer's inks",
        performanceReason:
          "Compares the drawn colour against the slots in use, which is bounded by the palette rather than by any control.",
        performanceRole: "responsiveness",
        target: "selectedLayer.quantize",
        type: "switch",
      },
    },
    id: "selected-layer-print",
    title: "Layer Print",
  },
] as const;
