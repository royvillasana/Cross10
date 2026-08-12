/**
 * The chromatic ramp chunk.
 *
 * Split from the chunk registry because that file is at its line budget, and the
 * ramp is a self-contained colour source: everything here resolves a band's
 * colour, and nothing here knows which engine is drawing.
 *
 * The ramp consumes the gradient control's own geometry — its type and its angle —
 * rather than reproducing either as a sibling control. R23 makes that mandatory,
 * and the framework enforces it: declaring the control obliges proving every one
 * of its semantic parts changes the output, so a part the renderer ignored could
 * not be covered.
 */

import { CROIX10_MAX_RAMP_STOPS } from "./croix10-parameters";

export const CROIX10_CHUNK_RAMP = `
// Where a point falls along the ramp, in [0,1).
//
// The gradient's own type and angle decide the geometry. Coordinates are centred
// and normalised against the composition width, so a ramp holds its shape at any
// export size — the same resolution independence the band pitch has.
float croix10RampCoordinate(vec2 point, vec2 resolution) {
  vec2 uv = (point - resolution * 0.5) / max(resolution.x, 1.0);
  float radians = uRampAngle * 0.017453292519943295;
  vec2 direction = vec2(cos(radians), sin(radians));

  if (uRampType == 1) {
    // Radial: distance from the centre, reaching the far stop at the half-width.
    return clamp(length(uv) * 2.0, 0.0, 1.0);
  }
  if (uRampType == 2) {
    // Angular: the sweep around the centre, rotated by the gradient's angle. This
    // is the one type that is periodic by construction, so it wraps rather than
    // clamping and its two ends always meet.
    float sweep = atan(uv.y, uv.x) - radians;
    return fract(sweep / 6.283185307179586 + 1.0);
  }
  if (uRampType == 3) {
    // Diamond: Manhattan distance in the rotated frame.
    vec2 rotated = vec2(dot(uv, direction), dot(uv, vec2(-direction.y, direction.x)));
    return clamp((abs(rotated.x) + abs(rotated.y)) * 2.0, 0.0, 1.0);
  }
  // Linear: projection onto the gradient's direction.
  return clamp(dot(uv, direction) + 0.5, 0.0, 1.0);
}

// Piecewise-linear ramp lookup, between the two stops bracketing t.
//
// Returns colour and coverage together: a stop's opacity is part of the stop, so
// resolving them separately would let the two disagree. uRampInterpolation picks
// the mixing space — 0 mixes the linear-light values the uniforms already hold,
// 1 mixes in sRGB and converts back. Neither is "correct": linear light is
// physically right and often reads washed out through the middle, which is why
// the space is a control rather than a silent choice.
vec4 croix10RampSample(float t) {
  float position = uRampType == 2 ? fract(t) : clamp(t, 0.0, 1.0);
  int count = max(uRampStopCount, 1);
  if (count == 1) return vec4(uRampColors[0], uRampOpacities[0]);

  if (position <= uRampPositions[0]) {
    return vec4(uRampColors[0], uRampOpacities[0]);
  }
  if (position >= uRampPositions[count - 1]) {
    return vec4(uRampColors[count - 1], uRampOpacities[count - 1]);
  }

  vec3 lowerColor = uRampColors[0];
  vec3 upperColor = uRampColors[count - 1];
  float lowerOpacity = uRampOpacities[0];
  float upperOpacity = uRampOpacities[count - 1];
  float lowerAt = uRampPositions[0];
  float upperAt = uRampPositions[count - 1];

  for (int i = 0; i < ${CROIX10_MAX_RAMP_STOPS} - 1; i++) {
    if (i + 1 > count - 1) continue;
    float a = uRampPositions[i];
    float b = uRampPositions[i + 1];
    if (position >= a && position <= b) {
      lowerColor = uRampColors[i];
      upperColor = uRampColors[i + 1];
      lowerOpacity = uRampOpacities[i];
      upperOpacity = uRampOpacities[i + 1];
      lowerAt = a;
      upperAt = b;
    }
  }

  float span = max(upperAt - lowerAt, 0.0001);
  float blend = clamp((position - lowerAt) / span, 0.0, 1.0);
  float opacity = mix(lowerOpacity, upperOpacity, blend);
  if (uRampInterpolation == 1) {
    vec3 mixed = mix(
      croix10LinearToSrgb(lowerColor),
      croix10LinearToSrgb(upperColor),
      blend
    );
    return vec4(croix10SrgbToLinear(mixed), opacity);
  }
  return vec4(mix(lowerColor, upperColor, blend), opacity);
}

// How hard the cursor pushes the ramp at this band.
//
// Measured from the band's own centre, so the influence travels with the band
// rather than smearing across boundaries — the same reason the ramp is sampled
// per band. Returns exactly zero outside the radius and at zero strength, which
// is what makes the effect switchable without a second shader variant.
float croix10ProximityPush(vec2 point, vec2 resolution) {
  if (uProximityStrength == 0.0) return 0.0;

  vec2 uv = (point - resolution * 0.5) / max(resolution.x, 1.0);
  float distance = length(uv - uProximityCenter);
  float radius = max(uProximityRadius * 0.5, 0.0001);
  if (distance >= radius) return 0.0;

  float nearness = 1.0 - distance / radius;
  float shaped = uProximityFalloff == 0
    ? nearness
    : uProximityFalloff == 1
      ? smoothstep(0.0, 1.0, nearness)
      : nearness * nearness * nearness;
  return shaped * uProximityStrength;
}

// The colour a band takes, from whichever source is active.
//
// Every engine reads through here, so the ramp reaches all of them without any
// engine knowing it exists. Source 0 is the palette and is the default: a ramp
// that replaced the palette silently would invalidate the canonical module proof.
//
// The ramp is sampled once per band, at the point where that band's centreline
// crosses the composition centre, rather than per fragment. Per-fragment sampling
// would bleed adjacent bands into a continuous wash and dissolve the boundaries
// the analytic antialiasing exists to keep clean; per-band keeps each band one
// flat colour, which is also what the source plates do.
//
// Opacity is coverage over the support, the same reading the separators already
// have: a stop at less than full opacity lets the background through rather than
// painting a lighter version of itself.
vec3 croix10SlotColor(int index) {
  if (uRampSource == 0) return croix10PaletteSlotColor(index);

  vec4 sampled = croix10RampSample(
    croix10RampCoordinate(gCroix10BandCenter, uResolution)
      + uRampPhase
      + croix10ProximityPush(gCroix10BandCenter, uResolution)
  );
  return mix(uBackgroundColor, sampled.rgb, clamp(sampled.a, 0.0, 1.0));
}
`;
