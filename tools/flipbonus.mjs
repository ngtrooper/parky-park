// Flip bonus check: launch off the kicker, spin, land upright -> coins banked per flip.
import { genLot, payout } from '../src/launch.js'; import { createSim } from '../src/sim.js';
const L = genLot(11, { spin: 4, air: 3 }); const S = createSim(L); let air = false, log = [];
while (!S.parked && !S.failed && S.frame < 1500) {
  let inp = { right: true, boost: true };
  if (S.car.position.x > L.lipX - 5 && !S.grounded) air = true;
  if (air) { const cs = Math.cos(S.car.angle); inp = { spinR: S.airFlips < 2 || cs < 0.9, up: S.car.velocity.y > 1 && cs > 0.5 }; if (S.airFlips >= 2 && cs > 0.9) inp.spinL = S.car.angularVelocity > 0.02; }
  S.step(inp); for (const e of S.events) if (/flip/.test(e) || e === 'bail') log.push(e);
}
console.log('events:', log.join(' '), '| flipBank', S.flipBank, '| payout', JSON.stringify(payout(L, S)));
process.exit(S.flipBank > 0 ? 0 : 1);
