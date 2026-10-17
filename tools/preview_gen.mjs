// Finds a good-looking scripted run for the store preview videos: boost, big flight, a clean flip, a rival, then PARKED (ideally STOLEN).
import { genLot } from '../src/launch.js'; import { createSim, GRAV_LA, DT } from '../src/sim.js';
const G = GRAV_LA * DT * DT;
function landX(L, x, y, vx, vy) { const d = 1 - (L.tune.drag || 0.0035); for (let i = 0; i < 900; i++) { vy += G; vx *= d; vy *= d; x += vx; y += vy; if (vy > 0 && y >= 609) return x; } return x; }
export const enc = i => (i.left ? 1 : 0) | (i.right ? 2 : 0) | (i.spinL ? 8 : 0) | (i.spinR ? 16 : 0) | (i.hop ? 32 : 0) | (i.tD ? 128 : 0) | (i.tL ? 256 : 0) | (i.tR ? 512 : 0) | (i.tU ? 4 : 0);
export const PAD = 20;
export function run(L, spot, boostF, flipAt) {
  const sp = L.spots[spot], tx = sp.x + sp.w / 2, S = createSim(L), rec = []; let flipping = false, turned = 0, lastA = 0, flipped = false;
  for (let f = 0; f < PAD; f++) { rec.push(0); S.step({}); }
  while (!S.parked && !S.failed && S.frame < 1400) {
    const c = S.car, inp = {}, g = S.grounded;
    if (c.position.x < L.lipX && g) { inp.right = true; inp.tR = S.frame < PAD + boostF; }
    else if (!g) {
      const lx = landX(L, c.position.x, c.position.y, c.velocity.x, c.velocity.y), an = Math.atan2(Math.sin(c.angle), Math.cos(c.angle));
      if (!flipped && !flipping && c.position.x > L.lipX + flipAt && c.velocity.y < 2) { flipping = true; turned = 0; lastA = c.angle; }
      if (flipping) { inp.spinR = true; turned += c.angle - lastA; lastA = c.angle; if (turned > Math.PI * 2 - 0.9) { flipping = false; flipped = true; } }
      else { if (an > 0.18 && c.angularVelocity > -0.05) inp.spinL = true; else if (an < -0.18 && c.angularVelocity < 0.05) inp.spinR = true;
        const lvl = Math.abs(an) < 0.5;
        if (lx < tx - 40) { inp.right = true; if (S.fuel > 0 && lvl) { inp.tR = true; if (c.velocity.y > -1.5) inp.tU = true; } }
        else if (lx > tx + 120 && lvl) inp.tL = true;
        if (Math.abs(tx - c.position.x) < 250 && c.velocity.y > 4 && lvl) inp.tU = true; }
    } else { const d = tx - c.position.x; if (d < -14) inp.left = true; else if (d > 14 && !S.inSpot) inp.right = true; }
    rec.push(enc(inp)); S.step(inp);
  }
  return { S, rec };
}
export const UP = { boostCap: 6, boostPow: 6, air: 6, thrust: 6, grip: 3, spin: 6 };
if ((process.argv[1] || '').endsWith('preview_gen.mjs')) {
  const out = [];
  for (let seed = 1; seed <= 80; seed++) { const L = genLot(seed, UP, false, 4);
    for (const spot of [4, 5, 6]) for (const bf of [40, 60, 90]) for (const fa of [150, 400]) {
      const { S, rec } = run(L, spot, bf, fa);
      if (S.parked && S.parkedSpot === spot && S.cleanFlips >= 1 && L.rivals.length && rec.length < 760) out.push({ seed, spot, bf, fa, stolen: !!S.stolen, frames: rec.length, flips: S.cleanFlips }); } }
  out.sort((a, b) => (b.stolen - a.stolen) || (a.frames - b.frames)); console.log(out.length, JSON.stringify(out.slice(0, 8)));
}
