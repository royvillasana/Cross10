import type { ResolvedToolcraftAppSchema } from "@/toolcraft/runtime";

import {
  schemaHasPngExportPanelAction,
  schemaHasVideoExportPanelAction,
} from "./output-export-actions";
import type {
  ToolcraftAcceptanceEvidence,
  ToolcraftComponentAcceptance,
  ToolcraftInfinityCanvasCoverage,
  ToolcraftProductReadiness,
} from "./types";

type RequiredInfinityCanvasProof = Readonly<{
  coverage: ToolcraftInfinityCanvasCoverage;
  evidence: ToolcraftAcceptanceEvidence;
  message: string;
}>;

function hasInfinityCanvasProof(
  acceptance: readonly ToolcraftComponentAcceptance[],
  proof: RequiredInfinityCanvasProof,
): boolean {
  return acceptance.some(
    (entry) =>
      entry.kind === "runtime" &&
      entry.automated &&
      entry.browser &&
      entry.infinityCanvasCoverage === proof.coverage &&
      entry.evidence === proof.evidence,
  );
}

export function getToolcraftInfinityCanvasCoverageErrors({
  acceptance,
  productReadiness,
  schema,
  sceneElementsHaveIndependentBounds,
}: {
  acceptance: readonly ToolcraftComponentAcceptance[];
  productReadiness: ToolcraftProductReadiness;
  schema: ResolvedToolcraftAppSchema;
  /**
   * Whether any visible scene element occupies less than the whole artboard.
   *
   * An infinite export can only crop to something narrower than the artboard
   * when some element has an extent of its own. A product whose elements all
   * cover the whole scene has a union identical to its artboard, so its infinite
   * export is the same size as its finite one and the protected helper -- which
   * requires the two to differ -- cannot be satisfied by anything but a
   * fabricated bound. Requiring the proof anyway buys a green suite for an
   * assertion that says nothing.
   */
  sceneElementsHaveIndependentBounds: boolean;
}): string[] {
  if (
    productReadiness.mode !== "product" ||
    !schema.canvas.enabled ||
    schema.canvas.sizing.mode !== "editable-output"
  ) {
    return [];
  }

  const requiredProofs: RequiredInfinityCanvasProof[] = [
    {
      coverage: "mode-and-restoration",
      evidence: "viewport-side-effect",
      message:
        'canvas.sizing mode "editable-output" requires a runtime acceptance entry with infinityCanvasCoverage "mode-and-restoration" proving Infinity canvas hides finite size controls, removes artboard clipping, and restores the dormant finite size when disabled.',
    },
  ];

  if (schemaHasPngExportPanelAction(schema) && sceneElementsHaveIndependentBounds) {
    requiredProofs.push({
      coverage: "scene-bounds-image-export",
      evidence: "exported-bytes",
      message:
        'Export PNG with editable-output canvas requires a runtime acceptance entry with infinityCanvasCoverage "scene-bounds-image-export" proving infinite export crops to the union of visible scene elements through ToolcraftAppComposition.sceneBoundsProvider.',
    });
  }

  if (schemaHasVideoExportPanelAction(schema)) {
    requiredProofs.push({
      coverage: "scene-bounds-video-export",
      evidence: "exported-bytes",
      message:
        'Export Video with editable-output canvas requires a runtime acceptance entry with infinityCanvasCoverage "scene-bounds-video-export" proving infinite export uses one scene-bounds time-range envelope for every rendered frame.',
    });
  }

  return requiredProofs
    .filter((proof) => !hasInfinityCanvasProof(acceptance, proof))
    .map((proof) => proof.message);
}
