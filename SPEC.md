Build a first-person shooter "DO NOT FEED THE KEA": a deadpan New Zealand comedy at a quake-closed alpine pass car park in
aftershock season, where a ranger armed with a ranger-issue leaf blower protects three stranded tourists' campervans from kea
(flying, non-lethal: blown away, they come back offended) and possums (ground, blown into trap boxes) until SH73 reopens, while
aftershock alerts force a drop, cover and hold. Humour is carried by dry official signage and HUD text. Small in scope (one
180 x 44 m bench of car park + closed highway inside 420 m of alpine terrain, a 7-minute loop), but it must look like a current
AAA game in every screenshot.

PRIORITIES (in this order when they conflict)
1. Visual quality at the 6 hero poses, in random-yaw views and in motion
2. Stable frame pacing at the target
3. Gameplay that is complete (win, lose, restart) and feels good
4. Bundle size

CONSTRAINTS
- three.js 0.180.0, WebGL2, named imports only. Everything procedural: no texture, model or audio files, no base64 blobs.
  Fonts: system stack (no network).
- Deliverable: one self-contained dist/index.html < 2 MB, built by esbuild from src/ modules (build.mjs).
- Module contracts in src/contracts.js; every module exports create(G) + showcase(G) and has a stub fallback (src/modules/_stub.js).
- Cookbook first: use the cookbook files in src/cookbook as-is before writing new rendering code (src/cookbook/CONTRACT.md).
- Harness hooks: ?shot ?cam ?q ?dt ?seed ?show ?post=0 ?dynres=0 #bench; window.__ready __frames __errors __stats __setCam __G.
- Pointer lock with drag fallback; gamepad; zero per-frame allocations in update/render hot paths.

TARGET
- Apple M4 class (ANGLE Metal), Chrome stable, 1920x1080, display 60 Hz.
- Bench (vsync off, dynres off, q=high, 1920x1080): avg <= 12.5 ms, p99 <= 20 ms, max <= 33 ms.
  Defaults at 2560x1440: dynres >= 0.8, no tier drop. Boot to first frame <= 10 s. Budgets: references/perf-budgets.md high
  (<= 2.5 M tris, <= 450 draw calls per frame incl. shadow passes).

LOOK (ART.md = T3 "Overcast snow" adapted: alpine pass, late-afternoon break in the overcast)
- Thesis: grey-blue deck with a burning gap over the western saddle; flurries; wet asphalt; cool blue range in the haze.
  Sun elev 14 / azim 250, (1.0,0.80,0.60) x5. Fog sigma (0.0052,0.0050,0.0046). Grade agxMix 0.35, lookPower 1.10, sat 1.05, cool shadows.
- Signature surface: meltwater puddles on dark asphalt (planar reflection) + snow dusting on up-facing faces. Weather: snow 0.2, wind (2.5,0,0.8).
- Hero object: the ranger-issue leaf blower view model (orange two-stroke housing, tapered tube, flat nozzle), >= 30k tris, mm dims.
- Hero poses: 1 [44,6.4,-12 -> -10,3,-8] from the slip debris west along the car park into the sun
  2 [2,1.68,-9 -> -1,1.5,4] spawn, eye height, three campervans ahead, beech edge behind  3 [-4,1.68,-6 -> -40,4,-16] blower backlit
  4 [-22.2,1.6,-5.4 -> -26.6,1.35,-7.2] visitor shelter interior, fluoro tube, YOU ARE HERE board
  5 [-2.6,1.68,-2.4 -> 0.6,1.8,1.4] blowing kea off van B's cab, possum heading for the door
  6 [-26,2.2,0 -> 30,2.2,-14] reverse east, away from the sun: vans side-on, amber road-closed flashers, slip.
  Fly path: 60 s loop through 8 keys at 2.6-6.4 m (contracts.js PATH).

SCENE CHECKLIST
- Sealed apron 60 x 30 m with 9 painted bays, 150 mm kerbs, SH73 7.5 m wide with dashed centre line, meltwater puddles
- 3 rental campervans (6.4 x 2.2 x 2.9 m, three liveries), cab tourist visible through the windscreen, warm cab light
- Visitor shelter 6 x 4 x 3 m (open east side), bench, info board, fluoro batten that lights the floor (interior probe)
- Long-drop toilet 2.4 m, 3 picnic tables (aftershock cover), 4 possum trap boxes along the forest edge
- ROAD CLOSED gate at x=31: swing arm, 7 concrete blocks, 2 amber flashers that light the road, rail fence
- The slip: debris lobe 30 m across the road at x=50 with 1-3 m boulders (scatter)
- North scree slope rising to the range; south beech forest (>= 150 trees, fading at 140-200 m); tussock verges
- Far field: wilderness rings (mountains 1200 m + 700 m, treeline 320 m) in the shared fog; boundary hidden by terrain + fog
- Practicals: 2 LED lamp poles (8 m), shelter fluoro, gate flashers, van cab lights; all light the ground near them
- 6 official signs (canvas plates): DO NOT FEED THE KEA, SH73 CLOSED, AFTERSHOCK SEASON IS NOW OPEN, POSSUM CONTROL,
  CAMPERVAN PARKING, YOU ARE HERE (Unfortunately.)
- Actors: up to 10 kea (olive body, orange underwing), up to 8 possums; airflow dust/leaf puffs from the blower

GAMEPLAY
- Verbs: move/sprint, look, BLOW (LMB, spool-up, heat builds, overheats -> forced cool-down), TURBO (RMB: stronger, hotter),
  DROP/HOLD (C) during aftershocks. Actors: kea (land on vans, strip seals; blown -> tumble -> retreat -> return offended,
  faster, harder), possums (walk from 4 forest dens to a van door and get in; blown along the ground; into a trap mouth = trapped).
  Objective loop: keep all three vans' integrity above 0 for a 7-minute shift; director ramps arrivals; 5 aftershocks
  (3 s alert, 6 s shake; must be crouched, still and not blowing; near a table/shelter = "exemplary").
  Win: SH73 reopens (timer 0). Lose: any van integrity 0 ("A tourist has left a review") or 3 procedure strikes ("stood down").
- UI: title (live fly along PATH), settings (tier, sensitivity, FOV, volume, invert Y), pause, HUD (reopening estimate,
  van plates, blower temp, aftershock banner, strikes, toast feed in departmental voice), end screen (stats + restart).
- MODE SELECTOR (v1 requirement): the title screen shows a mode choice before play: "RANGER" (selectable, starts the
  v1 game) and "KEA" (visible but disabled, tagged "COMING SOON" in departmental voice, e.g. "Pending risk assessment").
  Ranger is the default focus; Enter/click starts it. Kea is not built in v1: it must not be playable, but store the chosen
  mode as G.mode = 'ranger' and keep the selector data-driven (a modes list with {id, label, enabled, note}) so v2 can
  add the playable Kea mode by enabling that entry. Keyboard (arrows/Enter) and mouse both work.

VERIFICATION
- Visual critic: a separate blind subagent sees ONLY renders: 6 poses captured in GPU Chrome by tools/capture.mjs --critic
  --shimmer, the 2 YAWS shots and module showcases. Gate G2: the g2 thresholds in references/quality-bar.json.
- Performance: bench report (avg/p99/max, render scale, tier, renderer string) + GPU timestamps when available. Gate G4.
- Gameplay: playtest bot reaches win and lose, exercises every verb, restart works, zero console errors over 5 min;
  audio self-test: peak <= -1 dBFS, no NaN, no silent stems. Gate G3.
- Boot: 6 pose PNGs, __errors empty, renderer is not SwiftShader/llvmpipe, dist builds. Gate G1.

DONE WHEN gates G1-G4 pass in the same build, or the critic-round budget (quick 2) is exhausted, in which case ship the best
snapshot with its residual defect list. Never ship a blocker. Deliver dist/index.html, its size, the perf report and the
critic's final review.

---

# v2: KEA MODE (branch v2-kea-mode)

Enable the KEA entry in the title mode selector (hud/ui.js MODES) and make it a complete mode. RANGER (v1) must keep working
exactly as now and pass its v1 playtest unchanged. Same world, same 7-minute shift, seen from the kea. The Department's
notices, toasts and signs address the kea directly in the same deadpan voice; the kea ignores all of them.
Tagline: "The kea are protected. The cone is not." Full brief: .campaign/v2-kea-mode-prompt.md.

RULES (html-game-concept, binding): nothing is harmed (blown = tumble, right yourself, return offended; failure =
"relocated"); the ranger cannot be attacked or damaged and is just doing the job (the joke is on the procedures);
tourists are only mildly inconvenienced; no real organisations (keep "the Department").

PLAYER (first person, G.mode === 'kea')
- Eye 0.35 m on the ground. Walk/hop (WASD, hop bob), Space flaps (climb ~3.5 m/s, "Wing capacity" stamina 0..1, drains
  while flapping, recovers grounded/perched), release glides (sink ~1.2 m/s, forward ~7 m/s, Shift dives faster).
  Arcade: no stalls, auto-level roll, absolute ceiling y = 16, bounds WORLD.min/max x,z widened to z >= -34 (stash).
  Auto-land when slow (< 3 m/s horizontal) and < 0.5 m above a top surface (van roofs/cabs/mirrors, signs, gate arm,
  tables, lamp heads, shelter roof, colliders' tops, terrain). Mouse look, gamepad, pointer lock as v1.
- View model (hero object, replaces the blower in kea mode): own beak at the bottom of frame (olive upper mandible, long
  curved hook, grey cere, lower mandible opens on squawk / grips on pull) + wing leading edges sweeping in on each flap
  with orange underwing flashes. Reuse v1 kea textures/materials (src/modules/kea/tex.js, shader.js) so it matches.
- PULL (LMB hold) on a part within 0.9 m of the beak, in view: wiper, seal, mirror, roof-pod strap. Progress 0..1 over
  ~2.5 s (faster when offended); the van takes v1 damage while pulling (van.damage). Done → part detaches, hangs from
  the beak (CARRY). Carrying the cone halves climb rate and stamina.
- CARRY → bank at the STASH (LAYOUT.stash: rock ledge on the north scree, about (-4, terrain, -31), pile grows per part).
- SQUAWK (RMB): emits 'kea:squawk' at the player position; the ranger turns toward it for 3 s. Cooldown 6 s.

OPPOSITION
- Ranger: AI human (procedural, Department hi-vis jacket + beanie, readable at distance, no face close-ups) carrying the
  v1 blower model third-person. Patrol vans → investigate pull noise / squawks → blow the kea (same force-cone + tumble
  physics as v1, applied to the player). Prefers a possum at a van door over the kea. Overheats like v1 (forced cool-down).
  In an aftershock: drops, covers and holds (crouched, not blowing) for the whole shake. Exposes a duck-typed blower
  query (firing, origin, dir, range, strengthAt(p), forceAt(p,out)) so v1 possums and background kea react to it.
- Blown off: tumble 1.2 s, then OFFENDED +1 (cap 3): +15 % speed and +25 % pull rate per level.
- Possums: v1 possums unchanged; a possum inside a van locks that van's parts until the ranger traps it.
- Background flock: 2-3 v1 AI kea, non-player.
- Aftershocks: the same five; HUD still says drop, cover and hold ("This applies to kea. It does not apply to kea.").

OBJECTIVES / END
- Bank QUOTA = 9 rubber parts + the Department's road cone (LAYOUT.cone, by the ROAD CLOSED gate).
- Win: quota and cone banked before the highway reopens: "Road open. The kea have kept the cone."
- Lose: timer runs out ("Road open. The kea have not kept the cone. Yet.") or 3 notices (blown off mid-pull while a part
  is still attached): "You have been relocated to a quieter car park. You will find your way back."
- End stats (Department voice): parts recovered, cone status, notices received, times offended.
- HUD: "Items held for research: n of 9", cone status, "Wing capacity" meter, offended level, notices, reopening estimate,
  toast feed. Title note for KEA: "Risk assessment complete. Risk confirmed."

KEA-MODE HERO POSES (KPOSES in contracts.js; refine at integration): K1 on van B cab mid-pull, ranger turning behind;
K2 gliding west down the car park into the sun, beak in frame; K3 perched on the ROAD CLOSED gate arm eyeing the cone;
K4 carrying the cone over the vans; K5 the stash ledge, pile + car park below; K6 the ranger crouched in an aftershock as a kea lands.

HARNESS: ?mode=kea (with ?autostart=1 / ?shot) starts kea mode directly; #bench works in both modes (kea path 0.3-14 m).

GATES (both modes, one build): G1 both boot, 6 ranger + 6 kea poses capture with 0 errors. G2 blind critic on the 6 kea
poses, references/quality-bar.json, 2 rounds. G3 playtest bot reaches win and lose in both modes, exercises every kea
verb (hop, flap, glide, land, pull, carry, squawk, blown + offended), 0 console errors over 5 min; ranger v1 script passes
unchanged. G4 auto quality holds 60 fps at 1920x1080 on the base M4 in both modes; never ship a G4 failure. Size < 2 MB.
