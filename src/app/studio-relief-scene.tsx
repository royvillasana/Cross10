"use client";

import * as React from "react";
import {
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from "three";

import {
  readToolcraftOrientationPose,
  useToolcraftModelOrbitInteraction,
  useToolcraftProductSceneFrame,
  useToolcraftSelector,
} from "@/toolcraft/runtime/react";

import styles from "./studio-canvas.module.css";
import { STUDIO_RELIEF_POSE_TARGET } from "./studio-relief";

/**
 * The relief: the studio's second renderer, and the only one with geometry.
 *
 * **Why a second renderer exists at all.** Everything else here composites a
 * frame from a stack of fields, and the colour change a Physichromie shows as
 * you move past it is computed from an angle — a good simulation of the effect,
 * and not the effect. Standing the fins up and moving a viewer around them is.
 * That cannot be done by the stack renderer, because the stack has no geometry
 * to occlude anything with.
 *
 * **What it costs, stated where the code is rather than only in the spec.** A
 * composition in this mode has no fragment shader to hand out: `Copy shader
 * source` and the MCP package describe the stack, and a scene is not one. That
 * is a real gap in the artifact story and the reason this is a mode an author
 * chooses rather than the way the product draws.
 *
 * **Inside the runtime's own scene surface.** The canvas is mounted in
 * `canvasContent` and sized from `useToolcraftProductSceneFrame()`, exactly as
 * the flat one is, so the runtime keeps owning placement, background and export
 * backing. No model loader, no presentation lease, no second Three cache: the
 * geometry is procedural, so `modelPresentation` stays `{ mode: "runtime" }`
 * and none of the model pipeline is involved.
 */
export function StudioReliefScene(): React.JSX.Element {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rendererRef = React.useRef<WebGLRenderer | null>(null);
  const sceneRef = React.useRef<Scene | null>(null);
  const cameraRef = React.useRef<OrthographicCamera | null>(null);

  const frame = useToolcraftProductSceneFrame();
  const pose = useToolcraftSelector(
    (state) => state.values[STUDIO_RELIEF_POSE_TARGET],
  );

  /**
   * Dragging the geometry turns the same pose the gizmo turns.
   *
   * The runtime's own interaction rather than a product camera: the contract
   * forbids a hand-rolled orbit, and it is right to — two things that both turn
   * a view are two things that disagree about where it is pointing. The hit
   * test is the product's, because only the product knows where its geometry
   * is, and it is the extension point the runtime provides for exactly this.
   */
  const orbit = useToolcraftModelOrbitInteraction({
    hitTest: (x, y) => {
      const canvas = canvasRef.current;
      if (!canvas) return false;

      // A hit is a press inside the drawn relief rather than anywhere on the
      // canvas: a miss has to stay a canvas pan, which is what keeps the
      // viewport navigable while the scene is rotatable.
      const rect = canvas.getBoundingClientRect();
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        return false;
      }

      const localX = ((x - rect.left) / rect.width) * 2 - 1;
      const localY = -(((y - rect.top) / rect.height) * 2 - 1);
      // The relief occupies the middle of its own frame, so a press near the
      // edge is the canvas rather than the work.
      return Math.abs(localX) < 0.5 && Math.abs(localY) < 0.5;
    },
    target: STUDIO_RELIEF_POSE_TARGET,
  });

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
      // Preserved for the same reason the flat canvas preserves it: every proof
      // in this product reads the frame back with `readPixels`, and a buffer
      // cleared after presenting reads as empty however well it drew.
      preserveDrawingBuffer: true,
    });
    renderer.setClearColor(new Color(0, 0, 0), 0);
    rendererRef.current = renderer;

    const scene = new Scene();
    sceneRef.current = scene;

    /**
     * Orthographic rather than perspective, which is a decision about the
     * subject.
     *
     * A Physichromie is read from in front and from the side, and what changes
     * is which faces of the fins a viewer can see. A perspective camera adds a
     * second reason for the picture to change — distance — and the two are hard
     * to tell apart in a still. Orthographic keeps the only variable the one
     * this mode exists for.
     */
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    cameraRef.current = camera;

    // One slab, and deliberately only one: this change is the scene, the gizmo
    // and the declaration. The instanced lamellae the mode is named for arrive
    // with the parallax that needs them.
    const slab = new Mesh(
      new BoxGeometry(1.2, 1.2, 0.35),
      new MeshBasicMaterial({ color: new Color(0.85, 0.85, 0.85) }),
    );
    scene.add(slab);

    return () => {
      slab.geometry.dispose();
      (slab.material as MeshBasicMaterial).dispose();
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera || frame.rect === null) return;

    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(frame.rect.width));
    const height = Math.max(1, Math.round(frame.rect.height));
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);

    // The pose is the runtime's, read rather than kept: the gizmo and a drag on
    // the geometry both write it, so holding a camera of our own would be a
    // second answer to where the view is pointing.
    const resolved = readToolcraftOrientationPose(pose);
    const aspect = width / Math.max(1, height);
    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.position.set(...(resolved.position as [number, number, number]));
    camera.up.set(...(resolved.up as [number, number, number]));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
  }, [frame, pose]);

  return (
    <canvas
      className={styles.canvas}
      /*
       * The pose the frame in front of you was drawn from.
       *
       * Published rather than inferred, for the same reason the flat canvas
       * publishes the loop position it drew: a proof that read the pose from
       * state would be checking that state agrees with itself, where what has
       * to be true is that the *picture* followed it.
       */
      data-studio-pose={JSON.stringify(readToolcraftOrientationPose(pose))}
      // The product's one output, whichever renderer is drawing it. Two
      // canvases claiming to be the output would make every proof that reads
      // "the frame" ambiguous, so exactly one is mounted at a time.
      data-studio-relief=""
      data-toolcraft-product-output=""
      onPointerCancel={orbit.onPointerUp}
      onPointerDown={orbit.onPointerDown}
      onPointerMove={orbit.onPointerMove}
      onPointerUp={orbit.onPointerUp}
      ref={canvasRef}
    />
  );
}
