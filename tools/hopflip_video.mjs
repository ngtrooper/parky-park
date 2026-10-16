import { chromium } from 'playwright'; import fs from 'fs';
const rec = JSON.parse(fs.readFileSync('tools/hopflip_l8.json'));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: 'shots/hvideo', size: { width: 960, height: 540 } } });
const p = await ctx.newPage(); await p.goto(process.argv[2] || 'http://localhost:4173/'); await p.waitForFunction(() => window.__pp && document.querySelector('.menu'));
await p.evaluate(r => window.__pp.play(8, r), rec);
const r = await p.waitForFunction(() => { const S = window.__pp.scene?.sim; return S && (S.parked || S.failed) ? [S.parked, S.flips, S.time()] : null; }, null, { timeout: 30000 }).then(h => h.jsonValue());
await p.waitForTimeout(1200); await p.screenshot({ path: 'shots/hopflip_parked.png' }); console.log('L8 hop-flip run (no thrusters):', r);
await ctx.close(); await b.close();
