import { expect, type Page } from "@playwright/test";

import { readStudioOutputSignature } from "./studio-product-helpers";

/**
 * Readers the stack proofs share, kept out of the spec that uses them.
 *
 * Not an abstraction for its own sake: the spec was eleven lines over the
 * per-file budget the code-health check enforces, and these two are the parts
 * of it that are machinery rather than argument. The reader below is serialised
 * into the page, so it closes over nothing.
 */

export const POINTER_REACH = (
  root: HTMLElement,
): {
  controlValue: unknown;
  outputSignature: string;
  selectedLayerId: string;
} => {
  const canvas = root.querySelector<HTMLCanvasElement>(
    "[data-toolcraft-product-output]",
  );
  const gl = canvas?.getContext("webgl2", { preserveDrawingBuffer: true });
  let outputSignature = "absent";

  if (canvas && gl && canvas.width > 0 && canvas.height > 0) {
    const at = (fx: number): string => {
      const width = 120;
      const x = Math.min(
        Math.max(Math.round(canvas.width * fx) - width / 2, 0),
        canvas.width - width,
      );
      const pixels = new Uint8Array(width * 4);
      gl.readPixels(
        x,
        Math.floor(canvas.height / 2),
        width,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      const seen = new Set<string>();
      for (let index = 0; index < pixels.length; index += 4) {
        seen.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
      }
      return seen.size > 8 ? "induced" : "plain";
    };

    outputSignature = `left=${at(0.4)} right=${at(0.6)}`;
  }

  const reach = root
    .querySelector('[data-toolcraft-control-target="stack.pointerSubject"]')
    ?.querySelector('[role="combobox"]');

  return {
    controlValue: {
      follow:
        root
          .querySelector(
            '[data-toolcraft-control-target="selectedLayer.engineCursor"] [role="switch"]',
          )
          ?.getAttribute("aria-checked") ?? "absent",
      reach: (reach?.textContent ?? "").replace(/[^A-Za-z]/gu, ""),
    },
    outputSignature,
    selectedLayerId:
      root
        .querySelector('[data-layer-id][aria-selected="true"]')
        ?.getAttribute("data-layer-id") ?? "",
  };
};

/**
 * Stack acceptance domain: decisions that belong to the whole stack.
 *
 * Separate file from `product-selected-layer.spec.ts` because the delivery
 * catalog requires one acceptance domain per spec file, and the line is a real
 * one rather than bookkeeping. "How many layers does the pointer move" and "the
 * canvas is a drawing surface now" are not properties of whichever row happens
 * to be highlighted — a layer only knows about itself, so neither question can
 * be asked of one. Everything left in the other file is a property of the
 * selection.
 */


/**
 * The composite once it has stopped moving.
 *
 * Every equality below compares two frames, so both have to be frames the
 * renderer has finished with. A read taken the instant a state change resolves
 * is not one: the commit lands, the pass redraws, and under a loaded suite
 * those are far enough apart to catch a half-drawn frame and report a
 * difference nothing in the product caused.
 */
export async function settleStudioFrame(page: Page): Promise<string> {
  const recent: string[] = [];
  await expect
    .poll(
      async () => {
        recent.push(await readStudioOutputSignature(page));
        if (recent.length > 3) recent.shift();
        return recent.length === 3 && new Set(recent).size === 1;
      },
      { intervals: [200], timeout: 30_000 },
    )
    .toBe(true);
  return recent[recent.length - 1] ?? "";
}
