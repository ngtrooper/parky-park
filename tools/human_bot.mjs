// Human-reach model (new controls): ▶ drives, BOOST only on its own key, THRUST only on its own key, true ballistic flight.
// A "human" picks how long to boost on the ramp (tries a few, like retrying runs), reacts ~150ms late, misjudges the spot by ±40px.
import { genLot } from '../src/launch.js'; import { createSim, GRAV_LA, DT } from '../src/sim.js'; import { path } from './econ.mjs';
const G = GRAV_LA * DT * DT;
function landX(L, x, y, vx, vy) { const d = 1 - (L.tune.drag || 0.0035); for (let i = 0; i < 900; i++) { vy += G; vx *= d; vy *= d; x += vx; y += vy; if (vy > 0 && y >= 609) return x; } return x; }
export function humanRun(L, i, boostF = 999, seed = 1, lag = 9) {
  const sp = L.spots[i], cx = sp.x + sp.w / 2, S = createSim(L), hist = []; let rs = seed * 7919 + 13;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647; const bias = (rnd() - 0.5) * 80, tx = cx + bias;
  while (!S.parked && !S.failed && S.frame < 2700) {
    const c = S.car; hist.push({ x: c.position.x, y: c.position.y, vx: c.velocity.x, vy: c.velocity.y, g: S.grounded });
    const o = hist[Math.max(0, hist.length - 1 - lag)], inp = {};
    if (o.x < L.lipX && o.g) { inp.right = true; inp.boost = S.frame < boostF; }
    else if (!o.g) { const lx = landX(L, o.x, o.y, o.vx, o.vy);
      if (lx < tx - 50) { inp.right = true; if (S.fuel > 0 && o.vy > -1.5) inp.up = true; }
      else if (lx > tx + 50) inp.left = true;
      if (Math.abs(tx - o.x) < 250 && o.vy > 4) inp.up = true; }
    else { const d = cx - o.x; if (d < -14) inp.left = true; else if (d > 14 && !S.inSpot) inp.right = true; }
    S.step(inp);
  }
  return S;
}
const BOOSTS = [0, 15, 30, 45, 60, 80, 999];
export function reachable(L, i) { for (const bf of BOOSTS) { let ok = 0; for (const s of [1, 2, 3]) { const S = humanRun(L, i, bf, s * (i + 3)); if (S.parked && S.parkedSpot === i) ok++; } if (ok >= 2) return bf; } return null; }
export const TIERS = [0, 2, 4, 6, 8, 10, 13, 24];
if ((process.argv[1] || '').endsWith('human_bot.mjs')) {
  const P = path();
  for (const n of TIERS) { const out = [];
    for (const seed of [11, 22, 33, 44]) { const L = genLot(seed, P[n].up); let best = 0;
      for (let i = 0; i < L.spots.length; i++) if (reachable(L, i) !== null) best = i + 1; else if (i > best + 1) break;
      out.push(best); }
    console.log(`tier n=${String(n).padStart(2)} spent ${String(P[n].spent).padStart(4)}  human-model farthest spot:`, out.join(' '));
  }
}
