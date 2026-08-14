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
    // much of it reaches the composite, whether it is shown, the region it is
    // confined to, and what it does to the picture beneath it.
    const uniforms = studioLayerUniforms("gradient").map((entry) => entry.name);

    expect(uniforms).toEqual([
      ...STUDIO_LAYER_TYPES.gradient.uniforms.map((entry) => entry.name),
      "opacity",
      "visible",
      "maskSize",
      "maskAspect",
      "maskCenterX",
      "maskCenterY",
      "maskShape",
      "maskSides",
      "maskRotation",
      "maskInvert",
      "hue",
      "saturation",
      "contrast",
      "blendMode",
    ]);
  });

  it("declares the jitter variation where the stripe body reads it", () => {
    // Uniforms reach a body positionally, so a name that drifts out of step
    // with the parameter list is not a compile error -- it is a layer drawing
    // one value where it meant another, silently. This checks the one thing
    // that keeps them in step for the newest of them: the wrapper passes
    // `jitterVariation` at exactly the index the body's signature reads it.
    const source = studioAssembleStackFragmentShader([stripes]);
    const uniforms = STUDIO_LAYER_TYPES.stripes.uniforms.map((entry) => entry.name);
    const signature = source.slice(
      source.indexOf("vec4 studioStripesBody("),
      source.indexOf(") {", source.indexOf("vec4 studioStripesBody(")),
    );
    const parameters = signature
      .split("\n")
      .map((line) => line.trim().replace(/^(float|vec2|vec3|sampler2D)\s+/u, ""))
      .map((line) => line.replace(/,$/u, ""));

    expect(uniforms).toContain("jitterVariation");
    // The body takes the frame's own three arguments before the layer's, so the
    // uniform's place in the registry is its place in the signature offset by
    // those three.
    expect(parameters.indexOf("jitterVariation") - parameters.indexOf("angle")).toBe(
      uniforms.indexOf("jitterVariation") - uniforms.indexOf("angle"),
    );
    expect(source).toContain("uniform float uLayer0_jitterVariation;");
  });

  it("declares the offset where each field body reads it", () => {
    // One control over two kinds of field, so the claim is made twice: the
    // offset reaches each body at the index its own registry gives it. And for
    // the gradient there is a second claim worth a test -- it is applied to the
    // ramp coordinate *before* the engines read that coordinate, or an induced
    // fringe would sit on a seam the author has just moved away from.
    const source = studioAssembleStackFragmentShader([stripes, gradient]);
    const placedIn = (body: string, typeId: "gradient" | "stripes"): boolean => {
      const uniforms = STUDIO_LAYER_TYPES[typeId].uniforms.map((entry) => entry.name);
      const opening = source.indexOf(`vec4 ${body}(`);
      const parameters = source
        .slice(opening, source.indexOf(") {", opening))
        .split("\n")
        .map((line) =>
          line.trim().replace(/^(float|vec2|vec3|sampler2D)\s+/u, "").replace(/,$/u, ""),
        );

      return (
        uniforms.includes("phase") &&
        parameters.indexOf("phase") - parameters.indexOf("angle") ===
          uniforms.indexOf("phase") - uniforms.indexOf("angle")
      );
    };

    expect(placedIn("studioStripesBody", "stripes")).toBe(true);
    expect(placedIn("studioGradientBody", "gradient")).toBe(true);
    expect(source).toContain("uniform float uLayer1_phase;");

    // Searched inside the gradient body rather than in the whole program: the
    // stripes body has an engine block of its own and it is emitted first, so a
    // whole-source comparison would be measuring against the wrong one.
    const gradientBody = source.slice(source.indexOf("vec4 studioGradientBody("));
    const applied = gradientBody.indexOf("position += phase;");
    expect(applied).toBeGreaterThan(-1);
    expect(applied).toBeLessThan(gradientBody.indexOf("if (engine >= 0.5)"));
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

    // Reach and opacity are separate since treatment landed: reach carries the
    // lens, opacity carries only the paint. Visibility still folds into the
    // weight rather than branching, which is what this asserts.
    expect(source).toContain("uLayer0_visible * maskCoverage");
    expect(source).toContain("uLayer0_opacity * layerReach");
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
