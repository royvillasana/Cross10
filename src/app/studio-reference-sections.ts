/**
 * Nothing. The reference has no panel section any more.
 *
 * It had two: a picker, which moved into the flow when choosing moved there,
 * and a `Reference View` holding opacity and a compare mode. The product owner
 * removed the second on sight -- a study is not something you keep adjusting
 * beside the work, it is something you set when you pick one and then get on
 * with building. Both now live in the dialog step that chooses the study, where
 * the picture they describe is on screen to compare against.
 *
 * The targets are unchanged and still product-owned: `reference.entry`,
 * `reference.opacity` and `reference.compare` are written by the dialog and read
 * by the overlay. What went is the control surface, not the state.
 *
 * The export kept rather than deleted, because the schema composes a list of
 * section groups and an empty one says "this product has no reference section"
 * more clearly than a missing import does.
 */
export const STUDIO_REFERENCE_SECTIONS: readonly never[] = [];
