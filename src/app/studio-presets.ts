import { type StudioLayerTypeId } from "./studio-layers";
import {
  STUDIO_APPLY_TO_CANVAS,
  STUDIO_LAYER_RECORD_TARGET,
  STUDIO_SNAPSHOT_TARGET,
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

/**
 * The eight investigations the library covers, and which of them a rectangle can
 * actually hold.
 *
 * Eight rather than six, which is what the spec used to say. Chromoscope and
 * Couleur dans l'espace were simply missing from a list that claimed to
 * enumerate them.
 *
 * **Carry or evoke** is the distinction that matters more. Four of these are
 * planar constructions: a band field, a relief read at an angle, an induced
 * colour at a boundary, two structures beating against each other. A canvas
 * carries those -- the phenomenon is in the picture plane, and reproducing the
 * geometry reproduces the effect.
 *
 * The other four are not pictures at all. Chromosaturation is a chamber the
 * visitor stands inside; Transchromie is coloured and transparent panels they
 * walk between; Chromoscope and Couleur dans l'espace are environments. Their
 * subject is a body moving through coloured space, which a fixed rectangle does
 * not have. A flat preset can produce the *chromatic condition* those works put
 * a viewer in; calling that a rendering of the work would misdescribe both.
 */
export const STUDIO_SERIES = {
  chromointerference: { carriage: "carry", label: "Chromointerférence" },
  chromosaturation: { carriage: "evoke", label: "Chromosaturation" },
  chromoscope: { carriage: "evoke", label: "Chromoscope" },
  "couleur-additive": { carriage: "carry", label: "Couleur Additive" },
  "couleur-dans-l-espace": { carriage: "evoke", label: "Couleur dans l'espace" },
  "induction-chromatique": { carriage: "carry", label: "Induction Chromatique" },
  physichromie: { carriage: "carry", label: "Physichromie" },
  transchromie: { carriage: "evoke", label: "Transchromie" },
} as const;

export type StudioSeriesId = keyof typeof STUDIO_SERIES;

export const STUDIO_SERIES_IDS = Object.keys(STUDIO_SERIES) as readonly StudioSeriesId[];

/**
 * Where a preset's colours came from, as data rather than as a file comment.
 *
 * The user never reads the file. Before this existed the product offered ten
 * palettes with equal confidence while the source said, in prose, that they were
 * guesses -- which is the shape of every quiet inaccuracy: true somewhere nobody
 * looks.
 *
 * Three values rather than the two the change was first written with. `studio`
 * is not a weaker `plausible`, it is a different claim: a plausible palette says
 * "we think this is roughly the artist's and did not check", and every palette
 * here says "these are ours, chosen for the relationships the technique needs".
 * Recording the second as the first would put back exactly the false citation
 * the palettes were rewritten to remove.
 */
export type StudioPalettePedigree = "plausible" | "studio" | "verified";

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
  palette: StudioPalettePedigree;
  series: StudioSeriesId;
}>;

/**
 * What the picker calls an entry.
 *
 * The series is part of the name because the library is organised by series and
 * a grid of thumbnails has nowhere else to put it -- and because "Wedge Beat"
 * tells an author nothing about which investigation they are looking at.
 *
 * An evoked series says so here, which is the whole of requirement's positive
 * half: the four environmental series are marked wherever they are offered, so
 * nothing in the product presents a flat rectangle as a rendering of a room.
 *
 * Provenance appears only when there is something to claim. All ten original
 * palettes are the studio's own and assert nothing, so they say nothing; a
 * palette that had genuinely been checked against a primary source would be the
 * one thing worth stating, and the schema test refuses to let anything else say
 * it.
 */
export function studioPresetPickerLabel(preset: StudioPreset): string {
  const series = STUDIO_SERIES[preset.series];
  const provenance = preset.palette === "verified" ? ", verified palette" : "";
  return series.carriage === "evoke"
    ? `${preset.label} — evoking ${series.label}${provenance}`
    : `${preset.label} — ${series.label}${provenance}`;
}

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
    palette: "studio",
    series: "couleur-additive",
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
    palette: "studio",
    series: "induction-chromatique",
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
    id: "four-ink-relief",
    palette: "studio",
    series: "physichromie",
    // Renamed from a catalogue number.
    //
    // Naming a preset after an individual work claims to be that work, and it
    // is not: the technique is free to use and the specific pieces are in
    // copyright until well into the next century. What this entry actually is
    // -- a four-ink relief field read slightly off head-on -- is both the
    // honest name and the more useful one, because it says what changing the
    // controls will change.
    label: "Four-Ink Relief",
    // The relief read head-on-ish: each strip presenting some of its neighbour.
    // The field's count stops at 200, which is the Nyquist limit against pixel
    // pitch rather than a performance bound.
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
    palette: "studio",
    series: "physichromie",
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
    palette: "studio",
    series: "induction-chromatique",
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
    palette: "studio",
    series: "induction-chromatique",
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
    palette: "studio",
    series: "chromosaturation",
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
    palette: "studio",
    series: "chromointerference",
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
    palette: "studio",
    series: "chromointerference",
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
    palette: "studio",
    series: "transchromie",
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
  {
    id: "serigraph-registers",
    palette: "studio",
    series: "couleur-additive",
    label: "Serigraph Registers",
    // The printed form of the additive series: horizontal bands over a light
    // ground, three inks, and a second register of the same field printed at an
    // offset inside a rectangular window. The offset is the whole subject --
    // where the two registers disagree, the eye makes a colour neither ink
    // carries, which is what "additive" names.
    layers: [
      {
        name: "Ground",
        typeId: "gradient",
        values: { colorA: INK.white, colorB: INK.white, maskSize: 0, rampType: "linear" },
      },
      {
        name: "Register — first",
        typeId: "stripes",
        values: {
          angle: 0,
          colorA: INK.red,
          colorB: INK.blue,
          colorC: INK.yellow,
          count: 32,
          maskSize: 0,
          paletteSlots: 3,
          separator: 0.14,
          widthRatio: 0.55,
        },
      },
      {
        name: "Register — offset",
        typeId: "stripes",
        // Confined rather than whole-frame, and deliberately: the stepped
        // window is the printed second pass, so it has to have an edge.
        values: {
          angle: 0,
          colorA: INK.yellow,
          colorB: INK.red,
          colorC: INK.blue,
          count: 32,
          maskAspect: 1.6,
          maskCenterY: -0.08,
          maskShape: "rectangle",
          maskSize: 0.3,
          paletteSlots: 3,
          phase: 0.5,
          separator: 0.14,
          widthRatio: 0.55,
        },
      },
    ],
  },
  {
    id: "amber-blue-relief",
    palette: "studio",
    series: "physichromie",
    label: "Amber and Blue Relief",
    // The dense register: four inks, separators thin enough to read as lines
    // rather than bands, and an inset that repeats the field at a different
    // phase so the relief appears to step where the window is.
    layers: [
      {
        name: "Relief",
        typeId: "stripes",
        values: {
          angle: 0,
          colorA: INK.amber,
          colorB: INK.black,
          colorC: INK.blue,
          colorD: INK.black,
          count: 180,
          engine: "physichromie",
          engineAmount: 0.6,
          maskSize: 0,
          paletteSlots: 4,
          separator: 0.05,
        },
      },
      {
        name: "Inset",
        typeId: "stripes",
        values: {
          angle: 0,
          colorA: INK.blue,
          colorB: INK.black,
          colorC: INK.amber,
          colorD: INK.black,
          count: 180,
          engine: "physichromie",
          engineAmount: 0.6,
          maskAspect: 0.7,
          maskShape: "rectangle",
          maskSize: 0.34,
          paletteSlots: 4,
          phase: 0.5,
          separator: 0.05,
        },
      },
    ],
  },
  {
    id: "spectrum-relief",
    palette: "studio",
    series: "physichromie",
    label: "Spectrum Relief",
    // The same construction in a full register rather than a two-ink one, which
    // is the other half of what the series does: the relief carries as many
    // inks as the support will hold and the shear mixes all of them.
    layers: [
      {
        name: "Relief",
        typeId: "stripes",
        values: {
          angle: 0,
          colorA: INK.magenta,
          colorB: INK.yellow,
          colorC: INK.cyan,
          colorD: INK.green,
          count: 200,
          engine: "physichromie",
          engineAmount: 0.85,
          maskSize: 0,
          paletteSlots: 4,
          separator: 0.04,
        },
      },
    ],
  },
  {
    id: "tapered-study",
    palette: "studio",
    series: "induction-chromatique",
    label: "Tapered Study",
    // The recurring structure of the induction studies: bands whose width runs
    // out across the field, with rectangular insets carrying the same field at
    // a different phase. The taper is what gives the induced colour somewhere
    // to change along, so the effect is not uniform across the picture.
    layers: [
      {
        name: "Field",
        typeId: "stripes",
        values: {
          angle: 0,
          colorA: INK.black,
          colorB: INK.white,
          count: 120,
          engine: "induction",
          engineAmount: 0.7,
          maskSize: 0,
          taper: 0.6,
        },
      },
      {
        name: "Inset — upper",
        typeId: "stripes",
        values: {
          angle: 0,
          colorA: INK.white,
          colorB: INK.black,
          count: 120,
          engine: "induction",
          engineAmount: 0.7,
          maskAspect: 2.2,
          maskCenterY: 0.22,
          maskShape: "rectangle",
          maskSize: 0.16,
          phase: 0.5,
          taper: 0.6,
        },
      },
      {
        name: "Inset — lower",
        typeId: "stripes",
        values: {
          angle: 0,
          colorA: INK.white,
          colorB: INK.black,
          count: 120,
          engine: "induction",
          engineAmount: 0.7,
          maskAspect: 2.2,
          maskCenterY: -0.22,
          maskShape: "rectangle",
          maskSize: 0.16,
          phase: 0.25,
          taper: 0.6,
        },
      },
    ],
  },
  {
    id: "superimposed-beat",
    palette: "studio",
    series: "chromointerference",
    label: "Superimposed Beat",
    // Two fields rather than one engine: the moiré here is produced by the
    // stack, which is the honest reading of the technique -- a second structure
    // laid over the first at a slightly different angle and pitch, beating with
    // it. Small differences, because a large one reads as two patterns rather
    // than as interference.
    layers: [
      {
        name: "Field — first",
        typeId: "stripes",
        values: {
          angle: 0,
          colorA: INK.cyan,
          colorB: INK.black,
          count: 96,
          maskSize: 0,
        },
      },
      {
        name: "Field — second",
        typeId: "stripes",
        values: {
          angle: 4,
          blendMode: "screen",
          colorA: INK.magenta,
          colorB: INK.black,
          count: 104,
          maskSize: 0,
          opacity: 0.7,
        },
      },
    ],
  },
  {
    id: "interference-lens",
    palette: "studio",
    series: "chromointerference",
    label: "Interference Lens",
    // The beat confined to a form over a ground, which is the other way the
    // series is composed: the interference is an event happening somewhere
    // rather than a field filling the frame.
    layers: [
      {
        name: "Ground",
        typeId: "gradient",
        values: {
          angle: 90,
          colorA: INK.black,
          colorB: INK.blue,
          maskSize: 0,
          rampType: "linear",
        },
      },
      {
        name: "Lens",
        typeId: "stripes",
        values: {
          angle: 0,
          colorA: INK.yellow,
          colorB: INK.red,
          colorC: INK.cyan,
          count: 72,
          engine: "chromointerference",
          engineAmount: 0.8,
          enginePitch: 1.12,
          maskAspect: 1.2,
          maskShape: "ellipse",
          maskSize: 0.38,
          paletteSlots: 3,
        },
      },
    ],
  },
  {
    id: "projection-cone",
    palette: "studio",
    series: "chromoscope",
    label: "Projection Cone",
    // **An evocation, not a rendering.** The chromoscope is an apparatus that
    // throws coloured light into a room; its subject is the event in the air and
    // the body standing in it. What a rectangle can carry is the chromatic
    // condition that produces -- saturated hues meeting at a soft boundary, with
    // an angular sweep standing in for the throw.
    layers: [
      {
        name: "Dark",
        typeId: "gradient",
        values: { colorA: INK.black, colorB: INK.black, maskSize: 0, rampType: "linear" },
      },
      {
        name: "Throw",
        typeId: "gradient",
        values: {
          angle: 0,
          colorA: INK.magenta,
          colorB: INK.cyan,
          colorC: INK.amber,
          maskSize: 0,
          paletteSlots: 3,
          rampType: "angular",
        },
      },
      {
        name: "Falloff",
        typeId: "gradient",
        values: {
          blendMode: "multiply",
          colorA: INK.white,
          colorB: INK.black,
          maskSize: 0,
          rampType: "radial",
        },
      },
    ],
  },
  {
    id: "suspended-planes",
    palette: "studio",
    series: "couleur-dans-l-espace",
    label: "Suspended Planes",
    // **An evocation, not a rendering.** Colour in space is planes hung apart
    // from one another in a room, read against each other as the visitor moves.
    // Flat, that becomes several banded planes at different angles over a dark
    // ground -- the arrangement without the walking, which is the part a
    // rectangle cannot supply.
    layers: [
      {
        name: "Ground",
        typeId: "gradient",
        values: { colorA: INK.black, colorB: INK.blue, maskSize: 0, rampType: "radial" },
      },
      {
        name: "Plane — left",
        typeId: "stripes",
        values: {
          angle: 68,
          colorA: INK.red,
          colorB: INK.amber,
          count: 40,
          maskAspect: 0.45,
          maskCenterX: -0.32,
          maskRotation: 12,
          maskShape: "rectangle",
          maskSize: 0.4,
          opacity: 0.9,
        },
      },
      {
        name: "Plane — middle",
        typeId: "stripes",
        values: {
          angle: 24,
          colorA: INK.cyan,
          colorB: INK.white,
          count: 56,
          maskAspect: 0.5,
          maskRotation: -8,
          maskShape: "rectangle",
          maskSize: 0.44,
          opacity: 0.9,
        },
      },
      {
        name: "Plane — right",
        typeId: "stripes",
        values: {
          angle: 112,
          colorA: INK.green,
          colorB: INK.magenta,
          count: 34,
          maskAspect: 0.4,
          maskCenterX: 0.34,
          maskRotation: 20,
          maskShape: "rectangle",
          maskSize: 0.38,
          opacity: 0.9,
        },
      },
    ],
  },
  {
    id: "scattered-planes",
    palette: "studio",
    series: "couleur-dans-l-espace",
    label: "Scattered Planes",
    // **An evocation, not a rendering.** The looser arrangement: banded planes
    // at widely differing angles over a dark ground, overlapping rather than
    // ranked, so the frame reads as depth without any of it being modelled.
    layers: [
      {
        name: "Ground",
        typeId: "gradient",
        values: { colorA: INK.black, colorB: INK.black, maskSize: 0, rampType: "linear" },
      },
      {
        name: "Plane — low",
        typeId: "stripes",
        values: {
          angle: 8,
          colorA: INK.yellow,
          colorB: INK.red,
          count: 28,
          maskAspect: 1.8,
          maskCenterY: -0.2,
          maskRotation: -14,
          maskShape: "rectangle",
          maskSize: 0.24,
        },
      },
      {
        name: "Plane — mid",
        typeId: "stripes",
        values: {
          angle: 96,
          blendMode: "screen",
          colorA: INK.cyan,
          colorB: INK.blue,
          count: 44,
          maskAspect: 0.9,
          maskCenterX: 0.18,
          maskRotation: 32,
          maskShape: "rectangle",
          maskSize: 0.3,
        },
      },
      {
        name: "Plane — high",
        typeId: "stripes",
        values: {
          angle: 150,
          blendMode: "screen",
          colorA: INK.magenta,
          colorB: INK.green,
          count: 60,
          maskAspect: 1.3,
          maskCenterX: -0.22,
          maskCenterY: 0.24,
          maskRotation: 6,
          maskShape: "rectangle",
          maskSize: 0.26,
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

/*
 * The two-press technique change was removed with R74.
 *
 * `planStudioTechniqueChange` and `planStudioTechniqueDecline` lived here
 * because the product had no modal and a destructive change still had to be
 * agreed to, so the agreement was expressed as a second press on an actions
 * control. The onboarding dialog asks the question properly now, so keeping the
 * pair would have left two ways to confirm one thing -- and the panel one would
 * have been the one nobody saw.
 *
 * What did not change is the part that mattered: the change is still revertible,
 * because the snapshot is still captured by `planStudioPresetApplication` rather
 * than by whoever calls it.
 */

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
