# ART — Do Not Feed The Kea

## Thesis
**T3 "Overcast snow", adapted to an alpine pass at the end of the day.** A grey-blue cloud deck over the Southern Alps with
one burning gap above the western saddle: the sun at 14° pushes warm light straight down the car park and the closed highway,
the north scree slope catches it on its ribs, the beech forest to the south stays cool and dark. Light snow flurries in the
wind, meltwater puddles on dark asphalt mirroring the gap, a dusting of snow on every up-facing face. Distance goes blue
(red extinguishes first); warmth only from the sun gap, cab lights and the amber road-closed flashers. Deadpan: the image is
calm and beautiful; the comedy comes from the signs.

Constants: `src/art.js` (sun elev 14 / azim 250, (1.0,0.80,0.60) x5; fog sigma (0.0052,0.0050,0.0046); agxMix 0.35;
surface wet 0.35, snow 0.35; weather snow 0.2, wind (2.5,0,0.8)). Change one knob per critic round.

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
