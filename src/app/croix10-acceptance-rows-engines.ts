/**
 * Acceptance rows for the chromatic engines.
 *
 * Split from the core rows so both files stay within their line budget as engines
 * land. The engine selector's own row lives here too: it is the cross-entity gate
 * every one of these rows depends on.
 */

import type { ToolcraftComponentAcceptance } from "./acceptance/types";
import {
  CROIX10_MAX_PLANES,
  CROIX10_MIN_PLANES,
} from "./croix10-parameters";

export const croix10EngineAcceptanceRows: readonly ToolcraftComponentAcceptance[] = [
  {
    automated: true,
    automatedTestName:
      "declares interference drift travels the beat across the loop",
    browser: true,
    browserTestName:
      "browser: croix10 interference drift travels the moire across the loop",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "With Drift above zero, scrubbing the timeline moves the moire across the field while its beat period stays put; at zero the field is identical at every time.",
    fixture: "Croix10 with Chromointerference selected and the second layer on",
    id: "interference.driftCycles",
    kind: "control",
    target: "interference.driftCycles",
    userAction:
      "Select Chromointerference, raise Drift, then scrub the timeline to a different time.",
  },
  {
    automated: true,
    automatedTestName:
      "declares immersion drift sweeps the wash across the loop",
    browser: true,
    browserTestName:
      "browser: croix10 immersion drift sweeps the chromosaturation wash",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "With Drift above zero, scrubbing the timeline moves the colour transition across the field; at zero the wash holds still at every time.",
    fixture: "Croix10 with the Chromosaturation engine selected",
    id: "immersion.driftCycles",
    kind: "control",
    target: "immersion.driftCycles",
    userAction:
      "Select Chromosaturation, raise Drift, then scrub the timeline to a different time.",
  },

  {
    automated: true,
    automatedTestName: "declares engine selection switches the rendered grammar",
    browser: true,
    browserTestName:
      "browser: croix10 engine selection switches the rendered chromatic grammar",
    componentType: "select",
    evidence: "product-output",
    expectedObservable:
      "Selecting each engine renders a visibly different chromatic grammar, and stripe controls are absent while Chromosaturation is selected.",
    fixture: "Croix10 with every engine reachable from the selector",
    id: "engine.active",
    kind: "control",
    optionCoverage: "each-visible-item",
    target: "engine.active",
    userAction: "Choose each Engine option in turn.",
  },
  {
    automated: true,
    automatedTestName: "declares viewing angle sweeps the physichromie colour state",
    browser: true,
    browserTestName:
      "browser: croix10 viewing angle sweeps the physichromie colour state",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Sweeping Viewing angle moves the composition through colour states as strip faces occlude and reveal their neighbours.",
    fixture: "Croix10 with the Physichromie engine selected",
    id: "viewer.angle",
    kind: "control",
    target: "viewer.angle",
    userAction: "Select Physichromie, then drag Viewing angle across its range.",
  },
  {
    automated: true,
    automatedTestName: "declares depth scales how strongly the angle shifts colour",
    browser: true,
    browserTestName:
      "browser: croix10 depth scales how strongly the viewing angle shifts colour",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "At a fixed viewing angle, raising Depth increases how far the colour state has shifted.",
    fixture: "Croix10 with Physichromie selected and the angle held off centre",
    id: "viewer.parallax",
    kind: "control",
    target: "viewer.parallax",
    userAction: "Select Physichromie, offset the angle, then drag Depth.",
  },
  {
    automated: true,
    automatedTestName: "declares line pair frequency changes the induced field",
    browser: true,
    browserTestName:
      "browser: croix10 line pair frequency changes the induced field density",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Raising Line pairs increases the density of the high-frequency pairs while they stay resolvable rather than aliasing.",
    fixture: "Croix10 with the Induction Chromatique engine selected",
    id: "induction.frequency",
    kind: "control",
    target: "induction.frequency",
    userAction: "Select Induction Chromatique, then drag Line pairs.",
  },
  {
    automated: true,
    automatedTestName: "declares fringe width changes the complementary edge",
    browser: true,
    browserTestName:
      "browser: croix10 fringe width changes the complementary edge band",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Widening Fringe width broadens the complementary colour along each pair boundary.",
    fixture: "Croix10 with Induction Chromatique selected and fringe strength raised",
    id: "induction.fringe-width",
    kind: "control",
    target: "induction.fringeWidth",
    userAction: "Select Induction Chromatique, then drag Fringe width.",
  },
  {
    automated: true,
    automatedTestName: "declares fringe strength changes the induced colour",
    browser: true,
    browserTestName:
      "browser: croix10 fringe strength changes the induced complementary colour",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Raising Fringe strength pushes each boundary further toward the complement of its local colour.",
    fixture: "Croix10 with Induction Chromatique selected",
    id: "induction.fringe-intensity",
    kind: "control",
    target: "induction.fringeIntensity",
    userAction: "Select Induction Chromatique, then drag Fringe strength.",
  },
  {
    automated: true,
    automatedTestName: "declares spread changes the immersive field transition",
    browser: true,
    browserTestName:
      "browser: croix10 spread changes the immersive field transition",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Narrowing Spread concentrates the colour transition; widening it immerses the whole canvas, with no banding steps at either end.",
    fixture: "Croix10 with the Chromosaturation engine selected",
    id: "immersion.spread",
    kind: "control",
    target: "immersion.spread",
    userAction: "Select Chromosaturation, then drag Spread.",
  },
  {
    automated: true,
    automatedTestName: "declares balance moves the immersive field transition",
    browser: true,
    browserTestName:
      "browser: croix10 balance moves the immersive field transition across the canvas",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Moving Balance slides the colour transition across the field without changing its width.",
    fixture: "Croix10 with the Chromosaturation engine selected",
    id: "immersion.balance",
    kind: "control",
    target: "immersion.balance",
    userAction: "Select Chromosaturation, then drag Balance.",
  },
  {
    automated: true,
    automatedTestName: "declares the second layer switch gates its own controls",
    browser: true,
    browserTestName:
      "browser: croix10 second layer switch adds the interfering structure and removes its controls",
    componentType: "switch",
    evidence: "product-output",
    expectedObservable:
      "Turning the second layer off renders the primary structure alone and removes pitch, angle, phase, coverage, and blend from the panel; turning it back on restores them and the composite.",
    fixture: "Croix10 Chromointerférence engine selected before load",
    id: "interference.enabled",
    kind: "control",
    target: "interference.enabled",
    userAction: "Toggle Second layer off, then on again.",
  },
  {
    automated: true,
    automatedTestName: "declares the pitch ratio sets the beat period",
    browser: true,
    browserTestName:
      "browser: croix10 interference pitch ratio changes the moire beat period",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Moving Pitch ratio away from one tightens the low-frequency beat between the layers.",
    fixture: "Croix10 Chromointerférence with the second layer enabled",
    id: "interference.pitch-ratio",
    kind: "control",
    target: "interference.pitchRatio",
    userAction: "Drag Pitch ratio to its maximum.",
  },
  {
    automated: true,
    automatedTestName: "declares the angle offset rotates the beat",
    browser: true,
    browserTestName:
      "browser: croix10 interference angle offset rotates the beat across the field",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Increasing Angle offset rotates the second layer, so the interference bands change orientation.",
    fixture: "Croix10 Chromointerférence with the second layer enabled",
    id: "interference.angle-offset",
    kind: "control",
    target: "interference.angleOffset",
    userAction: "Drag Angle offset to its maximum.",
  },
  {
    automated: true,
    automatedTestName: "declares the phase offset translates the beat",
    browser: true,
    browserTestName:
      "browser: croix10 interference phase offset translates the beat without changing its period",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Moving Phase offset slides the second layer along its axis, translating the interference pattern.",
    fixture: "Croix10 Chromointerférence with the second layer enabled",
    id: "interference.phase-offset",
    kind: "control",
    target: "interference.phaseOffset",
    userAction: "Drag Phase offset to its maximum.",
  },
  {
    automated: true,
    automatedTestName: "declares layer coverage opens windows onto the layer beneath",
    browser: true,
    browserTestName:
      "browser: croix10 interference layer coverage changes how much of the base shows through",
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Reducing Layer coverage narrows the second layer's printed bands, so more of the primary layer shows through.",
    fixture: "Croix10 Chromointerférence with the second layer enabled",
    id: "interference.width-ratio",
    kind: "control",
    target: "interference.widthRatio",
    userAction: "Drag Layer coverage to its minimum.",
  },
  {
    automated: true,
    automatedTestName: "declares every blend mode composites in linear light",
    browser: true,
    browserTestName:
      "browser: croix10 interference blend modes composite the two layers in linear light",
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "Each blend mode changes the composite; additive raises the field's mean luminance above normal, multiply sits below screen, and difference renders black wherever the two layers agree.",
    fixture: "Croix10 Chromointerférence with the second layer enabled",
    id: "interference.blend-mode",
    kind: "control",
    optionCoverage: "each-visible-item",
    target: "interference.blendMode",
    userAction: "Choose each Blend option in turn.",
  },
  {
    automated: true,
    automatedTestName:
      "declares plane collection add, remove, and record coverage",
    browser: true,
    browserTestName:
      "browser: croix10 plane collection adds, edits, and removes translucent planes",
    componentType: "collectionActions",
    controlPartCoverage: [
      "collectionActions.add",
      "collectionActions.items",
      "collectionActions.remove",
    ],
    evidence: "product-output",
    expectedObservable:
      "Editing a plane's colour and opacity changes what that sheet transmits, adding a plane introduces another filter whose overlaps darken the composite further, and removing the final plane restores the composite while the edited sibling is preserved.",
    fixture: `Croix10 Transchromie with between ${CROIX10_MIN_PLANES} and ${CROIX10_MAX_PLANES} translucent planes`,
    id: "transchromie.planes",
    kind: "control",
    target: "transchromie.planes",
    userAction:
      "Edit a plane's colour and opacity, add a plane, then remove the last one.",
  },
  {
    automated: true,
    automatedTestName: "declares stacking composites planes in linear light",
    browser: true,
    browserTestName:
      "browser: croix10 plane stacking switches between subtractive and additive light",
    componentType: "select",
    evidence: "rendered-pixels",
    expectedObservable:
      "Subtractive stacking filters a white ground, so the field is bright and every overlap is darker than the sheets that cross there; additive stacking sums the sheets against a dark ground, so the field is darker overall and overlaps are brighter than either sheet.",
    fixture: "Croix10 Transchromie with the three default sheets",
    id: "transchromie.blend-mode",
    kind: "control",
    optionCoverage: "each-visible-item",
    target: "transchromie.blendMode",
    userAction: "Choose each Stacking option in turn.",
  },];
