// Art direction constants (schema: cookbook/CONTRACT.md). Thesis T3 "Overcast snow" adapted to an alpine pass:
// a late-afternoon break in the overcast. The sun sits 14° above the western saddle and burns through a gap in a
// grey-blue deck; light snow flurries, wet asphalt from melt, a dusting of snow on up-facing faces, cool blue aerial
// perspective on the range. Warmth only from the sun gap, campervan cab lights and the amber road-closed flashers.
// Colours are LINEAR RGB; intensities HDR. Read-only at runtime. Tune one knob per critic round (look-director).
export const ART = {
  sun:   { elevDeg: 14, azimDeg: 250, color: [1.0, 0.70, 0.42], intensity: 9.5 },
  sky:   { zenith: [0.10, 0.125, 0.17], horizon: [0.50, 0.50, 0.54], groundTint: [0.20, 0.21, 0.22],
           cloudCover: 0.80, cloudSharp: 0.55, sunGlow: 1.15, burnGap: 0.75 },
  fog:   { sigma: [0.0052, 0.0050, 0.0046], scatter: [0.40, 0.46, 0.56], heightFalloff: 0.045, baseHeight: 0.0,
           sunInscatter: 1.0, start: 4.0 },
  vol:   { density: 0.010, g: 0.60, steps: 20, strength: 0.7 },
  ambient: { skyIntensity: 1.6, envIntensity: 1.25 },
  grade: { exposure: 1.0, agxMix: 0.30, lookPower: 1.16, sat: 0.98, contrast: 0.24,
           splitShadow: [0.92, 1.0, 1.09], splitHigh: [1.07, 1.0, 0.92], vignette: 0.32,
           bloom: 0.06, bloomThreshold: 1.2, lensDirt: 0.2, chroma: 0.0012, grain: 0.020, sharpen: 0.28,
           adaptMin: 0.55, adaptMax: 1.8, adaptTau: 1.6 },
  post:  { volShaft: 1.4, aoIntensity: 3.0, aoRadius: 0.8, adaptKey: 0.21 },
  surface: { wet: 0.35, dust: 0.0, snow: 0.35, macroVar: 0.30 },
  weather: { kind: 'snow', amount: 0.2, wind: [2.5, 0, 0.8], lightning: false },
};
