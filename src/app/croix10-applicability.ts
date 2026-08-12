/**
 * Control applicability for the chromatic engines.
 *
 * Shared by the schema assembly and the engine sections it composes, so the gate a
 * control declares cannot drift from the gate its section assumes.
 */

import { CROIX10_STRIPE_ENGINES } from "./croix10-parameters";

/**
 * Controls that only mean something while a stripe engine is selected.
 *
 * Chromosaturation is a full-field wash with no stripe structure, so every stripe
 * control is conditional rather than always applicable. The gate lives in another
 * entity because engine selection crosses every section by nature, which is the
 * recorded exception: its branch behaviour is proved by named Playwright tests
 * instead of derived applicability cases.
 */
export const STRIPE_ENGINE_APPLICABILITY = {
  all: [{ oneOf: [...CROIX10_STRIPE_ENGINES], target: "engine.active" }],
  mode: "conditional",
} as const;

/**
 * The shape's own controls only mean something once an outline is chosen.
 *
 * The gate is the outline selector rather than the strength slider: a continuous
 * slider is not a valid applicability selector, and a discrete outline choice is
 * both legal and clearer. Unlike the engine gate this one lives in the same entity
 * as the controls it gates, so the harness derives real presence and absence cases.
 */
export const SHAPE_ACTIVE_APPLICABILITY = {
  all: [
    { oneOf: [...CROIX10_STRIPE_ENGINES], target: "engine.active" },
    { notEquals: "none", target: "shape.kind" },
  ],
  mode: "conditional",
} as const;

/**
 * The second layer's own controls, gated by the switch that turns the layer on.
 *
 * The gate is in the same section as the controls it gates, so presence and
 * absence are both derivable. The engine predicate is still required: the layer
 * only exists under Chromointerférence, whose whole grammar is the composite.
 */
export const INTERFERENCE_ACTIVE_APPLICABILITY = {
  all: [
    { equals: "chromointerference", target: "engine.active" },
    { equals: true, target: "interference.enabled" },
  ],
  mode: "conditional",
} as const;

export function engineApplicability(engine: string) {
  return {
    all: [{ equals: engine, target: "engine.active" }],
    mode: "conditional",
  } as const;
}


/**
 * The ramp's controls exist only when the ramp is the band colour source.
 *
 * The gate lives in the same section as everything it gates (R34), so the
 * harness derives a real presence case and a real absence case from it rather
 * than the product having to assert them by hand.
 */
export const RAMP_APPLICABILITY = {
  all: [{ equals: "continuous", target: "ramp.source" }],
  mode: "conditional",
} as const;

/**
 * The cursor field's shape controls exist only when the field is on, and the
 * field itself only means anything while the ramp is the colour source.
 *
 * Both conditions rather than just the switch: with the palette active there is
 * no ramp position for the cursor to push, so a Reach slider would be present and
 * inert — the exact state applicability exists to prevent.
 */
export const PROXIMITY_APPLICABILITY = {
  all: [
    { equals: "continuous", target: "ramp.source" },
    { equals: true, target: "proximity.enabled" },
  ],
  mode: "conditional",
} as const;
