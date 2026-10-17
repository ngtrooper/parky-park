// Puzzles must use a fixed car: replay each solution with NO upgrades and with MAXED upgrades; results must be identical.
import { chromium } from 'playwright'; import fs from 'fs';
const URL = process.argv[2] || 'http://localhost:4173/'; const sol = JSON.parse(fs.readFileSync('tools/solutions.json'));
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] }); const res = {};
for (const up of [{}, { boostPow: 4, air: 4, thrust: 4, boostCap: 3, grip: 3, spin: 3, mult: 3 }]) {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.addInitScript(u => localStorage.setItem('parkypark_v1', JSON.stringify({ up: u, econ: 2, tut: 1 })), up);
  await p.goto(URL); await p.waitForFunction(() => window.__pp && document.querySelector('.menu'));
  for (const id of Object.keys(sol)) {
    await p.evaluate(([id, inp]) => { window.__pp.scene = null; window.__pp.play(+id, inp); }, [id, sol[id].inputs]); await p.waitForFunction(id => window.__pp.scene?.levelId === id && window.__pp.scene.sim.frame < 30, +id);
    const r = await p.waitForFunction(() => { const S = window.__pp.scene?.sim; return S && (S.parked || S.failed) ? `${S.parked ? 'P' : S.failed} f${S.frame} x${S.car.position.x | 0} fuel${S.fuel | 0}` : null; }, null, { timeout: 60000 }).then(h => h.jsonValue());
    (res[id] = res[id] || []).push(r); }
  await p.close(); }
let same = true; for (const [id, [a, c]] of Object.entries(res)) { console.log('L' + id, a, '|', c); if (a !== c) same = false; }
console.log(same ? 'PUZZLES IGNORE LAUNCH UPGRADES' : 'PUZZLE DIFFERS WITH UPGRADES'); await b.close(); process.exit(same ? 0 : 1);
