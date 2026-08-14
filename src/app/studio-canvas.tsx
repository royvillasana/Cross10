"use client";

import * as React from "react";

import { shouldIncludeToolcraftPreviewBackground } from "@/toolcraft/runtime";
import {
  useToolcraftDispatch,
  useToolcraftMediaPresentationUrls,
  useToolcraftPipelinePass,
  useToolcraftProductSceneFrame,
  useToolcraftSelector,
} from "@/toolcraft/runtime/react";

import styles from "./studio-canvas.module.css";
import { useStudioLayerSync } from "./studio-layer-sync";
import { studioLayerStackPass } from "./studio-pipeline";
import { StudioRegionHandles } from "./studio-region-handles";
import { useStudioShortcuts } from "./studio-shortcuts";
import {
  STUDIO_CURSOR_AWAY,
  STUDIO_CURSOR_TARGET,
  type StudioLayerMedia,
} from "./studio-stack-state";
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
  // The product's own keys (15.4). Mounted beside the sync for the same reason:
  // product code has one mount point inside the runtime shell, and a document
  // listener belongs to the product rather than to the canvas it lives in.
  useStudioShortcuts();

  const frame = useToolcraftProductSceneFrame();
  // Select the state object itself, which is referentially stable per update, and
  // derive parameters with a memo. A selector that built a fresh object on every
  // call would return a new snapshot each time it ran, which is unsafe for an
  // external-store subscription.
  const state = useToolcraftSelector((current) => current);
  const renderScale = readStudioRenderScale(state);

  /**
   * Uploaded pictures, decoded once and keyed by the layer that owns them.
   *
   * The runtime owns the media: `useToolcraftMediaPresentationUrls` is the
   * surface it offers a product, and an asset already carries the layer it
   * belongs to, so nothing here re-implements import, storage or ownership.
   * What this adds is the one thing a shader needs and a URL is not: decoded
   * pixels.
   *
   * Decoded off the render path deliberately. `createImageBitmap` is async, and
   * doing it inside the draw would either block the frame or make the first one
   * blank; instead the map fills in and the pass redraws when it changes.
   */
  const mediaAssets = state.mediaAssets ?? [];
  const presentationUrls = useToolcraftMediaPresentationUrls(mediaAssets);
  const [images, setImages] = React.useState<ReadonlyMap<string, StudioLayerMedia>>(
    () => new Map(),
  );

  React.useEffect(() => {
    let cancelled = false;
    const wanted = mediaAssets.filter(
      (asset) => asset.assetKind === "image" && presentationUrls.has(asset.id),
    );

    void Promise.all(
      wanted.map(async (asset) => {
        const url = presentationUrls.get(asset.id);
        if (!url) return null;
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          return [
            asset.layerId,
            {
              image: await createImageBitmap(blob),
              // Carried from the asset, so the runtime's own rotate and flip
              // buttons drive what this renderer draws.
              ...(asset.assetKind === "image" && asset.transform
                ? { transform: asset.transform }
                : {}),
            },
          ] as const;
        } catch {
          // A picture that will not decode is a picture the layer does not
          // have. The layer still draws, with nothing where the image would be,
          // rather than the canvas failing around it.
          return null;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setImages(new Map(entries.filter((entry) => entry !== null)));
    });

    return () => {
      cancelled = true;
    };
    // Keyed on the ids and their urls: the asset array is rebuilt by the store
    // on unrelated edits, and decoding on each would re-upload every texture.
  }, [
    mediaAssets
      .map(
        (asset) =>
          `${asset.id}:${presentationUrls.get(asset.id) ?? ""}:${
            asset.assetKind === "image" ? JSON.stringify(asset.transform ?? {}) : ""
          }`,
      )
      .join("|"),
  ]);

  const parameters = useStableStudioSceneParameters(
    React.useMemo(
      () =>
        buildStudioSceneParameters(
          state,
          shouldIncludeToolcraftPreviewBackground({ state }),
          images,
        ),
      [images, state],
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

  const dispatch = useToolcraftDispatch();

  /**
   * The pointer, committed to state in field units (R68).
   *
   * Listened for on the window rather than on the canvas, which is not a
   * refinement but a requirement: the region handles are an overlay drawn on
   * top of the shape, and a canvas-bound listener never sees a pointer moving
   * across the very field the engines are supposed to respond to. A pointer
   * position is a global fact, so it is read globally and converted against the
   * canvas rectangle.
   *
   * Coalesced to one commit per frame. Every move would otherwise dispatch, and
   * the value is read once per draw regardless.
   */
  React.useEffect(() => {
    let frame = 0;
    let pending: readonly [number, number] | undefined;

    const commit = () => {
      frame = 0;
      if (!pending) return;
      dispatch({
        // Where the pointer is is not an edit, so it is not on the undo stack.
        // Recorded, it was worse than untidy: the pointer moves whenever a
        // button is clicked, so every click on Undo pushed a fresh cursor patch
        // for that same Undo to pop, and no layer command underneath it could
        // ever be reached. R68 commits the position so the export bakes what
        // the author saw; nothing in that asks for it to be undoable.
        history: "skip",
        target: STUDIO_CURSOR_TARGET,
        type: "controls.setValue",
        value: [...pending],
      });
      pending = undefined;
    };

    const onMove = (event: PointerEvent) => {
      const canvas = canvasRef.current;
      const box = canvas?.getBoundingClientRect();
      if (!box || box.height <= 0) return;

      const inside =
        event.clientX >= box.left &&
        event.clientX <= box.right &&
        event.clientY >= box.top &&
        event.clientY <= box.bottom;

      pending = inside
        ? [
            (event.clientX - (box.left + box.width / 2)) / box.height,
            // Flipped: the field measures upward from its centre and the page
            // measures downward from its top, so a pointer moved up has to
            // arrive as a larger y rather than a smaller one.
            -(event.clientY - (box.top + box.height / 2)) / box.height,
          ]
        : [...STUDIO_CURSOR_AWAY];
      if (!frame) frame = requestAnimationFrame(commit);
    };

    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [dispatch]);

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
    <>
      <canvas
        className={styles.canvas}
        // The stack the renderer actually assembled, from the same scene the draw
        // used. Layer coverage proves against real panel rows, and this is what
        // lets a proof assert the assembled order matches the order the panel
        // shows rather than asserting the runtime agrees with itself.
        //
        // Hidden layers are omitted rather than listed, because this describes what
        // was drawn: a layer at zero visibility contributes nothing to the
        // composite, so including it would make the attribute claim more than the
        // frame contains.
        data-studio-stack={parameters.layers
          .filter((entry) => entry.values.visible !== 0)
          .map((entry) => entry.typeId)
          .join(">")}
        data-toolcraft-product-output=""
        ref={canvasRef}
      />
      <StudioRegionHandles canvasRef={canvasRef} />
    </>
  );
}
