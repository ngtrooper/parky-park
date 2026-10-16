// Can a player using ONLY the two phone zones reach spots? Policy: hold R through the ramp + flight,
// release to drop, both zones to hover-brake over the target, L on ground to stop.
import { genLot } from '../src/launch.js'; import { createSim } from '../src/sim.js'; import { simpleInput } from '../src/controls.js';
const tiers = { fresh: {}, early: { boostCap: 1, air: 1, boostPow: 1 }, mid: { boostCap: 3, boostPow: 3, air: 3, thrust: 3, grip: 2 } };
for (const [name, up] of Object.entries(tiers)) {
  const out = [];
  for (const seed of [11, 22, 33, 44, 55]) {
    const L = genLot(seed, up); let best = 0;
    for (let i = 0; i < L.spots.length; i++) {
      const sp = L.spots[i], cx = sp.x + sp.w / 2, S = createSim(L);
      while (!S.parked && !S.failed && S.frame < 2400) {
        const p = S.car.position, v = S.car.velocity, z = { l: false, r: false }, dx = cx - p.x;
        if (S.grounded && p.x < L.lipX) z.r = true;
        else if (!S.grounded) {
          if (dx > 260) z.r = v.y > -1 || p.y > sp.y - 220;          // keep flying forward
          else { const want = Math.max(-2, Math.min(6, dx * 0.04));
            if (v.x > want + 0.5) z.l = z.r = true;            // both = hover + brake
            else if (v.x < want - 0.5) z.r = v.y > -0.5;     // nudge forward
            else z.l = z.r = v.y > 1.6; }                    // soft drop
        } else { if (dx < -10) z.l = true; else if (dx > 10 && !S.inSpot) z.r = false; }
        S.step(simpleInput(S, z));
      }
      if (S.parked) best = Math.max(best, S.parkedSpot + 1);
    }
    out.push(best);
  }
  console.log(name.padEnd(6), 'touch-only farthest spot per seed:', out.join(' '));
}
