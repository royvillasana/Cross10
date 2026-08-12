"use client";

import * as React from "react";

import { shouldIncludeToolcraftPreviewBackground } from "@/toolcraft/runtime";
import {
  useToolcraftPipelinePass,
  useToolcraftProductSceneFrame,
  useToolcraftSelector,
} from "@/toolcraft/runtime/react";

import styles from "./croix10-canvas.module.css";
import { croix10ChromaticFieldPass } from "./croix10-pipeline";
import {
  createCroix10Renderer,
  type Croix10Renderer,
  type Croix10SceneParameters,
} from "./croix10-render";
import {
  readCroix10LoopDurationSeconds,
  readCroix10RenderScale,
  readCroix10SceneParameters,
} from "./croix10-scene";
import { useCroix10ProximityTracking } from "./croix10-proximity";
import { useCroix10RandomizeShortcut } from "./croix10-shortcuts";

/**
 * Holds the previous parameters object while the scene it describes is unchanged.
 *
 * The pipeline compares its cache input one level deep, so a parameters object
 * rebuilt with identical contents still reads as a new input and redraws. That
 * was harmless while state only changed on an edit, but playback advances the
 * timeline every frame: without this, a scene with no drift would redraw sixty
 * times a second to produce the same pixels. Comparing the serialised scene is
 * far cheaper than the draw it avoids, and a scene that really is drifting
 * serialises differently and redraws as it should.
 */
function useStableCroix10SceneParameters(
  parameters: Croix10SceneParameters,
): Croix10SceneParameters {
  const signature = JSON.stringify(parameters);
  const held = React.useRef({ parameters, signature });
  if (held.current.signature !== signature) {
    held.current = { parameters, signature };
  }
  return held.current.parameters;
}

/**
 * Product output only. The runtime owns the canvas shell, sizing, background
 * placement, and export; this component draws the chromatic field into the
 * runtime-positioned product scene surface and nothing else.
 */
export function Croix10Canvas(): React.JSX.Element {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rendererRef = React.useRef<Croix10Renderer | null>(null);
  const [unsupported, setUnsupported] = React.useState(false);

  // Keyboard access to Randomize. Mounted here because product code has one mount
  // point inside the runtime shell, and the shortcut belongs to the app rather than
  // to the canvas it happens to live in.
  useCroix10RandomizeShortcut();

  const frame = useToolcraftProductSceneFrame();
  // Select the state object itself, which is referentially stable per update, and
  // derive parameters with a memo. A selector that built a fresh object on every
  // call would return a new snapshot each time it ran, which is unsafe for an
  // external-store subscription and left array-valued parameters stale.
  const state = useToolcraftSelector((current) => current);
  const renderScale = readCroix10RenderScale(state);
  const committed = useStableCroix10SceneParameters(
    React.useMemo(
      () =>
        readCroix10SceneParameters(
          state,
          shouldIncludeToolcraftPreviewBackground({ state }),
        ),
      [state],
    ),
  );

  // The live hotspot overrides the committed one for preview only, and only while
  // a gesture is in flight. Export reads state, which holds the committed value —
  // the same relationship a slider has between drag and release (R44).
  const proximity = useCroix10ProximityTracking(
    canvasRef,
    committed.proximityStrength > 0,
  );
  const parameters = React.useMemo(
    () =>
      proximity.hover === null
        ? committed
        : { ...committed, proximityCenter: proximity.hover },
    [committed, proximity.hover],
  );

  // Acquired on first pass execution rather than in an effect: the pipeline pass
  // runs in a layout effect, so an ordinary effect would not have created the
  // renderer yet and the first frame would be blank. Resources are still created
  // outside render, retained across unrelated interactions, and released once.
  const acquireRenderer = React.useCallback((): Croix10Renderer | null => {
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
      rendererRef.current = createCroix10Renderer(gl);
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

  // The draw runs through the declared pipeline pass rather than as a loose
  // effect, so runtime execution, invalidation, and performance evidence all
  // describe the same pass this product registered.
  useToolcraftPipelinePass(
    croix10ChromaticFieldPass,
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
        Croix10 needs WebGL2. This browser did not provide a WebGL2 context.
      </p>
    );
  }

  return (
    <canvas
      className={styles.canvas}
      onPointerCancel={proximity.handlers.onPointerCancel}
      onPointerLeave={proximity.handlers.onPointerLeave}
      onPointerMove={proximity.handlers.onPointerMove}
      onPointerUp={proximity.handlers.onPointerUp}
      // The cycle the renderer actually walks, from the same timeline state that
      // normalises its phase. Editing the duration must move this and the runtime
      // scrubber range together; a proof that read only the scrubber would be
      // asserting the runtime agrees with itself.
      data-croix10-cycle-seconds={readCroix10LoopDurationSeconds(state)}
      data-toolcraft-product-output=""
      ref={canvasRef}
    />
  );
}
