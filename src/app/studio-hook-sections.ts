import { STUDIO_HOOK_DEFAULT, STUDIO_HOOK_TARGET } from "./studio-hook";

/**
 * The author's own code, and the one action that takes it back.
 *
 * Its own section, last among the layer sections and before delivery, because
 * of what it acts on: every section above edits one layer, and this edits the
 * frame those layers composite into. It is the only control in the product
 * whose value can be *wrong* -- everything else is a control whose domain the
 * schema guarantees -- which is why the renderer keeps drawing the last program
 * that compiled and the error is surfaced rather than thrown.
 */
/**
 * **Two sections rather than one, and that is the framework rather than a
 * preference.** A `code` control is a compound control, and the runtime gives a
 * compound control a section of its own -- so an action sharing a section with
 * it produces two sections with one title between them. The same rule shaped
 * the Randomize section, where a lock could not sit beside the press it
 * excludes.
 */
export const STUDIO_HOOK_SECTIONS = [
  {
    controls: {
      source: {
        semanticGroup: "delivery",
        applicability: { mode: "always" },
        defaultValue: STUDIO_HOOK_DEFAULT,
        /*
         * The runtime's own `code` control rather than a third-party editor.
         *
         * It caps at twelve visible lines and scrolls, which is a constraint
         * that shaped the feature rather than one it works around: what is
         * editable is a self-contained chunk with a documented contract, not
         * the whole program. An editor big enough for the program would invite
         * editing the parts that hold the stack together.
         */
        label: "Your own code",
        // Whatever this costs is what the author wrote, which is the one place
        // in the product where the answer is not the schema's to give. What is
        // declared is the part that *is*: the chunk is compiled into the same
        // program the stack assembles, so it is one program per edit rather
        // than a second pass over the frame, and an unedited stack emits
        // nothing at all.
        performanceReason:
          "Compiled into the stack's own program and applied once to the composited colour; an unedited chunk is not emitted, so a stack nobody has edited assembles exactly as before.",
        performanceRole: "responsiveness",
        target: STUDIO_HOOK_TARGET,
        textValueKind: "structured",
        type: "code",
      },
    },
    id: "composition-hook",
    title: "Your Code",
  },
  {
    controls: {
      /*
       * A knob whose meaning is the author's.
       *
       * This is what became of "a uniform declared in the hook registers itself
       * as a control". That cannot be built here: the runtime takes its schema
       * once at mount, so a control nobody declared would have to be added by
       * editing signed source, and it would have neither an inventory entry nor
       * an acceptance row -- which is the gate that stops an unproved control
       * shipping.
       *
       * A fixed pool inverts the problem and keeps the substance. The controls
       * exist and are proved; what an author writes is which of them their code
       * reads. Written out rather than generated, because a schema that says
       * what it contains is one a reader can check against the panel.
       *
       * Labelled by position rather than by purpose: the purpose lives in a
       * chunk this schema cannot read, so the name in the code is the
       * documentation.
       */
      hookA: {
        semanticGroup: "delivery",
        applicability: { mode: "always" },
        defaultValue: 0,
        label: "Your parameter A",
        max: 1,
        min: 0,
        performanceReason:
          "One float uploaded per frame, and only when a chunk declares it; the value does not change the work per pixel.",
        performanceRole: "responsiveness",
        step: 0.01,
        target: "stack.hookA",
        type: "slider",
      },
      hookB: {
        semanticGroup: "delivery",
        applicability: { mode: "always" },
        defaultValue: 0,
        label: "Your parameter B",
        max: 1,
        min: 0,
        performanceReason:
          "One float uploaded per frame, and only when a chunk declares it; the value does not change the work per pixel.",
        performanceRole: "responsiveness",
        step: 0.01,
        target: "stack.hookB",
        type: "slider",
      },
      hookC: {
        semanticGroup: "delivery",
        applicability: { mode: "always" },
        defaultValue: 0,
        label: "Your parameter C",
        max: 1,
        min: 0,
        performanceReason:
          "One float uploaded per frame, and only when a chunk declares it; the value does not change the work per pixel.",
        performanceRole: "responsiveness",
        step: 0.01,
        target: "stack.hookC",
        type: "slider",
      },
      hookD: {
        semanticGroup: "delivery",
        applicability: { mode: "always" },
        defaultValue: 0,
        label: "Your parameter D",
        max: 1,
        min: 0,
        performanceReason:
          "One float uploaded per frame, and only when a chunk declares it; the value does not change the work per pixel.",
        performanceRole: "responsiveness",
        step: 0.01,
        target: "stack.hookD",
        type: "slider",
      },
    },
    id: "composition-hook-parameters",
    title: "Your Parameters",
  },
  {
    controls: {
      reset: {
        semanticGroup: "delivery",
        applicability: { mode: "always" },
        actions: [{ label: "Restore the shipped code", value: "reset-hook" }],
        label: "Starting over",
        performanceReason:
          "Writes one value; the program is reassembled by the same path any edit uses.",
        performanceRole: "responsiveness",
        target: "stack.hookReset",
        type: "actions",
      },
    },
    id: "composition-hook-reset",
    title: "Starting Over",
  },
] as const;
