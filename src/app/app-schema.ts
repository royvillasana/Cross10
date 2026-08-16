import { defineToolcraft } from "@/toolcraft/runtime";

import { appIdentity } from "./app-identity";
import { STUDIO_LOOP_SECONDS } from "./studio-motion";
import { STUDIO_BACKGROUND_SECTIONS } from "./studio-background-sections";
import { STUDIO_EXPORT_SECTIONS } from "./studio-export-sections";
import { STUDIO_GALLERY_SECTIONS } from "./studio-gallery-sections";
import { STUDIO_LAYER_SECTIONS } from "./studio-layer-sections";
import {
  STUDIO_ONBOARDING_CHOICE_TARGET,
  STUDIO_ONBOARDING_SETTLED_TARGET,
  STUDIO_ONBOARDING_TARGET,
} from "./studio-onboarding";
import { STUDIO_REFERENCE_SECTIONS } from "./studio-reference-sections";
import { STUDIO_SMALL_VIEWPORT_TARGET } from "./studio-small-viewport";
import {
  STUDIO_CURSOR_TARGET,
  STUDIO_LAYER_RECORD_TARGET,
  STUDIO_PEN_TARGET,
  STUDIO_PENDING_TECHNIQUE_TARGET,
  STUDIO_SHAPE_GEOMETRY_TARGETS,
  STUDIO_SNAPSHOT_TARGET,
  STUDIO_TECHNIQUE_TARGET,
  STUDIO_VERTEX_PATH_TARGET,
} from "./studio-stack-state";

/**
 * Croix10 product schema.
 *
 * `panels.layers` is enabled because the product's whole subject is an ordered
 * stack of editable objects — the runtime owns the list, its selection, its
 * visibility, its grouping, and its reordering, and product code authors none of
 * those surfaces. What the runtime does not own is per-layer values, which is
 * R56 and lives in `stack.layerRecord`.
 *
 * Section titles name the entity edited, never the branch that reveals them, so
 * neither can collide with the layer-kind option labels (R33).
 */
export const appSchema = defineToolcraft({
  canvas: {
    enabled: true,
    renderScale: { step: 0.25 },
    // The output has its own dimensions rather than inheriting them from an
    // uploaded image: a generated shader is sized by the author, not by media.
    sizing: { mode: "editable-output" },
    // Media arrives by dropping it on the canvas rather than through a product
    // uploader (3.1). The runtime owns import and creates a layer per file, so
    // enabling this is the whole of the product's import surface.
    upload: true,
  },
  identity: appIdentity,
  panels: {
    controls: {
      sections: [
        // First, because it is where a composition starts: an entry sets a
        // stack and every control below stays live over it (R58).
        ...STUDIO_GALLERY_SECTIONS,
        // Next, because it is the order the work happens in: see what the
        // techniques look like, put one behind the canvas to work against,
        // then build. The reference changes nothing about the composition, so
        // it sits before everything that does.
        ...STUDIO_REFERENCE_SECTIONS,
        ...STUDIO_BACKGROUND_SECTIONS,
        ...STUDIO_LAYER_SECTIONS,
        ...STUDIO_EXPORT_SECTIONS,
      ],
      title: "Controls",
    },
    layers: true,
    // Playback, not keyframes. The renderer already reads its values through the
    // timeline evaluator, which returns raw values while no keyframe groups
    // exist, so nothing here has to be rewritten to reach keyframes later --
    // what keyframes would add today is `timelineCoverage: "keyframes"`
    // acceptance for every slider and colour in the panel, which is a change in
    // its own right rather than a detail of this one.
    timeline: {
      defaultDurationSeconds: STUDIO_LOOP_SECONDS,
      enabled: true,
      mode: "playback",
    },
  },
  persistence: {
    // `stack.layerRecord` is written by product code rather than rendered by a
    // control, and an uncontrolled target is not persisted without being named
    // here — the same gap Croix10's cursor hotspot hit. Without it a reload
    // would restore the layer list and lose everything each layer looked like.
    additionalValueTargets: [
      STUDIO_LAYER_RECORD_TARGET,
      STUDIO_CURSOR_TARGET,
      STUDIO_VERTEX_PATH_TARGET,
      STUDIO_PEN_TARGET,
      // The stack an apply overwrote, persisted for the same reason the stack
      // itself is: a composition survives a reload, so the ability to take back
      // the apply that replaced one should survive it too. One snapshot, so the
      // cost is bounded by a single stack's metadata.
      STUDIO_SNAPSHOT_TARGET,
      // Which construction the canvas was started from. Persisted because the
      // composition is: a reload that forgot it would report no current
      // technique for a canvas that plainly has one.
      STUDIO_TECHNIQUE_TARGET,
      // The offer a press has made and not yet been allowed to carry out.
      // Persisted with the rest so a reload mid-decision does not quietly turn
      // "asked" into "never asked" -- the next press would then replace the
      // work with no confirmation at all, which is the failure the two presses
      // exist to prevent.
      STUDIO_PENDING_TECHNIQUE_TARGET,
      // Whether a narrow viewport has already been arranged once. Persisted so
      // the collapse happens on first arrival and never again -- a layout that
      // re-imposed itself every load would undo the user's own choice each time
      // they came back.
      STUDIO_SMALL_VIEWPORT_TARGET,
      // Which step the onboarding flow is on, and what it is about to start
      // from. Persisted so a reload mid-decision does not drop the user onto a
      // canvas they never confirmed.
      STUDIO_ONBOARDING_TARGET,
      STUDIO_ONBOARDING_CHOICE_TARGET,
      STUDIO_ONBOARDING_SETTLED_TARGET,
          ...STUDIO_SHAPE_GEOMETRY_TARGETS,
    ],
    include: ["canvas", "layers", "panels", "values"],
    key: `toolcraft:${appIdentity.id}:state:v1`,
    storage: "localStorage",
    version: 1,
  },
  toolbar: {
    history: true,
    radar: true,
    zoom: true,
  },
});
