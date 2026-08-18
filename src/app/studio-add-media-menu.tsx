import * as React from "react";

/**
 * A third item in the layers panel's `+` menu: **Media**.
 *
 * **Why this is done to the DOM rather than through the schema.** The menu is
 * two hardcoded buttons in `layers-panel.tsx`, which is signed runtime source
 * with no composition point (upstream issue 18). Editing it would break the
 * integrity gate permanently. So the product waits for the menu to open and adds
 * its own item to it.
 *
 * **Why the item does not import anything itself.** It cannot: a product can
 * dispatch `media.import` but cannot stage the bytes behind it, so an import
 * written here produces a layer that draws nothing — which was tried and
 * reverted. What this does instead is press the runtime's own file control on
 * the author's behalf. The runtime then decodes, stages, allocates and creates
 * the layer exactly as it always has. The product relays a click; it does not
 * take over media.
 *
 * The control being pressed still exists, still declared and still proved. It is
 * hidden from view in `studio-hidden-controls.css` so the panel does not carry a
 * drop zone the author was told twice they did not want, while remaining in the
 * document so it can be clicked and so its acceptance evidence stays honest.
 *
 * This is a deliberate deviation, taken on instruction after the supported
 * routes were shown to be closed. It is confined to one file, touches nothing
 * signed, and fails visibly rather than silently: if the runtime renames the
 * menu or the control, the item stops appearing and the file control comes back
 * into view.
 */

/** The runtime's own import control, wherever the panel has put it. */
const MEDIA_CONTROL = '[data-toolcraft-control-target="media.image"]';

/** Marks the item so it is added once per opening rather than once per mutation. */
const ADDED = "data-studio-add-media";

function findAddLayerMenu(): HTMLElement | null {
  const popovers = document.querySelectorAll<HTMLElement>(
    '[data-slot="popover-content"]',
  );
  for (const popover of popovers) {
    const buttons = [...popover.querySelectorAll("button")];
    // Identified by what it contains rather than by a class or position: the
    // menu is the one offering to add a Layer and a Group.
    const isAddMenu =
      buttons.some((button) => button.textContent?.trim() === "Layer") &&
      buttons.some((button) => button.textContent?.trim() === "Group");
    if (isAddMenu) return popover;
  }
  return null;
}

function openSystemFilePicker(): void {
  const input = document.querySelector<HTMLInputElement>(
    `${MEDIA_CONTROL} input[type="file"]`,
  );
  // Called synchronously inside the click handler, because the browser only
  // opens a file dialog while it still considers itself inside a user gesture.
  input?.click();
}

export function StudioAddMediaMenuItem(): null {
  React.useEffect(() => {
    const addItem = (): void => {
      const menu = findAddLayerMenu();
      if (!menu || menu.querySelector(`[${ADDED}]`)) return;

      const template = [...menu.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Group",
      );
      if (!template) return;

      // Cloned from the sibling rather than built, so the item inherits the
      // menu's classes *and* its icon slot. Restating either would drift the
      // moment the runtime restyles its own menu, and a bare button beside two
      // iconed ones reads as broken rather than as added.
      const item = template.cloneNode(true) as HTMLButtonElement;
      item.setAttribute(ADDED, "");
      item.type = "button";

      const icon = item.querySelector("svg");
      if (icon) {
        // A framed picture, in the stroke weight the neighbouring icons use.
        icon.innerHTML =
          '<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
          '<circle cx="8.5" cy="9.5" r="1.6" fill="currentColor"/>' +
          '<path d="M4 17l5-5 4 4 3-2 4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
        icon.setAttribute("viewBox", "0 0 24 24");
      }

      // Replaces the label without disturbing the icon beside it.
      for (const node of [...item.childNodes]) {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = "Media";
      }
      if (!item.textContent?.includes("Media")) item.append("Media");
      item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openSystemFilePicker();
        // The menu is deliberately not dismissed here, because it cannot be.
        // The popover ignores untrusted events: a synthetic Escape, an outside
        // pointerdown and a second press of its own trigger were all tried and
        // all ignored, and hiding its element is worse than useless because the
        // same node is reused the next time it opens. So the system dialog
        // covers it and the author's next real click closes it, which is how a
        // menu behaves anywhere else when a modal opens over it.
      });
      menu.append(item);
    };

    addItem();
    const observer = new MutationObserver(addItem);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
