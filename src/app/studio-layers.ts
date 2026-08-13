/**
 * Layer-type registry.
 *
 * This is the divergence from the engine model the chunk registry was built for.
 * There, one shader variant per engine had its components fixed at authoring
 * time and a single `uEngine` branch chose between them. Here the program is
 * assembled from an ordered stack the user builds, so a layer's uniforms cannot
 * be named ahead of time.
 *
 * Per-layer uniforms are name-mangled at assembly (`uLayer0_angle`), which is
 * R52. Indexed arrays would cap stack depth and pay for slots nobody filled; a
 * packed uniform block would decouple program identity from stack contents but
 * emit source no one can read, and readable source is the artifact this product
 * exists to produce. The cost of mangling is that every stack edit compiles a new
 * program — but the variant cache already keys on the stack signature (R54), so
 * a stack edit invalidates the cached program either way. The churn is inherent
 * to the feature rather than added by the choice.
 *
 * Bodies are shared and parameterised; only the thin per-layer wrapper is
 * emitted per instance. So a stack of six stripe layers compiles one
 * `studioStripesBody` and six calls to it, not six copies of the field code.
 *
 * The helpers this module emits are deliberately self-contained: the assembled
 * program declares its own colour-space conversion and compositing rather than
 * reaching into the engine chunk registry, which is what lets delivered source
 * compile without carrying the studio with it.
 */

/** A GLSL scalar or vector a per-layer uniform can hold. */
export type StudioLayerUniformType = "float" | "vec3";

export interface StudioLayerUniform {
  /** Default in the same units the control exposes. */
  readonly defaultValue: number | readonly [number, number, number];
  /** Suffix after the mangled layer prefix, e.g. `angle` in `uLayer0_angle`. */
  readonly name: string;
  /**
   * Option values, in the order the shader's branches read them, for a float
   * uniform whose control is a `select`.
   *
   * Without this the control's string value never becomes the uniform's number:
   * the collector sees a string where it wants a number, drops the edit, and the
   * control moves while the render stays put. The order is the contract — index
   * 0 is the first branch — so it must match the body's own ordering.
   */
  readonly optionValues?: readonly string[];
  /**
   * Whether this float uniform is driven by a `switch`.
   *
   * A switch's value is a boolean and the shader branches on a float, so
   * without this the edit is dropped for not already being a number -- the same
   * gap `optionValues` closes for selects, and with the same symptom: the
   * control moves and the render does not.
   */
  readonly booleanControl?: boolean;
  readonly type: StudioLayerUniformType;
}

export interface StudioLayerType {
  /**
   * Parameterised GLSL body, shared across every instance of this type. It must
   * declare exactly one function named by `entryPoint` and read nothing from
   * global uniform state, so the same compiled body serves every layer.
   */
  readonly chunk: string;
  /** Function the per-layer wrapper calls. */
  readonly entryPoint: string;
  readonly id: StudioLayerTypeId;
  readonly label: string;
  /** Ordered — the wrapper passes them positionally, so order is load-bearing. */
  readonly uniforms: readonly StudioLayerUniform[];
}

export type StudioLayerTypeId = "gradient" | "stripes";

/**
 * Carried by every layer regardless of type.
 *
 * Visibility is a float rather than a bool because it multiplies into the
 * composite weight, which keeps a hidden layer from needing a branch. The
 * runtime owns the value — `panels.layers` writes it — but the program still has
 * to receive it.
 */
export const STUDIO_LAYER_COMMON_UNIFORMS: readonly StudioLayerUniform[] = [
  { defaultValue: 1, name: "opacity", type: "float" },
  { defaultValue: 1, name: "visible", type: "float" },
  /**
   * Half-extent of the shape the layer is confined to, measured the same way
   * the field is: normalised against height, from the centre of the frame.
   *
   * The default is a real size rather than nothing (R64): a layer *is* a shape,
   * so it arrives with one already drawn and already grabbable. Half the frame's
   * height, which leaves the shape and every one of its handles inside the view
   * even in a window smaller than the frame -- a shape whose corners fall off
   * the visible canvas is one whose handles cannot be reached at all. A layer that
   * started at zero would have to be given an extent before its canvas handles
   * could be reached at all, which is what left the handles depending on a
   * sidebar slider to bring the shape into existence.
   *
   * Zero still means unmasked rather than empty. It is no longer where a layer
   * starts, but it is the only way to say "the whole frame", and a size that
   * made the layer vanish instead would leave that unsayable.
   */
  { defaultValue: 0.25, name: "maskSize", type: "float" },
  /**
   * Width of the region relative to its height. One is square; larger is a wide
   * band, smaller a tall column. Aspect rather than a second size, so resizing
   * the region does not require moving two controls in step to keep its shape.
   */
  { defaultValue: 1, name: "maskAspect", type: "float" },
  /**
   * Centre of the region, measured in the same units as the field: normalised
   * against height, from the centre of the frame. Zero leaves it centred, which
   * is where an unplaced region belongs.
   */
  { defaultValue: 0, name: "maskCenterX", type: "float" },
  { defaultValue: 0, name: "maskCenterY", type: "float" },
  /**
   * Which form the layer's shape takes (R64).
   *
   * Named forms rather than three constructions. Underneath there are only two
   * here -- an extent read as a box, and an extent read as a regular polygon --
   * and the free vertex list that is the third arrives with the pen (14.4),
   * because a vertex list nothing can author yet would be a form nobody could
   * choose. Every named form shares size, aspect, placement, rotation and
   * sense, so the vocabulary costs one uniform rather than one geometry each.
   *
   * A square is a rectangle at equal extents and a circle is an ellipse at
   * equal extents, so neither gets its own entry: the handles drive the extents
   * directly, and a form that claimed to be a square would stop being one the
   * moment a handle was dragged.
   *
   * Order is the contract with the branch order in `compositeLayer`, and
   * rectangle and ellipse keep indices 0 and 1 so a stack persisted before the
   * vocabulary existed still reads as the shape it was saved as.
   */
  {
    defaultValue: 0,
    name: "maskShape",
    optionValues: [
      "rectangle",
      "ellipse",
      "triangle",
      "diamond",
      "pentagon",
      "hexagon",
      "polygon",
      "free",
    ],
    type: "float",
  },
  /**
   * Side count for the `polygon` form, which is the general case the five named
   * polygons are instances of. Read only in that branch; the named forms carry
   * their own count so that choosing "Triangle" cannot be contradicted by a
   * slider left at eight.
   */
  { defaultValue: 8, name: "maskSides", type: "float" },
  /**
   * Rotation of the region about its own centre, in degrees. Applied to the
   * sampling coordinate before the extent is tested, so it turns the region and
   * not the layer inside it -- a rotated zone still carries bands at whatever
   * angle the pattern asks for.
   */
  { defaultValue: 0, name: "maskRotation", type: "float" },
  {
    booleanControl: true,
    defaultValue: 0,
    name: "maskInvert",
    type: "float",
  },
  /**
   * Treatment of what lies beneath the layer, applied wherever the layer
   * reaches. This is what makes a layer a lens rather than a sticker: the
   * reference works put a shape over a field and the field beneath it shifts
   * hue and brightness rather than being covered up.
   *
   * Weighted by reach -- visibility and region -- and deliberately not by
   * opacity, so a layer at zero opacity is pure treatment and paints nothing of
   * its own. That is exactly the lens the works ask for, and it falls out of the
   * two being separate rather than needing a mode to select it.
   *
   * The defaults are the identity: no shift, full saturation, unchanged
   * contrast. A layer that has never been treated composites exactly as it did
   * before treatment existed.
   */
  { defaultValue: 0, name: "hue", type: "float" },
  { defaultValue: 1, name: "saturation", type: "float" },
  { defaultValue: 1, name: "contrast", type: "float" },
  /**
   * How the layer's own colour meets what it sits on. Order matches the branch
   * order in `studioBlend`.
   */
  {
    defaultValue: 0,
    name: "blendMode",
    optionValues: ["normal", "multiply", "screen", "overlay"],
    type: "float",
  },
];

const CHUNK_LAYER_SUPPORT = `
vec3 studioLinearToSrgb(vec3 linear) {
  vec3 clamped = clamp(linear, 0.0, 1.0);
  vec3 low = clamped * 12.92;
  vec3 high = 1.055 * pow(clamped, vec3(1.0 / 2.4)) - 0.055;
  return mix(high, low, step(clamped, vec3(0.0031308)));
}

// One colour from the palette at position t, walking whichever slots are in use.
// Shared by both bodies so a four-colour stripe field and a four-stop gradient
// agree about what the slots mean.
vec3 studioPaletteRamp(float t, float slots, vec3 a, vec3 b, vec3 c, vec3 d) {
  float clamped = clamp(t, 0.0, 1.0);
  if (slots < 2.5) return mix(a, b, clamped);
  if (slots < 3.5) {
    float scaled = clamped * 2.0;
    return scaled < 1.0 ? mix(a, b, scaled) : mix(b, c, scaled - 1.0);
  }
  float scaled = clamped * 3.0;
  if (scaled < 1.0) return mix(a, b, scaled);
  if (scaled < 2.0) return mix(b, c, scaled - 1.0);
  return mix(c, d, scaled - 2.0);
}

// The slot a band falls in, as flat colour rather than a ramp. This is the
// stripe reading of a palette: consecutive bands take consecutive inks, which is
// what makes a three or four ink rhythm rather than a gradient.
vec3 studioPaletteSlot(float index, float slots, vec3 a, vec3 b, vec3 c, vec3 d) {
  float slot = mod(floor(index), max(slots, 1.0));
  if (slot < 0.5) return a;
  if (slot < 1.5) return b;
  if (slot < 2.5) return c;
  return d;
}

// Whether a point falls inside a regular polygon centred on the origin.
//
// The polygon is inscribed in the circle the radius names, so its vertices
// touch exactly the extent an ellipse of that radius would fill. That is what
// keeps every form honest against the same handles: whatever the form, the
// shape sits inside the box its size and aspect describe and never spills past
// the corner a handle is drawn on.
//
// Folding the angle into a single wedge is why the side count is not a workload
// dimension -- a twelve-sided polygon reads the same one atan, one mod and one
// cos that a triangle does, so the cost is flat across the control's domain.
//
// The base angle turns the polygon before the test, which is how a shape points
// up rather than sitting on whichever vertex the fold happens to start from.
float studioPolygonInside(vec2 point, float radius, float sides, float baseDegrees) {
  float count = max(sides, 3.0);
  float wedge = 6.283185307179586 / count;
  float reach = length(point);
  // atan is undefined at the origin, and the centre is inside every polygon.
  if (reach < 1e-6) return 1.0;

  float folded = mod(atan(point.y, point.x) - radians(baseDegrees) + wedge * 0.5, wedge)
    - wedge * 0.5;
  // Measured to the side rather than to the vertex: the apothem is where the
  // edge actually is, and the radius only says where the corners reach.
  return step(reach * cos(folded), radius * cos(wedge * 0.5));
}

// Hue, saturation and contrast against what is already composited.
//
// Saturation and contrast are the usual readings -- toward the luma of the
// colour, and away from mid grey. Hue is a rotation about the grey axis, which
// is what keeps a shifted colour as bright as it was rather than merely
// swapping channels.
//
// At the identity arguments this returns its input unchanged, so an untreated
// layer costs a few multiplies and changes nothing.
vec3 studioTreat(vec3 colour, float hueDegrees, float saturation, float contrast) {
  float luma = dot(colour, vec3(0.2126, 0.7152, 0.0722));
  vec3 saturated = mix(vec3(luma), colour, saturation);
  vec3 contrasted = (saturated - 0.5) * contrast + 0.5;

  float angle = radians(hueDegrees);
  float c = cos(angle);
  float s = sin(angle);
  // Written as columns, which is the order the constructor reads.
  mat3 rotation = mat3(
    vec3(
      0.213 + c * 0.787 - s * 0.213,
      0.213 - c * 0.213 + s * 0.143,
      0.213 - c * 0.213 - s * 0.787
    ),
    vec3(
      0.715 - c * 0.715 - s * 0.715,
      0.715 + c * 0.285 + s * 0.140,
      0.715 - c * 0.715 + s * 0.715
    ),
    vec3(
      0.072 - c * 0.072 + s * 0.928,
      0.072 - c * 0.072 - s * 0.283,
      0.072 + c * 0.928 + s * 0.072
    )
  );

  return clamp(rotation * contrasted, 0.0, 1.0);
}

// How the layer's colour meets what it sits on. Branch order is the contract
// with the blendMode uniform's option order.
vec3 studioBlend(vec3 below, vec3 above, float mode) {
  if (mode < 0.5) return above;
  if (mode < 1.5) return below * above;
  if (mode < 2.5) return 1.0 - (1.0 - below) * (1.0 - above);
  return mix(
    2.0 * below * above,
    1.0 - 2.0 * (1.0 - below) * (1.0 - above),
    step(vec3(0.5), below)
  );
}

// Source-over in linear light. Weight folds opacity and visibility together so a
// hidden layer contributes exactly nothing without costing a branch.
vec4 studioComposite(vec4 below, vec4 above, float weight, float mode) {
  float alpha = above.a * clamp(weight, 0.0, 1.0);
  vec3 blended = studioBlend(below.rgb, above.rgb, mode);
  return vec4(mix(below.rgb, blended, alpha), max(below.a, alpha));
}
`;

const CHUNK_STRIPES_BODY = `
vec4 studioStripesBody(
  vec2 fragmentPosition,
  vec2 resolution,
  vec2 cursor,
  float angle,
  float count,
  float widthRatio,
  float phase,
  float mirror,
  float taper,
  float separator,
  float jitterAmount,
  float jitterFrequency,
  float paletteSlots,
  float engine,
  float engineAmount,
  float engineCursor,
  float enginePitch,
  vec3 colorA,
  vec3 colorB,
  vec3 colorC,
  vec3 colorD
) {
  // Normalised against height so the field does not stretch with aspect ratio.
  vec2 centered = (fragmentPosition - resolution * 0.5) / max(resolution.y, 1.0);
  float radians = angle * 0.017453292519943295;
  float coordinate = centered.x * cos(radians) + centered.y * sin(radians);
  // Reflected about the field's own axis, so the two halves read as mirrored
  // rather than merely repeated. Folding the coordinate rather than branching
  // keeps the cost identical whether the switch is on or off.
  coordinate = mix(coordinate, abs(coordinate), step(0.5, mirror));
  // Each band is displaced by a value drawn from its own index, so the field
  // stays deterministic: the same stack renders the same frame here, in the
  // exported artifact, and in the delivered source. A displacement drawn from
  // the fragment instead would dissolve the bands into noise rather than move
  // them.
  //
  // The amount is bounded by the control's own domain rather than clamped here,
  // so a band cannot be displaced past its neighbour and swap identity with it.
  float scaled = coordinate * max(count, 1.0) + phase;
  float bandIndex = floor(scaled);
  float jitter =
    fract(sin(bandIndex * max(jitterFrequency, 1e-4)) * 43758.5453) - 0.5;
  float position = fract(scaled + jitterAmount * jitter);

  // Analytic edge from the screen-space derivative rather than supersampling:
  // per-pixel cost stays constant with respect to band count, which is what lets
  // the pipeline declare a constant relationship for the stripe dimensions.
  // Where one colour gives way to the other, drifting along the band rather
  // than sitting at a constant fraction of it. That drift is what turns a band
  // of even thickness into a wedge: the split reaches one edge at one end of the
  // band and the other edge at the other, so the darker colour reads as a
  // triangle rather than a line. It is the same construction the kinetic
  // painters used to make a shape emerge from a field that stays parallel.
  //
  // Measured along the band, which is the axis perpendicular to the one the
  // bands repeat along, so the drift follows the band's own length whatever
  // angle the field is set to.
  float along = centered.x * -sin(radians) + centered.y * cos(radians);
  float split = widthRatio + taper * along;

  float edge = max(fwidth(position) * 1.5, 1e-5);
  float band = smoothstep(split - edge, split + edge, position);

  // A separator is a gap the layer does not paint rather than a third colour:
  // in a stack, what shows through is whatever sits beneath, which is the only
  // reading that stays true when a layer is composited over another.
  //
  // Measured from the nearest cycle boundary, so the gap straddles the seam
  // evenly instead of eating one band from one side. At a separator of zero the
  // smoothstep saturates and the coverage is exactly one, so the default costs
  // nothing and changes nothing.
  float seamDistance = min(position, 1.0 - position);
  float coverage = smoothstep(separator - edge, separator + edge, seamDistance);

  // Two inks keep the original reading exactly: one colour either side of the
  // split. Beyond two, consecutive bands take consecutive inks and the split
  // divides each band between its own ink and the one after it, which is how a
  // three or four colour rhythm carries a wedge without losing either.
  vec3 near = studioPaletteSlot(bandIndex, paletteSlots, colorA, colorB, colorC, colorD);
  vec3 far = studioPaletteSlot(bandIndex + 1.0, paletteSlots, colorA, colorB, colorC, colorD);
  vec3 pair = paletteSlots < 2.5 ? mix(colorA, colorB, band) : mix(near, far, band);

  // The chromatic engine, applied to the field this body has just resolved
  // rather than replacing it (R67). Each technique is a way of colouring a
  // banded field, and every value it needs -- the band index, the distance to
  // the boundary, the two inks either side -- has already been computed above.
  // Branch order is the contract with the engine option order.
  if (engine >= 0.5) {
    // Distance to the nearest band boundary, in cycles. The techniques below
    // are all about what happens at or across an edge, so this is the quantity
    // they share.
    float toEdge = min(position, 1.0 - position);
    // How near the pointer is, as a value between nothing and everything. This
    // is the whole of the cursor's effect on an engine: each technique scales
    // by it and so decides its own response, rather than the cursor being a
    // fourth engine or a mode of its own. Croix10's proximity push is the prior
    // art, and this is the same idea with the push replaced by the technique.
    //
    // A cursor parked outside the frame reaches nothing, which is what makes an
    // export with no pointer identical to a preview nobody is touching.
    float cursorReach = 1.0 - smoothstep(0.0, 0.45, length(centered - cursor));
    float engineStrength = engineAmount * mix(1.0, cursorReach, step(0.5, engineCursor));

    if (engine < 1.5) {
      // Induction chromatique. The afterimage colour the eye induces along a
      // high-frequency boundary, made explicit: the complement of the local
      // colour, strongest at the edge and falling off across a fringe whose
      // width is the amount. Nothing is added away from the edges, so at any
      // amount the middle of a band is the colour it always was.
      float fringeSpan = max(engineStrength * 0.25, 0.0001);
      float fringe = 1.0 - smoothstep(0.0, fringeSpan, toEdge);
      pair = mix(pair, vec3(1.0) - pair, fringe * engineStrength);
    } else if (engine < 2.5) {
      // Physichromie. A relief of strips whose apparent colour depends on where
      // the viewer stands: the amount shears which slot each strip presents, so
      // sweeping it moves the whole field through colour states rather than
      // recolouring one band. The side faces occlude as the shear grows, which
      // is what a real lamella does seen obliquely.
      // The amount is the viewer's displacement from head-on, so zero is the
      // identity: every engine leaves the field exactly as it found it at zero,
      // which is what makes the amount comparable across the three of them. At
      // a half it presented each band as the average of itself and its
      // neighbour -- a flat grey field, which is a technique destroying its
      // subject rather than moving it through colour states.
      vec3 presented = mix(near, far, clamp(engineStrength, 0.0, 1.0));
      float occlusion = 1.0 - min(engineStrength * 0.35, 0.55);
      pair = presented * occlusion;
    } else {
      // Chromointerference. A second printed structure at a slightly different
      // pitch, beating against the first. The moire is nowhere drawn -- it is
      // the product of the two, so it appears at the beat period their ratio
      // implies, which is the whole point of the technique.
      float secondScaled = coordinate * max(count * enginePitch, 1.0) + phase;
      float secondBand = fract(secondScaled);
      float secondEdge = max(fwidth(secondBand) * 1.5, 1e-5);
      float secondMask = smoothstep(0.5 - secondEdge, 0.5 + secondEdge, secondBand);
      vec3 secondInk = studioPaletteSlot(
        floor(secondScaled), paletteSlots, colorA, colorB, colorC, colorD
      );
      // Difference rather than a mix: it is black exactly where the two prints
      // agree, which is what makes the beat itself the thing that is seen.
      pair = mix(pair, abs(pair - secondInk), secondMask * engineStrength);
    }
  }

  return vec4(pair, coverage);
}
`;

const CHUNK_GRADIENT_BODY = `
vec4 studioGradientBody(
  vec2 fragmentPosition,
  vec2 resolution,
  vec2 cursor,
  float angle,
  float rampType,
  float paletteSlots,
  float engine,
  float engineAmount,
  float engineCursor,
  float enginePitch,
  vec3 colorA,
  vec3 colorB,
  vec3 colorC,
  vec3 colorD
) {
  vec2 uv = fragmentPosition / max(resolution, vec2(1.0));
  vec2 centered = uv - 0.5;
  float radians = angle * 0.017453292519943295;

  float position;
  if (rampType < 0.5) {
    position = dot(centered, vec2(cos(radians), sin(radians))) + 0.5;
  } else if (rampType < 1.5) {
    position = length(centered) * 2.0;
  } else {
    position = fract((atan(centered.y, centered.x) - radians) * 0.15915494309189535 + 1.0);
  }

  vec3 colour = studioPaletteRamp(position, paletteSlots, colorA, colorB, colorC, colorD);

  // The same three techniques the stripes body offers (R67), read against a
  // ramp instead of a band. A ramp has no edges of its own, so what stands in
  // for "the boundary" is the seam between two consecutive slots -- which is
  // where a gradient's induced colour actually appears.
  if (engine >= 0.5) {
    float cursorReach = 1.0 - smoothstep(0.0, 0.45, length(centered - cursor));
    float engineStrength = engineAmount * mix(1.0, cursorReach, step(0.5, engineCursor));
    float slots = max(paletteSlots - 1.0, 1.0);
    float withinSlot = fract(clamp(position, 0.0, 1.0) * slots);
    float toEdge = min(withinSlot, 1.0 - withinSlot);

    if (engine < 1.5) {
      float fringeSpan = max(engineStrength * 0.25, 0.0001);
      float fringe = 1.0 - smoothstep(0.0, fringeSpan, toEdge);
      colour = mix(colour, vec3(1.0) - colour, fringe * engineStrength);
    } else if (engine < 2.5) {
      // The viewer's position shifts where the ramp is read, so the whole
      // transition slides through its colour states rather than one stop
      // changing. Occlusion darkens with the shear, as in the relief.
      // Zero is head-on and leaves the ramp where it is, as in the stripes body.
      vec3 shifted = studioPaletteRamp(
        clamp(position + engineStrength * 0.25, 0.0, 1.0),
        paletteSlots, colorA, colorB, colorC, colorD
      );
      colour = shifted * (1.0 - min(engineStrength * 0.35, 0.55));
    } else {
      // A second ramp at a different pitch, beating against the first.
      vec3 second = studioPaletteRamp(
        fract(position * max(enginePitch, 0.01)),
        paletteSlots, colorA, colorB, colorC, colorD
      );
      colour = mix(colour, abs(colour - second), engineStrength);
    }
  }

  return vec4(colour, 1.0);
}
`;

export const STUDIO_LAYER_TYPES: Readonly<Record<StudioLayerTypeId, StudioLayerType>> =
  {
    gradient: {
      chunk: CHUNK_GRADIENT_BODY,
      entryPoint: "studioGradientBody",
      id: "gradient",
      label: "Gradient",
      uniforms: [
        { defaultValue: 0, name: "angle", type: "float" },
        {
          defaultValue: 0,
          name: "rampType",
          // Order matches the branch order in `CHUNK_GRADIENT_BODY`.
          optionValues: ["linear", "radial", "angular"],
          type: "float",
        },
        { defaultValue: 2, name: "paletteSlots", type: "float" },
        // Same three, in the same order as the stripes type and the control.
        {
          defaultValue: 0,
          name: "engine",
          optionValues: [
            "none",
            "induction",
            "physichromie",
            "chromointerference",
          ],
          type: "float",
        },
        { defaultValue: 0.25, name: "engineAmount", type: "float" },
        {
          booleanControl: true,
          defaultValue: 0,
          name: "engineCursor",
          type: "float",
        },
        { defaultValue: 1.2, name: "enginePitch", type: "float" },
        { defaultValue: [0, 0, 0], name: "colorA", type: "vec3" },
        { defaultValue: [1, 1, 1], name: "colorB", type: "vec3" },
        { defaultValue: [1, 0, 0], name: "colorC", type: "vec3" },
        { defaultValue: [0, 0, 1], name: "colorD", type: "vec3" },
      ],
    },
    stripes: {
      chunk: CHUNK_STRIPES_BODY,
      entryPoint: "studioStripesBody",
      id: "stripes",
      label: "Stripes",
      uniforms: [
        { defaultValue: 0, name: "angle", type: "float" },
        { defaultValue: 24, name: "count", type: "float" },
        { defaultValue: 0.5, name: "widthRatio", type: "float" },
        { defaultValue: 0, name: "phase", type: "float" },
        { booleanControl: true, defaultValue: 0, name: "mirror", type: "float" },
        { defaultValue: 0, name: "taper", type: "float" },
        { defaultValue: 0, name: "separator", type: "float" },
        { defaultValue: 0, name: "jitterAmount", type: "float" },
        // No control yet, deliberately. Varying this changes *which* bands
        // move rather than how irregular the field is, so every statistic a
        // proof could name -- run spread, run count, band frequency -- holds
        // steady across its whole domain. The only honest observable is the
        // arrangement itself, and asserting that would mean pinning a
        // fingerprint that depends on backing size and GPU. Carried as a fixed
        // characteristic of the field until it has an observable worth naming.
        { defaultValue: 12, name: "jitterFrequency", type: "float" },
        { defaultValue: 2, name: "paletteSlots", type: "float" },
        /**
         * The chromatic engine (R67), and the two values every technique reads.
         *
         * Order here is the contract with the branch order in the body and with
         * the option order of the control, all three of which have to agree --
         * declaring a uniform out of order is how this project once spent three
         * diagnoses on a value silently arriving in the wrong parameter.
         */
        {
          defaultValue: 0,
          name: "engine",
          optionValues: [
            "none",
            "induction",
            "physichromie",
            "chromointerference",
          ],
          type: "float",
        },
        { defaultValue: 0.25, name: "engineAmount", type: "float" },
        {
          booleanControl: true,
          defaultValue: 0,
          name: "engineCursor",
          type: "float",
        },
        { defaultValue: 1.2, name: "enginePitch", type: "float" },
        { defaultValue: [1, 1, 1], name: "colorA", type: "vec3" },
        { defaultValue: [0, 0, 0], name: "colorB", type: "vec3" },
        { defaultValue: [1, 0, 0], name: "colorC", type: "vec3" },
        { defaultValue: [0, 0, 1], name: "colorD", type: "vec3" },
      ],
    },
  };

export const STUDIO_LAYER_TYPE_IDS: readonly StudioLayerTypeId[] = [
  "stripes",
  "gradient",
];

/** One entry in the ordered stack. Index 0 composites first, so it sits lowest. */
export interface StudioStackEntry {
  readonly typeId: StudioLayerTypeId;
  /**
   * A drawn path, in field units relative to the layer's own centre (R69).
   *
   * Baked into the assembled source rather than uploaded as uniforms. Both
   * halves of that matter: a per-layer vertex array would add its length to a
   * budget that already carries thirty-odd vectors per layer at a declared
   * depth of sixteen, and the delivered shader is the artifact this product
   * exists to produce — a baked path travels with it, where uniforms would
   * leave the shape behind and require a host to supply it.
   *
   * The cost is that editing the path compiles a new program, which is the same
   * trade R52 already took for name-mangling and for the same reason: the
   * variant cache keys on the stack signature, and the path is part of it.
   */
  readonly vertices?: readonly (readonly [number, number])[];
}

/** Mangled uniform name for a layer's parameter. R52. */
export function studioLayerUniformName(index: number, suffix: string): string {
  return `uLayer${index}_${suffix}`;
}

/** Every uniform the assembled program declares for one layer, in wrapper order. */
export function studioLayerUniforms(
  typeId: StudioLayerTypeId,
): readonly StudioLayerUniform[] {
  return [...STUDIO_LAYER_TYPES[typeId].uniforms, ...STUDIO_LAYER_COMMON_UNIFORMS];
}

/**
 * Cache key for the assembled program (R54).
 *
 * Two stacks with the same types in a different order are different programs, so
 * order is part of the key. An engine-shaped key would collide across both.
 */
export function studioStackSignature(stack: readonly StudioStackEntry[]): string {
  return (
    stack
      .map((entry) => {
        // A drawn path is compiled into the program, so two stacks with the
        // same types and different paths are different programs. Leaving it out
        // would serve a cached shader for the shape the author just changed.
        const path = entry.vertices?.length
          ? `#${entry.vertices.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(";")}`
          : "";
        return `${entry.typeId}${path}`;
      })
      .join(">") || "empty"
  );
}

const VERTEX_SHADER = `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  vec2 positions[3] = vec2[3](
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0),
    vec2(-1.0, 3.0)
  );
  vec2 position = positions[gl_VertexID];
  vUv = (position + 1.0) * 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export function studioStackVertexShader(): string {
  return VERTEX_SHADER;
}

function declareLayerUniforms(stack: readonly StudioStackEntry[]): string {
  return stack
    .flatMap((entry, index) =>
      studioLayerUniforms(entry.typeId).map(
        (uniform) =>
          `uniform ${uniform.type} ${studioLayerUniformName(index, uniform.name)};`,
      ),
    )
    .join("\n");
}

/**
 * The point-in-polygon test for one drawn path, emitted as its own function.
 *
 * Per layer rather than shared, because each path has its own length and a
 * shared function would need a size it cannot have. The vertices are literals
 * (R69), so the loop bound is a compile-time constant, the loop unrolls, and
 * there is no dynamic indexing.
 *
 * The crossing-number rule: walk the edges, count how many cross a ray cast
 * from the point, odd means inside. It holds for any simple polygon rather than
 * only convex ones, which a pen draws plenty of.
 */
function pathFunction(entry: StudioStackEntry, index: number): string {
  const vertices = entry.vertices ?? [];
  if (vertices.length < 3) return "";

  const literals = vertices
    .map(([x, y]) => `vec2(${x.toFixed(5)}, ${y.toFixed(5)})`)
    .join(", ");

  return `
float studioPathInside${index}(vec2 point) {
  vec2 path[${vertices.length}] = vec2[${vertices.length}](${literals});
  bool inside = false;
  for (int index = 0; index < ${vertices.length}; index += 1) {
    vec2 a = path[index];
    vec2 b = path[index == 0 ? ${vertices.length - 1} : index - 1];
    if (
      (a.y > point.y) != (b.y > point.y) &&
      point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside ? 1.0 : 0.0;
}
`;
}

function compositeLayer(entry: StudioStackEntry, index: number): string {
  const type = STUDIO_LAYER_TYPES[entry.typeId];
  const args = type.uniforms
    .map((uniform) => studioLayerUniformName(index, uniform.name))
    .join(", ");
  const name = (suffix: string): string => studioLayerUniformName(index, suffix);
  const reach = `${name("visible")} * maskCoverage`;
  const weight = `${name("opacity")} * layerReach`;

  const aspect = `max(${name("maskAspect")}, 0.01)`;
  const hasPath = (entry.vertices?.length ?? 0) >= 3;

  return `  {
    // The layer is confined to a shape placed on the frame, and the sense
    // decides whether it draws inside that shape or everywhere except it.
    // Coverage folds into the composite weight rather than discarding the
    // fragment, so a masked-out layer contributes exactly nothing and still
    // costs the same as one that does not.
    vec2 maskDelta =
      (fragmentPosition - uResolution * 0.5) / max(uResolution.y, 1.0)
        - vec2(${name("maskCenterX")}, ${name("maskCenterY")});
    // Turn the coordinate into the shape's own frame rather than turning the
    // shape: the tests below stay axis-aligned, and the layer inside keeps
    // whatever angle its pattern asks for.
    float maskAngle = radians(${name("maskRotation")});
    vec2 maskLocal = vec2(
      maskDelta.x * cos(maskAngle) + maskDelta.y * sin(maskAngle),
      -maskDelta.x * sin(maskAngle) + maskDelta.y * cos(maskAngle)
    );
    vec2 maskOffset = abs(maskLocal);
    float maskWidth = ${name("maskSize")} * ${aspect};
    // Every form is read against the same half-extents, which is what lets the
    // vocabulary be one uniform rather than one geometry each. The rectangle
    // asks whether both extents are within reach; the ellipse asks the same
    // question of the two together; the polygons ask it of a coordinate
    // un-stretched by aspect, so a widened shape stays the form it was.
    //
    // The branch order is the contract with the maskShape option order.
    float maskForm = ${name("maskShape")};
    float maskInside;
    if (maskForm < 0.5) {
      maskInside =
        step(maskOffset.x, maskWidth) * step(maskOffset.y, ${name("maskSize")});
    } else if (maskForm < 1.5) {
      maskInside = step(
        length(vec2(
          maskOffset.x / max(maskWidth, 0.0001),
          maskOffset.y / max(${name("maskSize")}, 0.0001)
        )),
        1.0
      );
    } else if (maskForm > 6.5) {
      // A drawn path (R69). Tested against the shape's own frame, so moving or
      // turning the layer moves and turns what was drawn; size and aspect do
      // not scale it, because a path is authored geometry rather than an extent
      // — the way to change it is to draw it again or move a vertex.
      maskInside = ${hasPath ? `studioPathInside${index}(maskLocal)` : "1.0"};
    } else {
      // The named polygons carry their own side count so that choosing one
      // cannot be contradicted by the count control; only the polygon form reads it.
      float maskSides = maskForm < 2.5
        ? 3.0
        : maskForm < 3.5
          ? 4.0
          : maskForm < 4.5
            ? 5.0
            : maskForm < 5.5 ? 6.0 : ${name("maskSides")};
      // Point up, whatever the count: turning the polygon so a vertex lands at
      // the top is what makes a triangle read as a triangle and a four-sided
      // one read as a diamond rather than as the rectangle it would otherwise
      // duplicate.
      maskInside = studioPolygonInside(
        vec2(maskLocal.x / ${aspect}, maskLocal.y),
        ${name("maskSize")},
        maskSides,
        90.0 - 180.0 / max(maskSides, 3.0)
      );
    }
    float maskCoverage = ${name("maskSize")} <= 0.0
      ? 1.0
      : mix(maskInside, 1.0 - maskInside, step(0.5, ${name("maskInvert")}));

    // Treatment first and weighted by reach alone: a layer at zero opacity
    // still treats what is beneath it, which is the lens the reference works
    // are built on, and paints none of its own colour.
    float layerReach = ${reach};
    composite = vec4(
      mix(
        composite.rgb,
        studioTreat(
          composite.rgb,
          ${name("hue")},
          ${name("saturation")},
          ${name("contrast")}
        ),
        clamp(layerReach, 0.0, 1.0)
      ),
      composite.a
    );

    vec4 layer = ${type.entryPoint}(fragmentPosition, uResolution, uCursor${args ? `, ${args}` : ""});
    composite = studioComposite(composite, layer, ${weight}, ${name("blendMode")});
  }`;
}

/**
 * Assembles one fragment shader for the whole stack.
 *
 * A type absent from the stack contributes no code at all, so an unused layer
 * type costs nothing per frame — the same property the engine variants had, held
 * across a dynamic stack rather than a fixed pair.
 */
export function studioAssembleStackFragmentShader(
  stack: readonly StudioStackEntry[],
): string {
  const usedTypes = STUDIO_LAYER_TYPE_IDS.filter((typeId) =>
    stack.some((entry) => entry.typeId === typeId),
  );

  const preamble = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec3 uBackgroundColor;
uniform float uIncludeBackground;
/**
 * Where the pointer is, in the same units the field is measured in: normalised
 * against height, from the centre of the frame. Committed to state rather than
 * read from an event (R68), so the exported artifact and the delivered source
 * carry the position the author left it at instead of no position at all.
 */
uniform vec2 uCursor;

${declareLayerUniforms(stack)}

in vec2 vUv;
out vec4 fragColor;
`;

  const main = `
void main() {
  vec2 fragmentPosition = vUv * uResolution;
  vec4 composite = vec4(uBackgroundColor, uIncludeBackground);

${stack.map((entry, index) => compositeLayer(entry, index)).join("\n")}

  fragColor = vec4(studioLinearToSrgb(composite.rgb), composite.a);
}
`;

  return [
    preamble,
    CHUNK_LAYER_SUPPORT,
    ...usedTypes.map((typeId) => STUDIO_LAYER_TYPES[typeId].chunk),
    ...stack.map((entry, index) => pathFunction(entry, index)),
    main,
  ].join("\n");
}
