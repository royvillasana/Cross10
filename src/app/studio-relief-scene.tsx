"use client";

import * as React from "react";
import {
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from "three";

import {
  useToolcraftProductSceneFrame,
  useToolcraftSelector,
} from "@/toolcraft/runtime/react";

import styles from "./studio-canvas.module.css";
import { buildStudioSceneParameters } from "./studio-scene";
import {
  readStudioReliefFins,
  STUDIO_RELIEF_DEPTH_TARGET,
  type StudioReliefFins,
} from "./studio-relief";

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
/**
 * The fins, as one instanced mesh.
 *
 * Instanced rather than a mesh per fin, and at two hundred bands that is the
 * difference between one draw call and two hundred. It is also what makes the
 * count free to follow the band count: the geometry is described once and
 * placed many times, so a field of eight fins and a field of two hundred cost
 * the same to describe.
 *
 * Each fin is a thin box standing off the support, its width taken from the
 * layer's own band width and its depth from the control. Consecutive fins take
 * consecutive inks, which is the same rhythm the flat field draws — a relief of
 * a two-ink band field is two-ink fins, not a grey extrusion of one.
 */
function buildStudioLamellae(fins: StudioReliefFins, depth: number): InstancedMesh {
  const mesh = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    new MeshBasicMaterial({ vertexColors: true }),
    fins.count,
  );

  // The field spans two units, centred, so the whole relief sits inside the
  // orthographic frame whatever the count is.
  const span = 2;
  const pitch = span / fins.count;
  const matrix = new Matrix4();
  const colour = new Color();

  for (let index = 0; index < fins.count; index += 1) {
    const centre = -span / 2 + pitch * (index + 0.5);
    matrix.makeScale(Math.max(pitch * fins.coverage, 1e-4), span * 0.6, Math.max(depth, 1e-4));
    matrix.setPosition(centre, 0, depth / 2);
    mesh.setMatrixAt(index, matrix);

    const ink = fins.colors[index % 2] ?? fins.colors[0];
    // Set from linear light, which is the space the rest of the product works
    // in and the space these values arrive in.
    colour.setRGB(ink[0], ink[1], ink[2]);
    mesh.setColorAt(index, colour);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  // Turned as a whole, so the fins stand along the layer's own reading axis
  // rather than always across the frame.
  mesh.rotation.z = (fins.angle * Math.PI) / 180;

  return mesh;
}

export function StudioReliefScene(): React.JSX.Element {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rendererRef = React.useRef<WebGLRenderer | null>(null);
  const sceneRef = React.useRef<Scene | null>(null);
  const cameraRef = React.useRef<OrthographicCamera | null>(null);

  const frame = useToolcraftProductSceneFrame();
  const state = useToolcraftSelector((current) => current);

  /**
   * The fins, read from the layers the flat view already draws.
   *
   * Through the same scene builder rather than from the record directly, so the
   * relief stands up exactly what the field would have drawn: the same band
   * count, the same width, the same inks in linear light. Reading the record
   * here would be a second interpretation of it, and the first time the two
   * disagreed the relief would be of a work nobody had made.
   */
  const scene = buildStudioSceneParameters(state, false);
  const fins = readStudioReliefFins(scene.layers);
  const depthValue = state.values[STUDIO_RELIEF_DEPTH_TARGET];
  const depth =
    typeof depthValue === "number" && Number.isFinite(depthValue) ? depthValue : 0.3;

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
    sceneRef.current = new Scene();

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
    cameraRef.current = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

    return () => {
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const renderer = rendererRef.current;
    const target = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !target || !camera || frame.rect === null) return;

    // Rebuilt rather than mutated when the field changes, because the fin count
    // is the instance count: an InstancedMesh cannot grow, and reusing one at a
    // smaller count would leave the extra fins standing where the author had
    // removed them.
    const previous = target.children[0];
    if (previous instanceof InstancedMesh) {
      previous.geometry.dispose();
      (previous.material as MeshBasicMaterial).dispose();
      target.remove(previous);
    }

    if (fins) target.add(buildStudioLamellae(fins, depth));

    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(frame.rect.width));
    const height = Math.max(1, Math.round(frame.rect.height));
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);

    /**
     * A fixed viewpoint, off the axis on purpose.
     *
     * Fixed because an orbit cannot be *proved* here: an orientation gizmo must
     * declare seven coverages and two are unreachable through no fault of this
     * product, and the schema will not accept an orbit without a gizmo. Off the
     * axis because a view straight down the normal shows the relief as the flat
     * field it is a relief of — the fins hide behind their own faces, and the
     * first thing an author would see is the thing this mode exists to escape.
     */
    const aspect = width / Math.max(1, height);
    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.position.set(1.9, 1.25, 3.4);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    renderer.render(target, camera);
  }, [depth, fins, frame]);

  return (
    <canvas
      className={styles.canvas}
      /*
       * The fins the frame in front of you was drawn with.
       *
       * Published rather than inferred, for the same reason the flat canvas
       * publishes the loop position it drew: a proof that read the count from
       * state would be checking that state agrees with itself, where what has
       * to be true is that the *geometry* followed it.
       */
      data-studio-fins={fins ? `${fins.count}@${depth.toFixed(2)}` : "none"}
      // The product's one output, whichever renderer is drawing it. Two
      // canvases claiming to be the output would make every proof that reads
      // "the frame" ambiguous, so exactly one is mounted at a time.
      data-studio-relief=""
      data-toolcraft-product-output=""
      ref={canvasRef}
    />
  );
}
