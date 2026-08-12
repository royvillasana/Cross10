import {
  studioLayerUniformName,
  studioLayerUniforms,
  type StudioLayerUniform,
} from "./studio-layers";
import { studioAssembleStackFragmentShader } from "./studio-layers";
import type { StudioStackSceneParameters } from "./studio-stack-render";

/**
 * The delivered artifact: a fragment shader that runs where it is pasted.
 *
 * **R53 — a runnable module, not a bare fragment shader.** The product exists to
 * hand someone a script they can put wherever they want, and a bare body whose
 * fifty per-layer uniforms must be discovered and wired by hand is not that. So
 * every parameter arrives baked in at its current value, and the only input left
 * is `uResolution` — the one thing the destination genuinely owns and the studio
 * cannot know.
 *
 * They are emitted as named `const` declarations rather than inlined literals so
 * the result stays editable at the other end: an author can change
 * `uLayer0_count` in place and see the field respond, which is the difference
 * between a delivered shader and a screenshot of one.
 *
 * The source is produced by baking values into the *same* program the preview
 * compiles rather than by assembling a second one. A separate delivery assembler
 * would be a second chance to disagree with what the author is looking at, and
 * disagreement there is invisible until someone runs the file somewhere else.
 *
 * Current values, not stored ones: the scene is built from live runtime state,
 * so what is delivered is what the author has edited the stack to, not whatever
 * a preset first loaded.
 */

/**
 * A GLSL float literal.
 *
 * Always carries a decimal point: GLSL has no implicit int-to-float conversion in
 * a `const float` initialiser, so `1` is a compile error where `1.0` is not.
 */
function glslFloat(value: number): string {
  if (!Number.isFinite(value)) return "0.0";
  const rounded = Math.round(value * 1e6) / 1e6;
  return Number.isInteger(rounded) ? `${rounded}.0` : String(rounded);
}

function glslLiteral(
  uniform: StudioLayerUniform,
  value: number | readonly [number, number, number] | undefined,
): string {
  if (uniform.type === "vec3") {
    const triple = Array.isArray(value)
      ? (value as readonly [number, number, number])
      : (uniform.defaultValue as readonly [number, number, number]);
    return `vec3(${triple.map(glslFloat).join(", ")})`;
  }

  return glslFloat(
    typeof value === "number" ? value : (uniform.defaultValue as number),
  );
}

/** Replaces one `uniform` declaration with an initialised `const` of the same name. */
function bake(source: string, type: string, name: string, literal: string): string {
  return source.replace(
    `uniform ${type} ${name};`,
    `const ${type} ${name} = ${literal};`,
  );
}

/**
 * Assembles the deliverable source for a scene.
 *
 * Takes the same `StudioStackSceneParameters` the renderer draws, so the
 * delivered file describes exactly the frame on screen.
 */
export function studioAssembleDeliverableSource(
  scene: StudioStackSceneParameters,
): string {
  const stack = scene.layers.map((layer) => ({ typeId: layer.typeId }));
  let source = studioAssembleStackFragmentShader(stack);

  scene.layers.forEach((layer, index) => {
    for (const uniform of studioLayerUniforms(layer.typeId)) {
      source = bake(
        source,
        uniform.type,
        studioLayerUniformName(index, uniform.name),
        glslLiteral(uniform, layer.values[uniform.name]),
      );
    }
  });

  source = bake(
    source,
    "vec3",
    "uBackgroundColor",
    `vec3(${scene.backgroundColor.map(glslFloat).join(", ")})`,
  );
  source = bake(
    source,
    "float",
    "uIncludeBackground",
    glslFloat(scene.includeBackground ? 1 : 0),
  );

  return source;
}
