// Shop: 3x levels + old-save migration, flame colours purchase/select, daily ad gift (mockads) once per day.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:4173/';
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] }); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE); await p.evaluate(() => localStorage.setItem('parkypark_v1', JSON.stringify({ coins: 1000, up: { air: 2, mult: 1 }, econ: 2, tut: 1 })));
await p.goto(BASE + '?mockads'); await p.waitForFunction(() => window.__pp);
const mig = await p.evaluate(() => window.__pp.save.up); let ok = mig.air === 6 && mig.mult === 3;
await p.evaluate(() => window.__pp.openShop ? window.__pp.openShop() : document.querySelector('[data-a=shop]').click()); await p.waitForSelector('[data-f=blue]');
const pips = await p.evaluate(() => document.querySelector('.up .pips').textContent.length); ok &&= pips === 12;
await p.click('[data-f=blue]'); const fl = await p.evaluate(() => ({ f: window.__pp.save.flame, c: window.__pp.save.coins })); ok &&= fl.f === 'blue' && fl.c === 850;
const c0 = fl.c; await p.click('[data-a=dad]'); await p.waitForSelector('.mockad', { state: 'detached', timeout: 8000 }); await p.waitForTimeout(300);
const c1 = await p.evaluate(() => window.__pp.save.coins), claimed = await p.textContent('.dailyad'); ok &&= c1 > c0 && /next in/.test(claimed);
await p.screenshot({ path: 'shots/shop_v9.png', fullPage: true });
await p.goto(BASE); await p.waitForFunction(() => window.__pp); await p.evaluate(() => document.querySelector('[data-a=shop]').click()); await p.waitForTimeout(300);
const webHidden = !(await p.$('[data-a=dad]')) && !/Watch ad|ad2/.test(await p.innerHTML('.shop, body'));
console.log('migrated', JSON.stringify(mig), '| pips', pips, '| flame', fl.f, 'coins', fl.c, '| daily ad', c0, '->', c1, claimed.trim(), '| hidden on web', webHidden, '| errors', errs);
console.log(ok ? 'SHOP V9 OK' : 'SHOP V9 FAIL'); await b.close(); process.exit(ok ? 0 : 1);
