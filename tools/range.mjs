// Flight range on a flat lot for a given upgrade set, flown like a human on the phone scheme (hold ▶ the whole way).
import { genLot } from '../src/launch.js'; import { createSim } from '../src/sim.js'; import { simpleInput } from '../src/controls.js';
export function flatLot(up) { const L = genLot(11, up);
  return { ...L, solids: [{ t: 'wall', r: [-60, -600, 20, 1600] }, { t: 'ground', r: [900, 620, 30000, 120] }], pits: [], lotcars: [], rivals: [], spots: [{ x: 99999, y: 620, w: 100 }], w: 32000 }; }
export function range(up) {
  const L = flatLot(up), S = createSim(L); let air = false;
  while (S.frame < 3000) { const p = S.car.position;
    if (!air && p.x > L.lipX && !S.grounded) air = true;
    if (air && S.grounded) return Math.round((p.x - L.lipX) / 60);
    S.step({ ...simpleInput(S, { r: true, l: false }), assist: false }); }
  return -1;
}
if ((process.argv[1] || '').endsWith('range.mjs')) {
  console.log('fresh', range({}));
  for (const k of ['boostCap', 'boostPow', 'air', 'thrust']) console.log(k.padEnd(9), [1, 2, 3, 4, 5, 6].map(l => range({ [k]: l })).join(' '));
  console.log('mid', range({ boostCap: 2, boostPow: 3, air: 3, thrust: 3 }), 'max', range({ boostCap: 4, boostPow: 6, air: 6, thrust: 6 }));
}
