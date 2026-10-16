// Human-reach model: phone/keyboard-simple scheme flown with ~150ms reaction lag and a sloppy release.
// Tiers follow the cheapest-first purchase path (tools/econ.mjs). Target: fresh #1-2, about +1 spot per tier.
import { genLot } from '../src/launch.js'; import { createSim } from '../src/sim.js'; import { simpleInput } from '../src/controls.js'; import { path } from './econ.mjs';
export function humanRun(L, i, lag = 9, seed = 1) {
  const sp = L.spots[i], cx = sp.x + sp.w / 2, S = createSim(L), hist = []; let rs = seed;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647; const bias = (rnd() - 0.5) * 80; // misjudges the spot by up to ±40px
  while (!S.parked && !S.failed && S.frame < 2700) {
    const p = S.car.position, v = S.car.velocity; hist.push({ x: p.x, y: p.y, vx: v.x, vy: v.y, g: S.grounded });
    const o = hist[Math.max(0, hist.length - 1 - lag)], z = { l: false, r: false }, dx = cx + bias - o.x;
    if (o.g && o.x < L.lipX) z.r = true;
    else if (!o.g) {
      if (dx > 300) z.r = o.vy > -1 || o.y > sp.y - 240;
      else { const want = Math.max(-2, Math.min(5, dx * 0.035));
        if (o.vx > want + 0.8) z.l = z.r = true; else if (o.vx < want - 0.8) z.r = o.vy > -0.5; else z.l = z.r = o.vy > 1.8; }
    } else { const d = cx - o.x; if (d < -14) z.l = true; else if (d > 14 && !S.inSpot) z.r = true; }
    S.step(simpleInput(S, z));
  }
  return S;
}
export const TIERS = [0, 3, 6, 9, 12, 15, 19, 23, 27, 33];
if ((process.argv[1] || '').endsWith('human_bot.mjs')) {
  const P = path();
  for (const n of TIERS) { const out = [];
    for (const seed of [11, 22, 33, 44, 55, 66]) { const L = genLot(seed, P[n].up); let best = 0;
      for (let i = 0; i < L.spots.length; i++) { let ok = 0; for (const s of [3, 7, 11]) { const S = humanRun(L, i, 9, s * seed); if (S.parked && S.parkedSpot === i) ok++; } if (ok >= 2) best = i + 1; }
      out.push(best); }
    console.log(`tier n=${String(n).padStart(2)} spent ${String(P[n].spent).padStart(4)}  human-model farthest spot:`, out.join(' '));
  }
}
