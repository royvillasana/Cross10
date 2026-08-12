/**
 * Built-in preset library.
 *
 * A preset is a plain map of schema target to value, nothing more. It is applied by
 * dispatching one runtime `controls.setValue` per target under a single history
 * group, so undo, reset, persistence, and Settings Transfer all treat a preset the
 * way they treat any other edit — there is no parallel scene format to keep in sync.
 *
 * Each preset names the composition it is reaching for rather than its parameters,
 * because the parameters are visible in the panel the moment it loads. Every engine
 * series has at least one, which is what the preset library is for: the engines are
 * six different grammars and a preset is the fastest way to see what each one is.
 *
 * The palettes here are plausible rather than verified. Checking them against
 * primary sources is its own task, and claiming canonical colour before that work is
 * done would be a claim this file cannot support.
 */

export type Croix10Preset = Readonly<{
  id: string;
  label: string;
  values: Readonly<Record<string, unknown>>;
}>;

export const CROIX10_PRESETS: readonly Croix10Preset[] = [
  {
    id: "additive-bands",
    label: "Additive Bands",
    values: {
      "bands.separatorWidth": 0.18,
      "engine.active": "couleurAdditive",
      "palette.slots": ["#0B7A3B", "#C8102E", "#0B3C8A"],
      "stripe.angle": 0,
      "stripe.count": 48,
      "stripe.jitterAmount": 0,
      "stripe.widthRatio": 1,
    },
  },
  {
    id: "induced-third",
    label: "Induced Third",
    values: {
      // Narrow separators and unequal band widths push the induced colour at each
      // boundary, which is the whole point of the Couleur Additive series.
      "bands.separatorWidth": 0.06,
      "engine.active": "couleurAdditive",
      "palette.slots": ["#F2B300", "#0B3C8A", "#E4007F", "#0B7A3B"],
      "stripe.angle": 12,
      "stripe.count": 140,
      "stripe.jitterAmount": 0,
      "stripe.widthRatio": 0.55,
    },
  },
  {
    id: "physichromie-500",
    label: "Physichromie 500",
    values: {
      "engine.active": "physichromie",
      "palette.slots": ["#0B7A3B", "#FFFFFF", "#C8102E", "#0B3C8A"],
      "stripe.angle": 0,
      "stripe.count": 220,
      "viewer.angle": 18,
      "viewer.parallax": 0.6,
    },
  },
  {
    id: "lamella-sweep",
    label: "Lamella Sweep",
    values: {
      "engine.active": "physichromie",
      "palette.slots": ["#000000", "#F2B300", "#00A0C6"],
      "stripe.angle": 0,
      "stripe.count": 340,
      "viewer.angle": -34,
      "viewer.parallax": 1,
    },
  },
  {
    id: "induction-grid",
    label: "Induction Grid",
    values: {
      "engine.active": "induction",
      "induction.frequency": 240,
      "induction.fringeIntensity": 0.8,
      "induction.fringeWidth": 0.3,
      "palette.slots": ["#000000", "#FFFFFF"],
      "stripe.angle": 0,
    },
  },
  {
    id: "afterimage-rose",
    label: "Afterimage Rose",
    values: {
      "engine.active": "induction",
      "induction.frequency": 150,
      "induction.fringeIntensity": 0.55,
      "induction.fringeWidth": 0.5,
      "palette.slots": ["#E4007F", "#0B7A3B"],
      "stripe.angle": 24,
    },
  },
  {
    id: "saturation-chamber",
    label: "Saturation Chamber",
    values: {
      "engine.active": "chromosaturation",
      "immersion.balance": 0.5,
      "immersion.spread": 0.85,
      "palette.slots": ["#C8102E", "#0B7A3B", "#0B3C8A"],
    },
  },
  {
    id: "interference-beat",
    label: "Interference Beat",
    values: {
      "engine.active": "chromointerference",
      "interference.angleOffset": 3,
      "interference.blendMode": "difference",
      "interference.enabled": true,
      "interference.pitchRatio": 1.06,
      "interference.widthRatio": 0.5,
      "palette.slots": ["#00A0C6", "#F2B300", "#E4007F"],
      "stripe.count": 60,
    },
  },
  {
    id: "moire-wedge",
    label: "Moiré Wedge",
    values: {
      "engine.active": "chromointerference",
      "interference.angleOffset": 14,
      "interference.blendMode": "additive",
      "interference.enabled": true,
      "interference.pitchRatio": 1.24,
      "interference.widthRatio": 0.35,
      "palette.slots": ["#0B3C8A", "#C8102E"],
      "stripe.count": 96,
    },
  },
  {
    id: "transchromie-sheets",
    label: "Transchromie Sheets",
    values: {
      "engine.active": "transchromie",
      "transchromie.blendMode": "subtractive",
      "transchromie.planes": [
        { color: "#00A0C6", offset: { x: 0.2, y: 0 }, opacity: 0.65, rotation: 160 },
        { color: "#E4007F", offset: { x: -0.18, y: 0 }, opacity: 0.65, rotation: 20 },
        { color: "#FFE800", offset: { x: 0, y: 0.12 }, opacity: 0.55, rotation: -90 },
      ],
    },
  },
];

export function findCroix10Preset(id: unknown): Croix10Preset | null {
  if (typeof id !== "string") return null;
  return CROIX10_PRESETS.find((preset) => preset.id === id) ?? null;
}
