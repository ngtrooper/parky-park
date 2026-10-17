// Paint shop: buy, equip, save, milestone free unlock, half-price, old-skin migration, tint applied to the player car.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:4173/';
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] }); const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE); await p.evaluate(() => localStorage.setItem('parkypark_v1', JSON.stringify({ coins: 1000, skin: 'midnight', econ: 2, upVer: 2, tut: 1, stats: { parks: 6, steals: 0, triple: 0, dailies: 0 }, bestStreak: 5 })));
await p.reload(); await p.waitForFunction(() => window.__pp);
let ok = true; const mig = await p.evaluate(() => window.__pp.save.skin); ok &&= mig === 'purple';
await p.evaluate(() => window.__pp.openShop()); await p.waitForSelector('[data-s=red]');
const t = s => p.textContent(`[data-s=${s}] em`);
const st = { purple: await t('purple'), neon: await t('neon'), red: await t('red') }; ok &&= /EQUIPPED/.test(st.purple) && /450/.test(st.neon) && /150/.test(st.red);
await p.click('[data-s=red]'); const a = await p.evaluate(() => ({ s: window.__pp.save.skin, c: window.__pp.save.coins, own: window.__pp.save.paints })); ok &&= a.s === 'red' && a.c === 850 && a.own.includes('red');
await p.click('[data-s=pearl]'); await p.click('[data-s=red]'); const c2 = await p.evaluate(() => window.__pp.save.coins); ok &&= c2 === 850; // re-equip owned = free
await p.screenshot({ path: 'shots/paint_shop.png', fullPage: true });
await p.evaluate(() => window.__pp.startLaunch()); await p.waitForFunction(() => window.__pp.scene?.carImg);
const tint = await p.evaluate(() => window.__pp.scene.carImg.tintTopLeft); ok &&= tint === 0xff4a4a;
await p.reload(); await p.waitForFunction(() => window.__pp); ok &&= (await p.evaluate(() => window.__pp.save.skin)) === 'red' && !errs.length;
console.log('migrated', mig, '| labels', JSON.stringify(st), '| bought', JSON.stringify(a), '| re-equip coins', c2, '| car tint', tint?.toString(16), '| errors', errs);
console.log(ok ? 'PAINT OK' : 'PAINT FAIL'); await b.close(); process.exit(ok ? 0 : 1);
