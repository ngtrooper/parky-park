import { LEVELS } from '../src/levels.js'; import { createSim } from '../src/sim.js'; import { makePilot } from '../src/autopilot.js';
const L = LEVELS[+process.argv[2] - 1]; const S = createSim(L), P = makePilot(L);
while (!S.parked && !S.failed && S.frame < 1500) { const i = P(S); S.step(i); if (S.frame % 20 == 0) console.log(S.frame, S.car.position.x.toFixed(0), S.car.position.y.toFixed(0), S.car.velocity.x.toFixed(1), S.car.velocity.y.toFixed(1), S.car.angle.toFixed(2), S.fuel.toFixed(0), S.grounded, JSON.stringify(i).replace(/"|false|true/g, m => m === 'true' ? '1' : m === 'false' ? '0' : '')); }
console.log(S.parked, S.failed, S.time());
