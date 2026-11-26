// Frozen contracts shared by every module owner. Change only through the lead (re-run captures after any change).
// Coordinates: metres, Y up. -Z = north (the closed highway + the range), +Z = south (beech forest edge),
// -X = west (the pass, where the sun sets), +X = east (the slip that closed SH73).
// Sun: ART.sun elev 14 / azim 250 -> dir (-0.91, 0.24, -0.33): low in the west-north-west.
//  POSES  6 hero camera poses [x,y,z, tx,ty,tz] — the critic judges exactly these (capture.mjs --poses).
//  YAWS   2 eye-height spawn views no hero pose covers (random-yaw honesty shots).
//  PATH   fly-through keys, same format; used by the title screen flyover and #bench (engine/bench.js).
//  WORLD  playable bounds. Anything outside is terrain / backdrop hidden by fog.
//  PLAYER body + feel constants read by modules/game/player.js.
//  LAYOUT named anchor positions every module dresses around (carpark builds them, actors/game read them).
export const SEED = 7303;

export const POSES = [
  [44.0, 6.4, -12.0, -10.0, 3.0, -8.0],   // 1 vista from the slip debris, west along the car park into the low sun
  [2.0, 1.68, -9.0, -1.0, 1.5, 4.0],      // 2 spawn, eye height: the three campervans ahead, beech edge behind them
  [-4.0, 1.68, -6.0, -40.0, 4.0, -16.0],  // 3 hero: the ranger-issue leaf blower, backlit by the sun
  [-22.2, 1.6, -5.4, -26.6, 1.35, -7.2],  // 4 interior: the DOC-style visitor shelter, fluoro tube + info boards
  [-2.6, 1.68, -2.4, 0.6, 1.8, 1.4],      // 5 action: blowing kea off the middle campervan's cab, possum at the door
  [-26.0, 2.2, 0.0, 30.0, 2.2, -14.0],    // 6 reverse, east, away from the sun: vans side-on, road-closed flashers, slip
];

export const YAWS = [
  [0.0, 1.68, -8.0, 0.0, 2.2, -40.0],     // north: highway, scree slope, range wall
  [0.0, 1.68, -8.0, 28.0, 1.4, 8.0],      // south-east: car park corner, trap line, forest edge
];

export const PATH = [
  [44, 6.4, -12, -10, 3, -8],
  [24, 3.2, -14, 0, 1.8, 2],
  [6, 2.6, -10, -4, 2, 4],
  [-10, 3.4, -2, -24, 1.5, -6],
  [-20, 2.6, 10, 0, 1.5, 4],
  [0, 3.0, 13, 10, 2, 0],
  [20, 3.4, 8, 30, -0.5, -18],
  [36, 5.2, -4, -10, 3, -8],
];

export const WORLD = { min: [-34, -2, -24], max: [34, 30, 20], groundY: 0 };

export const PLAYER = {
  eye: 1.68, crouchEye: 1.05, radius: 0.32, height: 1.8,
  fov: 74, viewFov: 54,                     // world camera / view-model camera
  walk: 4.2, sprint: 6.6, crouch: 1.8,      // m/s
  accel: 40, airAccel: 6, friction: 10,
  jump: 4.6, gravity: 18,
  spawn: [2, 0, -9], spawnYaw: Math.PI,     // facing south, toward the vans
};

// Level anchors (the carpark module builds geometry exactly here; everyone else reads these).
export const LAYOUT = {
  carpark: { x0: -30, x1: 30, z0: -14, z1: 16 },               // sealed asphalt apron
  road: { z: -20, w: 7.5, x0: -140, x1: 140 },                 // SH73, closed
  slip: { x: 50, z: -19, r: 15, h: 7 },                        // landslide across the road (terrain owns the mound)
  gate: { x: 31, z: -20 },                                     // ROAD CLOSED gate + flashing amber lamps
  vans: [                                                      // campervans: centre of footprint, yaw 0 = nose to -Z
    { id: 'A', name: 'Ingrid & Lars', x: -12, z: 4, yaw: 0, color: 0xe8e4da },
    { id: 'B', name: 'The Okonkwos', x: 0, z: 4, yaw: 0.04, color: 0x7fb0c8 },
    { id: 'C', name: 'Mr. Tanaka', x: 12, z: 4, yaw: -0.05, color: 0xd9c25a },
  ],
  van: { len: 6.4, w: 2.2, h: 2.9 },
  shelter: { x: -24, z: -6, w: 6, d: 4, h: 3.0 },              // open to +X; interior pose 4
  toilet: { x: -24, z: 6, w: 2.4, d: 2.4, h: 2.8 },
  tables: [[-8, -8], [8, -8], [20, 10]],                       // picnic tables = adequate cover (drop, cover, hold)
  traps: [[-18, 15], [-6, 15.5], [6, 15.5], [18, 15]],          // possum trap boxes, mouth facing -Z
  dens: [[-22, 28], [-4, 30], [10, 29], [26, 27]],              // possum entry points in the forest
  keaRoost: [[26, 22, -34], [-30, 26, -36], [0, 30, -40]],      // kea come off the north range
  lamps: [[-6, -3], [16, -3]],
  spawn: [2, 0, -9],
  // v2 kea mode
  cone: [29.0, 0, -17.5],                                     // the Department's road cone, beside the ROAD CLOSED gate
  stash: [-4, 3.9, -31],                                      // kea stash: rock ledge on the north scree (y = terrain)
  keaSpawn: [-4, 4.3, -30.4], keaSpawnYaw: Math.PI,           // the player kea starts on the stash ledge facing south (keaplayer yaw 0 = -Z)
};

// v2 kea mode: hero poses (refine at integration; the critic judges these) and the #bench fly path (0.3-14 m).
export const KPOSES = [   // camera = the kea's eye (feet + KEA_PLAYER.eye); main.js stages each one (?kshot=K1..K6 / ?mode=kea&shot&cam=KPOSES[i])
  [-0.35, 2.43, 1.75, -0.9, 0.2, -2.2],    // K1 on van B's cab roof worrying the windscreen seal, the ranger below turning toward the noise
  [20.0, 6.0, -4.0, -20.0, 3.0, -8.0],     // K2 gliding west down the car park into the sun, beak in frame
  [31.0, 1.56, -18.8, 29.0, 0.45, -17.4],  // K3 perched on the ROAD CLOSED gate's top rail, eyeing the cone below
  [6.0, 7.0, 6.0, -6.0, 2.0, 2.0],         // K4 carrying the cone over the vans, the ranger blowing up at it
  [-4.4, 5.6, -33.0, -2.0, 1.5, -22.0],    // K5 the stash ledge from behind: pile + cone, the car park below
  [-6.0, 1.2, -6.5, -8.0, 0.6, -8.0],      // K6 the ranger crouched by a picnic table in an aftershock as a kea lands
];
export const KPATH = [
  [-4, 5.0, -30, 0, 2, 0],
  [-2, 8.0, -18, 0, 2, 4],
  [0, 4.0, -4, 0, 2, 4],
  [10, 3.2, 1, 20, 1.5, 6],
  [24, 6.0, -6, 30, 1, -18],
  [30, 1.8, -16, 10, 2, -2],
  [10, 12.0, -10, -20, 2, 0],
  [-18, 0.6, -2, -4, 1, -30],
];
export const KEA_PLAYER = {
  eye: 0.35, radius: 0.18, walk: 1.6, hop: 2.4, flapClimb: 3.5, glideSink: 1.2, glideSpeed: 7, diveSpeed: 11,
  ceiling: 16, landSpeed: 3, landHeight: 0.5, stamDrain: 0.28, stamRecover: 0.45, fov: 78, viewFov: 54,
  pullTime: 2.5, pullReach: 0.9, tumble: 1.2, squawkCooldown: 6, offendedMax: 3, bounds: { min: [-34, -2, -34], max: [34, 16, 20] },
};
