# OWNERS — module plan (Do Not Feed The Kea)

Lead/integrator owns: `src/main.js`, `src/contracts.js`, `src/art.js`, `src/modules/_stub.js`, `SPEC.md`, `ART.md`, this file,
`build.mjs`, `dist/index.html`. Cookbook (`src/cookbook/**`) is read-only for everyone. Never edit another owner's files:
report needed contract or wiring changes in your answer. Every module exports `create(G, opts)` + `showcase(G)` and keeps
its stub in `_stub.js` API-compatible (ask the lead to change a stub). Module results are on `G.mods[name]`.
Builds: `node build.mjs --out dist/<module>.html`. Showcase: `?show=<module>` (or capture the pose below with `--poses`).
Per-frame budget at q=high is the WHOLE frame (main + shadow + planar-reflection passes): <= 2.5 M tris, <= 450 calls.
G1 graybox measured 4-6 M tris / 260-480 calls (trees + terrain drawn 3x): terrain must bring it inside budget.

| # | Module | Wave | Visual | Files | Showcase (x,y,z,tx,ty,tz) |
|---|---|---|---|---|---|
| 1 | terrain | 1 | yes | `src/modules/terrain/*` | `40,8,6,50,3,-19` |
| 2 | carpark | 1 | yes | `src/modules/carpark/*` | `-14,2,-12,-24,1.4,-6` |
| 3 | vans | 2 | yes | `src/modules/vans/*` | `6,1.7,-6,0,1.5,4` |
| 4 | blower | 2 | yes | `src/modules/blower/*` | `-4,1.68,-6,-40,4,-16` |
| 5 | kea | 2 | yes | `src/modules/kea/*` | `-2,1.9,-1.2,0.6,1.7,1.2` |
| 6 | possums | 2 | yes | `src/modules/possums/*` | `3.6,1.2,0.2,2.3,0.2,2.4` |
| 7 | game | 3 | no | `src/modules/game/*` | `2,1.68,-9,-1,1.5,4` |
| 8 | hud | 3 | yes (DOM) | `src/modules/hud/*`, `src/ui/ui.css`, `template.html` | `2,1.68,-9,-1,1.5,4` |
| 9 | audio | 3 | no | `src/modules/audio/*` | `2,1.68,-9,-1,1.5,4` |

## 1. terrain (wave 1, visual)
`create(G, {mats}) → { group, heightAt(x,z), normalAt(x,z,out), farfield, update, dispose }`. Height function `heightFn()` is
exported: the bench (|x| <= 95, -27 <= z <= 19) stays at y = -0.06 so the carpark ground slab shows; never raise it there.
Build: the north scree slope as stepped benches and gullies (erodedHeight ridges + talus fans, not one smooth ramp), the slip
lobe across SH73 at LAYOUT.slip (fresh grey debris, 1-3 m boulders, a few snapped beech trunks), the south beech forest
(treeGeo + leafTexture, darker beech greens, moss on lower trunks), tussock verges, snow patches in hollows (patchTerrainTint
snowLine / weathering snow). Far field: wilderness rings + one nearer ridge so no pose sees an empty band past the fog
(run-log: "Far field empty past the fog wall"). Cookbook: geo/sdf-terrain.js, geo/scatter.js, backdrop/farfield.js,
materials/library.js. Quality bar: pose 1 and YAW north must read as a real alpine pass, no terrain edge, no tiling.
Budget: terrain + forest + rocks <= 900 k tris per main pass; use distance LOD (cells at res 2-4 m beyond 60 m, trees fade
120-180 m, fewer trees on low), `shadow: false` for small scatter, <= 60 draw calls.

## 2. carpark (wave 1, visual) — the `world` stage (critical)
`create(G, {mats}) → { root, ground, colliders: Box3[], bounds, shelter:{group, box, probeAt}, anchors:{lamps, flashers,
shelterLamp, cover:[{pos,r}], traps:[{pos,mouth}], signs}, update, dispose }`. Positions come only from `LAYOUT`.
Build: sealed apron + SH73 with real road markings (paint as decals or thin geometry, 100 mm lines, worn), kerbs and
channel, asphalt patch repairs and quake cracks across the apron, the visitor shelter interior (DOC-style board-and-batten,
corrugated roof, bench, info boards, a lost-property box), long-drop toilet with vent and door sign, 3 picnic tables,
4 DOC 200 trap boxes with mesh mouths and stencilled IDs, ROAD CLOSED gate (swing arm, water-filled barriers, flasher
heads), litter bins (kea-proof lids), a "Kea crossing" style sign, and more dry signage (keep it official and deadpan).
Cookbook: geo/kit.js, decals/canvas-text.js, materials/library.js, ground/ground.js (mask via main). Quality bar: pose 4
interior and pose 6 practicals; every prop bevelled, AO baked, real scale. Budget <= 250 k tris, <= 40 draw calls.

## 3. vans (wave 2, visual) — hero set piece
`create(G, {mats, colliders}) → { list: Van[], root, reset(), update, dispose }`, `Van = { id, name, group, pos, yaw,
integrity 0..1, perches: Vector3[] (0 mirror, 1 wiper, 2-4 roof), doorPos, damage(amount, kind), lastHit, lastKind }`;
emits `van:damage (van, amount, kind)`. Build three real-scale rental campervans (Ford Transit/Mercedes Sprinter-class
cab + coachbuilt body, rounded corners, real windscreen glass with env reflection, wheels with rims and arches, roof
hatch, awning rail, rental livery decals, rego plates), the tourist visible in each cab, a warm cab/interior light
(lights.js, within the tier light budget), damage states driven by integrity (missing wiper blades, torn seal strips,
scratches, a possum-opened door ajar), per-van comedy props (deck chair, gas bottle, washing line). Cookbook: geo/kit.js
(extrudeBevel, lathe, sweep), materials/library.js, decals/canvas-text.js, lighting/lights.js. Budget: <= 60 k tris per
van, <= 8 draw calls per van.

## 4. blower (wave 2, visual) — hero object + weapon verb
`create(G, {input}) → { overlay:{scene,camera}, firing, power, heat, overheated, turbo, origin, dir, range,
strengthAt(p), forceAt(p,out), forceFire, enabled, update }`. Build the ranger-issue handheld leaf blower at mm scale
(>= 30 k tris: ribbed engine housing, recoil starter, air filter cover, fuel tank with translucent window, rear loop
handle with throttle trigger and lockout, tapered tube in 3 sections with clamps, flat nozzle, DOC ranger stickers via
canvas decals, grime + wear), gloved ranger hand on the handle. Damped springs (engine/springs.js) for sway, walk bob,
spool-up kick and two-stroke vibration; turbo pose; overheat shimmer/smoke. Airflow FX: dust + leaf + snow puffs and
streaks through fx/index.js (smoke/puff/streaks), lit, with a wet-ground spray where the cone meets puddles. Keep
pose 3 the hero: blower 30-50% of frame, rim light from the sun. Cookbook: geo/kit.js, engine/springs.js, fx/*,
decals/canvas-text.js. Budget: <= 60 k tris, <= 10 draw calls, FX within fx caps.

## 5. kea (wave 2, visual)
`create(G, {vans, blower}) → { list, spawn(n), active(), reset(), update, materials, frozen }`; events `kea:land`,
`kea:blown`, `kea:return`. Build believable kea (46 cm; olive-bronze scalloped plumage, orange-red underwing flash, long
curved grey beak), flap/glide animation (vertex shader or bone-free procedural parts), landing hop, pecking at
seals/wipers/mirrors, blown tumble with feather puffs, a retreat glide to the north range, and the OFFENDED return
(ruffled pose, faster). Kea call cues for audio. Shot/showcase tableau stays (mirror + wiper + one mid-tumble). Budget:
10 kea <= 40 k tris total, instanced or <= 2 draw calls each.

## 6. possums (wave 2, visual)
`create(G, {vans, blower, traps}) → { list, spawn(n), active(), trapped, reset(), update, materials, frozen }`; events
`possum:raid`, `possum:blown`, `possum:trapped`. Build brushtail possums (grey fur via shell or card fringe, bushy black
tail, pink nose, eye glints), waddle cycle, a scramble when blown (slides on wet asphalt with spray), trap-box entry
animation (lid thump). Budget: 8 possums <= 30 k tris total.

## 7. game (wave 3, logic)
`create(G, {input, colliders, vans, kea, possums, blower, cover}) → { player, state, timeLeft, shiftLength, strikes,
phase, alertT, compliant, coverOk, stats, reason, restart, update }`; owns `game/player.js` (controller + aftershock
shake). Tune the director (kea/possum arrival curves, offended escalation), aftershock timing and compliance (crouched,
still, not blowing; cover = bonus), win/lose/restart, a `?autostart` path for the playtest bot, and a bot-drivable
playtest.json that reaches win (shortened via `?shift=`) and lose. Zero allocations per frame.

## 8. hud (wave 3, visual DOM)
`create(G, {input, player, quality, path, game, vans, blower}) → { ui, update, toast, set }`; owns `hud/ui.js`,
`src/ui/ui.css`, `template.html`. Departmental-voice HUD (timer "REOPENING ESTIMATE (NOT GUARANTEED)", van plates with
tourist names, blower temp, DROP/COVER/HOLD banner with a 3 s countdown, strikes, toast feed), title/pause/settings/end
screens styled like DOC signage (green/cream, condensed caps), end-screen stats + restart. Must not show in `?shot`.
Title screen MUST include the mode selector from SPEC.md UI: RANGER (playable) + KEA (disabled, "COMING SOON" —
v2). Data-driven modes list, sets G.mode = 'ranger'; game starts only from Ranger. Playtest must still start via Ranger.

## 9. audio (wave 3)
`create(G, {blower}) → { mixer, music, play, setVolume, unlock, update }`. Two-stroke blower (idle/rev/turbo layers
tracking power), airflow whoosh, kea "keee-aa" calls (synth), possum hiss/chatter, trap-box thunk, aftershock rumble +
phone-alert tone, alpine wind ambience, sparse music. Peak <= -1 dBFS, no silent stems (audio/meter.js).

---

# v2 (Kea mode) module plan

Lead/integrator still owns main.js, contracts.js (adds LAYOUT.cone, LAYOUT.stash, KPOSES, KPATH), _stub.js, SPEC.md.
v1 modules are frozen except where listed. Mode is chosen after boot: everything boots once, modes enable/disable.

| # | Module | Files | Contract |
|---|---|---|---|
| 10 | keaplayer | `src/modules/keaplayer/*` | `create(G, { input, colliders, terrain, vans }) → { overlay:{scene,camera}, position, velocity, yaw, pitch, grounded, perched, flying, stamina, offended, carrying (part|null), pulling (0..1), tumble (s), enabled, teleport(p,yaw), knock(force), update }`. Events `kea:pull:start/done`, `kea:squawk`, `kea:land`, `kea:tumble`. Reads the ranger via `G.mods.ranger.forceAt`. Parts come from `vans` (expose part anchors via a small vans API if missing: report it). |
| 11 | ranger | `src/modules/ranger/*` | `create(G, { vans, colliders, possums }) → { group, position, state:'patrol'|'investigate'|'blow'|'cool'|'dch', firing, origin, dir, range, strengthAt(p), forceAt(p,out), enabled, reset(), update, materials }`. Reuses `blower/model.js` for the blower it carries. Listens `kea:squawk`, `kea:pull:start`, `game:alert`. |
| 12 | keagame | `src/modules/keagame/*` + kea panels in `hud` | `create(G, { player, ranger, vans, possums, kea, terrain }) → { state:'shift'|'won'|'lost', timeLeft, banked, quota:9, cone:'gate'|'carried'|'banked', notices, stats, restart(), update }`. Owns the stash + cone props, aftershock schedule (reuse game RULES), end lines, kea-mode toasts. |
