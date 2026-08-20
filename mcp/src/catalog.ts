import {
  STUDIO_PRESETS,
  STUDIO_SERIES,
  studioPresetLayerEntry,
  studioPresetPickerLabel,
  type StudioPreset,
} from "../../src/app/studio-presets";
import { studioAssembleDeliverableSource } from "../../src/app/studio-source";
import { studioSelectedLayerTarget } from "../../src/app/studio-stack-state";

/**
 * What this package serves, and why it is a package rather than a route.
 *
 * The studio's artifact is the shader, not the picture: a composition leaves as
 * source that compiles somewhere else. A clipboard action delivers that to a
 * person; this delivers it to an agent, which is the primary path the product
 * was designed around -- an agent can ask what the library holds, pick an
 * entry, override a parameter and get source back without a browser, a canvas,
 * or a human in the loop.
 *
 * **Outside the signed app on purpose.** The integrity manifest covers the
 * runtime, and anything inside it inherits an obligation to stay byte-identical
 * to what was signed. A delivery surface should be free to change with the
 * things it delivers, so it lives in its own package with its own dependency,
 * importing the product's library rather than restating it.
 *
 * That import direction is the whole design. The gallery, the layer types, the
 * uniform defaults and the assembler are the app's, so an entry served here is
 * the same entry the studio draws -- there is no second copy of the library to
 * drift, and a preset corrected in the product is corrected here by rebuilding
 * nothing.
 */

/** One entry as an agent needs to see it: enough to choose between them. */
export type StudioCatalogEntry = Readonly<{
  id: string;
  label: string;
  /** The full picker label, which names the series and how it relates to it. */
  title: string;
  series: string;
  /**
   * Whether a flat rectangle carries the investigation or only evokes it.
   *
   * Served rather than hidden because it is the one thing an agent choosing
   * between entries could otherwise get wrong: four of these series are rooms a
   * visitor walks through, and a picture of one is not a rendering of it.
   */
  carriage: "carry" | "evoke";
  layers: readonly Readonly<{ name: string; typeId: string }>[];
  /** Where the colours came from. Always the studio's own; never an artist's. */
  palette: string;
}>;

export function studioCatalog(): readonly StudioCatalogEntry[] {
  return STUDIO_PRESETS.map((preset) => ({
    carriage: STUDIO_SERIES[preset.series].carriage,
    id: preset.id,
    label: preset.label,
    layers: preset.layers.map((layer) => ({ name: layer.name, typeId: layer.typeId })),
    palette: preset.palette,
    series: STUDIO_SERIES[preset.series].label,
    title: studioPresetPickerLabel(preset),
  }));
}

export function findStudioCatalogEntry(id: string): StudioPreset | undefined {
  return STUDIO_PRESETS.find((preset) => preset.id === id);
}

/**
 * The parameters an override may name, per layer, with their current values.
 *
 * Served so an agent does not have to guess: the names are the uniform names
 * the entry's own values are keyed by, which are also the names an override
 * uses. A tool that accepted overrides without saying what could be overridden
 * would be asking callers to read this file.
 */
export function studioEntryParameters(
  preset: StudioPreset,
): readonly Readonly<{ layer: string; values: Record<string, unknown> }>[] {
  return preset.layers.map((layer) => ({
    layer: layer.name,
    values: { ...layer.values },
  }));
}

/** An override, addressed the way the entry is: by layer index and uniform name. */
export type StudioParameterOverride = Readonly<{
  layer: number;
  name: string;
  value: unknown;
}>;

/**
 * Assembled source for a named entry, with the overrides applied.
 *
 * Overrides are folded in through the same function a control edit goes
 * through, so a value written here is normalised exactly as the studio would
 * normalise it -- a hex colour becomes the linear triple the shader reads, and
 * an option's own string becomes the index the branch tests. Applying them to
 * the record directly would deliver source in which a colour is the string
 * "#ff0000".
 */
export function studioEntrySource({
  overrides = [],
  preset,
}: {
  readonly overrides?: readonly StudioParameterOverride[];
  readonly preset: StudioPreset;
}): string {
  const layers = preset.layers.map((layer, index) => {
    const named = overrides.filter((override) => override.layer === index);
    const entry = studioPresetLayerEntry(layer);
    if (named.length === 0) return entry;

    return studioPresetLayerEntry({
      ...layer,
      values: {
        ...layer.values,
        ...Object.fromEntries(named.map((override) => [override.name, override.value])),
      } as typeof layer.values,
    });
  });

  return studioAssembleDeliverableSource({
    backgroundColor: [0, 0, 0],
    cursor: [0, 0],
    includeBackground: false,
    layers,
    loop: 0,
  });
}

/** Every parameter name an override may use, so a bad name fails loudly. */
export function studioOverrideNames(preset: StudioPreset): readonly string[] {
  return [
    ...new Set(preset.layers.flatMap((layer) => Object.keys(layer.values))),
  ].sort();
}

/** The control target a uniform name belongs to, for callers that want it. */
export const studioOverrideTarget = studioSelectedLayerTarget;
