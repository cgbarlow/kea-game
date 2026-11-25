// Art direction constants (schema: cookbook/CONTRACT.md). Thesis T3 "Overcast snow" adapted to an alpine pass:
// a late-afternoon break in the overcast. The sun sits 14° above the western saddle and burns through a gap in a
// grey-blue deck; light snow flurries, wet asphalt from melt, a dusting of snow on up-facing faces, cool blue aerial
// perspective on the range. Warmth only from the sun gap, campervan cab lights and the amber road-closed flashers.
// Colours are LINEAR RGB; intensities HDR. Read-only at runtime. Tune one knob per critic round (look-director).
export const ART = {
  sun:   { elevDeg: 14, azimDeg: 250, color: [1.0, 0.80, 0.60], intensity: 5.0 },
  sky:   { zenith: [0.17, 0.24, 0.36], horizon: [0.78, 0.68, 0.60], groundTint: [0.20, 0.21, 0.22],
           cloudCover: 0.72, cloudSharp: 0.45, sunGlow: 0.95, burnGap: 0.55 },
  fog:   { sigma: [0.0052, 0.0050, 0.0046], scatter: [0.56, 0.61, 0.69], heightFalloff: 0.03, baseHeight: 0.0,
           sunInscatter: 1.0, start: 4.0 },
  vol:   { density: 0.010, g: 0.60, steps: 20, strength: 0.7 },
  ambient: { skyIntensity: 1.7, envIntensity: 1.8 },
  grade: { exposure: 1.0, agxMix: 0.35, lookPower: 1.10, sat: 1.05, contrast: 0.18,
           splitShadow: [0.93, 1.0, 1.07], splitHigh: [1.05, 1.0, 0.94], vignette: 0.28,
           bloom: 0.05, bloomThreshold: 1.3, lensDirt: 0.2, chroma: 0.0012, grain: 0.020, sharpen: 0.28,
           adaptMin: 0.55, adaptMax: 1.8, adaptTau: 1.6 },
  surface: { wet: 0.35, dust: 0.0, snow: 0.35, macroVar: 0.30 },
  weather: { kind: 'snow', amount: 0.2, wind: [2.5, 0, 0.8], lightning: false },
};
