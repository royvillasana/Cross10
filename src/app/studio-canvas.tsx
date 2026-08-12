"use client";

import * as React from "react";

import { shouldIncludeToolcraftPreviewBackground } from "@/toolcraft/runtime";
import {
  useToolcraftPipelinePass,
  useToolcraftProductSceneFrame,
  useToolcraftSelector,
} from "@/toolcraft/runtime/react";

import styles from "./studio-canvas.module.css";
import { useStudioLayerSync } from "./studio-layer-sync";
import { studioLayerStackPass } from "./studio-pipeline";
import {
  buildStudioSceneParameters,
  readStudioRenderScale,
} from "./studio-scene";
import {
  createStudioStackRenderer,
  type StudioStackRenderer,
  type StudioStackSceneParameters,
} from "./studio-stack-render";

/**
 * Holds the previous parameters object while the scene it describes is unchanged.
 *
 * The pipeline compares its cache input one level deep, so a parameters object
 * rebuilt with identical contents still reads as a new input and redraws. The
 * stack rebuilds its scene from the whole state object, so any unrelated state
 * write — a panel resize, a selection change that projects the same values —
 * would otherwise redraw every layer to produce identical pixels. Comparing the
 * serialised scene is far cheaper than the draw it avoids.
 */
function useStableStudioSceneParameters(
  parameters: StudioStackSceneParameters,
): StudioStackSceneParameters {
  const signature = JSON.stringify(parameters);
  const held = React.useRef({ parameters, signature });
  if (held.current.signature !== signature) {
    held.current = { parameters, signature };
  }
  return held.current.parameters;
}

/**
 * Product output only. The runtime owns the canvas shell, sizing, background
 * placement, and export; this component draws the layer stack into the
 * runtime-positioned product scene surface and nothing else.
 */
export function StudioCanvas(): React.JSX.Element {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rendererRef = React.useRef<StudioStackRenderer | null>(null);
  const [unsupported, setUnsupported] = React.useState(false);

  // Keeps the per-layer record and the `selectedLayer.*` controls in step (R56).
  // Mounted here because product code has one mount point inside the runtime
  // shell; the sync belongs to the product rather than to the canvas it lives in.
  useStudioLayerSync();

  const frame = useToolcraftProductSceneFrame();
  // Select the state object itself, which is referentially stable per update, and
  // derive parameters with a memo. A selector that built a fresh object on every
  // call would return a new snapshot each time it ran, which is unsafe for an
  // external-store subscription.
  const state = useToolcraftSelector((current) => current);
  const renderScale = readStudioRenderScale(state);
  const parameters = useStableStudioSceneParameters(
    React.useMemo(
      () =>
        buildStudioSceneParameters(
          state,
          shouldIncludeToolcraftPreviewBackground({ state }),
        ),
      [state],
    ),
  );

  // Acquired on first pass execution rather than in an effect: the pipeline pass
  // runs in a layout effect, so an ordinary effect would not have created the
  // renderer yet and the first frame would be blank. Resources are still created
  // outside render, retained across unrelated interactions, and released once.
  const acquireRenderer = React.useCallback((): StudioStackRenderer | null => {
    if (rendererRef.current) return rendererRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      setUnsupported(true);
      return null;
    }

    try {
      rendererRef.current = createStudioStackRenderer(gl);
    } catch {
      setUnsupported(true);
      return null;
    }
    return rendererRef.current;
  }, []);

  React.useEffect(
    () => () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    },
    [],
  );

  // The draw runs through the declared pipeline pass rather than a loose effect,
  // so runtime execution, invalidation, and performance evidence all describe the
  // same pass this product registered.
  useToolcraftPipelinePass(
    studioLayerStackPass,
    {
      backing:
        frame.rect === null
          ? "unavailable"
          : `${Math.round(frame.rect.width)}x${Math.round(frame.rect.height)}@${renderScale}`,
      sceneParameters: parameters,
    },
    React.useCallback(() => {
      const canvas = canvasRef.current;
      const renderer = acquireRenderer();
      if (!canvas || !renderer || frame.rect === null) return;

      // Backing pixels are CSS size x devicePixelRatio x selected scale. The
      // contract measures exactly this product, so the scale must reach the
      // backing rather than being applied as a visual transform.
      const ratio = (window.devicePixelRatio || 1) * renderScale;
      const width = Math.max(1, Math.round(frame.rect.width * ratio));
      const height = Math.max(1, Math.round(frame.rect.height * ratio));

      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      renderer.render(parameters, width, height);
    }, [acquireRenderer, frame, parameters, renderScale]),
  );

  if (unsupported) {
    // Product output, not app chrome: a WebGL2 failure means there is no other
    // output to show, so this text is the product's result.
    return (
      <p className={styles.unsupported} data-toolcraft-product-text="">
        Shader Studio needs WebGL2. This browser did not provide a WebGL2 context.
      </p>
    );
  }

  return (
    <canvas
      className={styles.canvas}
      // The stack the renderer actually assembled, from the same scene the draw
      // used. Layer coverage proves against real panel rows, and this is what
      // lets a proof assert the assembled order matches the order the panel
      // shows rather than asserting the runtime agrees with itself.
      data-studio-stack={parameters.layers.map((entry) => entry.typeId).join(">")}
      data-toolcraft-product-output=""
      ref={canvasRef}
    />
  );
}
