import { describe, expect, it } from "vitest";

import {
  STUDIO_LAYER_TYPES,
  studioAssembleStackFragmentShader,
  studioLayerUniformName,
  studioLayerUniforms,
  studioStackSignature,
  type StudioStackEntry,
} from "./studio-layers";

const stripes: StudioStackEntry = { typeId: "stripes" };
const gradient: StudioStackEntry = { typeId: "gradient" };

describe("stack signature", () => {
  it("distinguishes the same types in a different order", () => {
    // The whole point of the stack: two layers swapped is a different program,
    // because which one covers the other changed. An engine-shaped key that
    // named only the set of types would collide here and serve a stale program.
    expect(studioStackSignature([stripes, gradient])).not.toBe(
      studioStackSignature([gradient, stripes]),
    );
  });

  it("is stable for an identical stack", () => {
    expect(studioStackSignature([stripes, gradient])).toBe(
      studioStackSignature([{ typeId: "stripes" }, { typeId: "gradient" }]),
    );
  });

  it("names the empty stack rather than producing an empty key", () => {
    // An empty string would compare equal to a missing key and read as a cache
    // hit against whatever was compiled first.
    expect(studioStackSignature([])).toBe("empty");
  });
});

describe("per-layer uniform mangling", () => {
  it("gives every layer its own uniform namespace", () => {
    const source = studioAssembleStackFragmentShader([stripes, stripes]);

    expect(source).toContain("uniform float uLayer0_angle;");
    expect(source).toContain("uniform float uLayer1_angle;");
  });

  it("declares each type's own uniforms plus the common set", () => {
    // The common set carries what belongs to a layer whatever it draws: how
    // much of it reaches the composite, whether it is shown, and the region it
    // is confined to.
    const uniforms = studioLayerUniforms("gradient").map((entry) => entry.name);

    expect(uniforms).toEqual([
      ...STUDIO_LAYER_TYPES.gradient.uniforms.map((entry) => entry.name),
      "opacity",
      "visible",
      "maskSize",
      "maskInvert",
    ]);
  });

  it("mangles by index so two layers of one type never share a uniform", () => {
    expect(studioLayerUniformName(0, "angle")).not.toBe(
      studioLayerUniformName(1, "angle"),
    );
  });
});

describe("stack assembly", () => {
  it("shares one body across repeated layers of the same type", () => {
    const source = studioAssembleStackFragmentShader([stripes, stripes, stripes]);
    const bodyDefinitions = source.split("vec4 studioStripesBody(").length - 1;

    // Three layers, one compiled body. Emitting the field code per instance
    // would triple compile time for a stack a user builds in seconds.
    expect(bodyDefinitions).toBe(1);
    expect(source.split("studioStripesBody(fragmentPosition").length - 1).toBe(3);
  });

  it("omits a type the stack does not use", () => {
    const source = studioAssembleStackFragmentShader([stripes]);

    expect(source).toContain("studioStripesBody");
    expect(source).not.toContain("studioGradientBody");
  });

  it("composites in stack order, lowest index first", () => {
    const source = studioAssembleStackFragmentShader([stripes, gradient]);
    const stripeCall = source.indexOf("studioStripesBody(fragmentPosition");
    const gradientCall = source.indexOf("studioGradientBody(fragmentPosition");

    expect(stripeCall).toBeGreaterThan(-1);
    expect(gradientCall).toBeGreaterThan(stripeCall);
  });

  it("folds visibility into the composite weight rather than branching", () => {
    const source = studioAssembleStackFragmentShader([stripes]);

    expect(source).toContain("uLayer0_opacity * uLayer0_visible");
  });

  it("still assembles a compilable main for an empty stack", () => {
    const source = studioAssembleStackFragmentShader([]);

    expect(source).toContain("void main()");
    expect(source).toContain("fragColor");
  });

  it("carries no reference to the engine chunk registry", () => {
    // Group 7 delivers this source standalone. A reference to the studio's own
    // registry would make delivered source uncompilable outside the app, which
    // is the failure the shader-delivery spec exists to prevent.
    const source = studioAssembleStackFragmentShader([stripes, gradient]);

    expect(source).not.toContain("uEngine");
    expect(source).not.toContain("studioResolveField");
  });
});
