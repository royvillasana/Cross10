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

import { StudioAddMediaMenuItem } from "./studio-add-media-menu";
import { StudioLayerRowActions } from "./studio-layer-row-actions";
import styles from "./studio-canvas.module.css";
import { useStudioLayerSync } from "./studio-layer-sync";
import { studioLayerStackPass } from "./studio-pipeline";
import { StudioOnboardingDialog } from "./studio-onboarding-dialog";
import { StudioReferenceOverlay } from "./studio-reference-overlay";
import { useStudioSmallViewportArrangement } from "./studio-small-viewport-sync";
import { StudioRegionHandles } from "./studio-region-handles";
import { useStudioShortcuts } from "./studio-shortcuts";
import {
  STUDIO_CURSOR_AWAY,
  STUDIO_CURSOR_TARGET,
  type StudioLayerMedia,
} from "./studio-stack-state";
import {
  buildStudioSceneParameters,
  readStudioLoopProgress,
  readStudioRenderScale,
} from "./studio-scene";
import { setStudioMediaRegistry } from "./studio-media-registry";
import { studioPathAtlasSignature } from "./studio-path-mask";
import {
  readStudioViewportPose,
  useStudioViewportGesture,
  type StudioViewportPose,
} from "./studio-viewport-gesture";
import {
  isStudioVideoAsset,
  studioVideoLoopTime,
} from "./studio-video";
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
  /**
   * Everything except the drawn paths, which are hashed instead.
   *
   * A path may hold thousands of nodes, and serialising all of them to answer
   * "is this the same scene" is the kind of cost that arrives disguised as
   * something else: every unrelated control edit got slower in proportion to
   * how much someone had drawn. The hash folds in every coordinate, so this is
   * not a sample -- a moved node still misses the memo.
   */
  const signature = `${JSON.stringify({
    ...parameters,
    // Stripped by rebuilding the layers rather than by a `JSON.stringify`
    // replacer: a replacer is called for every key of every object in the tree
    // and made the common case -- a stack with no drawing at all -- measurably
    // slower to answer a question about paths that are not there.
    layers: parameters.layers.map(({ vertices: _vertices, ...rest }) => rest),
  })}#${studioPathAtlasSignature(
    new Map(
      parameters.layers.flatMap((layer, index) =>
        layer.vertices?.length ? [[index, layer.vertices] as const] : [],
      ),
    ),
  )}`;
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

  // Brings the panels back within reach when the shell is wider than the screen.
  // Here rather than in a module of its own because this component is already
  // the product's one mounted surface, and a second mount point for a hook that
  // runs once would be a second thing to keep alive.
  useStudioSmallViewportArrangement();

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
      (asset) =>
        (asset.assetKind === "image" || isStudioVideoAsset(asset)) &&
        presentationUrls.has(asset.id),
    );

    void Promise.all(
      wanted.map(async (asset) => {
        const url = presentationUrls.get(asset.id);
        if (!url) return null;
        try {
          if (isStudioVideoAsset(asset)) {
            // Handed to an element rather than fetched into memory. A clip is
            // large enough that reading it whole to hand the bytes back to a
            // decoder would cost the memory twice for nothing, and the element
            // is the only thing that can seek anyway.
            //
            // Muted and inline because it is a texture, not a player: the
            // author hears the composition's silence, and an element that
            // asks for sound is an element some browsers refuse to decode
            // without a gesture. Never played -- `currentTime` is written from
            // the loop below, which is what makes the clip a source read at a
            // position rather than something running beside the work.
            const element = document.createElement("video");
            element.crossOrigin = "anonymous";
            element.muted = true;
            element.loop = true;
            element.playsInline = true;
            element.preload = "auto";
            element.src = url;
            await new Promise<void>((resolve, reject) => {
              const settle = (): void => {
                element.removeEventListener("loadeddata", settle);
                element.removeEventListener("error", fail);
                resolve();
              };
              const fail = (): void => {
                element.removeEventListener("loadeddata", settle);
                element.removeEventListener("error", fail);
                reject(new Error("clip did not decode"));
              };
              // `loadeddata` rather than `loadedmetadata`: metadata gives the
              // duration but not a frame, and a texture uploaded from an
              // element with no frame yet is undefined on some drivers and
              // black on the rest.
              element.addEventListener("loadeddata", settle);
              element.addEventListener("error", fail);
              element.load();
            });
            return [
              asset.layerId,
              { image: element, moving: true },
            ] as readonly [string, StudioLayerMedia];
          }

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
          ] as readonly [string, StudioLayerMedia];
        } catch {
          // A picture that will not decode is a picture the layer does not
          // have. The layer still draws, with nothing where the image would be,
          // rather than the canvas failing around it.
          return null;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setImages((previous) => {
        const next = new Map(entries.filter((entry) => entry !== null));
        // A clip that is no longer in the stack keeps its decoder alive and its
        // buffer resident until the element is told to let go. Dropping the map
        // entry alone does not do it, because the element is still referenced
        // by the pending decode until GC gets to it.
        for (const [layerId, media] of previous) {
          if (next.get(layerId)?.image === media.image) continue;
          if (media.image instanceof HTMLVideoElement) {
            media.image.removeAttribute("src");
            media.image.load();
          }
        }
        return next;
      });
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

  /**
   * Every clip moved to the frame this loop position asks for.
   *
   * Done on the way to building the scene rather than inside the draw, because
   * the draw must stay pure -- it is run again by the export path, at positions
   * the preview never visited, and a renderer that seeked would make the two
   * paths disagree about what a frame is.
   *
   * The seek is written and not awaited. Waiting for `seeked` at sixty frames a
   * second would either stall the frame or arrive after the draw that wanted
   * it; writing it means the element decodes toward the position while the
   * renderer uploads whatever frame it currently holds, which for forward
   * motion is at most a frame behind and for a scrub catches up within one.
   * The export path is the one that needs the exact frame, and it awaits.
   */
  const loopProgress = readStudioLoopProgress(state);
  const loopSeconds =
    (state as { timeline?: { durationSeconds?: number } }).timeline
      ?.durationSeconds ?? 0;

  // Published where the export frame can reach it, because the runtime calls
  // that frame from outside this tree. The alternative is decoding everything a
  // second time for the artifact, which would cost the memory twice and build
  // the file from pixels the author never saw.
  React.useEffect(() => {
    setStudioMediaRegistry(images);
  }, [images]);

  /**
   * The frame is held still while the view is being moved.
   *
   * Panning and zooming are a transform the runtime applies to a surface whose
   * pixels have not changed, so a gesture costs nothing by itself. It began to
   * cost everything once compositions animated: a drifting stack -- or one
   * holding a clip -- rebuilds its scene every frame and redraws the whole
   * program, while the browser is trying to composite a drag at the same rate.
   *
   * So during a gesture the loop is pinned to the value the scene last used.
   * The parameters come out byte-identical, the memo holds, and the renderer
   * sleeps until the gesture ends. Nothing is approximated: the frame on screen
   * is the frame that was already there, which is the one the author is
   * dragging.
   *
   * Play state is deliberately untouched. Dispatching a pause on gesture start
   * would look the same for one drag and be wrong in every way that lasts --
   * two history entries per gesture, a fight with an author who paused on
   * purpose, and a resume at the moment the drag ended rather than the moment
   * the clock reached. Freezing what the *reader* passes leaves the timeline
   * running underneath, so the resumed frame is the one the clock says it is.
   */
  const moving = useStudioViewportGesture(
    readStudioViewportPose((state as { canvas?: StudioViewportPose }).canvas),
  );
  const heldLoop = React.useRef(0);

  React.useEffect(() => {
    // Held with the rest of the animation while the view is being moved: a
    // decoder seeking every frame is exactly the non-essential work a gesture
    // should not be competing with, and the frame on screen is frozen anyway.
    if (moving) return;
    for (const media of images.values()) {
      if (!media.moving || !(media.image instanceof HTMLVideoElement)) continue;
      const clipSeconds = media.image.duration;
      if (!Number.isFinite(clipSeconds) || clipSeconds <= 0) continue;
      media.image.currentTime = studioVideoLoopTime(
        clipSeconds,
        loopSeconds,
        loopProgress,
      );
    }
  }, [images, loopProgress, loopSeconds, moving]);


  const parameters = useStableStudioSceneParameters(
    React.useMemo(
      () =>
        buildStudioSceneParameters(
          state,
          shouldIncludeToolcraftPreviewBackground({ state }),
          images,
          undefined,
          moving ? heldLoop.current : undefined,
        ),
      [images, moving, state],
    ),
  );
  // Recorded after the build rather than computed beside it, so what is held is
  // the value the scene actually used -- including the zero an undrifted
  // composition is pinned to, which a second derivation here could disagree
  // with the moment either rule changed.
  heldLoop.current = parameters.loop;

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
        Croix10 needs WebGL2. This browser did not provide a WebGL2 context.
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
        // Where the loop has got to, as the frame that was actually drawn saw it.
        // Read from `parameters`, not from the timeline, so it moves only when a
        // draw moved: a marker wired straight to the clock would report playback
        // during a frame the renderer never produced.
        data-timeline-progress={parameters.loop.toFixed(6)}
        data-toolcraft-product-output=""
        ref={canvasRef}
      />
      <StudioAddMediaMenuItem />
      <StudioLayerRowActions />
      <StudioOnboardingDialog />
      <StudioReferenceOverlay canvasRef={canvasRef} />
      <StudioRegionHandles canvasRef={canvasRef} />
    </>
  );
}
