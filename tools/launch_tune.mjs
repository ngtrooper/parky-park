// Headless progression check for LAUNCH mode: which spots can an autopilot reach at each upgrade tier?
import { genLot } from '../src/launch.js'; import { createSim } from '../src/sim.js'; import { makePilot } from '../src/autopilot.js';
export function tryRun(L, i, opts = {}) {
  const S = createSim(L), sp = L.spots[i], cx = sp.x + sp.w / 2;
  const LL = { ...L, wps: [[cx, sp.y - 170], [cx, sp.y - 60], [cx, sp.y - 30]] };
  const P = makePilot(LL, { vmax: 14, kx: 0.03 }); const rec = [];
  let air = false;
  while (!S.parked && !S.failed) {
    if (S.taken.has(i)) break;
    let inp;
    if (!air) { inp = { right: true, boost: true }; if (S.car.position.x > L.lipX - 10 && !S.grounded) air = true; }
    else { inp = P(S); if (S.car.position.x < cx - 600 && S.car.velocity.x < 12) inp.boost = true; }
    rec.push(inp); S.step(inp);
  }
  return { S, rec };
}
const tiers = { fresh: {}, early: { boostCap: 1, air: 1, boostPow: 1 }, mid: { boostCap: 3, boostPow: 3, air: 3, thrust: 3, grip: 2 }, maxed: { boostCap: 6, boostPow: 6, air: 6, thrust: 6, spin: 4, grip: 4 } };
if ((process.argv[1] || '').endsWith('launch_tune.mjs')) {
  for (const [name, up] of Object.entries(tiers)) {
    const res = [];
    for (const seed of [11, 22, 33, 44, 55]) {
      const L = genLot(seed, up); let best = -1;
      for (let i = 0; i < L.spots.length; i++) { const { S } = tryRun(L, i); if (S.parked && S.parkedSpot === i) best = i; }
      res.push(best + 1);
    }
    console.log(name.padEnd(7), 'farthest spot reached per seed:', res.join(' '));
  }
}
