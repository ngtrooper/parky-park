// Phone emulation: tutorial, 2-zone controls, ads mock (2x coins only, interstitial pacing), portrait layout.
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
const btn = k => p.evaluate(([k, d]) => document.querySelector(`.touch [data-k=${k}]`).dispatchEvent(new PointerEvent(d ? 'pointerdown' : 'pointerup', { pointerId: k.length, bubbles: true, pointerType: 'touch' })), [k, true]);
const rel = k => p.evaluate(k => document.querySelector(`.touch [data-k=${k}]`).dispatchEvent(new PointerEvent('pointerup', { pointerId: k.length, bubbles: true, pointerType: 'touch' })), k);
const btnsShown = await p.evaluate(() => getComputedStyle(document.querySelector('.touch')).display !== 'none' && ['left', 'right', 'spinL', 'spinR', 'hop'].every(k => document.querySelector(`.touch [data-k=${k}]`)) && !!document.querySelector('.touch .pad'));
// ▶ alone must not use boost
await btn('right'); await p.waitForTimeout(700); const b1 = await p.evaluate(() => window.__pp.scene.sim.boost);
const full = await p.evaluate(() => window.__pp.scene.L.tune.boostCap);
// ▶ + ⚡ BOOST on the ramp drains the gauge and builds speed
const padAt = (fx, fy, t) => p.evaluate(([fx, fy, t]) => { const el = document.querySelector('.touch .pad'), r = el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent(t, { pointerId: 9, bubbles: true, pointerType: 'touch', clientX: r.left + r.width * fx, clientY: r.top + r.height * fy })); }, [fx, fy, t]);
await padAt(0.95, 0.5, 'pointerdown'); const padR = await p.evaluate(() => window.__pp.input ? null : null); await p.waitForTimeout(1500); await p.screenshot({ path: 'shots/phone_flight.png' });
const st = await p.evaluate(() => { const S = window.__pp.scene.sim; return { x: S.car.position.x | 0, lip: window.__pp.scene.L.lipX, boost: S.boost | 0, v: Math.hypot(S.car.velocity.x, S.car.velocity.y).toFixed(1) }; });
await padAt(0.95, 0.5, 'pointerup'); await rel('right');
console.log('tutorial dismissed:', tutGone, '| touch buttons shown:', btnsShown, '| ▶ alone kept boost full:', b1 === full, '| ▶+pad▶ (ramp boost): boost', full, '->', st.boost, 'speed', st.v, 'car x', st.x, '(lip', st.lip + ')');
// zero-coin fail -> no ad button; coin-earning fail -> only '2x coins' (no continue)
await p.evaluate(() => window.__pp.scene.sim.fail('STUCK')); await p.waitForSelector('.panel.res');
const noCoinAd = !!(await p.$('[data-a=ad2]')), anyCont = !!(await p.$('[data-a=adc]'));
await p.evaluate(() => window.__pp.startLaunch()); await p.waitForFunction(() => window.__pp.scene?.sim && !window.__pp.scene.done && window.__pp.scene.sim.frame < 30);
await p.evaluate(() => { const S = window.__pp.scene.sim; S.flipBank = 50; S.fail('STUCK'); }); await p.waitForSelector('[data-a=ad2]'); await p.screenshot({ path: 'shots/phone_results_ads.png' });
const before = await p.evaluate(() => window.__pp.save.coins), cont2 = !!(await p.$('[data-a=adc]'));
await p.tap('[data-a=ad2]'); await p.waitForSelector('.mockad', { state: 'detached', timeout: 6000 }); await p.waitForTimeout(200);
const after = await p.evaluate(() => window.__pp.save.coins);
console.log('ad on 0-coin run:', noCoinAd, '| continue button anywhere:', anyCont || cont2, '| rewarded 2x coins: coins', before, '->', after);
// interstitial pacing: count mock interstitials over 6 run starts
let inter = 0;
for (let k = 0; k < 6; k++) { await p.evaluate(() => { window.__pp.startLaunch(); }); await p.waitForTimeout(250); if (await p.$('.mockad')) { inter++; await p.waitForSelector('.mockad', { state: 'detached', timeout: 5000 }); } }
console.log('interstitials over 6 run starts:', inter);
await p.evaluate(() => document.exitFullscreen?.().catch(() => {})); await p.waitForTimeout(300); await p.setViewportSize({ width: 412, height: 860 }); await p.waitForTimeout(500); await p.screenshot({ path: 'shots/phone_portrait.png' });
console.log('errors:', errs.length ? errs : 'none'); await b.close();
