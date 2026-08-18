/**
 * One door, and nothing else.
 *
 * Everything that *decides* something moved into the flow: the thumbnails, the
 * technique change and its confirmation went first, and the narrow application
 * -- picking a composition and pushing it onto the selection -- followed when
 * the product owner pointed out that an action which replaces work is a thing
 * you should be asked about, not a button that is always sitting there.
 *
 * What is left is the way in. A door decides nothing: it opens the surface that
 * asks the question, and the question is asked in one place.
 *
 * `gallery.entry` is still a value and is still what an application applies; it
 * simply has no control any more. The dialog writes it, the apply reads it, and
 * one target keeps one meaning across both.
 *
 * Restore went with them for the same reason. Taking back a replacement belongs
 * beside the replacing, and a panel row offering to undo something the author
 * may never have done is a row that is wrong most of the time.
 */
export const STUDIO_GALLERY_SECTIONS = [
  {
    controls: {
      // The door. It reopens the flow rather than doing anything itself, which
      // is why it is one press with no confirmation attached: what it opens asks
      // its own question, and asking twice trains the answer out of anyone.
      open: {
        semanticGroup: "composition",
        applicability: { mode: "always" },
        actions: [
          { label: "Change the technique", value: "open-onboarding" },
          { label: "Apply to the selection", value: "open-apply" },
          { label: "Work against a study", value: "open-reference" },
        ],
        label: "What the canvas is working in",
        performanceReason:
          "Opens a product surface; nothing is rendered and no value changes until a choice is made in it.",
        performanceRole: "responsiveness",
        target: "gallery.actions",
        type: "actions",
      },
    },
    id: "composition",
    title: "Composition",
  },
  {
    controls: {
      /*
       * Still here, and not because it was overlooked.
       *
       * Restore was meant to move into the flow with everything else that
       * decides something. It could not: the dialog reads runtime state through
       * a selector and the snapshot does not reach it, while `onPanelAction`
       * sees the same value perfectly well. Until that is understood, a restore
       * rendered in the dialog would be a button that is invisible exactly when
       * an author needs it, which is worse than a row in the wrong place.
       *
       * Recorded as `outstanding` 1a.6.
       */
      restore: {
        semanticGroup: "composition",
        applicability: { mode: "always" },
        actions: [{ label: "Restore previous", value: "restore-stack" }],
        label: "Undoing the last replacement",
        performanceReason:
          "Rewrites the layer list and one record from a held snapshot; the frame is redrawn by the pass any edit uses.",
        performanceRole: "responsiveness",
        target: "gallery.restore",
        type: "actions",
      },
    },
    id: "composition-restore",
    title: "Previous Stack",
  },
] as const;
