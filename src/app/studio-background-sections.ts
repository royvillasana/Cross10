/**
 * Background source.
 *
 * Declared by the product but relocated by the runtime into Setup, which is
 * where the contract requires it: an app with artifact export must expose
 * `export.includeBackground` as a Background switch and a renderer-owned
 * background colour beside it, and preview, image export, and video export must
 * all read that same colour so the three cannot diverge.
 *
 * This section is an obligation of declaring image export rather than something
 * the layer stack asked for. It is real all the same — a composite whose lowest
 * layer is a partly transparent gradient shows whatever sits behind it, so the
 * ground genuinely is part of the picture.
 */

export const STUDIO_BACKGROUND_SECTIONS = [
  {
    controls: {
      includeBackground: {
        applicability: { mode: "always" },
        defaultValue: true,
        label: "Background",
        performanceReason:
          "Toggling the background changes one uniform read by the composite; layer workload is unchanged.",
        performanceRole: "responsiveness",
        target: "export.includeBackground",
        type: "switch",
      },
      color: {
        // Conditional on the switch beside it, and not merely for tidiness:
        // with the background excluded the composite starts fully transparent,
        // so the colour has nothing to colour. A control that is visible but
        // cannot change the output is what applicability exists to prevent.
        applicability: {
          all: [{ equals: true, target: "export.includeBackground" }],
          mode: "conditional",
        },
        defaultValue: "#000000",
        label: "Background color",
        performanceReason:
          "The background colour is one uniform upload consumed by the composite.",
        performanceRole: "responsiveness",
        target: "appearance.background",
        type: "color",
      },
    },
    id: "background",
    title: "Background",
  },
] as const;
