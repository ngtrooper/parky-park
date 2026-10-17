// Max landing distance (m past the lip) on a flat lot: full ramp boost, thrust to stretch, per purchase-path tier.
import { genLot } from '../src/launch.js'; import { createSim } from '../src/sim.js'; export function far(up, thrust = true) { const L0 = genLot(11, up);
  const L = { ...L0, solids: [{ t: 'wall', r: [-60, -600, 20, 1600] }, { t: 'ground', r: [900, 620, 40000, 120] }], pits: [], lotcars: [], rivals: [], spots: [{ x: 99999, y: 620, w: 100 }], w: 42000 };
  const S = createSim(L); let air = false;
  while (S.frame < 3000) { const p = S.car.position; if (!air && p.x > L.lipX && !S.grounded) air = true; if (air && S.grounded) return Math.round((p.x - L.lipX) / 60);
    S.step(air ? { right: true, up: thrust && S.car.velocity.y > -1.5 } : { right: true, boost: true }); }
  return -1; }
if ((process.argv[1] || '').endsWith('range2.mjs')) { const { path } = await import('./econ.mjs'); const P = path(); console.log([0, 2, 4, 6, 8, 10, 13, 24].map(n => `n${n}:${far(P[n].up, false)}/${far(P[n].up)}m`).join('  ')); }
