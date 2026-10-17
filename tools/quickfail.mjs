// Quick fail: boost + air empty, on the ground, no free spot in roll-in range -> run ends within ~1s. Near a spot -> roll-in grace.
import { genLot } from '../src/launch.js'; import { createSim } from '../src/sim.js'; import Matter from 'matter-js'; const { Body } = Matter;
const L = genLot(11, {}); let ok = true;
for (const [name, x] of [['far from spots', (L.spots[2].x + L.spots[3].x) / 2], ['next to spot #3', L.spots[2].x - 200]]) {
  const S = createSim({ ...L, rivals: [], lotcars: [] }); S.step({ right: true });
  const near = name.startsWith('next');
  Body.setPosition(S.car, { x, y: 590 }); Body.setVelocity(S.car, { x: 0, y: 0 }); S.fuel = 0; S.boost = 0;
  let f = 0; while (!S.failed && !S.parked && f < 600) { S.step({}); f++; }
  console.log(`${name}: ${S.parked ? 'PARKED spot #' + (S.parkedSpot + 1) : S.failed} after ${(f / 60).toFixed(2)}s`);
  if (!near && (!S.failed || f > 60)) ok = false; if (near && !S.parked) ok = false;
}
console.log(ok ? 'QUICK FAIL OK' : 'QUICK FAIL BROKEN'); process.exit(ok ? 0 : 1);
