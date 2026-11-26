// Art direction constants (schema: cookbook/CONTRACT.md). Thesis T3 "Overcast snow" adapted to an alpine pass:
// a late-afternoon break in the overcast. The sun sits 14° above the western saddle and burns through a gap in a
// grey-blue deck; light snow flurries, wet asphalt from melt, a dusting of snow on up-facing faces, cool blue aerial
// perspective on the range. Warmth only from the sun gap, campervan cab lights and the amber road-closed flashers.
// Look r2: committed to ONE time of day, overcast late afternoon (~5 pm, March). Street lamps are OFF (daylight sensor),
// no stars, no floating flakes; the snow is on the ground (weathering uSnow) not in the air. Only the shelter fluoro and
// the amber gate flashers glow.
// r1 critic: toward the sun the road blew out (D14): sunGlow/sunInscatter down, key -0.26 EV, adaptMax capped so a
// shadowed foreground cannot meter the far field to white, bloom threshold above the asphalt sheen, asphalt wet sheen
// down. D12 (pale strip at the beech-edge base) is the dry tussock bank, not height fog: fog left as is.
// Colours are LINEAR RGB; intensities HDR. Read-only at runtime. Tune one knob per critic round (look-director).
export const ART = {
  sun:   { elevDeg: 14, azimDeg: 250, color: [1.0, 0.70, 0.42], intensity: 9.5 },
  sky:   { zenith: [0.15, 0.17, 0.21], horizon: [0.52, 0.53, 0.56], groundTint: [0.20, 0.21, 0.22],
           cloudCover: 0.80, cloudSharp: 0.55, sunGlow: 0.75, burnGap: 0.75 },
  fog:   { sigma: [0.0052, 0.0050, 0.0046], scatter: [0.40, 0.46, 0.56], heightFalloff: 0.045, baseHeight: 0.0,
           sunInscatter: 0.5, start: 4.0 },
  vol:   { density: 0.010, g: 0.60, steps: 20, strength: 0.7 },
  ambient: { skyIntensity: 1.6, envIntensity: 1.25 },
  grade: { exposure: 1.0, agxMix: 0.30, lookPower: 1.16, sat: 0.98, contrast: 0.24,
           splitShadow: [0.92, 1.0, 1.09], splitHigh: [1.07, 1.0, 0.92], vignette: 0.32,
           bloom: 0.055, bloomThreshold: 2.3, lensDirt: 0.2, chroma: 0.0012, grain: 0.020, sharpen: 0.28,
           adaptMin: 0.6, adaptMax: 1.3, adaptTau: 1.2 },
  post:  { volShaft: 1.4, aoIntensity: 3.0, aoRadius: 0.8, adaptKey: 0.175 },
  surface: { wet: 0.35, dust: 0.0, snow: 0.35, macroVar: 0.30 },
  weather: { kind: 'snow', amount: 0.0, wind: [2.5, 0, 0.8], lightning: false, particles: false },
  // practicals (main.js lights stage): daytime, so the pole lamps are dark; the shelter fluoro is a dim daytime tube
  lamps: { pole: 0, poleEmissive: 0.15, shelter: 9, tubeEmissive: 2.2, flasher: 8 },
  // per-material look defaults (main.js materials stage): dry rock / dirt never gloss; the wet sheen is for asphalt + puddles
  matLook: { rockRough: 1.45, rockWet: 0.2, puddleWet: 0.4, puddleRain: 0.18, reflLod: 0.6 },
  // far field (main.js replaces the terrain module's placeholder): layered snowy ridgelines at increasing haze depth
  farfield: [
    { kind: 'mountains', radius: 1500, height: 380, base: -40, follow: 0.92, body: [0.10, 0.12, 0.155], top: [0.46, 0.50, 0.58], rim: 1.2, fogScale: 0.5, rough: 0.8, seed: 2 },
    { kind: 'mountains', radius: 950, height: 230, base: -30, follow: 0.7, body: [0.06, 0.07, 0.085], top: [0.30, 0.33, 0.39], rim: 1.0, fogScale: 0.62, rough: 1.1, seed: 7 },
    { kind: 'mountains', radius: 560, height: 120, base: -20, follow: 0.35, body: [0.03, 0.036, 0.034], top: [0.09, 0.10, 0.10], rim: 0.8, fogScale: 0.8, rough: 1.7, seed: 13 },
  ],
};
