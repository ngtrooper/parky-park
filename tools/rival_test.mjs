// Rivals wait for your first input; rival behaviour varies per run; snatchers only on spot #5+ and never adjacent.
import { genLot } from '../src/launch.js'; import { createSim } from '../src/sim.js';
let ok = true;
const L = genLot(9, {}); const S = createSim(L);
for (let f = 0; f < 600; f++) S.step({});
const waited = S.rf === -1 && S.rivals.every(r => !r.arrived) && S.taken.size === L.lotcars.filter(o => o.beh === 'pullout' || o.beh === 'late').length;
S.step({ right: true }); const went = S.started && S.events.includes('go');
console.log('600 idle frames: rivals waiting =', waited, '| first input fires GO =', went); if (!waited || !went) ok = false;
const sig = new Set(); let snOk = true; const pers = {}, mis = {};
for (let seed = 1; seed <= 300; seed++) { const L = genLot(seed, { boostCap: 2, air: 2 }, false, 2);
  L.rivals.forEach(r => { sig.add([r.spot, r.arrive, Math.round(r.arcH)].join()); pers[r.pers] = (pers[r.pers] || 0) + 1; mis[r.mistake || 'clean'] = (mis[r.mistake || 'clean'] || 0) + 1; });
  const sn = L.lotcars.filter(o => o.beh === 'snatch').map(o => o.spot);
  if (sn.some(i => i < 4) || sn.some((i, k) => k && i - sn[k - 1] < 3)) snOk = false; }
console.log('distinct rival runs:', sig.size, '| personalities', JSON.stringify(pers), '| mistakes', JSON.stringify(mis), '| snatchers only #5+ & spaced:', snOk);
if (sig.size < 500 || !snOk) ok = false;
console.log(ok ? 'RIVAL TESTS PASS' : 'RIVAL TESTS FAIL'); process.exit(ok ? 0 : 1);
