// 1920x1080 screenshot with the phone touch controls visible, mid-run (for the Play listing).
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] }); const c = await b.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); const p = await c.newPage();
await p.addInitScript(() => localStorage.setItem('parkypark_v1', JSON.stringify({ tut: 1, econ: 2, upVer: 2, up: { boostCap: 6, boostPow: 6, air: 6, thrust: 6 }, coins: 1840, skin: 'red', paints: ['red'], flame: 'blue', flames: ['classic', 'blue'], bestSpot: 4 })));
await p.goto('http://localhost:4173/?touch'); await p.waitForFunction(() => window.__pp && document.querySelector('.menu'));
await p.evaluate(() => window.__pp.startLaunch(true)); await p.waitForFunction(() => window.__pp.scene?.sim);
const pad = await (await p.$('.touch .pad')).boundingBox();
const down = (sel, x, y, id) => p.evaluate(([sel, x, y, id]) => document.querySelector(sel).dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, bubbles: true, clientX: x, clientY: y })), [sel, x, y, id]);
await down('[data-k=right]', 0, 0, 3); await down('.touch .pad', pad.x + pad.width * 0.95, pad.y + pad.height * 0.5, 9);
await p.waitForTimeout(2300);
await p.evaluate(([x, y]) => document.querySelector('.touch .pad').dispatchEvent(new PointerEvent('pointermove', { pointerId: 9, bubbles: true, clientX: x, clientY: y })), [pad.x + pad.width * 0.85, pad.y + pad.height * 0.15]);
await p.waitForTimeout(700); await p.screenshot({ path: 'store/play/screenshot_7_touch_controls.png' }); await b.close();
