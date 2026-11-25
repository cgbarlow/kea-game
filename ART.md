# ART — Do Not Feed The Kea

## Thesis
**T3 "Overcast snow", adapted to an alpine pass at the end of the day.** A grey-blue cloud deck over the Southern Alps with
one burning gap above the western saddle (late afternoon, lamps still off): the sun at 14° pushes warm light straight down the car park and the closed highway,
the north scree slope catches it on its ribs, the beech forest to the south stays cool and dark. Light snow flurries in the
wind, meltwater puddles on dark asphalt mirroring the gap, a dusting of snow on every up-facing face. Distance goes blue
(red extinguishes first); warmth only from the sun gap, cab lights and the amber road-closed flashers. Deadpan: the image is
calm and beautiful; the comedy comes from the signs.

Constants: `src/art.js` (look r1: sun elev 14 / azim 250, (1.0,0.70,0.42) x9.5; deck cover 0.80, burnGap 0.75, zenith
slate (0.10,0.125,0.17); fog sigma (0.0052,0.0050,0.0046), scatter (0.40,0.46,0.56), falloff 0.045; env 1.25; grade
agxMix 0.30, lookPower 1.16, sat 0.98, contrast 0.24, teal/amber split; `ART.post` volShaft 1.4, AO 3.0 @ 0.8 m,
adaptKey 0.21; surface wet 0.35, snow 0.35; weather snow 0.2, wind (2.5,0,0.8)). Change one knob per critic round.

### Look r1 log (A/B captures in shots/look-r1-work/)
- base → a: sun 5 → 8 and warmer, fog scatter darker/cooler (was milky), zenith deeper, env 1.8 → 1.4.
- a → b: deck 0.72 → 0.80, sharper, burnGap 0.75, glow 1.15, fog falloff 0.045 (sky stops going milky above the range).
- b → c: grade contrast 0.24, lookPower 1.16, sat 0.98 (beech greens were cartoonish), stronger teal/amber split, vignette 0.32.
- c → d: sun 9.5 + warmer, env 1.25 (more sun/shade ratio). d → e: zenith desaturated (pose 6 read as dusk lavender);
  painted-metal / van / tarp tints capped (white vans clipped). e → f: `ART.post` (wired in main.js) shafts 1.4, AO 3.0.
- Material albedo rule: no paint/livery above ~0.65 linear (tints 0xcc-0xd8 on white kit colours).
- Interior probe: `?probe=0` A/Bs it. It must only go on interior-facing materials (main assigns `shelter.interior` when
  the carpark module provides it); on the whole group the exterior cladding reflects the dark room and renders black.

### Look r2 log (A/B captures in shots/look-r2-work/ a, b, c)
- Time of day committed: overcast late afternoon (~5 pm). Zenith (0.15,0.17,0.21), horizon (0.52,0.53,0.56); street lamps
  dark (`ART.lamps.pole` 0, head emissive 0.15, no pools/halos); flashers + dim daytime shelter fluoro only.
- Weather particles off (`ART.weather.particles` false): flakes/motes read as stars and dead pixels. Snow lives on the
  ground (weathering `uSnow` = `surface.snow`). Snow thesis line is now "snow lying, not falling".
- Exposure: `post.resetAdaptation()` on every `camset` (pose cut / teleport): no exposure drift under a frozen camera
  (pose-4 whole-frame shimmer gone). adaptTau 1.2, adapt clamp 0.6–1.6, bloom threshold 1.7.
- Foliage: alpha-to-coverage on every alpha-tested opaque material (main.js `stabiliseCutouts`); under `?shot` the
  shared `uWind` is zeroed (contract: fixed-time stills). Canopy shimmer gone; grass tufts still crawl (terrain owner).
- Rock/terrain: rough ×1.45, wet ×0.2 (dry rock never glosses). Ground: patchGround wet 0.6 (damp halos round puddles),
  uGrRain 0.18 (soft ripple normals), uReflLod +0.6 (no mirror-glass puddles).
- Far field: `ART.farfield` = 3 layered mountain rings (1500/950/560 m) with snowy tops at increasing haze depth,
  replacing the terrain module's wilderness rings (cone treeline gone).
- Shelter: the point light hangs 0.35 m under the batten (no ceiling hotspot), tube emissive 2.2, intensity 9.

## Palette (sRGB, roles)
| Role | Hex |
|---|---|
| Sun gap / burnt cloud edge | `#F2C79A` |
| Deck / zenith | `#5C6E86` |
| Wet asphalt | `#1E1F22` |
| Snow dusting (never pure white) | `#D9DFE6` |
| Tussock gold | `#9C8548` |
| Beech shade | `#24342A` |
| DOC green (signs, HUD timer) | `#1F4A37` |
| Sign cream | `#EFE8D4` |
| Blower orange (hero accent) | `#D8571C` |
| Kea olive / underwing orange | `#56663A` / `#C0501E` |
| Flasher amber | `#FFA020` |
| Campervan liveries | `#E8E4DA`, `#7FB0C8`, `#D9C25A` |

## Signature surface
Meltwater puddles (ground/ground.js mask + planar reflection) on the asphalt bench, plus snow on up-facing faces via the
weathering patch (`surface.snow`). Blower airflow lifts dust/leaf puffs off the wet ground.

## Hero shot list (contracts.js POSES)
1. **Vista into the sun** from the slip debris: boulders foreground, the road + car park as a leading line, vans at 32-56 m,
   the saddle and sun gap upper right, beech wall left, scree right.
2. **Spawn, eye height**: three campervans across the frame, bay lines and puddles in the lower third, beech edge behind.
3. **Hero close-up**: the blower view model backlit by the sun, the DO NOT FEED THE KEA sign at frame right, puddle glare.
4. **Interior**: the visitor shelter, cool fluoro on weathered boards, YOU ARE HERE (Unfortunately.) board, bench, the open
   east side bright behind the camera.
5. **Action**: kea on van B's mirror and wiper, one tumbling in the airflow, dust puffs, a possum heading for the side door.
6. **Reverse, away from the sun**: east along the car park; vans side-lit, amber flashers on the road-closed gate lighting
   the wet road, the slip and the scree in blue haze.
Random-yaw: YAWS north (highway, scree, range) and south-east (trap line, forest edge).

## Avoid
Blown snow (adaptation must meter it), flat front-lit pose 6 (needs flashers + lamp pools + far ring), cartoon-saturated
van paint (desaturate 15% and weather), the north slope reading as one smooth ramp, a visible terrain edge past 200 m.
