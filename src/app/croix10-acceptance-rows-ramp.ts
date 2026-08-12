/**
 * Acceptance rows for the chromatic ramp.
 *
 * Its own file for the reason the engine rows have one: the core row file is at
 * its line budget, and a colour source is a coherent unit to keep together.
 *
 * The gradient row declares coverage for every part the control owns, which is
 * what forced the renderer to consume the gradient's type, angle, and stop
 * opacity rather than reproducing any of them as sibling controls (R23). A part
 * the renderer ignored could not be proved, and the framework would not accept
 * the control without proof of all of them.
 */

import type { ToolcraftComponentAcceptance } from "./acceptance/types";

export const croix10RampAcceptanceRows: readonly ToolcraftComponentAcceptance[] = [
  {
    automated: true,
    automatedTestName: "declares the band colour source switches the field",
    browser: true,
    browserTestName:
      "browser: croix10 band colour source switches between palette and ramp",
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "Switching Band colour from Palette to Continuous recolours the bands from the ramp instead of the palette slots, and switching back restores the palette composition exactly.",
    fixture: "Croix10 at the default palette and the default ramp",
    id: "ramp.source",
    kind: "control",
    optionCoverage: "each-visible-item",
    target: "ramp.source",
    userAction:
      "Set Band colour to Continuous, read the field, then set it back to Palette.",
  },
  {
    automated: true,
    automatedTestName: "declares every ramp part drives the rendered bands",
    browser: true,
    browserTestName: "browser: croix10 ramp type, angle, and stops recolour the bands",
    componentType: "gradient",
    controlPartCoverage: [
      "gradient.gradientType",
      "gradient.angle",
      "gradient.stops.position",
      "gradient.stops.color",
      "gradient.stops.opacity",
    ],
    evidence: "rendered-pixels",
    expectedObservable:
      "Each part of the ramp changes the rendered bands: the type changes how colour is distributed across the field, the angle rotates that distribution, moving a stop moves where its colour lands, recolouring a stop recolours the bands sampling near it, and lowering a stop's opacity lets the background through those bands.",
    fixture: "Croix10 with Band colour set to Continuous",
    id: "ramp.gradient",
    kind: "control",
    target: "ramp.gradient",
    userAction:
      "With the ramp active, change its type, rotate its angle, then move, recolour, and fade one of its stops.",
  },
  {
    automated: true,
    automatedTestName: "declares the ramp mixing space changes the transition",
    browser: true,
    browserTestName: "browser: croix10 ramp mixing space changes the midtones",
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "Mixing in sRGB rather than linear light changes the colours between stops while leaving the stop colours themselves where they are, so the ends of the transition match and its middle does not.",
    fixture: "Croix10 with Band colour set to Continuous",
    id: "ramp.interpolationSpace",
    kind: "control",
    optionCoverage: "each-visible-item",
    target: "ramp.interpolationSpace",
    userAction: "Switch Mixing between Linear light and sRGB.",
  },
  {
    automated: true,
    automatedTestName: "declares the ramp offset slides the transition",
    browser: true,
    browserTestName: "browser: croix10 ramp offset slides the transition",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Offset moves which part of the ramp each band takes, sliding the colour sequence through the field without changing the band geometry.",
    fixture: "Croix10 with Band colour set to Continuous",
    id: "ramp.phase",
    kind: "control",
    target: "ramp.phase",
    userAction: "Drag Offset.",
  },
  {
    automated: true,
    automatedTestName: "declares ramp drift travels the transition across the loop",
    browser: true,
    browserTestName:
      "browser: croix10 ramp drift travels the transition across the loop",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "With Drift above zero, scrubbing the timeline slides the ramp through the bands and the loop's last instant renders its first; at zero the field is identical at every time.",
    fixture: "Croix10 with Band colour set to Continuous",
    id: "ramp.driftCycles",
    kind: "control",
    target: "ramp.driftCycles",
    userAction:
      "Set Band colour to Continuous, raise Drift, then scrub the timeline to a different time.",
  },
];

export const croix10ProximityAcceptanceRows: readonly ToolcraftComponentAcceptance[] = [
  {
    automated: true,
    automatedTestName: "declares the cursor field switch reveals and drives the effect",
    browser: true,
    browserTestName: "browser: croix10 cursor field switch reveals its shape controls",
    componentType: "switch",
    evidence: "rendered-pixels",
    expectedObservable:
      "Turning Follow the cursor on reveals Reach, Push, and Falls off and lets a pointer gesture displace the ramp; turning it off removes those controls and renders the field exactly as it was before.",
    fixture: "Croix10 with Band colour set to Continuous",
    id: "proximity.enabled",
    kind: "control",
    target: "proximity.enabled",
    userAction: "Toggle Follow the cursor with the ramp active.",
  },
  {
    automated: true,
    automatedTestName: "declares the cursor field reach bounds the disturbance",
    browser: true,
    browserTestName: "browser: croix10 cursor field reach bounds the disturbance",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Widening Reach extends how far from the committed hotspot the ramp is displaced, so bands outside the previous radius change while the hotspot itself stays put.",
    fixture: "Croix10 with the cursor field on and a hotspot placed",
    id: "proximity.radius",
    kind: "control",
    target: "proximity.radius",
    userAction: "Place the hotspot on the canvas, then drag Reach.",
  },
  {
    automated: true,
    automatedTestName: "declares the cursor field push displaces the ramp",
    browser: true,
    browserTestName: "browser: croix10 cursor field push displaces the ramp",
    componentType: "slider",
    evidence: "rendered-pixels",
    expectedObservable:
      "Raising Push moves the ramp further at the hotspot; at zero the field is pixel-identical to the effect being off.",
    fixture: "Croix10 with the cursor field on and a hotspot placed",
    id: "proximity.strength",
    kind: "control",
    target: "proximity.strength",
    userAction: "Place the hotspot on the canvas, then drag Push.",
  },
  {
    automated: true,
    automatedTestName: "declares the cursor field falloff shapes the disturbance",
    browser: true,
    browserTestName: "browser: croix10 cursor field falloff shapes the disturbance",
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "Each falloff distributes the same displacement differently between the hotspot and the edge of its reach, so the bands between them change while the hotspot and the untouched field do not.",
    fixture: "Croix10 with the cursor field on and a hotspot placed",
    id: "proximity.falloff",
    kind: "control",
    optionCoverage: "each-visible-item",
    target: "proximity.falloff",
    userAction: "Place the hotspot on the canvas, then switch Falls off.",
  },
];
