/**
 * The author's own code, as a chunk of the program the studio assembles.
 *
 * **Why this is not the opposite of delivery.** The studio's artifact is the
 * shader: a composition leaves as source that compiles elsewhere. That looked
 * like the alternative to letting someone hand-edit the shader — one makes an
 * editor, the other makes an instrument whose output happens to be readable.
 *
 * It is only the alternative if the hook lives *outside* the assembled program.
 * This one is inside it: the hook is a function the assembler emits and the
 * composite calls, so what leaves through `Copy shader source` or the MCP
 * package already contains whatever was typed here. Source is still one-way.
 * The hook is upstream of delivery rather than a second path around it.
 *
 * **Applied to the composite rather than to "the active engine",** which is
 * what the requirement said and what this product has no such thing as: every
 * layer carries its own engine, so there is no single active one. The one place
 * a single editable hook belongs is where a single thing exists — after the
 * layers have composited, with the frame's colour in hand.
 */

/** The function the assembler emits and the composite calls. */
export const STUDIO_HOOK_ENTRY = "studioUserHook";

/** Where the author's source lives in state. Product-owned, so persisted by name. */
export const STUDIO_HOOK_TARGET = "stack.hookSource";

/**
 * The shipped hook: the identity, written out rather than left empty.
 *
 * A pass-through that returns what it was given is the honest default, and
 * writing it out matters more than it looks. An empty editor says "type
 * something" and nothing about *what* — the contract, the names in scope, what
 * a return value means. Four lines of code that do nothing teach all three, and
 * the first edit an author makes is to a working program rather than to a blank
 * one.
 */
export const STUDIO_HOOK_DEFAULT = `// colour: what the stack composited, in linear light.
// uv: 0 to 1 across the frame. loop: 0 to 1 through the loop.
vec3 hook(vec3 colour, vec2 uv, float loop) {
  return colour;
}`;

/** The hook an author has written, or the shipped one. */
export function readStudioHookSource(value: unknown): string {
  return typeof value === "string" && value.trim() !== ""
    ? value
    : STUDIO_HOOK_DEFAULT;
}

/**
 * Whether a hook is the shipped one, which decides whether it is emitted at all.
 *
 * A pass-through compiled into every program would cost nothing at runtime and
 * something worse at delivery: every copied shader would carry a function that
 * does nothing, and a reader would have to work out that it is inert. A stack
 * nobody has hand-edited assembles exactly as it did before this existed.
 */
export function isStudioHookDefault(source: string): boolean {
  // Blank counts as shipped. Nothing typed and the shipped pass-through are the
  // same statement -- "this composition has no hand-written part" -- and
  // treating an empty string as a custom hook would emit a chunk with no
  // function in it and fail to compile for a stack nobody had edited.
  if (source.trim() === "") return true;

  return normalizeStudioHook(source) === normalizeStudioHook(STUDIO_HOOK_DEFAULT);
}

/** Whitespace-insensitive, so re-indenting the shipped hook is not an edit. */
function normalizeStudioHook(source: string): string {
  return source.replace(/\s+/gu, " ").trim();
}

/**
 * The hook wrapped in the function the composite calls.
 *
 * The author writes `hook`, and the assembler emits a differently-named wrapper
 * around it. That indirection is what keeps the two contracts separate: the
 * name the program calls is the studio's business and stable, while the name in
 * the editor is short enough to read in a twelve-line control.
 */
export function studioHookChunk(source: string): string {
  if (isStudioHookDefault(source)) return "";

  return `
${source}

vec3 ${STUDIO_HOOK_ENTRY}(vec3 colour, vec2 uv, float loop) {
  return hook(colour, uv, loop);
}
`;
}

/**
 * How many lines the assembler puts above the author's first line.
 *
 * Needed to correct a compiler's line numbers back to what the editor shows.
 * A message pointing at line 412 of a program nobody wrote is worse than no
 * message: it tells an author the error is somewhere they cannot look.
 */
export function studioHookLineOffset(assembled: string, source: string): number {
  const first = source.split("\n")[0] ?? "";
  const at = assembled.indexOf(first);
  if (at === -1) return 0;

  return assembled.slice(0, at).split("\n").length - 1;
}

/**
 * A compiler message with its line numbers moved back into the editor's frame.
 *
 * GLSL reports `ERROR: 0:412: ...`, where 412 counts from the top of the
 * assembled program. The author is looking at a twelve-line control. Rewriting
 * the number is the difference between a message that locates the mistake and
 * one that proves only that something is wrong.
 */
export function correctStudioHookErrors(
  message: string,
  offset: number,
): string {
  return message.replace(
    /ERROR:\s*(\d+):(\d+):/gu,
    (whole, column: string, line: string) => {
      const corrected = Number(line) - offset;
      return corrected > 0 ? `line ${corrected}:` : whole;
    },
  );
}
