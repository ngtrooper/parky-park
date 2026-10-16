// Headless browser test of LAUNCH mode: menu default, replayed runs at 2 upgrade tiers, coins, shop purchase, GIF capture.
import { chromium } from 'playwright';
import { genLot } from '../src/launch.js'; import { tryRun } from './launch_tune.mjs';
const URL = process.argv[2] || 'http://localhost:4173/';
const enc = i => (i.left ? 1 : 0) | (i.right ? 2 : 0) | (i.up ? 4 : 0) | (i.spinL ? 8 : 0) | (i.spinR ? 16 : 0) | (i.hop ? 32 : 0) | (i.boost ? 64 : 0);
const plan = [{ up: {}, seed: 11 }, { up: { boostCap: 3, boostPow: 3, air: 3, thrust: 3, grip: 2 }, seed: 22 }];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: process.env.VIDEO ? { dir: 'shots/lvideo', size: { width: 960, height: 540 } } : undefined });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(URL); await page.waitForFunction(() => window.__pp && document.querySelector('.menu'));
await page.screenshot({ path: 'shots/launch_menu.png' });
let ok = true;
for (const [n, p] of plan.entries()) {
  await page.evaluate(up => { window.__pp.save.up = up; }, p.up);
  const L = genLot(p.seed, p.up); let best = null;
  for (let i = L.spots.length - 1; i >= 0 && !best; i--) { const r = tryRun(L, i); if (r.S.parked && r.S.parkedSpot === i) best = { i, rec: r.rec.map(enc), coins: r.S }; }
  const coins0 = await page.evaluate(() => window.__pp.save.coins);
  await page.evaluate(([s, inp]) => window.__pp.playLaunch(s, inp), [p.seed, best.rec]);
  await page.waitForTimeout(2600); await page.screenshot({ path: `shots/launch_tier${n}_flight.png` });
  const r = await page.waitForFunction(() => { const S = window.__pp.scene?.sim; return S && (S.parked || S.failed) ? { parked: S.parked, spot: S.parkedSpot, failed: S.failed } : null; }, null, { timeout: 60000 }).then(h => h.jsonValue());
  await page.waitForTimeout(900); await page.screenshot({ path: `shots/launch_tier${n}_result.png` });
  const coins1 = await page.evaluate(() => window.__pp.save.coins);
  console.log(`tier ${n} upgrades=${JSON.stringify(p.up)} expected spot #${best.i + 1} -> ${r.parked ? 'PARKED spot #' + (r.spot + 1) : 'FAILED ' + r.failed}, coins +${coins1 - coins0}`);
  if (!r.parked || r.spot !== best.i) ok = false;
}
// shop: give coins, buy one
await page.evaluate(() => { window.__pp.save.coins = 500; window.__pp.save.up = {}; window.__pp.openShop(); });
await page.waitForTimeout(300); await page.screenshot({ path: 'shots/shop.png' });
await page.click('.up button[data-k=air]'); const lv = await page.evaluate(() => [window.__pp.save.up.air, window.__pp.save.coins, JSON.parse(localStorage.getItem('parkypark_v1')).up.air]);
console.log('shop buy Air Tank -> level, coins, saved level:', lv.join(', '));
if (lv[0] !== 1 || lv[2] !== 1) ok = false;
await page.keyboard.press('Enter'); await page.waitForTimeout(500);
const mode = await page.evaluate(() => window.__pp.scene.isLaunch); console.log('Enter from shop starts launch run:', mode);
console.log('errors:', errs.length ? errs : 'none');
await ctx.close(); await browser.close(); process.exit(ok && !errs.length ? 0 : 1);
