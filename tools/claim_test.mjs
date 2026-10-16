// Regression: a rival arriving at a spot the player is already in/over must NOT take it; parking it scores STOLEN.
// Also: rivals never take more than half the spots, and the run never auto-fails just because rivals took spots.
import { genLot } from '../src/launch.js'; import { createSim } from '../src/sim.js'; import { tryRun } from './launch_tune.mjs';
let ok = true;
for (const seed of [11, 22, 33, 44, 55]) {
  const L = genLot(seed, {}); const { S, rec } = tryRun(L, 0);
  if (!S.parked) { console.log('seed', seed, 'baseline did not park'); ok = false; continue; }
  // find first frame the player is over spot 0
  const S1 = createSim(L); let claimF = -1;
  for (const i of rec) { S1.step(i); if (claimF < 0 && S1.claimed === 0) claimF = S1.frame; }
  for (const delta of [2, 15, 30]) {
    const L2 = { ...L, rivals: [{ spot: 0, lane: 0, path: L.rivals[0].path, lipF: L.rivals[0].lipF, arrive: claimF + delta }], lotcars: [] };
    const S2 = createSim(L2); let takenMsg = false;
    for (const i of rec) { S2.step(i); if (S2.events.includes('taken:0')) takenMsg = true; if (S2.parked) break; }
    const pass = S2.parked && S2.parkedSpot === 0 && !takenMsg && !S2.taken.has(0) && S2.stolen;
    console.log(`seed ${seed} rival arrives ${delta}f after player is over spot: parked=${S2.parked} taken=${takenMsg || S2.taken.has(0)} stolen=${S2.stolen} -> ${pass ? 'OK' : 'FAIL'}`);
    if (!pass) ok = false;
  }
}
// cap: many rivals, everyone arrives; at most half the spots get taken, run doesn't fail from it
const L = genLot(5, { boostCap: 6, boostPow: 6, air: 6, thrust: 6 }); const many = { ...L, rivals: L.spots.map((_, i) => ({ spot: i, lane: 0, path: [], lipF: 0, arrive: 30 + i })) };
const S = createSim(many); for (let f = 0; f < 200; f++) S.step(f === 0 ? { spinL: true } : {});
console.log('10 rivals all arrive -> spots taken:', S.taken.size, 'of', L.spots.length, '| failed:', S.failed);
if (S.taken.size > L.spots.length / 2 || S.failed === 'ALL SPOTS TAKEN') ok = false;
console.log(ok ? 'CLAIM TESTS PASS' : 'CLAIM TESTS FAIL'); process.exit(ok ? 0 : 1);
