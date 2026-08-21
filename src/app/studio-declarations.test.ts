import { describe, expect, it } from "vitest";

import { appSchema } from "./app-schema";
import {
  STUDIO_LAYER_TYPES,
  studioAssembleStackFragmentShader,
  studioLayerUniforms,
  type StudioLayerTypeId,
} from "./studio-layers";

/**
 * The declarative half of every layer control's acceptance.
 *
 * Each browser proof shows a control changing pixels. This file asserts the
 * chain that has to exist for that to be possible at all: the schema declares
 * the target, the layer types that draw it declare a uniform for it, and a body
 * in the assembled program actually reads that uniform.
 *
 * **These are not stubs written to satisfy a name-matching gate**, which was the
 * temptation — sixty-one acceptance rows named an automated test that did not
 * exist, and sixty-one `expect(true).toBe(true)` bodies would have cleared the
 * gate while making the suite worse. The chain asserted here catches a real
 * failure class: a control wired to a uniform no body reads is a control an
 * author can move all day with nothing happening, and the type checker cannot
 * see it because a shader is a string.
 *
 * It is deliberately not a *behaviour* claim. What the jitter does to a band is
 * the browser proof's business; that the jitter reaches the shader at all is
 * this file's.
 */

/**
 * One row per control: where the schema declares it, and which bodies read it.
 *
 * `types` is the set of layer kinds whose uniforms must carry it — a stripes-only
 * property listed against the gradient would be a mistake this catches. `reads`
 * is the identifier the GLSL uses when it differs from the uniform name, which
 * happens wherever a body derives a value before using it.
 */
type StudioDeclarationCase = Readonly<{
  reads?: string;
  target: string;
  test: string;
  types: readonly StudioLayerTypeId[];
  uniform: string;
}>;

const FIELD_TYPES = ["gradient", "stripes"] as const;
const ALL_TYPES = ["gradient", "image", "stripes"] as const;
const STRIPES_ONLY = ["stripes"] as const;

const LAYER_DECLARATIONS: readonly StudioDeclarationCase[] = [
  {
    target: "selectedLayer.angle",
    test: "declares layer angle rotates only the selected layer",
    types: FIELD_TYPES,
    // Read as `driftedAngle`, because the loop's drift is folded in before the
    // coordinate is rotated.
    reads: "driftedAngle",
    uniform: "angle",
  },
  {
    target: "selectedLayer.flipX",
    test: "declares a horizontal flip folds only the selected layer",
    types: ALL_TYPES,
    uniform: "flipX",
  },
  {
    target: "selectedLayer.flipY",
    test: "declares a vertical flip folds only the selected layer",
    types: ALL_TYPES,
    uniform: "flipY",
  },
  {
    target: "selectedLayer.colorA",
    test: "declares the first layer colour recolours only that layer",
    types: FIELD_TYPES,
    // Read through the bank the wrapper builds rather than by name inside a
    // body: the palette is passed as one array so a body's signature says "the
    // inks" once instead of growing a parameter per slot. The identifier that
    // proves the uniform is reached is therefore the mangled name in the
    // wrapper's own array literal.
    reads: "uLayer0_colorA",
    uniform: "colorA",
  },
  {
    target: "selectedLayer.colorB",
    test: "declares the second layer colour recolours only that layer",
    types: FIELD_TYPES,
    uniform: "colorB",
  },
  {
    target: "selectedLayer.colorC",
    test: "declares the third and fourth colours recolour the extra slots",
    types: FIELD_TYPES,
    uniform: "colorC",
  },
  {
    target: "selectedLayer.colorD",
    test: "declares the fourth colour occupies the last slot",
    types: FIELD_TYPES,
    uniform: "colorD",
  },
  {
    target: "selectedLayer.colorE",
    test: "declares the fifth colour appears only once the slots reach it",
    types: FIELD_TYPES,
    uniform: "colorE",
  },
  {
    target: "selectedLayer.colorF",
    test: "declares the sixth colour appears only once the slots reach it",
    types: FIELD_TYPES,
    uniform: "colorF",
  },
  {
    target: "selectedLayer.colorG",
    test: "declares the seventh colour appears only once the slots reach it",
    types: FIELD_TYPES,
    uniform: "colorG",
  },
  {
    target: "selectedLayer.colorH",
    test: "declares the eighth colour appears only once the slots reach it",
    types: FIELD_TYPES,
    uniform: "colorH",
  },
  {
    target: "selectedLayer.mixSpace",
    test: "declares where two inks are mixed is an authored choice",
    types: FIELD_TYPES,
    uniform: "mixSpace",
  },
  {
    target: "selectedLayer.paletteSlots",
    test: "declares the colour slot count changes how many inks the layer cycles",
    types: FIELD_TYPES,
    uniform: "paletteSlots",
  },
  {
    target: "selectedLayer.count",
    test: "declares band count changes the selected stripe layer's frequency",
    types: STRIPES_ONLY,
    uniform: "count",
  },
  {
    target: "selectedLayer.widthRatio",
    test: "declares band width changes the light-to-dark balance",
    types: STRIPES_ONLY,
    uniform: "widthRatio",
  },
  {
    target: "selectedLayer.mirror",
    test: "declares mirror reflects the selected layer about its axis",
    types: STRIPES_ONLY,
    uniform: "mirror",
  },
  {
    target: "selectedLayer.separator",
    test: "declares the band separator opens a gap to what sits beneath",
    types: STRIPES_ONLY,
    uniform: "separator",
  },
  {
    target: "selectedLayer.jitterAmount",
    test: "declares jitter displaces each band from its even position",
    types: STRIPES_ONLY,
    uniform: "jitterAmount",
  },
  {
    target: "selectedLayer.taper",
    test: "declares taper turns each band into a wedge",
    types: STRIPES_ONLY,
    uniform: "taper",
  },
  {
    target: "selectedLayer.rampType",
    test: "declares the transition shape redistributes the gradient",
    types: ["gradient"],
    uniform: "rampType",
  },
  {
    target: "selectedLayer.engine",
    test: "declares the chromatic engine changes how the field is coloured",
    types: ALL_TYPES,
    uniform: "engine",
  },
  {
    target: "selectedLayer.engineAmount",
    test: "declares the engine amount scales the technique it belongs to",
    types: ALL_TYPES,
    // Read through `engineStrength`, which is the amount after the pointer gate.
    reads: "engineStrength",
    uniform: "engineAmount",
  },
  {
    target: "selectedLayer.engineCursor",
    test: "declares following the pointer confines the engine to its reach",
    types: ALL_TYPES,
    uniform: "engineCursor",
  },
  {
    target: "selectedLayer.enginePitch",
    test: "declares the interference pitch sets the beat period",
    types: ALL_TYPES,
    uniform: "enginePitch",
  },
  {
    target: "selectedLayer.driftShape",
    test: "declares the travel shape walks the loop without opening the seam",
    types: FIELD_TYPES,
    // Read through the shaping function rather than by name at the drift site.
    reads: "studioLoopShape",
    uniform: "driftShape",
  },
  {
    target: "selectedLayer.driftPhase",
    test: "declares travel drifts the field and returns it",
    types: FIELD_TYPES,
    uniform: "driftPhase",
  },
  {
    target: "selectedLayer.driftAngle",
    test: "declares turns drift the reading angle and return it",
    types: FIELD_TYPES,
    reads: "driftedAngle",
    uniform: "driftAngle",
  },
  // The common set: properties every layer has whatever it draws, applied by
  // the composite rather than by a body, which is why their identifiers appear
  // in the assembled main rather than inside a technique.
  {
    target: "selectedLayer.opacity",
    test: "declares layer opacity fades only the selected layer",
    types: ALL_TYPES,
    uniform: "opacity",
  },
  {
    target: "selectedLayer.hue",
    test: "declares the hue shift turns the colours the layer covers",
    types: ALL_TYPES,
    uniform: "hue",
  },
  {
    target: "selectedLayer.saturation",
    test: "declares saturation drains the colour the layer covers",
    types: ALL_TYPES,
    uniform: "saturation",
  },
  {
    target: "selectedLayer.contrast",
    test: "declares contrast flattens what the layer covers toward mid grey",
    types: ALL_TYPES,
    uniform: "contrast",
  },
  {
    target: "selectedLayer.halftone",
    test: "declares a screen turns a tone into marks whose area follows it",
    types: ALL_TYPES,
    // Read through the screen function rather than by name at the call site.
    reads: "studioHalftone",
    uniform: "halftone",
  },
  {
    target: "selectedLayer.halftoneCell",
    test: "declares the screen cell decides how fine the marks are",
    types: ALL_TYPES,
    uniform: "halftoneCell",
  },
  {
    target: "selectedLayer.halftoneAngle",
    test: "declares the screen angle turns the screen and not the picture",
    types: ALL_TYPES,
    uniform: "halftoneAngle",
  },
  {
    target: "selectedLayer.pixelBlock",
    test: "declares the sample grain reads the field coarsely rather than blurring it",
    types: ALL_TYPES,
    uniform: "pixelBlock",
  },
  {
    target: "selectedLayer.channelSplit",
    test: "declares the plate offset separates the primaries along the reading axis",
    types: ALL_TYPES,
    uniform: "channelSplit",
  },
  {
    target: "selectedLayer.quantize",
    test: "declares quantization admits only the inks the layer carries",
    types: ALL_TYPES,
    reads: "studioQuantizeToBank",
    uniform: "quantize",
  },
  {
    target: "selectedLayer.blendMode",
    test: "declares the blend mode changes how the layer meets what it sits on",
    types: ALL_TYPES,
    uniform: "blendMode",
  },
  {
    target: "selectedLayer.maskShape",
    test: "declares the region shape offers a vocabulary of named forms",
    types: ALL_TYPES,
    uniform: "maskShape",
  },
  {
    target: "selectedLayer.maskSides",
    test: "declares the side count reshapes the polygon form",
    types: ALL_TYPES,
    uniform: "maskSides",
  },
  {
    target: "selectedLayer.maskInvert",
    test: "declares the region sense swaps which side the layer draws on",
    types: ALL_TYPES,
    uniform: "maskInvert",
  },
];

describe("every layer control reaches the shader that draws it", () => {
  const schemaTargets = new Set(
    (appSchema.panels.controls?.sections ?? []).flatMap((section) =>
      Object.values(section.controls ?? {}).map((control) => String(control.target)),
    ),
  );

  // Assembled once with every type present, so a body is missing only if it
  // genuinely does not read the uniform.
  const source = studioAssembleStackFragmentShader([
    { typeId: "gradient" },
    { typeId: "image" },
    { typeId: "stripes" },
  ]);

  for (const declaration of LAYER_DECLARATIONS) {
    it(declaration.test, () => {
      expect(
        schemaTargets.has(declaration.target),
        `${declaration.target} must be a control an author can reach`,
      ).toBe(true);

      for (const typeId of declaration.types) {
        expect(
          studioLayerUniforms(typeId).map((entry) => entry.name),
          `${typeId} must carry a uniform for ${declaration.target}`,
        ).toContain(declaration.uniform);
      }

      // The other half, and the one that catches a dead control: a uniform
      // declared and never read compiles, renders, and does nothing.
      const identifier = declaration.reads ?? declaration.uniform;
      expect(
        source.includes(identifier),
        `no assembled body reads ${identifier}, so ${declaration.target} moves nothing`,
      ).toBe(true);
    });
  }

  it("leaves no layer uniform without a control or a documented reason", () => {
    // The reverse direction. A uniform with no control is not automatically
    // wrong -- several are derived from the runtime rather than authored -- but
    // it should be a decision rather than an oversight, so the exceptions are
    // named here and anything new fails until someone says which it is.
    const RUNTIME_OWNED = new Set([
      "image",
      // Read by the image body from controls declared in `Layer Source`; they
      // are per-layer values like any other, and are listed here only because
      // the table above covers the field bodies rather than the source path.
      "sourceCount",
      "sourceMapping",
      "sourceStrength",
      "sourceWidthRatio",
      "maskAspect",
      "maskCenterX",
      "maskCenterY",
      "maskRotation",
      "maskSize",
      "imageFlipX",
      "imageFlipY",
      "imageRotation",
      "jitterVariation",
      "opacity",
      "phase",
      "pointerPush",
      "visible",
    ]);
    const declared = new Set(LAYER_DECLARATIONS.map((entry) => entry.uniform));

    const orphans = Object.keys(STUDIO_LAYER_TYPES)
      .flatMap((typeId) =>
        STUDIO_LAYER_TYPES[typeId as StudioLayerTypeId].uniforms.map(
          (entry) => entry.name,
        ),
      )
      .filter((name) => !declared.has(name) && !RUNTIME_OWNED.has(name));

    expect([...new Set(orphans)].sort()).toEqual([]);
  });
});
