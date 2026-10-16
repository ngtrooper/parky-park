// Headless browser test: replays the solver's inputs through the real game in Chromium, checks every level parks.
import { chromium } from 'playwright';
import fs from 'fs';
const URL = process.argv[2] || 'http://localhost:4173/';
const sol = JSON.parse(fs.readFileSync('tools/solutions.json'));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: process.env.VIDEO ? { dir: 'shots/video', size: { width: 960, height: 540 } } : undefined });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(String(e))); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
await page.goto(URL); await page.waitForFunction(() => window.__pp && document.querySelector('.menu'));
await page.screenshot({ path: 'shots/menu.png' });
let all = true;
const ids = process.env.IDS ? process.env.IDS.split(',').map(Number) : Object.keys(sol).map(Number);
for (const id of ids) {
  await page.evaluate(([id, inp]) => window.__pp.play(id, inp), [id, sol[id].inputs]);
  await page.waitForTimeout(400);
  if (!process.env.VIDEO) await page.screenshot({ path: `shots/level${id}_start.png` });
  const r = await page.waitForFunction(() => { const S = window.__pp.scene?.sim; return S && (S.parked || S.failed) ? { parked: S.parked, failed: S.failed, t: S.time() } : null; }, null, { timeout: 60000 }).then(h => h.jsonValue());
  await page.waitForTimeout(700);
  await page.screenshot({ path: `shots/level${id}_parked.png` });
  console.log(`L${id}`, r.parked ? 'PARKED' : 'FAILED ' + r.failed, r.t.toFixed(2) + 's');
  if (!r.parked) all = false;
}
// restart key + fail screen check
await page.evaluate(() => window.__pp.startLevel(1)); await page.waitForTimeout(300);
await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500); await page.keyboard.up('ArrowLeft');
await page.keyboard.press('KeyR'); await page.waitForTimeout(200);
const fr = await page.evaluate(() => window.__pp.scene.sim.frame); console.log('after R, frame =', fr);
await page.evaluate(() => { const S = window.__pp.scene.sim; S.fail('LEFT THE LOT'); }); await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/fail.png' });
await page.evaluate(() => window.__pp.showMenu()); await page.waitForTimeout(200); await page.screenshot({ path: 'shots/menu_after.png' });
console.log('errors:', errs.length ? errs : 'none');
await ctx.close(); await browser.close();
console.log(all ? 'BROWSER: ALL LEVELS PARKED' : 'BROWSER: FAILURES'); process.exit(all && !errs.length ? 0 : 1);
