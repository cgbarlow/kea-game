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
