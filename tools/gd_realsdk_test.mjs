// Loads the GameDistribution build with the REAL GD SDK (main.min.js) in headless Chromium; checks it initialises with our gameId without page errors.
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const dir = 'dist-portals/gamedistribution';
const s = http.createServer((q, w) => { let f = path.join(dir, q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, b) => { if (e) { w.writeHead(404); return w.end(); } w.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); w.end(b); }); }).listen(4191);
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] }); const p = await b.newPage(); const pageErrs = [], consoleErrs = [], gdReq = [];
p.on('pageerror', e => (/browsingTopics/.test(e.message) ? thirdParty : pageErrs).push(e.message)); const thirdParty = []; // GD's header-bidding script calls a removed Chrome API: not ours p.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 160)); });
p.on('request', r => { if (/gamedistribution|gdsdk/.test(r.url())) gdReq.push(r.url().slice(0, 100)); });
await p.goto('http://localhost:4191/'); await p.waitForFunction(() => window.__pp && !document.getElementById('loading'), null, { timeout: 30000 });
await p.waitForTimeout(4000);
const st = await p.evaluate(() => ({ gdsdk: typeof window.gdsdk, showAd: typeof window.gdsdk?.showAd, gameId: window.GD_OPTIONS?.gameId, adsOn: window.__pp.platform.adsOn() }));
await p.evaluate(() => { window.__pp.save.tut = 1; window.__pp.startLaunch(); }); await p.waitForTimeout(9000); // no ad fills on localhost: our 6 s no-start timeout lets the run begin
const running = await p.evaluate(() => (window.__pp.scene?.sim?.frame || 0) > 0 || !!document.querySelector('.menu,.shop'));
console.log(JSON.stringify({ ...st, running, pageErrs, thirdPartyPageErrs: thirdParty, consoleErrs: consoleErrs.slice(0, 6), gdRequests: gdReq.slice(0, 6) }, null, 1));
await b.close(); s.close(); console.log(!pageErrs.length && running && st.gameId === 'f80b379dea094c32949287ccda7b3610' ? 'GD REAL SDK OK' : 'GD REAL SDK FAIL'); process.exit(!pageErrs.length && running ? 0 : 1);
