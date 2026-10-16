// UI screenshots at desktop sizes: menu, shop, in-flight, results.
import { chromium } from 'playwright'; import { genLot } from '../src/launch.js'; import { tryRun } from './launch_tune.mjs';
const URL = process.argv[2] || 'http://localhost:4173/';
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
for (const [w, h] of [[1920, 1080], [2560, 1440]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForFunction(() => window.__pp && document.querySelector('.menu')); await p.screenshot({ path: `shots/ui_menu_${w}.png` });
  await p.evaluate(() => { window.__pp.save.coins = 300; window.__pp.save.tut = 1; window.__pp.openShop(); }); await p.waitForTimeout(200); await p.screenshot({ path: `shots/ui_shop_${w}.png` });
  const up = { boostPow: 2, air: 2, boostCap: 1 }, seed = 33, L = genLot(seed, up); const { rec } = tryRun(L, 4);
  await p.evaluate(([up, rec, seed]) => { window.__pp.save.up = up; window.__pp.save.bestDist = 40; window.__pp.playLaunch(seed, rec.map(i => (i.left ? 1 : 0) | (i.right ? 2 : 0) | (i.up ? 4 : 0) | (i.spinL ? 8 : 0) | (i.spinR ? 16 : 0) | (i.hop ? 32 : 0) | (i.boost ? 64 : 0))); }, [up, rec, seed]);
  await p.waitForFunction(() => window.__pp.scene?.sim?.car.position.x > window.__pp.scene.L.lipX + 500, null, { timeout: 30000 }); await p.screenshot({ path: `shots/ui_flight_${w}.png` });
  await p.waitForSelector('.panel.res', { timeout: 40000 }); await p.waitForTimeout(1500); await p.screenshot({ path: `shots/ui_results_${w}.png` });
  console.log(w, 'errors', errs.length ? errs : 'none'); await p.close();
}
await b.close();
