import { STUDIO_RELIEF_POSE_TARGET, STUDIO_RELIEF_VIEW_TARGET } from "./studio-relief";

/**
 * The spatial mode, and the one control that turns it on.
 *
 * **Why the product has two views at all.** A Physichromie is lamellae — thin
 * fins standing off a support — and its colour changing as a viewer moves is
 * the phenomenon rather than an effect over it. Everything else in this studio
 * does that in the plane, as a shift computed from an angle. That is a
 * simulation of the effect, and a good one; it is not the effect. Standing the
 * fins up and letting a viewer move around them is.
 *
 * **Why it is a mode rather than a layer kind.** A layer composites into a
 * frame; this replaces what draws the frame. The stack renderer and the relief
 * renderer are two programs that cannot both own one canvas, so the choice is
 * at the level of the view rather than of a layer in it.
 *
 * The gizmo lives here rather than in a section of its own, because the
 * contract says to declare it in the section that owns the view — which is what
 * makes section and global reset return the pose along with the mode it belongs
 * to.
 */
export const STUDIO_RELIEF_SECTIONS = [
  {
    controls: {
      view: {
        semanticGroup: "composition",
        applicability: { mode: "always" },
        defaultValue: "flat",
        label: "How it is drawn",
        options: [
          { label: "As a field", value: "flat" },
          { label: "As a relief", value: "relief" },
        ],
        performanceReason:
          "Chooses which renderer owns the canvas; exactly one is mounted, so the cost is one of the two rather than both.",
        performanceRole: "responsiveness",
        target: STUDIO_RELIEF_VIEW_TARGET,
        type: "select",
      },
      pose: {
        semanticGroup: "composition",
        /*
         * Shown only while there is something to orbit.
         *
         * The contract allows more than one gizmo declaration only for modes
         * that are statically provably exclusive, and rejects any state where
         * two orientation handles are visible. There is one here, and it is
         * gated on the mode that has geometry — a handle offered over a flat
         * field would be a promise the view cannot keep.
         */
        applicability: {
          all: [{ equals: "relief", target: STUDIO_RELIEF_VIEW_TARGET }],
          mode: "conditional",
        },
        /*
         * Off the axis on purpose. A pose looking straight down the normal
         * shows the relief as the flat field it is a relief of — the lamellae
         * hide behind their own faces, and the first thing an author sees is
         * the thing this mode exists to escape.
         */
        defaultValue: { position: [2.4, 1.6, 4.2], up: [0, 1, 0] },
        keyframeable: false,
        label: false,
        performanceReason:
          "Reads as a camera position each frame; the scene's own work does not change with it.",
        performanceRole: "responsiveness",
        target: STUDIO_RELIEF_POSE_TARGET,
        type: "orientationGizmo",
      },
    },
    id: "composition-view",
    title: "The View",
  },
] as const;
