// Scripted check of the new ground moves: drive (no fuel), hop, hop-flip, land upright, face left, and beat L8 with zero thrust.
import { LEVELS } from '../src/levels.js'; import { createSim } from '../src/sim.js'; import fs from 'fs';
const L = LEVELS[7], S = createSim(L), rec = []; let phase = 'drive', landF = 0;
const enc = i => (i.left ? 1 : 0) | (i.right ? 2 : 0) | (i.spinL ? 8 : 0) | (i.spinR ? 16 : 0) | (i.hop ? 32 : 0);
let maxV = 0, facingLeftSeen = false;
while (!S.parked && !S.failed && S.frame < 1800) {
  const p = S.car.position, i = {};
  if (phase === 'drive') { i.right = true; if (S.frame > 40) { i.hop = true; i.spinL = true; phase = 'air'; } }
  else if (phase === 'air') { i.spinL = S.flips === 0; if (S.grounded && S.frame > 60) { phase = 'back'; landF = S.frame; } }
  else if (phase === 'back') { i.left = true; if (S.frame - landF > 25) phase = 'go'; }
  else { const ex = 965 - p.x; if (ex > 8) i.right = S.car.velocity.x < Math.min(8, ex * 0.05 + 0.5); else if (S.car.velocity.x > 0.2) i.left = true; }
  if (S.facing < 0) facingLeftSeen = true;
  maxV = Math.max(maxV, Math.abs(S.car.velocity.x)); rec.push(enc(i)); S.step(i);
}
console.log({ parked: S.parked, failed: S.failed, t: S.time().toFixed(2), flips: S.flips, fuelLeft: S.fuel.toFixed(1), maxGroundSpeed: maxV.toFixed(1), facingLeftSeen, upright: Math.cos(S.car.angle) > 0.95 });
fs.writeFileSync('tools/hopflip_l8.json', JSON.stringify(rec));
process.exit(S.parked && S.flips >= 1 && S.fuel > 90 && facingLeftSeen ? 0 : 1);
