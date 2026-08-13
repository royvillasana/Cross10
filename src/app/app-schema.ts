import { defineToolcraft } from "@/toolcraft/runtime";

import { appIdentity } from "./app-identity";
import { STUDIO_BACKGROUND_SECTIONS } from "./studio-background-sections";
import { STUDIO_EXPORT_SECTIONS } from "./studio-export-sections";
import { STUDIO_LAYER_SECTIONS } from "./studio-layer-sections";
import {
  STUDIO_CURSOR_TARGET,
  STUDIO_LAYER_RECORD_TARGET,
  STUDIO_PEN_TARGET,
  STUDIO_SHAPE_GEOMETRY_TARGETS,
  STUDIO_VERTEX_PATH_TARGET,
} from "./studio-stack-state";

/**
 * Shader Studio product schema.
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
    upload: false,
  },
  identity: appIdentity,
  panels: {
    controls: {
      sections: [
        ...STUDIO_BACKGROUND_SECTIONS,
        ...STUDIO_LAYER_SECTIONS,
        ...STUDIO_EXPORT_SECTIONS,
      ],
      title: "Controls",
    },
    layers: true,
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
