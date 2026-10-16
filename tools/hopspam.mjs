// Exploit check: a fresh (no-upgrade) car that spams hop + thrust + drive must not get past spot #4 (a clean fresh launch reaches about #2) on any lot.
import { genLot } from '../src/launch.js'; import { createSim } from '../src/sim.js';
let ok = true;
for (const thr of [true, false]) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 11, 22]) {
  const L0 = genLot(seed, {}); const L = { ...L0, spots: L0.spots.slice(3), rivals: [], lotcars: [] }; const S = createSim(L); let hops = 0; // no near spots to fall into: pure distance test
  const lim = L0.spots[3].x;
  while (!S.failed && !S.parked && S.frame < 60 * 40) { S.step({ right: true, boost: true, hop: true, up: thr && S.frame % 2 === 0 }); if (S.events.includes('hop')) hops++; }
  console.log(`${thr ? 'hop+thrust' : 'hop-only  '} seed ${seed}: maxX=${S.maxX | 0} (spot#4 at ${lim | 0}) hops=${hops} end=${S.parked ? 'parked #' + (S.parkedSpot + 1) : S.failed}`);
  if (S.maxX > lim || S.parked) ok = false;
}
console.log(ok ? 'HOP-SPAM CANNOT REACH FAR SPOTS' : 'EXPLOIT STILL WORKS'); process.exit(ok ? 0 : 1);
