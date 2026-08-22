import {
  STUDIO_RELIEF_DEPTH_TARGET,
  STUDIO_RELIEF_VIEW_TARGET,
} from "./studio-relief";

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
 * **There is no orientation gizmo, and that is a deviation taken deliberately.**
 * The contract says a rotatable scene declares one, and it is right: a gizmo is
 * the surface that makes an orbit legible and snappable. It cannot be shipped
 * here yet. A gizmo control must declare all seven orientation coverages, and
 * two of them are unreachable through no fault of this product — the model-drag
 * recipe finds its surface by an attribute only the runtime's model layer
 * writes, and the shared preconditions read an `aria-valuemax` the runtime's own
 * render-scale slider does not set. Both are filed upstream as issues 19 and 21
 * with patches.
 *
 * So the relief ships with the orbit it can prove: dragging the geometry turns
 * it, through the runtime's own interaction and against a product-supplied hit
 * test. What is lost is axis snapping and a visible handle, and the pose is
 * still a real, persisted, shared target — the gizmo is added the day the
 * recipes can see it, and nothing else has to change.
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
      depth: {
        semanticGroup: "composition",
        /*
         * Offered only while there is a relief to have depth.
         *
         * The one number this mode adds. Everything else the fins are made of —
         * how many, how wide, which inks, which way they run — comes from the
         * band field they are a relief *of*, because a Physichromie's fins are
         * that field turned edge-on rather than a second construction beside
         * it.
         */
        applicability: {
          all: [{ equals: "relief", target: STUDIO_RELIEF_VIEW_TARGET }],
          mode: "conditional",
        },
        defaultValue: 0.3,
        label: "How far they stand off",
        max: 1,
        min: 0,
        performanceReason:
          "One scale on geometry already described; the fin count is the band count the pipeline already declares, so nothing here adds a workload dimension.",
        performanceRole: "responsiveness",
        step: 0.05,
        target: STUDIO_RELIEF_DEPTH_TARGET,
        type: "slider",
      },
    },
    id: "composition-view",
    title: "The View",
  },
] as const;
