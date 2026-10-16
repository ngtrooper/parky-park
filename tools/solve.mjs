// Headless proof: every level is beatable (and 3-star beatable) by the waypoint autopilot in the real sim.
import { LEVELS } from '../src/levels.js';
import { createSim, starsFor } from '../src/sim.js';
import { makePilot } from '../src/autopilot.js';
import fs from 'fs';
const out = {}; let ok = true;
for (const L of LEVELS) {
  let best = null;
  for (const vmax of [6.5, 8, 9.5, 11]) for (const kx of [0.04, 0.06, 0.09]) {
    const S = createSim(L), P = makePilot(L, { vmax, kx }), rec = [];
    while (!S.parked && !S.failed) { const i = P(S); rec.push(i); S.step(i); }
    if (S.parked && (!best || S.time() < best.t)) best = { t: S.time(), stars: starsFor(L, S.time()), fuel: S.fuel, flips: S.flips, tune: { vmax, kx },
      inputs: rec.map(i => (i.left ? 1 : 0) | (i.right ? 2 : 0) | (i.up ? 4 : 0) | (i.spinL ? 8 : 0) | (i.spinR ? 16 : 0)) };
  }
  console.log(`L${L.id} ${L.name.padEnd(20)} ${best ? `PARKED t=${best.t.toFixed(2)}s stars=${best.stars} fuelLeft=${best.fuel.toFixed(0)} flips=${best.flips}` : 'UNBEATEN'}  par=${L.par}`);
  if (!best || best.stars < 3) ok = false;
  out[L.id] = best;
}
fs.writeFileSync('tools/solutions.json', JSON.stringify(out));
console.log(ok ? 'ALL LEVELS 3-STAR BEATABLE' : 'SOME LEVELS NOT 3-STAR BEATABLE'); process.exit(ok ? 0 : 1);
