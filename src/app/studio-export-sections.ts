/**
 * Image export settings and the delivery action.
 *
 * Both are obligations of declaring image export rather than features the layer
 * stack asked for: an app with Export PNG must expose format and resolution in
 * their own section titled "Image Export", laid out as one compact two-column
 * inline row, and must put the export action in the controls panel's sticky
 * footer as `panelActions`.
 *
 * Resolution is a select rather than a slider because the contract mandates one
 * here — which also means it cannot carry the numeric bounds a workload
 * dimension would need, so it is declared for responsiveness instead.
 *
 * The shader itself does not leave through either of these (R55). Source goes to
 * the clipboard or the MCP; this section covers the picture, which is a
 * genuinely separate artifact.
 */

export const STUDIO_EXPORT_SECTIONS = [
  {
    controls: {
      format: {
        applicability: { mode: "always" },
        defaultValue: "png",
        label: "Format",
        options: [
          { label: "PNG", value: "png" },
          { label: "JPG", value: "jpg" },
        ],
        performanceReason:
          "Format selects the runtime encoder for one export action.",
        performanceRole: "responsiveness",
        target: "export.image.format",
        type: "select",
      },
      resolution: {
        applicability: { mode: "always" },
        defaultValue: "4k",
        label: "Resolution",
        options: [
          { label: "2K", value: "2k" },
          { label: "4K", value: "4k" },
          { label: "8K", value: "8k" },
        ],
        performanceReason:
          "Resolution sets the exported long edge, but the runtime owns artifact backing allocation and encoding; the contract also mandates a select here, which cannot carry the numeric schema bounds a workload dimension requires.",
        performanceRole: "responsiveness",
        target: "export.image.resolution",
        type: "select",
      },
    },
    id: "image-export",
    layoutGroups: [
      { columns: 2, controls: ["format", "resolution"], layout: "inline" },
    ],
    title: "Image Export",
  },
  {
    controls: {
      // MP4 first, and it is the only one of the two that matters here: it is
      // what the destinations this output is sized for accept. WebM is offered
      // because the contract fixes the option list, not because anything asks
      // for it.
      format: {
        applicability: { mode: "always" },
        defaultValue: "mp4",
        label: "Format",
        options: [
          { label: "MP4", value: "mp4" },
          { label: "WebM", value: "webm" },
        ],
        performanceReason:
          "Format selects the runtime encoder for one export action; the renderer draws the same frames either way.",
        performanceRole: "responsiveness",
        target: "export.video.format",
        type: "select",
      },
      // "Current" rather than 4K by default, and that is a real choice: a video
      // is watched at the size it was made for, and encoding a six-second loop
      // at 4096 costs minutes of the author's time for pixels the destination
      // immediately throws away.
      resolution: {
        applicability: { mode: "always" },
        defaultValue: "current",
        label: "Resolution",
        options: [
          { label: "Current", value: "current" },
          { label: "4K", value: "4k" },
        ],
        performanceReason:
          "Resolution sets the exported long edge, but the runtime owns artifact backing allocation and encoding; the contract also mandates a select here, which cannot carry the numeric schema bounds a workload dimension requires.",
        performanceRole: "responsiveness",
        target: "export.video.resolution",
        type: "select",
      },
    },
    id: "video-export",
    layoutGroups: [
      { columns: 2, controls: ["format", "resolution"], layout: "inline" },
    ],
    title: "Video Export",
  },
  {
    controls: {
      delivery: {
        applicability: { mode: "always" },
        actions: [
          // Video first, because `export-pipeline` requires it primary once the
          // intent declares it. Worth naming rather than absorbing: an author
          // who only ever wanted stills now finds their button demoted, and
          // that is the spec's call rather than this change's.
          {
            icon: "upload-simple",
            label: "Export Video",
            role: "export-video",
            value: "export-video",
          },
          {
            icon: "upload-simple",
            label: "Export PNG",
            role: "export-image",
            value: "export-image",
          },
          {
            // No `role`: copying the source writes no artifact and downloads
            // nothing, so the recorded image-and-video artifact intent stands.
            // It rides on the same acceptance entry as Export PNG because the
            // sticky footer is one surface -- footer coverage is checked against
            // every action in it, whichever control declares them.
            icon: "copy",
            label: "Copy shader source",
            value: "copy-source",
          },
        ],
        target: "export.actions",
        type: "panelActions",
      },
    },
    id: "delivery-actions",
  },
] as const;
