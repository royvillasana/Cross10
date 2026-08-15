import { type StudioLayerTypeId } from "./studio-layers";
import {
  STUDIO_APPLY_TO_CANVAS,
  STUDIO_LAYER_RECORD_TARGET,
  STUDIO_PENDING_TECHNIQUE_TARGET,
  STUDIO_SNAPSHOT_TARGET,
  STUDIO_TECHNIQUE_TARGET,
  captureStudioStackSnapshot,
  collectStudioSelectedLayerEdit,
  projectStudioLayerEntry,
  readStudioLayerEntry,
  studioSelectedLayerTarget,
  type StudioApplyTarget,
  type StudioLayerRecord,
  type StudioLayerRecordEntry,
  type StudioRuntimeLayer,
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
 * **The palettes are the studio's own.** They were previously carried from
 * Croix10, which had recorded them as plausible without checking them against
 * any primary source -- a guess wearing the authority of a citation. Choosing
 * them here removes the false claim and puts more distance between the library
 * and the works it works in the tradition of.
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

/**
 * The studio's own inks, named so a stack can be read.
 *
 * **These are not the artist's palettes and no longer claim to be.** They were
 * carried over as values Croix10 had recorded as plausible without checking
 * them against any primary source, which made them a guess wearing the
 * authority of a citation. They are now chosen here, which is both honest and
 * further from the works themselves.
 *
 * What is kept is the *relationships*, because those are the techniques rather
 * than decoration: complements that induce each other at a boundary, a dark
 * separator narrow enough to read as a line rather than a band, and a light
 * ground for the additive series. Recolouring at random would have kept the
 * geometry and thrown away the phenomenon the geometry exists to produce.
 *
 * Role for role against what was here before, so every composition still
 * assembles the same way and only the ink changed.
 */
const INK = {
  amber: "#FFC02E",
  black: "#0B0B0F",
  blue: "#2242A8",
  cyan: "#14A7BE",
  green: "#4FB84F",
  magenta: "#F0348C",
  red: "#D93A2B",
  white: "#F7F5EF",
  yellow: "#E9E44A",
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
 * A technique change, and the offer that has to precede it.
 *
 * Two presses rather than one, and the decision about which of them is being
 * made lives here rather than in the dispatcher, for the same reason every
 * other plan in this module does: the interesting part is *when it refuses to
 * act*, and that is worth asserting without a runtime.
 *
 * Three outcomes, in the order they can happen:
 *
 * - **Nothing to lose.** An empty canvas has no work to replace, so the first
 *   press applies. Asking anyway is how a confirmation becomes something a user
 *   learns to click through.
 * - **Not yet agreed.** The offer is recorded and *nothing else is emitted*.
 *   The canvas has to be untouched until the change is confirmed, so this
 *   deliberately returns one command rather than a smaller application.
 * - **Agreed to this entry.** The replacement runs, the offer is cleared, and
 *   the canvas records which construction it was set to.
 *
 * The confirming press is matched against the entry that was armed. An author
 * who arms a change, browses the thumbnails, and then confirms is agreeing to
 * what they were shown, not to whichever entry is under the cursor — and a
 * confirmation that could apply something never offered would be worse than
 * none.
 *
 * Confirming does not waive the revert: the application still captures its
 * snapshot, because agreeing to proceed is not agreeing to lose the work.
 */
export function planStudioTechniqueChange({
  confirmed,
  layers,
  pendingTechnique,
  preset,
  record,
  selectedLayerId,
}: {
  /** True for the confirming press, false for the one that offers. */
  readonly confirmed: boolean;
  readonly layers: readonly StudioRuntimeLayer[];
  readonly pendingTechnique: string | null;
  readonly preset: StudioPreset;
  readonly record: StudioLayerRecord;
  readonly selectedLayerId: string | null;
}): readonly Readonly<Record<string, unknown>>[] {
  const agreed = pendingTechnique === preset.id;

  if (confirmed && !agreed) return [];

  if (!confirmed && !agreed && layers.length > 0) {
    return [
      {
        label: `Offer to replace the work with ${preset.label}`,
        target: STUDIO_PENDING_TECHNIQUE_TARGET,
        type: "controls.setValue",
        value: preset.id,
      },
    ];
  }

  return [
    ...planStudioPresetApplication({ layers, preset, record, selectedLayerId }),
    {
      label: "Clear the pending technique",
      target: STUDIO_PENDING_TECHNIQUE_TARGET,
      type: "controls.setValue",
      value: "",
    },
    {
      label: `Record ${preset.label} as the canvas technique`,
      target: STUDIO_TECHNIQUE_TARGET,
      type: "controls.setValue",
      value: preset.id,
    },
  ];
}

/**
 * Declining, which writes one thing and touches nothing else.
 *
 * No layer command, no record write, and no write to the technique the canvas
 * is already in — "declining changes nothing" is a claim about the whole
 * composition, and the cheapest way to keep it true is for there to be nothing
 * else here to get wrong.
 */
export function planStudioTechniqueDecline(): readonly Readonly<
  Record<string, unknown>
>[] {
  return [
    {
      label: "Keep the current work",
      target: STUDIO_PENDING_TECHNIQUE_TARGET,
      type: "controls.setValue",
      value: "",
    },
  ];
}

/**
 * Applying an entry to layers that already exist.
 *
 * The narrow half of the applicator, and deliberately a different shape from
 * the canvas half. Nothing is created, nothing is destroyed, and nothing is
 * reordered: each named layer takes the entry's values and keeps everything the
 * runtime owns about it — its identity, its place in the stack, its name, its
 * parentage, and whether it is visible.
 *
 * **Each layer keeps its own kind.** `collectStudioSelectedLayerEdit` walks the
 * uniforms of the entry it is folding into, so a value the target's kind has no
 * uniform for is dropped rather than stored. That is what lets an entry built
 * out of band fields be applied to a picture: the engine, the treatment, the
 * blending and the opacity land, and `count` — which a picture has no reading
 * of — does not. Retyping instead would replace the picture with the bands, and
 * the author asked for the picture to be restyled, not removed.
 *
 * Entries carry a stack and targets carry a count of their own, so the entry's
 * layers are laid across the target's in order and repeat when they run out.
 * Both lists are bottom-first, so a two-layer entry over a four-layer group puts
 * the ground on the ground.
 *
 * One command, and therefore one undo. The record is the only thing written,
 * and `controls.setValue` is one of the two commands the runtime does give a
 * history entry — which is exactly why this half needs no snapshot and the
 * canvas half does.
 */
export function planStudioTargetedApplication({
  layerIds,
  preset,
  record,
  selectedLayerId = null,
}: {
  readonly layerIds: readonly string[];
  readonly preset: StudioPreset;
  readonly record: StudioLayerRecord;
  readonly selectedLayerId?: string | null;
}): readonly Readonly<Record<string, unknown>>[] {
  // Nothing eligible is selected, so nothing happens. Falling back to a wider
  // target would apply the entry somewhere the author did not point it, and the
  // wider target here is the one that destroys the stack.
  if (layerIds.length === 0 || preset.layers.length === 0) return [];

  const next: Record<string, StudioLayerRecordEntry> = { ...record };
  layerIds.forEach((layerId, index) => {
    const source = preset.layers[index % preset.layers.length];
    if (!source) return;

    next[layerId] = collectStudioSelectedLayerEdit(
      readStudioLayerEntry(record, layerId),
      Object.fromEntries(
        Object.entries(source.values).map(([name, value]) => [
          studioSelectedLayerTarget(name),
          value,
        ]),
      ),
    );
  });

  const commands: Readonly<Record<string, unknown>>[] = [
    {
      label: `Apply ${preset.label} to the selection`,
      // Merged rather than written whole, unlike the canvas half: every layer
      // this does not name keeps the values it had, and that is the whole
      // promise of a narrow target.
      target: STUDIO_LAYER_RECORD_TARGET,
      type: "controls.setValue",
      value: next as StudioLayerRecord,
    },
  ];

  // The controls have to be moved too, and this is not tidiness.
  //
  // A layer lives in two places (R56): the record, and — while it is the
  // selected one — the `selectedLayer.*` controls that edit it. The sync
  // reconciles them, and with the selection unchanged it reads any difference
  // between them as *an edit the user made in the controls* and folds the
  // controls back into the record. Writing the record alone therefore lasts
  // exactly until the next pass, which then restores the values the entry had
  // just replaced — the write looks like it worked and the canvas never moves.
  //
  // The canvas half never meets this because it selects a layer that did not
  // exist before, which sends the sync down its other branch.
  //
  // Nothing is projected when the selection is not one of the named layers:
  // there is no stale surface to correct, and writing the controls anyway would
  // put the entry's values onto whichever layer happened to be selected.
  const selectedEntry = selectedLayerId ? next[selectedLayerId] : undefined;
  if (selectedLayerId && layerIds.includes(selectedLayerId) && selectedEntry) {
    for (const assignment of projectStudioLayerEntry(selectedEntry)) {
      commands.push({
        // Skipped for the same reason the sync's own projection is: loading a
        // layer's values into the controls is a consequence of the record write
        // above, not a second edit beside it. Recorded, one press would need two
        // undos and the first would leave the two halves disagreeing.
        history: "skip",
        target: assignment.target,
        type: "controls.setValue",
        value: assignment.value,
      });
    }
  }

  return commands;
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
  layers,
  preset,
  record: currentRecord,
  selectedLayerId,
  target = STUDIO_APPLY_TO_CANVAS,
  targetLayerIds,
}: {
  readonly layers: readonly StudioRuntimeLayer[];
  readonly preset: StudioPreset;
  readonly record: StudioLayerRecord;
  readonly selectedLayerId: string | null;
  readonly target?: StudioApplyTarget;
  /** The layers a narrower target names, from `studioApplicationLayerIds`. */
  readonly targetLayerIds?: readonly string[];
}): readonly Readonly<Record<string, unknown>>[] {
  // A target narrower than the canvas is a different operation, not a smaller
  // version of this one: it restyles layers that already exist rather than
  // deciding which layers exist. It therefore emits no layer command at all,
  // which is what makes it additive, revertible by ordinary Undo, and free of
  // the confirmation the canvas target needs.
  if (target !== STUDIO_APPLY_TO_CANVAS) {
    return planStudioTargetedApplication({
      layerIds: targetLayerIds ?? [],
      preset,
      record: currentRecord,
      selectedLayerId,
    });
  }

  const commands: Readonly<Record<string, unknown>>[] = [];

  // The snapshot is emitted here rather than by the caller so that it cannot be
  // forgotten by one. A second caller that planned an application without
  // capturing first would produce exactly the defect this exists to fix, and it
  // would look like working code.
  //
  // Nothing is captured for an empty stack: there is no work to come back to,
  // and offering to restore emptiness is noise.
  // Derived here rather than collected as the adds are pushed, because the
  // snapshot has to be written before the first delete and the ids are already
  // knowable: they are a function of the preset and the index, which is what
  // lets the record be written for layers that do not exist yet.
  const applyingLayerIds = preset.layers.map(
    (_layer, index) => `${preset.id}-${index + 1}`,
  );

  if (layers.length > 0) {
    commands.push({
      label: `Keep the stack before ${preset.label}`,
      target: STUDIO_SNAPSHOT_TARGET,
      type: "controls.setValue",
      value: captureStudioStackSnapshot({
        appliedLabel: preset.label,
        appliedLayerIds: applyingLayerIds,
        layers,
        record: currentRecord,
        selectedLayerId,
      }),
    });
  }

  for (const layer of layers) {
    commands.push({ layerId: layer.id, type: "layers.delete" });
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
