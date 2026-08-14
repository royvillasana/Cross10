import { type StudioLayerTypeId } from "./studio-layers";
import {
  collectStudioSelectedLayerEdit,
  studioSelectedLayerTarget,
  type StudioLayerRecord,
  type StudioLayerRecordEntry,
} from "./studio-stack-state";

/**
 * The built-in preset library, and what applying one does.
 *
 * A preset here is an ordered **stack** rather than Croix10's map of target to
 * value (R71). That shape could not say what half of these compositions are:
 * "two stripe layers at different angles" is two entries under one target, and
 * the technique that made them worth porting is often the relationship between
 * the layers rather than either layer's own settings.
 *
 * Values are authored the way a control holds them -- hex for a colour, the
 * option's own value for a select -- and converted once, by the same function
 * that folds a control edit into the record. Authoring them in the shader's
 * representation would mean writing linear triples and option indices by hand,
 * and a preset nobody can read is a preset nobody will correct.
 *
 * Every layer sets `maskSize: 0`. A layer arrives confined to a shape (R65),
 * which is right for building a composition and wrong for a preset: these are
 * whole-frame fields, and zero is how the vocabulary says "the whole frame".
 *
 * **The palettes are Croix10's, which recorded them as plausible rather than
 * verified.** Checking them against primary sources is its own task, and
 * nothing here has done it.
 */

export type StudioPresetLayer = Readonly<{
  /** What the layers panel calls it, so the stack reads as the composition. */
  name: string;
  typeId: StudioLayerTypeId;
  /** Keyed by uniform name, valued as the control holds it. */
  values: Readonly<Record<string, boolean | number | string>>;
}>;

export type StudioPreset = Readonly<{
  id: string;
  label: string;
  /** Bottom first, which is the order the runtime holds and the stack draws. */
  layers: readonly StudioPresetLayer[];
}>;

/** Cruz-Diez's palette as Croix10 recorded it, named so a stack can be read. */
const INK = {
  amber: "#F2B300",
  black: "#000000",
  blue: "#0B3C8A",
  cyan: "#00A0C6",
  green: "#0B7A3B",
  magenta: "#E4007F",
  red: "#C8102E",
  white: "#FFFFFF",
  yellow: "#FFE800",
} as const;

export const STUDIO_PRESETS: readonly StudioPreset[] = [
  {
    id: "additive-bands",
    label: "Additive Bands",
    // Couleur additive is a band field whose separators are windows onto the
    // support (R67), and in a stack what shows through a window is the layer
    // beneath -- so the technique is two layers rather than one setting.
    layers: [
      {
        name: "Support",
        typeId: "gradient",
        values: { colorA: INK.blue, colorB: INK.green, maskSize: 0, rampType: "linear" },
      },
      {
        name: "Bands",
        typeId: "stripes",
        values: {
          angle: 0,
          colorA: INK.green,
          colorB: INK.red,
          count: 48,
          maskSize: 0,
          separator: 0.18,
          widthRatio: 0.5,
        },
      },
    ],
  },
  {
    id: "induced-third",
    label: "Induced Third",
    // Narrow separators and unequal band widths push the induced colour at each
    // boundary, which is what the series is about.
    layers: [
      {
        name: "Support",
        typeId: "gradient",
        values: { colorA: INK.black, colorB: INK.blue, maskSize: 0, rampType: "linear" },
      },
      {
        name: "Bands",
        typeId: "stripes",
        values: {
          angle: 12,
          colorA: INK.amber,
          colorB: INK.blue,
          colorC: INK.magenta,
          colorD: INK.green,
          count: 140,
          maskSize: 0,
          paletteSlots: 4,
          separator: 0.06,
          widthRatio: 0.55,
        },
      },
    ],
  },
  {
    id: "physichromie-500",
    label: "Physichromie 500",
    // The relief read head-on-ish: each strip presenting some of its neighbour.
    // Croix10 asked for 220 bands and this field's count stops at 200, which is
    // the Nyquist limit against pixel pitch rather than a performance bound.
    layers: [
      {
        name: "Relief",
        typeId: "stripes",
        values: {
          angle: 0,
          colorA: INK.green,
          colorB: INK.white,
          colorC: INK.red,
          colorD: INK.blue,
          count: 200,
          engine: "physichromie",
          engineAmount: 0.45,
          maskSize: 0,
          paletteSlots: 4,
        },
      },
    ],
  },
  {
    id: "lamella-sweep",
    label: "Lamella Sweep",
    layers: [
      {
        name: "Lamellae",
        typeId: "stripes",
        values: {
          angle: 0,
          colorA: INK.black,
          colorB: INK.amber,
          colorC: INK.cyan,
          count: 200,
          engine: "physichromie",
          engineAmount: 1,
          maskSize: 0,
          paletteSlots: 3,
        },
      },
    ],
  },
  {
    id: "induction-grid",
    label: "Induction Grid",
    // Black and white only: the colour in this one is entirely induced, which
    // is the claim the technique makes and the reason the palette is empty of
    // it.
    layers: [
      {
        name: "Grid",
        typeId: "stripes",
        values: {
          angle: 0,
          colorA: INK.black,
          colorB: INK.white,
          count: 180,
          engine: "induction",
          engineAmount: 0.8,
          maskSize: 0,
        },
      },
    ],
  },
  {
    id: "afterimage-rose",
    label: "Afterimage Rose",
    layers: [
      {
        name: "Rose",
        typeId: "stripes",
        values: {
          angle: 24,
          colorA: INK.magenta,
          colorB: INK.green,
          count: 150,
          engine: "induction",
          engineAmount: 0.55,
          maskSize: 0,
        },
      },
    ],
  },
  {
    id: "saturation-chamber",
    label: "Saturation Chamber",
    // Chromosaturation is a full-field wash with no band structure, which in
    // this product is a gradient layer (R67). Two of them, so the chamber has
    // the two colours meeting that the installation is made of.
    layers: [
      {
        name: "Chamber",
        typeId: "gradient",
        values: {
          angle: 0,
          colorA: INK.red,
          colorB: INK.green,
          colorC: INK.blue,
          maskSize: 0,
          paletteSlots: 3,
          rampType: "linear",
        },
      },
      {
        name: "Wash",
        typeId: "gradient",
        values: {
          colorA: INK.blue,
          colorB: INK.red,
          maskSize: 0,
          opacity: 0.45,
          rampType: "radial",
        },
      },
    ],
  },
  {
    id: "interference-beat",
    label: "Interference Beat",
    layers: [
      {
        name: "Beat",
        typeId: "stripes",
        values: {
          angle: 0,
          colorA: INK.cyan,
          colorB: INK.amber,
          colorC: INK.magenta,
          count: 60,
          engine: "chromointerference",
          engineAmount: 0.7,
          enginePitch: 1.06,
          maskSize: 0,
          paletteSlots: 3,
        },
      },
    ],
  },
  {
    id: "moire-wedge",
    label: "Moiré Wedge",
    // The wedge is the taper (R59) and the moiré is the second structure
    // beating against the first, so this one needs both halves of group 4.
    layers: [
      {
        name: "Wedge",
        typeId: "stripes",
        values: {
          angle: 0,
          colorA: INK.blue,
          colorB: INK.red,
          count: 96,
          engine: "chromointerference",
          engineAmount: 0.6,
          enginePitch: 1.24,
          maskSize: 0,
          taper: 0.35,
        },
      },
    ],
  },
  {
    id: "transchromie-sheets",
    label: "Transchromie Sheets",
    // Sheets of transparent colour laid over one another, where the overlaps
    // carry colours no sheet contains. That is the stack with multiply
    // blending in linear light (R67), so it is three layers and no engine.
    layers: [
      {
        name: "Sheet — cyan",
        typeId: "gradient",
        values: { angle: 160, colorA: INK.cyan, colorB: INK.white, maskSize: 0 },
      },
      {
        name: "Sheet — magenta",
        typeId: "gradient",
        values: {
          angle: 20,
          blendMode: "multiply",
          colorA: INK.magenta,
          colorB: INK.white,
          maskSize: 0,
          opacity: 0.65,
        },
      },
      {
        name: "Sheet — yellow",
        typeId: "gradient",
        values: {
          angle: 90,
          blendMode: "multiply",
          colorA: INK.yellow,
          colorB: INK.white,
          maskSize: 0,
          opacity: 0.55,
        },
      },
    ],
  },
];

export function findStudioPreset(id: unknown): StudioPreset | null {
  if (typeof id !== "string") return null;
  return STUDIO_PRESETS.find((preset) => preset.id === id) ?? null;
}

/** The record entry a preset layer describes, in the shader's own units. */
export function studioPresetLayerEntry(layer: StudioPresetLayer): StudioLayerRecordEntry {
  return collectStudioSelectedLayerEdit(
    { typeId: layer.typeId, values: {} },
    Object.fromEntries(
      Object.entries(layer.values).map(([name, value]) => [
        studioSelectedLayerTarget(name),
        value,
      ]),
    ),
  );
}

/**
 * What applying a preset asks the runtime to do.
 *
 * A plan rather than a dispatch, so the interesting part is testable without a
 * runtime -- and the interesting part is that this is a *replacement*: every
 * layer present goes, the preset's layers arrive in its own order, and the
 * record is written once for exactly the ids that now exist.
 *
 * **It is not one undo step, and cannot be.** `layers.add` and `layers.delete`
 * take no history options -- only `controls.setValue` and
 * `canvas.applySettings` do -- so each layer command is its own patch. The
 * alternative would be a product-authored batch command over the layer list,
 * which is a second scene format for a collection the runtime owns (R56).
 *
 * **And undo does not currently step back through them at all**, which was
 * found while proving this and is not this feature's doing: adding one layer by
 * hand and pressing the toolbar's Undo ten times leaves the layer in place. The
 * likely cause is the layer sync committing a patch of its own after every
 * change, so each undo pops that instead of the layer command underneath it.
 * Recorded in the change's tasks; nothing here claims otherwise.
 *
 * Ids are derived from the preset and the index rather than left to the
 * runtime, because the record has to be written for layers that do not exist
 * yet: a record keyed by ids the runtime chose would need the ids back before
 * it could be written, and there is no round trip for that inside one gesture.
 */
export function planStudioPresetApplication({
  layerIds,
  preset,
}: {
  readonly layerIds: readonly string[];
  readonly preset: StudioPreset;
}): readonly Readonly<Record<string, unknown>>[] {
  const commands: Readonly<Record<string, unknown>>[] = [];

  for (const layerId of layerIds) {
    commands.push({ layerId, type: "layers.delete" });
  }

  const record: Record<string, StudioLayerRecordEntry> = {};
  preset.layers.forEach((layer, index) => {
    const id = `${preset.id}-${index + 1}`;
    record[id] = studioPresetLayerEntry(layer);
    commands.push({
      insertIndex: index,
      layer: { id, name: layer.name, visible: true },
      type: "layers.add",
    });
  });

  commands.push({
    label: `Apply ${preset.label}`,
    // Exactly the entries the new stack needs. Merging with what was there
    // would leave a deleted layer's values behind to be restored by an undo
    // that put its id back, which is a stack the author never built.
    target: "stack.layerRecord",
    type: "controls.setValue",
    value: record as StudioLayerRecord,
  });

  // The topmost layer, which is the one an author looks at first and the one
  // whose values the controls should be showing when the preset lands.
  const selected = preset.layers.length > 0 ? `${preset.id}-${preset.layers.length}` : "";
  if (selected) commands.push({ layerId: selected, type: "layers.select" });

  return commands;
}
