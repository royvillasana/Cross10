import { type StudioVertexPoint } from "./studio-stack-state";
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

/**
 * What a per-layer uniform holds.
 *
 * `sampler2D` is the odd one and behaves differently everywhere: its value is
 * not in the layer's value map, because a texture is not a number the record
 * can carry. It is bound from the scene's decoded media instead, one texture
 * unit per layer index, and the value map has nothing to say about it.
 */
export type StudioLayerUniformType = "float" | "sampler2D" | "vec3";

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

export type StudioLayerTypeId = "gradient" | "image" | "stripes";

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
    // The index into this list *is* the uniform value the shader branches on,
    // so its order is the contract with `studioBlend` and with the section's
    // option order. Adding an option to the panel without adding it here leaves
    // the new mode mapping to zero, which renders as `normal` and looks exactly
    // like a blend that did nothing.
    optionValues: ["normal", "multiply", "screen", "overlay", "difference", "additive"],
    type: "float",
  },
];

/**
 * How many inks a layer's palette can hold.
 *
 * Declared once, in TypeScript, and interpolated into the GLSL as a
 * preprocessor constant so the array size, the slot control's ceiling and the
 * uniform list cannot disagree. Three places that all have to say eight is
 * three places that can end up saying different numbers, and the failure would
 * be a colour an author can set and the shader cannot read.
 *
 * The macro is named `PALETTE_MAX` in the emitted source rather than carrying
 * this file's prefix, and that is not cosmetic: a delivered shader must contain
 * no identifier naming the studio that produced it, and a proof asserts exactly
 * that. Prefixing it would have branded every delivered source with the tool.
 */
export const STUDIO_PALETTE_MAX = 8;

const CHUNK_LAYER_SUPPORT = `
#define PALETTE_MAX ${STUDIO_PALETTE_MAX}

vec3 studioLinearToSrgb(vec3 linear) {
  vec3 clamped = clamp(linear, 0.0, 1.0);
  vec3 low = clamped * 12.92;
  vec3 high = 1.055 * pow(clamped, vec3(1.0 / 2.4)) - 0.055;
  return mix(high, low, step(clamped, vec3(0.0031308)));
}

/**
 * Where two inks are mixed, which used to be a decision nobody could see.
 *
 * Everything in this product is composited in linear light, because that is
 * what light does: two beams add. But that is not what *paint* does, and it is
 * not what an author predicts from the two swatches they chose -- a mix of
 * saturated blue and yellow in linear light passes through a pale grey, where
 * the same two inks mixed the way a screen encodes them keep more of their
 * chroma, and mixed perceptually keep their lightness even.
 *
 * None of the three is correct in general. Which one is right depends on
 * whether the author is describing light, ink, or an impression -- and this
 * product is about all three at different moments, which is exactly why the
 * choice belongs to the author rather than to whoever wrote the shader.
 */
vec3 studioSrgbToLinear(vec3 srgb) {
  vec3 clamped = clamp(srgb, 0.0, 1.0);
  vec3 low = clamped / 12.92;
  vec3 high = pow((clamped + 0.055) / 1.055, vec3(2.4));
  return mix(high, low, step(clamped, vec3(0.04045)));
}

/**
 * Oklab, which is the perceptual space this offers.
 *
 * Chosen over Lab or HSL because it is the one whose lightness axis actually
 * tracks what an eye reports and whose hues stay put across a mix -- a blue to
 * white ramp in HSL swings through violet, and in Lab a saturated blue drifts.
 * The matrices are Björn Ottosson's, applied to linear sRGB.
 */
vec3 studioLinearToOklab(vec3 linear) {
  float l = 0.4122214708 * linear.r + 0.5363325363 * linear.g + 0.0514459929 * linear.b;
  float m = 0.2119034982 * linear.r + 0.6806995451 * linear.g + 0.1073969566 * linear.b;
  float s = 0.0883024619 * linear.r + 0.2817188376 * linear.g + 0.6299787005 * linear.b;
  vec3 root = pow(max(vec3(l, m, s), vec3(0.0)), vec3(1.0 / 3.0));
  return vec3(
    0.2104542553 * root.x + 0.7936177850 * root.y - 0.0040720468 * root.z,
    1.9779984951 * root.x - 2.4285922050 * root.y + 0.4505937099 * root.z,
    0.0259040371 * root.x + 0.7827717662 * root.y - 0.8086757660 * root.z
  );
}

vec3 studioOklabToLinear(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  vec3 cubed = vec3(l * l * l, m * m * m, s * s * s);
  return vec3(
    4.0767416621 * cubed.x - 3.3077115913 * cubed.y + 0.2309699292 * cubed.z,
    -1.2684380046 * cubed.x + 2.6097574011 * cubed.y - 0.3413193965 * cubed.z,
    -0.0041960863 * cubed.x - 0.7034186147 * cubed.y + 1.7076147010 * cubed.z
  );
}

/**
 * Two inks mixed in the space the author asked for.
 *
 * Everything arrives and leaves in linear light whichever space is chosen, so
 * this is a detour rather than a different pipeline: the composite, the
 * engines and the export all keep working in the one space, and only the walk
 * between two inks changes.
 */
/**
 * How the loop is walked, which is the shape of the travel rather than a second
 * source of motion.
 *
 * The spec this answers asked for sine, triangle and noise LFOs. Most of what
 * an LFO is *for* is already guaranteed better here by construction: drift is
 * counted in whole cycles per loop, so periodic motion cannot break the seam
 * however fast it runs. What that construction does not give is *shape* -- a
 * viewer who passes at one constant speed and never eases.
 *
 * So this shapes the position rather than adding an oscillator. Every shape
 * below returns 0 at the start of the loop and lands exactly on a whole number
 * of cycles at the end, which is what keeps the seam closed by construction
 * rather than by an author choosing a rate that happens to divide.
 *
 * - Steady is the walk this always had: constant speed, and a velocity that
 *   jumps at the seam the way a loop of a pan does.
 * - Eased starts and ends at rest. Its velocity is zero at both ends, so the
 *   seam is smooth in speed as well as in position -- the one place a looping
 *   camera move usually gives itself away.
 * - Swing goes out and comes back inside one loop. It ends where it began by
 *   shape rather than by counting, which is what makes it the honest reading of
 *   the sine the spec asked for.
 */
float studioLoopShape(float loop, float shape) {
  float t = clamp(loop, 0.0, 1.0);
  if (shape < 0.5) return t;
  if (shape < 1.5) return t * t * (3.0 - 2.0 * t);
  return (1.0 - cos(t * 6.283185307179586)) * 0.5;
}

/**
 * Where a band gives way, as coverage rather than as a hard edge.
 *
 * Pulled out of the stripe body so the halftone can use the same construction
 * instead of writing a second one. That is a requirement rather than a
 * convenience: a halftone line *is* a band, and two implementations of one
 * thing are two answers to the same question -- the first time they disagree
 * about where an edge falls, one of them is wrong and nobody can say which.
 *
 * The edge is analytic, from the screen-space derivative, so the width of the
 * transition is a pixel wherever the field is read and whatever it is read at.
 * Supersampling would cost more and antialias less.
 */
float studioBandInk(float position, float split) {
  float edge = max(fwidth(position) * 1.5, 1e-5);
  return smoothstep(split - edge, split + edge, position);
}

/**
 * A tone rendered as marks whose area follows it, which is what a halftone is.
 *
 * The mark carries the layer's own colour and the space between marks carries
 * nothing, so what shows through is whatever sits beneath -- the same reading a
 * band separator already has. A halftone that painted its own paper would be
 * opaque white over the stack, which is a different picture from a screen.
 *
 * Three modes, and two of them are the band field read twice. A halftone line
 * *is* a band: the same coverage function decides where it gives way, with the
 * tone standing in for the width. Cross is that field crossed with itself a
 * quarter turn away, which is how a cross screen is actually made.
 *
 * Tone drives *area*, not brightness. That is the whole of the technique: a
 * dark region is dark because more of it is covered, not because the ink is
 * darker, which is why a halftone survives being printed in one flat ink.
 */
float studioHalftone(vec2 position, float mode, float cell, float angle, float tone) {
  if (mode < 0.5) return 1.0;

  float grain = max(cell, 1e-3);
  float turn = radians(angle);
  float cosine = cos(turn);
  float sine = sin(turn);
  // Turned before it is cut into cells, so the screen turns rather than the
  // picture -- which is the difference between rotating a halftone and
  // halftoning a rotated picture.
  vec2 screen = vec2(
    position.x * cosine + position.y * sine,
    -position.x * sine + position.y * cosine
  ) / grain;

  float covered = clamp(tone, 0.0, 1.0);

  if (mode < 1.5) {
    // Dots. Radius from the square root of coverage, because area goes as the
    // square of the radius: without it the midtones come out far too light and
    // the ramp reads as a curve nobody chose.
    vec2 within = fract(screen) - 0.5;
    float radius = sqrt(covered) * 0.5;
    float reach = length(within);
    float edge = max(fwidth(reach) * 1.5, 1e-5);
    return 1.0 - smoothstep(radius - edge, radius + edge, reach);
  }

  // Lines, and cross as lines twice. studioBandInk is the stripe field's own
  // reading, so a halftone line gives way exactly where a band does.
  float line = 1.0 - studioBandInk(fract(screen.y), covered);
  if (mode < 2.5) return line;

  float crossed = 1.0 - studioBandInk(fract(screen.x), covered);
  // Union rather than product: two screens laid over one another cover what
  // either of them covers, and multiplying would thin the midtones toward
  // nothing where a real cross screen thickens them.
  return max(line, crossed);
}

/**
 * The nearest ink in the layer's own bank.
 *
 * Measured in Oklab rather than in linear light, and that is the difference
 * between "nearest" meaning what an eye would say and what a distance in a
 * cube would. Linear light puts most of its volume in the brights, so a
 * mid-tone snaps to whichever ink happens to be lightest rather than to the one
 * it looks most like.
 */
vec3 studioQuantizeToBank(vec3 colour, vec3 bank[PALETTE_MAX], float slots) {
  int used = int(clamp(floor(slots + 0.5), 2.0, float(PALETTE_MAX)));
  vec3 target = studioLinearToOklab(colour);
  vec3 nearest = bank[0];
  float best = 1e9;

  for (int index = 0; index < PALETTE_MAX; index += 1) {
    if (index >= used) break;
    vec3 candidate = studioLinearToOklab(bank[index]);
    vec3 delta = candidate - target;
    float distance = dot(delta, delta);
    if (distance < best) {
      best = distance;
      nearest = bank[index];
    }
  }

  return nearest;
}

vec3 studioMixInks(vec3 a, vec3 b, float t, float space) {
  if (space < 0.5) return mix(a, b, t);
  if (space < 1.5) {
    return studioSrgbToLinear(mix(studioLinearToSrgb(a), studioLinearToSrgb(b), t));
  }
  return studioOklabToLinear(mix(studioLinearToOklab(a), studioLinearToOklab(b), t));
}


/**
 * One colour from the palette at position t, walking whichever slots are in use.
 *
 * Shared by both bodies so a banded stripe field and a gradient agree about what
 * the slots mean.
 *
 * This was a ladder of cases, one branch per slot count, written out for two
 * three and four inks. Every additional ink would have been another branch and
 * another line of mixes, which is the shape that quietly decides a palette holds
 * four. As a walk over an array it is the same code for two inks and for eight,
 * so what the maximum is became a number rather than an argument.
 */
vec3 studioPaletteRamp(float t, float slots, vec3 bank[PALETTE_MAX], float space) {
  float used = clamp(floor(slots + 0.5), 2.0, float(PALETTE_MAX));
  float scaled = clamp(t, 0.0, 1.0) * (used - 1.0);
  // The last slot is reached exactly at t = 1, so the floor has to stay one
  // short of it or the final mix reads past the end of the bank.
  int low = int(min(floor(scaled), used - 2.0));
  return studioMixInks(
    bank[low],
    bank[low + 1],
    clamp(scaled - float(low), 0.0, 1.0),
    space
  );
}

// The slot a band falls in, as flat colour rather than a ramp. This is the
// stripe reading of a palette: consecutive bands take consecutive inks, which is
// what makes a three or four ink rhythm rather than a gradient.
/**
 * One ink of the bank, by position in the cycle.
 *
 * The bank is an array rather than four named colours, and that is what made
 * eight slots a change to one function instead of to thirty call sites. It also
 * removed the shape that was quietly limiting: a chain of "if" returns has to
 * be written out per slot, so every new ink was another branch in a function
 * every body calls.
 *
 * Indexed dynamically, which GLSL ES 3.0 allows for a local array and is what
 * keeps this a lookup rather than a ladder.
 */
vec3 studioPaletteSlot(float index, float slots, vec3 bank[PALETTE_MAX]) {
  int slot = int(mod(floor(index), clamp(slots, 1.0, float(PALETTE_MAX))));
  return bank[slot];
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
  if (mode < 3.5) {
    return mix(
      2.0 * below * above,
      1.0 - 2.0 * (1.0 - below) * (1.0 - above),
      step(vec3(0.5), below)
    );
  }

  // Difference: how far apart two fields are, channel by channel. Identical
  // colours collapse to black, which is what makes this the reading for "how
  // far off am I" rather than "are both present".
  if (mode < 4.5) return abs(below - above);

  // Additive, and this one is not decoration. *Couleur Additive* is a technique
  // this product ships entries for, and *Transchromie* is defined as
  // overlapping translucent planes with selectable subtractive and additive
  // mixing -- neither can be rendered as specified without it.
  //
  // Summed in linear light, which is why this is a plain add: these values are
  // radiometric here rather than sRGB, so adding them is what light does when
  // two projections overlap.
  //
  // Clamped here rather than trusting the composite, which does not clamp: it
  // mixes toward the blended colour and hands the result on. A sum above one
  // would travel to the sRGB conversion and come back as whatever that does
  // with out-of-range input. A saturated overlap should read as white.
  return min(below + above, vec3(1.0));
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
  float loop,
  float angle,
  float driftAngle,
  float driftPhase,
  float driftShape,
  float count,
  float widthRatio,
  float phase,
  float mirror,
  float flipX,
  float flipY,
  float pointerPush,
  float taper,
  float separator,
  float jitterAmount,
  float jitterVariation,
  float paletteSlots,
  float mixSpace,
  float engine,
  float engineAmount,
  float engineCursor,
  float enginePitch,
  vec3 bank[PALETTE_MAX]
) {
  // Normalised against height so the field does not stretch with aspect ratio.
  vec2 centered = (fragmentPosition - resolution * 0.5) / max(resolution.y, 1.0);
  // The pointer pushes the field away from itself, falling to nothing at the
  // same reach the engines already use. This is a displacement of the
  // coordinate rather than a change of strength: strength makes an effect
  // stronger where the pointer is, and displacement makes the field *move*,
  // which is the difference between a highlight and a gesture.
  //
  // Proportional to the offset itself rather than to its direction. A
  // normalised push has a full-strength discontinuity at zero length -- exactly
  // where the pointer sits -- so the field would tear under the cursor and the
  // direction it tore in would be whatever the arithmetic happened to produce.
  // Scaling the offset vector goes smoothly to nothing at the centre, which is
  // what makes this read as the field being pushed rather than punctured.
  vec2 fromCursor = centered - cursor;
  float pushReach = 1.0 - smoothstep(0.0, 0.45, length(fromCursor));
  centered += fromCursor * pushReach * pointerPush * 0.9;
  // The loop, applied where the author's own values are read.
  //
  // Additive, so at loop 0 the field is exactly what was built and the drift
  // moves it rather than replacing it. Whole cycles per loop, so at loop 1 the
  // phase has advanced an integer number of band periods and the angle a whole
  // number of turns -- both land back where they started, which is why the seam
  // needs no special case anywhere.
  //
  // What drifts is the *viewer*: which part of each lamella is presented, and
  // from what direction it is read. The inks, the count and the separators do
  // not move, because a field whose colours change is a different field rather
  // than the same one seen from somewhere else.
  float walked = studioLoopShape(loop, driftShape);
  float driftedAngle = angle + driftAngle * 360.0 * walked;
  float driftedPhase = phase + driftPhase * walked;
  float radians = driftedAngle * 0.017453292519943295;
  float coordinate = centered.x * cos(radians) + centered.y * sin(radians);
  // Folded in the layer's own axes, which is why it is applied to the rotated
  // coordinate rather than to the fragment: turning a layer and then flipping it
  // has to fold along the axis the author sees, not the screen's.
  //
  // Distinct from the mirror below, which reflects the field about its centre and
  // leaves two symmetric halves. This reverses the field's direction and keeps
  // it whole -- which is what makes it visible on a tapered or jittered field
  // and invisible on a mirrored one, since an already-symmetric field reads the
  // same either way.
  coordinate = mix(coordinate, -coordinate, step(0.5, flipX));
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
  float scaled = coordinate * max(count, 1.0) + driftedPhase;
  float bandIndex = floor(scaled);
  float jitter =
    fract(sin(bandIndex * max(jitterVariation, 1e-4)) * 43758.5453) - 0.5;
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
  // The other axis of the same fold. Along the band is where the taper drifts,
  // so flipping here is what points a wedge the other way.
  along = mix(along, -along, step(0.5, flipY));
  float split = widthRatio + taper * along;

  float edge = max(fwidth(position) * 1.5, 1e-5);
  float band = studioBandInk(position, split);

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
  vec3 near = studioPaletteSlot(bandIndex, paletteSlots, bank);
  vec3 far = studioPaletteSlot(bandIndex + 1.0, paletteSlots, bank);
  vec3 pair = paletteSlots < 2.5
    ? studioMixInks(bank[0], bank[1], band, mixSpace)
    : studioMixInks(near, far, band, mixSpace);

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
    // fourth engine or a mode of its own. The prior art is a proximity push,
    // and this is the same idea with the push replaced by the technique.
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
      float secondScaled = coordinate * max(count * enginePitch, 1.0) + driftedPhase;
      float secondBand = fract(secondScaled);
      float secondEdge = max(fwidth(secondBand) * 1.5, 1e-5);
      float secondMask = smoothstep(0.5 - secondEdge, 0.5 + secondEdge, secondBand);
      vec3 secondInk = studioPaletteSlot(
        floor(secondScaled), paletteSlots, bank
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
  float loop,
  float angle,
  float driftAngle,
  float driftPhase,
  float driftShape,
  float flipX,
  float flipY,
  float pointerPush,
  float rampType,
  float phase,
  float paletteSlots,
  float mixSpace,
  float engine,
  float engineAmount,
  float engineCursor,
  float enginePitch,
  vec3 bank[PALETTE_MAX]
) {
  vec2 uv = fragmentPosition / max(resolution, vec2(1.0));
  vec2 centered = uv - 0.5;
  // The pointer pushes the field away from itself, falling to nothing at the
  // same reach the engines already use. This is a displacement of the
  // coordinate rather than a change of strength: strength makes an effect
  // stronger where the pointer is, and displacement makes the field *move*,
  // which is the difference between a highlight and a gesture.
  //
  // Proportional to the offset itself rather than to its direction. A
  // normalised push has a full-strength discontinuity at zero length -- exactly
  // where the pointer sits -- so the field would tear under the cursor and the
  // direction it tore in would be whatever the arithmetic happened to produce.
  // Scaling the offset vector goes smoothly to nothing at the centre, which is
  // what makes this read as the field being pushed rather than punctured.
  vec2 fromCursor = centered - cursor;
  float pushReach = 1.0 - smoothstep(0.0, 0.45, length(fromCursor));
  centered += fromCursor * pushReach * pointerPush * 0.9;
  // Folded before the ramp is read, so every ramp type folds: a linear ramp
  // reverses, an angular sweep runs the other way, and a radial one is
  // unchanged because it already has no direction to reverse.
  centered.x = mix(centered.x, -centered.x, step(0.5, flipX));
  centered.y = mix(centered.y, -centered.y, step(0.5, flipY));
  // The loop, applied where the author's own values are read.
  //
  // Additive, so at loop 0 the field is exactly what was built and the drift
  // moves it rather than replacing it. Whole cycles per loop, so at loop 1 the
  // phase has advanced an integer number of band periods and the angle a whole
  // number of turns -- both land back where they started, which is why the seam
  // needs no special case anywhere.
  //
  // What drifts is the *viewer*: which part of each lamella is presented, and
  // from what direction it is read. The inks, the count and the separators do
  // not move, because a field whose colours change is a different field rather
  // than the same one seen from somewhere else.
  float walked = studioLoopShape(loop, driftShape);
  float driftedAngle = angle + driftAngle * 360.0 * walked;
  // The gradient composes these separately below: the author's offset
  // translates, the drift wraps.

  float radians = driftedAngle * 0.017453292519943295;

  float position;
  if (rampType < 0.5) {
    position = dot(centered, vec2(cos(radians), sin(radians))) + 0.5;
  } else if (rampType < 1.5) {
    position = length(centered) * 2.0;
  } else {
    position = fract((atan(centered.y, centered.x) - radians) * 0.15915494309189535 + 1.0);
  }

  // Applied here rather than at the palette read, so the engines below read the
  // ramp the author sees. An offset that moved only the fill would leave an
  // induced fringe sitting on a seam that is no longer there.
  position += phase;

  // The drift wraps; the author's own Offset does not, and the difference is
  // deliberate. Offset slides the ramp and saturates at its ends, which is what
  // an author setting a fixed position expects. Drift is a viewer *travelling*
  // along the work, and a ramp is not periodic -- translating it far enough
  // walks off the end, which is exactly what happened: a third of the way
  // through the loop the whole layer went black. The seam still closed, because
  // loop position wraps to zero there, so a one-layer seam proof saw nothing
  // wrong. It took two layers at different rates to show it.
  //
  // A mix on a step rather than a branch, so at rate zero this is the identity
  // and an undrifted gradient renders exactly as it did. (No backticks in this
  // file's comments: the shader lives inside a JS template literal, and one
  // closes it.)
  position = mix(
    position,
    fract(position + driftPhase * studioLoopShape(loop, driftShape)),
    step(0.0001, abs(driftPhase))
  );

  vec3 colour = studioPaletteRamp(position, paletteSlots, bank, mixSpace);

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
        paletteSlots, bank, mixSpace
      );
      colour = shifted * (1.0 - min(engineStrength * 0.35, 0.55));
    } else {
      // A second ramp at a different pitch, beating against the first.
      vec3 second = studioPaletteRamp(
        fract(position * max(enginePitch, 0.01)),
        paletteSlots, bank, mixSpace
      );
      colour = mix(colour, abs(colour - second), engineStrength);
    }
  }

  return vec4(colour, 1.0);
}
`;

const CHUNK_IMAGE_BODY = `
vec4 studioImageBody(
  vec2 fragmentPosition,
  vec2 resolution,
  vec2 cursor,
  // Accepted and unused. The call site hands every body the loop position, so
  // the signature is part of the calling convention rather than a statement
  // about this technique -- a body that omitted it would not compile, and the
  // whole stack it appears in would fail to compile with it.
  //
  // Unused on purpose, though. A picture does not drift: what travels in the
  // other techniques is a viewer's position along a band field, and there is no
  // equivalent for an imported photograph. Drifting it would be moving the
  // subject rather than moving past it.
  float loop,
  vec2 shapeLocal,
  float shapeHalfWidth,
  float shapeHalfHeight,
  float rotation,
  float mediaFlipX,
  float mediaFlipY,
  float flipX,
  float flipY,
  float engine,
  float engineAmount,
  float engineCursor,
  float enginePitch,
  float sourceMapping,
  float sourceCount,
  float sourceWidthRatio,
  float sourceStrength,
  float paletteSlots,
  float mixSpace,
  vec3 bank[PALETTE_MAX],
  sampler2D image
) {
  // The picture lives in the *layer's* frame, not the canvas's.
  //
  // This is the difference between moving a picture and moving a window over
  // one. \`shapeLocal\` is the coordinate the mask already built -- measured from
  // the shape's centre and turned by the shape's rotation -- so dividing by the
  // shape's own half-extents puts the picture inside the shape and nowhere
  // else. Drag the layer and the picture goes with it; pull a handle and the
  // picture grows; turn the layer and the picture turns.
  //
  // Mapping to the frame instead is what made a moved layer look like a mask
  // sliding over a stationary image, because that is exactly what it was.
  vec2 fitted = vec2(
    shapeLocal.x / max(shapeHalfWidth, 0.0001),
    shapeLocal.y / max(shapeHalfHeight, 0.0001)
  );

  // The asset's own transform, applied inside that frame: turning the sampling
  // coordinate turns the picture the other way, hence the negation.
  float radians = -rotation * 0.017453292519943295;
  vec2 turned = vec2(
    fitted.x * cos(radians) + fitted.y * sin(radians),
    -fitted.x * sin(radians) + fitted.y * cos(radians)
  );

  // Folded after the turn, so the mirror runs along the picture's own axes
  // rather than the screen's. That is the asset-property reading: the transform
  // is stored on the asset, so it has to mean the same thing to everything that
  // draws it.
  // Two folds, because two different things can be folded and an author means
  // different things by them. The media transform belongs to the *asset* -- the
  // runtime's own buttons write it, and it travels with the picture wherever it
  // is used. The layer flip belongs to the *layer*, like its angle, and is the
  // same control every other layer type carries.
  //
  // Combined rather than one overriding the other, so each stays a toggle:
  // folding an already-folded picture returns it, which is what a switch that
  // says "flip" has to mean. Summed modulo two is exclusive-or over 0 and 1.
  float foldX = mod(mediaFlipX + flipX, 2.0);
  float foldY = mod(mediaFlipY + flipY, 2.0);
  turned.x = mix(turned.x, -turned.x, step(0.5, foldX));
  turned.y = mix(turned.y, -turned.y, step(0.5, foldY));

  // Into texture space. The vertical flip is the two coordinate systems
  // disagreeing rather than a transform: an image's rows run down from its top
  // and the shape's run up from its centre.
  vec2 uv = vec2(turned.x * 0.5 + 0.5, 0.5 - turned.y * 0.5);

  // Outside the picture is nothing rather than a stretched edge, so a rotated
  // picture shows the layers beneath it at the corners instead of a smear.
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    return vec4(0.0);
  }

  vec4 sampled = texture(image, uv);
  // **Re-rendering the source as a field.** Until this existed a picture was a
  // layer that got *coloured* -- the engines and treatments reached it, but it
  // was never turned into the bands this product is made of. That is what
  // media-stylization is named for, and it was the largest thing it did not do.
  //
  // Luminance is the driver because it is what a band field already encodes: a
  // stripe sequence is light against dark, so a source's own light can decide
  // where the boundary between them falls. Rec. 709 weights, because the value
  // being read is linear light rather than a perceptual lightness.
  //
  // Two mappings, and they are genuinely different readings rather than two
  // dials on one. *Width* keeps every boundary where it was and moves the split
  // inside each band, so the picture appears as thickening and thinning of one
  // steady rhythm. *Phase* keeps every band the same width and displaces the
  // sequence, so the picture appears as the rhythm bending. The first reads as
  // tone, the second as relief.
  if (sourceMapping >= 0.5) {
    float sourceLight = dot(sampled.rgb, vec3(0.2126, 0.7152, 0.0722));
    float bands = max(sourceCount, 1.0);
    float sourceScaled = uv.x * bands;

    if (sourceMapping < 1.5) {
      // Width: the split within each band moves with the source.
      float split = clamp(
        sourceWidthRatio + (sourceLight - 0.5) * sourceStrength,
        0.02,
        0.98
      );
      float within = fract(sourceScaled);
      float edge = max(fwidth(within) * 1.5, 1e-5);
      float ink = smoothstep(split - edge, split + edge, within);
      float slotPosition = (floor(sourceScaled) + ink) / bands;
      vec3 banded = studioPaletteRamp(
        fract(slotPosition * max(paletteSlots, 2.0)),
        paletteSlots,
        bank,
        mixSpace
      );
      return vec4(banded, sampled.a);
    }

    // Phase: the sequence is displaced by the source, so boundaries bend.
    float displaced = sourceScaled + sourceLight * sourceStrength * bands;
    float within = fract(displaced);
    float edge = max(fwidth(within) * 1.5, 1e-5);
    float ink = smoothstep(sourceWidthRatio - edge, sourceWidthRatio + edge, within);
    float slotPosition = (floor(displaced) + ink) / bands;
    vec3 banded = studioPaletteRamp(
      fract(slotPosition * max(paletteSlots, 2.0)),
      paletteSlots,
      bank,
      mixSpace
    );
    return vec4(banded, sampled.a);
  }

  if (engine < 0.5) {
    return sampled;
  }

  // The same three readings the procedural bodies offer (R67), against a
  // picture instead of a field the body built.
  //
  // A picture has no palette and no seams of its own, so what the engine reads
  // is a structure it lays over the picture -- strips across the picture's own
  // frame, so they turn, fold and travel with it rather than sitting on the
  // canvas underneath. That is the prior art's own arrangement: the relief is
  // an apparatus placed in front of an image, not a property the image had.
  //
  // Branch order is the contract with the engine option order, as in the other
  // two bodies.
  vec2 centered = (fragmentPosition - resolution * 0.5) / max(resolution.y, 1.0);
  float cursorReach = 1.0 - smoothstep(0.0, 0.45, length(centered - cursor));
  float engineStrength = engineAmount * mix(1.0, cursorReach, step(0.5, engineCursor));

  float scaled = uv.x * 64.0;
  float withinBand = fract(scaled);
  vec3 colour = sampled.rgb;

  if (engine < 1.5) {
    // Induction: the complement appears in a narrow fringe at each seam, and
    // nowhere else, which is what makes it a colour the picture does not carry.
    float toEdge = min(withinBand, 1.0 - withinBand);
    float fringeSpan = max(engineStrength * 0.25, 0.0001);
    float fringe = 1.0 - smoothstep(0.0, fringeSpan, toEdge);
    colour = mix(colour, vec3(1.0) - colour, fringe * engineStrength);
  } else if (engine < 2.5) {
    // The relief: each strip presents a little of what is beside it, which for
    // a picture means reading it a strip over. Alternating which side a strip
    // leans to is what reads as depth rather than as one uniform smear, and the
    // occlusion darkens with the shear exactly as it does over a band field.
    float side = mod(floor(scaled), 2.0) < 0.5 ? -1.0 : 1.0;
    vec2 neighbour = vec2(
      clamp(uv.x + side * engineStrength * 0.015625, 0.0, 1.0),
      uv.y
    );
    colour = mix(colour, texture(image, neighbour).rgb, clamp(engineStrength, 0.0, 1.0));
    colour *= 1.0 - min(engineStrength * 0.35, 0.55);
  } else {
    // A second structure at another pitch, beating against the first. The beat
    // is the subject, so what it modulates is the picture's own colour rather
    // than a palette the picture does not have.
    float second = fract(scaled * max(enginePitch, 0.01));
    float secondMask = 1.0 - smoothstep(0.0, 0.5, abs(second - 0.5));
    colour = mix(colour, abs(colour - vec3(secondMask)), engineStrength);
  }

  return vec4(colour, sampled.a);
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
        { defaultValue: 0, name: "driftAngle", type: "float" },
        { defaultValue: 0, name: "driftPhase", type: "float" },
        {
          defaultValue: 0,
          name: "driftShape",
          // The index into this list is the float the shader branches on. A
          // select whose values are not mapped here falls to zero and the
          // control moves nothing.
          optionValues: ["steady", "eased", "swing"],
          type: "float",
        },
        { booleanControl: true, defaultValue: 0, name: "flipX", type: "float" },
        { booleanControl: true, defaultValue: 0, name: "flipY", type: "float" },
        { defaultValue: 0, name: "pointerPush", type: "float" },
        {
          defaultValue: 0,
          name: "rampType",
          // Order matches the branch order in `CHUNK_GRADIENT_BODY`.
          optionValues: ["linear", "radial", "angular"],
          type: "float",
        },
        /**
         * Where the ramp starts, as a shift along its own axis (9A.3).
         *
         * Named `phase` because it is the stripes' `phase` applied to the other
         * kind of field: one control, `Offset`, shifts a band sequence along
         * its axis and a ramp along its own. Two names for one operation would
         * have meant two controls for it, which is the arrangement this product
         * retires wherever it finds it.
         *
         * The ramp is read at a position the shape supplies -- across the frame
         * for the linear form, out from the centre for the radial, round it for
         * the angular -- and until this existed that position always began at
         * the edge. Turning the angle was the only way to move a transition,
         * which moves the whole field to reposition one seam.
         *
         * A shift rather than a wrap, because `studioPaletteRamp` clamps: the
         * ends hold their own colour as the ramp slides past, so an offset
         * cannot open a hard seam in a form that has none. The angular ramp
         * wraps anyway, being periodic, which is the one place a shift reads as
         * a rotation -- and there it is exactly what a reader would expect.
         */
        { defaultValue: 0, name: "phase", type: "float" },
        { defaultValue: 2, name: "paletteSlots", type: "float" },
        // How the layer is printed: the screen it is cut through, the grain it
        // is sampled at, and whether its colours are held to its own inks.
        { defaultValue: 0, name: "pixelBlock", type: "float" },
        { defaultValue: 0, name: "channelSplit", type: "float" },
        { defaultValue: 0, name: "quantize", type: "float" },
        { defaultValue: 12, name: "halftoneCell", type: "float" },
        { defaultValue: 0, name: "halftoneAngle", type: "float" },
        {
          defaultValue: 0,
          name: "halftone",
          // The index into this list is the float the shader branches on.
          optionValues: ["none", "dot", "line", "cross"],
          type: "float",
        },
        {
          defaultValue: 0,
          name: "mixSpace",
          // The index into this list is the float the shader branches on, and
          // a select whose values are not mapped here falls to zero -- the
          // control moves, the record changes, and the frame does not. That is
          // how the blend modes shipped inert once.
          optionValues: ["linear", "srgb", "perceptual"],
          type: "float",
        },
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
        { defaultValue: [0, 0, 1], name: "colorE", type: "vec3" },
        { defaultValue: [0, 0, 1], name: "colorF", type: "vec3" },
        { defaultValue: [0, 0, 1], name: "colorG", type: "vec3" },
        { defaultValue: [0, 0, 1], name: "colorH", type: "vec3" },
      ],
    },
    image: {
      chunk: CHUNK_IMAGE_BODY,
      entryPoint: "studioImageBody",
      id: "image",
      label: "Image",
      uniforms: [
        { defaultValue: 0, name: "imageRotation", type: "float" },
        { booleanControl: true, defaultValue: 0, name: "imageFlipX", type: "float" },
        { booleanControl: true, defaultValue: 0, name: "imageFlipY", type: "float" },
        { booleanControl: true, defaultValue: 0, name: "flipX", type: "float" },
        { booleanControl: true, defaultValue: 0, name: "flipY", type: "float" },
        /**
         * The chromatic engine over a picture, named exactly as it is over a
         * band field so that one control edits either and an entry applied to
         * an image carries the same engine it would carry anywhere else.
         *
         * Order here is the contract with the branch order in the body and with
         * the option order of the control, all three of which have to agree.
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
        // Last, and valueless: the texture is bound from decoded media rather
        // than read out of the record.
        {
          // How the source is read. Picture draws it; the other two turn it into
          // a band field, which is what makes an import a *source* rather than a
          // decoration. Order is the contract with the body's branches.
          defaultValue: 0,
          name: "sourceMapping",
          optionValues: ["picture", "width", "phase"],
          type: "float",
        },
        { defaultValue: 48, name: "sourceCount", type: "float" },
        { defaultValue: 0.5, name: "sourceWidthRatio", type: "float" },
        { defaultValue: 1, name: "sourceStrength", type: "float" },
        { defaultValue: 2, name: "paletteSlots", type: "float" },
        // How the layer is printed: the screen it is cut through, the grain it
        // is sampled at, and whether its colours are held to its own inks.
        { defaultValue: 0, name: "pixelBlock", type: "float" },
        { defaultValue: 0, name: "channelSplit", type: "float" },
        { defaultValue: 0, name: "quantize", type: "float" },
        { defaultValue: 12, name: "halftoneCell", type: "float" },
        { defaultValue: 0, name: "halftoneAngle", type: "float" },
        {
          defaultValue: 0,
          name: "halftone",
          // The index into this list is the float the shader branches on.
          optionValues: ["none", "dot", "line", "cross"],
          type: "float",
        },
        {
          defaultValue: 0,
          name: "mixSpace",
          // The index into this list is the float the shader branches on, and
          // a select whose values are not mapped here falls to zero -- the
          // control moves, the record changes, and the frame does not. That is
          // how the blend modes shipped inert once.
          optionValues: ["linear", "srgb", "perceptual"],
          type: "float",
        },
        { defaultValue: [0, 0, 0], name: "colorA", type: "vec3" },
        { defaultValue: [1, 1, 1], name: "colorB", type: "vec3" },
        { defaultValue: [1, 1, 1], name: "colorC", type: "vec3" },
        { defaultValue: [1, 1, 1], name: "colorD", type: "vec3" },
        { defaultValue: [1, 1, 1], name: "colorE", type: "vec3" },
        { defaultValue: [1, 1, 1], name: "colorF", type: "vec3" },
        { defaultValue: [1, 1, 1], name: "colorG", type: "vec3" },
        { defaultValue: [1, 1, 1], name: "colorH", type: "vec3" },
        { defaultValue: 0, name: "image", type: "sampler2D" },
      ],
    },
    stripes: {
      chunk: CHUNK_STRIPES_BODY,
      entryPoint: "studioStripesBody",
      id: "stripes",
      label: "Stripes",
      uniforms: [
        { defaultValue: 0, name: "angle", type: "float" },
        { defaultValue: 0, name: "driftAngle", type: "float" },
        { defaultValue: 0, name: "driftPhase", type: "float" },
        {
          defaultValue: 0,
          name: "driftShape",
          // The index into this list is the float the shader branches on. A
          // select whose values are not mapped here falls to zero and the
          // control moves nothing.
          optionValues: ["steady", "eased", "swing"],
          type: "float",
        },
        { defaultValue: 24, name: "count", type: "float" },
        { defaultValue: 0.5, name: "widthRatio", type: "float" },
        { defaultValue: 0, name: "phase", type: "float" },
        { booleanControl: true, defaultValue: 0, name: "mirror", type: "float" },
        { booleanControl: true, defaultValue: 0, name: "flipX", type: "float" },
        { booleanControl: true, defaultValue: 0, name: "flipY", type: "float" },
        { defaultValue: 0, name: "pointerPush", type: "float" },
        { defaultValue: 0, name: "taper", type: "float" },
        { defaultValue: 0, name: "separator", type: "float" },
        { defaultValue: 0, name: "jitterAmount", type: "float" },
        /**
         * Which arrangement of displacements the jitter draws, as distinct
         * from how far it moves each band.
         *
         * Named for what it does rather than for what it was. Croix10's
         * `jitterFrequency` scaled a noise coordinate *along* the band, so the
         * rate at which a band wobbled down its own length was a real,
         * continuous thing to control. This field's jitter is per band index
         * instead -- that is what keeps bands as bands rather than dissolving
         * them into noise -- and the index goes through a hash, so neighbouring
         * bands never correlate at any value. There is no rate left to set;
         * what remains is the choice of arrangement, and calling that a
         * frequency would be a control that lies (R65's rule).
         *
         * Stepped whole numbers for the same reason: each position is a
         * different arrangement rather than more of anything, so ticks say what
         * a continuous track would misstate.
         *
         * 14.x deferred exposing this at all, on the ground that its only
         * observable is the arrangement itself and asserting one would pin a
         * fingerprint. The proof it lands with is differential instead: the
         * same number of bands in different places, which needs no fingerprint
         * and holds on any backing.
         */
        { defaultValue: 12, name: "jitterVariation", type: "float" },
        { defaultValue: 2, name: "paletteSlots", type: "float" },
        // How the layer is printed: the screen it is cut through, the grain it
        // is sampled at, and whether its colours are held to its own inks.
        { defaultValue: 0, name: "pixelBlock", type: "float" },
        { defaultValue: 0, name: "channelSplit", type: "float" },
        { defaultValue: 0, name: "quantize", type: "float" },
        { defaultValue: 12, name: "halftoneCell", type: "float" },
        { defaultValue: 0, name: "halftoneAngle", type: "float" },
        {
          defaultValue: 0,
          name: "halftone",
          // The index into this list is the float the shader branches on.
          optionValues: ["none", "dot", "line", "cross"],
          type: "float",
        },
        {
          defaultValue: 0,
          name: "mixSpace",
          // The index into this list is the float the shader branches on, and
          // a select whose values are not mapped here falls to zero -- the
          // control moves, the record changes, and the frame does not. That is
          // how the blend modes shipped inert once.
          optionValues: ["linear", "srgb", "perceptual"],
          type: "float",
        },
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
        { defaultValue: [0, 0, 1], name: "colorE", type: "vec3" },
        { defaultValue: [0, 0, 1], name: "colorF", type: "vec3" },
        { defaultValue: [0, 0, 1], name: "colorG", type: "vec3" },
        { defaultValue: [0, 0, 1], name: "colorH", type: "vec3" },
      ],
    },
  };

export const STUDIO_LAYER_TYPE_IDS: readonly StudioLayerTypeId[] = [
  "stripes",
  "gradient",
  "image",
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
  readonly vertices?: readonly StudioVertexPoint[];
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
        // *Whether* a layer has a drawn region, never what it is.
        //
        // The path used to be compiled in as literals, so every edit was a
        // different program and the key had to carry the whole shape. It is a
        // texture now, so a moved node changes a uniform and nothing else --
        // and keying on the contents would recompile the entire stack on every
        // point of a stroke, which at a few thousand points is a program
        // rebuilt a few thousand times to draw one line.
        //
        // What still changes the program is the region existing at all, since
        // that is what decides whether the sampling function is emitted.
        return `${entry.typeId}${(entry.vertices?.length ?? 0) >= 2 ? "#path" : ""}`;
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
 * Where one drawn region reads from its mask.
 *
 * **This was a point-in-polygon test over baked literals**, walking every edge
 * of the path at every pixel to count ray crossings. It was correct and it was
 * the reason a path could hold only two dozen nodes: each node cost a line of
 * program and an iteration of an unrolled loop *per pixel*, so the cost of
 * drawing was paid again on every pixel of every frame, and curves -- several
 * cubic evaluations per segment on top -- were out of the question entirely.
 *
 * Now the path is rasterized once into a mask and this reads one texel. Per
 * pixel cost is constant in the node count, which is what lets a path hold
 * thousands of nodes and a bézier at each of them, and the rasterizer's own
 * antialiasing replaces an edge that used to come back as a hard staircase.
 *
 * One function per layer still, because each reads its own box and its own tile
 * of the shared atlas -- one texture unit for the whole stack, which is what
 * WebGL2's sixteen-unit guarantee leaves room for once each layer has spent one
 * on its picture.
 */
function pathFunction(entry: StudioStackEntry, index: number): string {
  const vertices = entry.vertices ?? [];
  if (vertices.length < 2) return "";

  return `
/**
 * Where this layer's mask sits, and what it covers.
 *
 * Declared beside the function rather than in the layer uniform registry,
 * because these are not parameters -- nobody sets them and no control writes
 * them. They are the rasterizer describing what it produced, which is why they
 * are derived from the path on every upload rather than carried in the record.
 */
uniform vec2 ${studioLayerUniformName(index, "pathOrigin")};
uniform vec2 ${studioLayerUniformName(index, "pathExtent")};
uniform vec4 ${studioLayerUniformName(index, "pathTile")};

float studioPathInside${index}(vec2 point) {
  vec2 uv = (point - ${studioLayerUniformName(index, "pathOrigin")}) /
    max(${studioLayerUniformName(index, "pathExtent")}, vec2(0.0001));
  // Outside the box the mask was rasterized over there is nothing drawn, and
  // saying so explicitly rather than relying on clamped sampling is what stops
  // the tile's edge pixels from smearing across the rest of the frame.
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  vec4 tile = ${studioLayerUniformName(index, "pathTile")};
  // The raster's y runs down and the shape frame's runs up.
  vec2 atlas = tile.xy + vec2(uv.x, 1.0 - uv.y) * tile.zw;
  return texture(uStudioPathMask, atlas).r;
}
`;
}

/**
 * The print uniforms, which the wrapper reads and no body takes.
 *
 * A body draws a field; a screen, a grain and a quantization act on what it
 * drew. Passing them positionally to the body would be handing it five values
 * it has no parameters for -- which is exactly what happened when they were
 * added to the registry and not excluded here, and the shader stopped
 * compiling for every stack at once.
 */
const STUDIO_PRINT_UNIFORMS = new Set([
  "channelSplit",
  "halftone",
  "halftoneAngle",
  "halftoneCell",
  "pixelBlock",
  "quantize",
]);

/** The ink uniforms, in cycle order. Also the order the bank is built in. */
export const STUDIO_PALETTE_UNIFORMS = Array.from(
  { length: STUDIO_PALETTE_MAX },
  (_slot, index) => `color${String.fromCharCode(65 + index)}`,
);

function compositeLayer(entry: StudioStackEntry, index: number): string {
  const type = STUDIO_LAYER_TYPES[entry.typeId];
  const palette = new Set(STUDIO_PALETTE_UNIFORMS);
  /**
   * The inks, gathered into one array argument.
   *
   * The wrapper passes uniforms positionally, so the bank takes the place of
   * the first ink and the rest drop out of the list -- which is what lets a
   * body's signature say "the palette" once instead of naming every slot and
   * growing by one parameter per ink.
   */
  const args = type.uniforms
    .flatMap((uniform) =>
      palette.has(uniform.name)
        ? uniform.name === STUDIO_PALETTE_UNIFORMS[0]
          ? ["bank"]
          : []
        : STUDIO_PRINT_UNIFORMS.has(uniform.name)
          ? []
          : [studioLayerUniformName(index, uniform.name)],
    )
    .join(", ");
  const name = (suffix: string): string => studioLayerUniformName(index, suffix);
  const reach = `${name("visible")} * maskCoverage`;
  const weight = `${name("opacity")} * layerReach`;

  const aspect = `max(${name("maskAspect")}, 0.01)`;
  const hasAngle = type.uniforms.some((uniform) => uniform.name === "angle");
  /**
   * The body call, as an expression rather than a statement.
   *
   * Named because the channel split reads the layer again at displaced
   * positions, and three hand-written copies of a call with this many
   * positional arguments is three places for one of them to drift.
   */
  const bodyCall = (position: string): string =>
    `${type.entryPoint}(${position}, uResolution, uCursor, uLoop${
      // Only the image type takes the shape's frame. The procedural bodies are
      // fields over the whole canvas that the mask then confines, which is the
      // right model for them -- a stripe field does not "belong to" its shape
      // the way a picture does.
      entry.typeId === "image" ? `, maskLocal, maskWidth, ${name("maskSize")}` : ""
    }${args ? `, ${args}` : ""})`;
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

    ${
      type.uniforms.some((uniform) => palette.has(uniform.name))
        ? `vec3 bank[PALETTE_MAX] = vec3[PALETTE_MAX](${STUDIO_PALETTE_UNIFORMS.map(
            (slot) => studioLayerUniformName(index, slot),
          ).join(", ")});`
        : ""
    }
    /**
     * The source, snapped to a grid before anything reads it.
     *
     * Pixelation is applied *upstream* of the body rather than to what the body
     * produced, and that is the difference between pixelating the work and
     * blurring it into squares: a field read at one point per block is a field
     * genuinely sampled coarsely, where averaging the output afterwards would
     * be a picture of the field with its detail smeared rather than absent.
     *
     * It therefore necessarily precedes halftone and quantization, which act on
     * what comes back. The declared order of the three effects is about what
     * happens after the body; this happens before it, and could not be ordered
     * any other way.
     */
    float pixelBlock = ${name("pixelBlock")};
    vec2 sourcePosition = pixelBlock < 0.5
      ? fragmentPosition
      : floor(fragmentPosition / pixelBlock) * pixelBlock + pixelBlock * 0.5;

    vec4 layer = ${bodyCall("sourcePosition")};

    /**
     * The primaries displaced against each other along the axis the field is
     * read on, which is what a mis-registered print does.
     *
     * The layer is *re-read* at two displaced positions rather than having its
     * output smeared, and that is the difference between a misregistration and
     * a blur: a plate laid down slightly off prints the same image somewhere
     * else, so what the red channel shows is genuinely the field a little to
     * one side. Smearing the colour that was already computed would produce a
     * fringe that no plate could make.
     *
     * The cost is honest and worth stating: while the split is on, the body is
     * evaluated three times for that layer instead of once. It is guarded by a
     * branch, so a layer with no split pays one comparison, and it is bounded
     * by a constant rather than by any control's value.
     *
     * The centre sample keeps its alpha. Inside a shape that is what a plate
     * does -- the ink shifts, the paper does not -- and taking the displaced
     * alphas would fray the layer's own edge into three.
     */
    float channelSplit = ${name("channelSplit")};
    if (channelSplit > 0.0) {
      // Up to two percent of the frame's height, which is a misregistration
      // rather than a special effect: past that the primaries stop reading as
      // one image printed badly and start reading as three images.
      float splitReach = channelSplit * 0.02 * uResolution.y;
      float splitAngle = radians(${hasAngle ? name("angle") : "0.0"});
      vec2 splitAxis = vec2(cos(splitAngle), sin(splitAngle)) * splitReach;
      vec4 splitLow = ${bodyCall("sourcePosition - splitAxis")};
      vec4 splitHigh = ${bodyCall("sourcePosition + splitAxis")};
      layer = vec4(splitLow.r, layer.g, splitHigh.b, layer.a);
    }
    /**
     * Halftone, then quantization, in the order the spec declares.
     *
     * Halftone decides *how much* of the mark is there and quantization decides
     * which ink it is, so quantizing first would snap a tone the halftone is
     * about to turn into coverage -- the screen would be reading an ink rather
     * than the tone that chose it.
     *
     * The tone is the layer's own luminance at Rec. 709 weights, because the
     * value being read is linear light. Coverage multiplies alpha rather than
     * painting paper: what shows between the marks is whatever sits beneath,
     * which is the same reading a band separator has.
     */
    float halftoneTone = dot(layer.rgb, vec3(0.2126, 0.7152, 0.0722));
    layer.a *= studioHalftone(
      sourcePosition,
      ${name("halftone")},
      ${name("halftoneCell")},
      ${name("halftoneAngle")},
      halftoneTone
    );
    ${
      type.uniforms.some((uniform) => palette.has(uniform.name))
        ? `if (${name("quantize")} > 0.5) {
      layer.rgb = studioQuantizeToBank(layer.rgb, bank, ${name("paletteSlots")});
    }`
        : ""
    }

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
/**
 * Where the loop has got to, from 0 at its start to 1 at its end.
 *
 * A fraction rather than a time, so the shader needs no notion of how long a
 * loop is and a recipient can drive it with anything that ramps. Drift rates are
 * whole cycles per loop, so at 1 every drifting value has advanced an exact
 * number of cycles and lands back where it started -- which is what makes the
 * seam invisible without the shader knowing anything about seams.
 */
uniform float uLoop;
${
  stack.some((entry) => (entry.vertices?.length ?? 0) >= 2)
    ? `
/**
 * Every drawn region in this stack, rasterized into one texture.
 *
 * One sampler for the whole stack rather than one per layer: WebGL2 guarantees
 * a fragment shader only sixteen texture units, and each layer already spends
 * one on its picture at a declared depth of sixteen. Each region reads its own
 * tile, named by that layer's own uniforms.
 *
 * This is where a drawn region parts company with the rest of the delivered
 * source. Everything else in this program is self-contained; a mask is an
 * image, so a host that wants the region has to supply it.
 */
uniform sampler2D uStudioPathMask;`
    : ""
}

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
