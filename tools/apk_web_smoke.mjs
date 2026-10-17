// Boots the web assets packaged INSIDE the release AAB/APK (assets/public) in a phone-sized headless Chromium.
// No emulator needed: checks menu, a launch run, touch UI, no page errors. Usage: node tools/apk_web_smoke.mjs <assets/public dir>
import { chromium, devices } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const dir = process.argv[2];
const T = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png' };
const s = http.createServer((q, w) => { let f = path.join(dir, q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, b) => { if (e) { w.writeHead(404); return w.end(); } w.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); w.end(b); }); }).listen(4192);
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] }); const c = await b.newContext({ ...devices['Pixel 7 landscape'] }); const p = await c.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 150)); });
await p.goto('http://localhost:4192/'); await p.waitForFunction(() => window.__pp && document.querySelector('.menu'), null, { timeout: 30000 });
await p.evaluate(() => { window.__pp.save.tut = 1; window.__pp.startLaunch(); }); await p.waitForFunction(() => window.__pp.scene?.sim?.frame > 30, null, { timeout: 20000 });
const st = await p.evaluate(() => ({ touch: getComputedStyle(document.querySelector('.touch')).display !== 'none', pad: !!document.querySelector('.touch .pad'), ads: window.__pp.platform.adsOn(), name: window.__pp.platform.name }));
await p.screenshot({ path: 'shots/apk_boot.png' });
console.log(JSON.stringify({ ...st, errs })); console.log(!errs.length && st.touch && st.pad ? 'APK WEB BOOT OK' : 'APK WEB BOOT FAIL');
await b.close(); s.close(); process.exit(errs.length ? 1 : 0);
