// Headless: fresh car falling fast; holding UP (belly jets) must stop the fall within ~1s, then climb; hover time from rest.
import { genLot, tuneFrom } from '../src/launch.js'; import { createSim } from '../src/sim.js'; import M from 'matter-js'; const { Body } = M;
let ok = true;
for (const tilt of [0, 0.4]) {
  const L = genLot(5, {}), S = createSim(L); S.step({}); const c = S.car;
  Body.setPosition(c, { x: L.lipX + 2000, y: -2000 }); Body.setAngle(c, tilt); Body.setVelocity(c, { x: 4, y: 12 }); Body.setAngularVelocity(c, 0);
  let stop = null, f = 0, y0; for (; f < 240 && S.fuel > 0; f++) { S.step({ tU: true }); if (stop === null && c.velocity.y <= 0) { stop = f; y0 = c.position.y; } }
  const climbed = stop !== null ? (y0 - c.position.y) | 0 : 0;
  console.log(`tilt ${tilt}: vy 12 -> stopped in ${stop === null ? 'NEVER' : (stop / 60).toFixed(2) + 's'}, then climbed ${climbed}px, fuel left ${S.fuel.toFixed(0)}, burn ${(f / 60).toFixed(2)}s`);
  if (stop === null || stop > 66 || climbed <= 0) ok = false;
  // hover: from rest
  const S2 = createSim(L); S2.step({}); Body.setPosition(S2.car, { x: L.lipX + 2000, y: -2000 }); Body.setVelocity(S2.car, { x: 0, y: 0 }); Body.setAngle(S2.car, tilt);
  let g = 0, yA = S2.car.position.y; while (S2.fuel > 0 && g < 600) { S2.step({ tU: true }); g++; }
  console.log(`  from rest: air lasts ${(g / 60).toFixed(2)}s, net ${S2.car.position.y < yA ? 'climb' : 'drop'} ${Math.abs(yA - S2.car.position.y) | 0}px`);
  if (g < 120 || S2.car.position.y > yA) ok = false;
}
console.log(ok ? 'LIFT OK' : 'LIFT TOO WEAK'); process.exit(ok ? 0 : 1);
