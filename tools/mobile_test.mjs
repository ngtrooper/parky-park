// Phone emulation: tutorial, 2-zone controls, ads mock (2x coins, continue, interstitial pacing), portrait layout.
import { chromium, devices } from 'playwright';
const URL = process.argv[2] || 'http://localhost:4173/';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ...devices['Pixel 7 landscape'] });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
// plain web build: no ads at all
await p.goto(URL); await p.waitForFunction(() => window.__pp && document.querySelector('.menu'));
await p.evaluate(() => { window.__pp.save.tut = 1; window.__pp.startLaunch(); }); await p.waitForTimeout(600);
await p.evaluate(() => window.__pp.scene.sim.fail('STUCK')); await p.waitForSelector('.panel.res'); await p.screenshot({ path: 'shots/phone_results_web.png' });
console.log('web build shows ad buttons:', !!(await p.$('.adbtn')), '| why line:', await p.textContent('.panel .why'));
await p.evaluate(() => { localStorage.clear(); }); await p.goto(URL + '?mockads'); await p.waitForFunction(() => window.__pp && document.querySelector('.menu'));
await p.screenshot({ path: 'shots/phone_menu.png' });
await p.tap('[data-a=launch]'); await p.waitForSelector('.tut'); await p.screenshot({ path: 'shots/phone_tutorial.png' });
for (let k = 0; k < 3; k++) { await p.tap('.tut'); await p.waitForTimeout(150); }
const tutGone = await p.evaluate(() => !document.querySelector('.tut') && window.__pp.save.tut === 1);
const vw = p.viewportSize(); const rx = vw.width * 0.8, y = vw.height * 0.6;
// hold RIGHT zone with a touch pointer for 2.2s
await p.evaluate(([x, y]) => { const z = document.querySelector('.zones'); z.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })); }, [rx, y]);
await p.waitForTimeout(2200); await p.screenshot({ path: 'shots/phone_flight.png' });
const st = await p.evaluate(() => { const S = window.__pp.scene.sim; return { x: S.car.position.x | 0, lip: window.__pp.scene.L.lipX, started: S.started }; });
await p.evaluate(([x, y]) => document.querySelector('.zones').dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })), [rx, y]);
console.log('tutorial dismissed:', tutGone, '| holding RIGHT zone 2.2s -> car x', st.x, '(lip at', st.lip + ')', 'started:', st.started);
// force a fail -> results with ad buttons
await p.evaluate(() => window.__pp.scene.sim.fail('STUCK')); await p.waitForSelector('[data-a=adc]'); await p.screenshot({ path: 'shots/phone_results_ads.png' });
const c0 = await p.evaluate(() => window.__pp.save.coins);
await p.tap('[data-a=adc]'); await p.waitForSelector('.mockad'); await p.waitForSelector('.mockad', { state: 'detached', timeout: 6000 });
const cont = await p.evaluate(() => ({ failed: window.__pp.scene.sim.failed, done: window.__pp.scene.done, revived: window.__pp.scene.sim.revived }));
console.log('rewarded continue -> run resumed:', !cont.failed && !cont.done && cont.revived);
await p.evaluate(() => { const S = window.__pp.scene.sim; S.flipBank = 50; S.fail('STUCK'); }); await p.waitForSelector('[data-a=ad2]');
const before = await p.evaluate(() => window.__pp.save.coins);
await p.tap('[data-a=ad2]'); await p.waitForSelector('.mockad', { state: 'detached', timeout: 6000 }); await p.waitForTimeout(200);
const after = await p.evaluate(() => window.__pp.save.coins); const cont2 = await p.$('[data-a=adc]');
console.log('rewarded 2x coins: coins', before, '->', after, '| continue offered again after revive:', !!cont2);
// interstitial pacing: count mock interstitials over 6 run starts
let inter = 0;
for (let k = 0; k < 6; k++) { await p.evaluate(() => { window.__pp.startLaunch(); }); await p.waitForTimeout(250); if (await p.$('.mockad')) { inter++; await p.waitForSelector('.mockad', { state: 'detached', timeout: 5000 }); } }
console.log('interstitials over 6 run starts:', inter);
await p.evaluate(() => document.exitFullscreen?.().catch(() => {})); await p.waitForTimeout(300); await p.setViewportSize({ width: 412, height: 860 }); await p.waitForTimeout(500); await p.screenshot({ path: 'shots/phone_portrait.png' });
console.log('errors:', errs.length ? errs : 'none'); await b.close();
