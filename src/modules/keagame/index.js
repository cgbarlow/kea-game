// keagame — v2 kea mode.
//   create(G, { player, ranger, vans, possums, kea, terrain }) → { state, timeLeft, banked, quota, cone, notices, stats, restart(), update }
// PLACEHOLDER (lead): the keagame owner replaces this file.
export function create() {
  return { state: 'idle', timeLeft: 420, shiftLength: 420, banked: 0, quota: 9, cone: 'gate', notices: 0, stats: {}, restart() {}, update() {} };
}
export function showcase() { const c = [-4, 6, -24, -4, 3.9, -31]; return { cam: c.slice(0, 3), target: c.slice(3) }; }
