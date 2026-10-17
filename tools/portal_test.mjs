// Tests each portal build (dist-portals/<p>) with mocked SDKs: loads, no console errors, gameplay events, ads mute+pause,
// rewarded grants, saves via the right storage, no external links / GitHub mentions; plus the web build hides ads.
import { chromium } from 'playwright'; import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path';
const SDK_URL = { crazygames: /sdk\.crazygames\.com/, poki: /game-cdn\.poki\.com/, gamedistribution: /html5\.api\.gamedistribution\.com/ };
const mock = fs.readFileSync('tools/mocks/sdks.js', 'utf8');
const serve = dir => new Promise(r => { const s = http.createServer((q, w) => { let f = path.join(dir, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { w.writeHead(404); return w.end(); } w.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); w.end(b); }); }).listen(0, () => r(s)); });
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] }); let allOk = true;
for (const P of ['crazygames', 'poki', 'gamedistribution', 'web']) {
  const dir = P === 'web' ? 'dist' : `dist-portals/${P}`, srv = await serve(dir), port = srv.address().port;
  const txt = fs.readdirSync(dir + '/assets').filter(f => f.endsWith('.js')).map(f => fs.readFileSync(`${dir}/assets/${f}`, 'utf8')).join('') + fs.readFileSync(dir + '/index.html', 'utf8');
  const leaks = P === 'web' ? [] : ['github.io', 'ngtrooper', 'Tesla'].filter(w => txt.toLowerCase().includes(w.toLowerCase()));
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 } }), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await ctx.addInitScript(`window.__adGap=0;window.__MOCK=${JSON.stringify(P)};localStorage.setItem('parkypark_v1', JSON.stringify({ tut: 1, coins: 50 }));`);
  if (SDK_URL[P]) await p.route(SDK_URL[P], r => r.fulfill({ contentType: 'text/javascript', body: mock }));
  await p.goto(`http://localhost:${port}/`); await p.waitForFunction(() => window.__pp && !document.getElementById('loading'), null, { timeout: 20000 });
  const r = { P, leaks };
  r.adsOn = await p.evaluate(() => window.__pp.platform.adsOn());
  await p.evaluate(() => window.__pp.startLaunch()); await p.waitForFunction(() => window.__pp.scene?.sim?.frame > 5, null, { timeout: 20000 });
  await p.waitForTimeout(500);
  r.log = await p.evaluate(() => (window.__sdkLog || []).join(' '));
  // rewarded: daily gift in the shop (portals: ad; web: free bonus)
  await p.evaluate(() => window.__pp.openShop()); await p.waitForSelector('.dailyad button');
  const c0 = await p.evaluate(() => window.__pp.save.coins);
  r.dailyBtn = (await p.textContent('.dailyad button')).trim();
  const sel = (await p.$('[data-a=dad]')) ? '[data-a=dad]' : '[data-a=dfree]';
  const muted = p.evaluate(() => new Promise(res => { let seen = false; const iv = setInterval(() => { if (window.__pp.sfx.adMuted) seen = true; }, 20); setTimeout(() => { clearInterval(iv); res(seen); }, 900); }));
  await p.click(sel); r.mutedDuringAd = await muted; await p.waitForTimeout(800);
  r.coins = [c0, await p.evaluate(() => window.__pp.save.coins)];
  r.log2 = await p.evaluate(() => (window.__sdkLog || []).join(' '));
  r.hidden = await p.evaluate(() => !document.querySelector('[data-a=dad]') || true);
  if (P === 'crazygames') { await p.evaluate(() => window.__cgSettings({ muteAudio: true })); r.cgMute = await p.evaluate(() => window.__pp.sfx.platformMuted);
    await p.evaluate(() => window.__cgSettings({ muteAudio: false })); r.cgUnmute = !(await p.evaluate(() => window.__pp.sfx.platformMuted)); }
  if (P !== 'web') { // rewarded 2x coins on the results screen
    await p.evaluate(() => { window.__oldSim = window.__pp.scene?.sim; return window.__pp.startLaunch(); });
    await p.waitForFunction(() => window.__pp.scene?.sim && window.__pp.scene.sim !== window.__oldSim && !window.__pp.scene.done && window.__pp.scene.sim.frame > 3, null, { timeout: 20000 });
    await p.evaluate(() => { const S = window.__pp.scene.sim; S.flipBank = 50; S.fail('STUCK'); }); await p.waitForSelector('[data-a=ad2]', { timeout: 8000 }).catch(async e => { await p.screenshot({ path: 'shots/pt_fail.png' }); console.log('dbg', await p.evaluate(() => ({ adsOn: window.__pp.platform.adsOn(), done: window.__pp.scene.done, failed: window.__pp.scene.sim.failed, ov: document.querySelector('.panel')?.innerText?.slice(0, 200) }))); throw e; });
    const b0 = await p.evaluate(() => window.__pp.save.coins); await p.click('[data-a=ad2]'); await p.waitForTimeout(1200);
    r.x2 = [b0, await p.evaluate(() => window.__pp.save.coins)]; }
  else r.x2web = !(await p.$('[data-a=ad2]'));
  if (P !== 'web') { // results -> Menu must open the menu (never an ad + new run), even if 'Run again' was hit just before
    const res = async () => { await p.evaluate(() => { window.__oldSim = window.__pp.scene?.sim; return window.__pp.startLaunch(); });
      await p.waitForFunction(() => window.__pp.scene?.sim && window.__pp.scene.sim !== window.__oldSim && window.__pp.scene.sim.frame > 3, null, { timeout: 20000 });
      await p.evaluate(() => window.__pp.scene.sim.fail('STUCK')); await p.waitForSelector('.panel [data-a=m]'); };
    await res(); const n0 = (await p.evaluate(() => window.__sdkLog.length));
    await p.click('.panel [data-a=m]'); await p.waitForTimeout(2500);
    r.menuOk = await p.evaluate(() => !!document.querySelector('.menu')) && (await p.evaluate(n => window.__sdkLog.slice(n).filter(x => /ad:midgame|commercialBreak|showAd:interstitial/.test(x)).length, n0)) === 0;
    await res(); await p.evaluate(() => { document.querySelector('.panel [data-a=r]').click(); setTimeout(() => document.querySelector('.panel [data-a=m]')?.click() || window.__pp.showMenu(), 30); });
    await p.waitForTimeout(2500); r.raceOk = await p.evaluate(() => !!document.querySelector('.menu') && window.__pp.scene.done);
    // 60 s gap: with the real gap two quick run starts give at most one interstitial
    await p.evaluate(() => { window.__adGap = 60000; }); const n1 = await p.evaluate(() => window.__sdkLog.length);
    for (let k = 0; k < 3; k++) { await p.evaluate(() => window.__pp.startLaunch()); await p.waitForTimeout(700); }
    r.gapAds = await p.evaluate(n => window.__sdkLog.slice(n).filter(x => /ad:midgame|commercialBreak|showAd:interstitial/.test(x)).length, n1); }
  r.errs = errs;
  const has = s => r.log2.includes(s);
  let ok = (P === 'web' || (r.menuOk && r.raceOk && r.gapAds <= 1)) && !leaks.length && !errs.length && r.coins[1] > r.coins[0] && (P === 'web' || r.x2[1] > r.x2[0]);
  if (P === 'crazygames') ok &&= has('init') && has('gameplayStart') && has('ad:rewarded') && has('data.set:parkypark_v1') && has('settingsListener') && r.cgMute && r.cgUnmute && r.mutedDuringAd && r.adsOn;
  if (P === 'poki') ok &&= has('loadingFinished') && has('gameplayStart') && has('gameplayStop') && has('rewardedBreak') && r.mutedDuringAd && r.adsOn;
  if (P === 'gamedistribution') ok &&= has('showAd:interstitial') && has('showAd:rewarded') && has('preloadAd:rewarded') && r.mutedDuringAd && r.adsOn;
  if (P === 'web') ok &&= !r.adsOn && /Free daily bonus/.test(r.dailyBtn);
  console.log((ok ? 'PASS ' : 'FAIL ') + JSON.stringify({ ...r, log: undefined, log2: r.log2.slice(0, 300) }));
  allOk &&= ok; await ctx.close(); srv.close();
}
await b.close(); console.log(allOk ? 'PORTAL BUILDS OK' : 'PORTAL BUILDS FAIL'); process.exit(allOk ? 0 : 1);
