import { chromium, devices } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
const ctx = await b.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage();
await p.goto('http://localhost:4173/'); await p.waitForFunction(() => window.__pp && document.querySelector('.menu'));
await p.screenshot({ path: '/workspace/parky-park/shots/phone_portrait_menu.png' });
await p.evaluate(() => { window.__pp.save.tut = 1; window.__pp.startLaunch(); }); await p.waitForTimeout(1500);
console.log(await p.evaluate(() => [window.__pp.scene.cameras.main.zoom, innerWidth, innerHeight]));
await p.screenshot({ path: '/workspace/parky-park/shots/phone_portrait2.png' }); await b.close();
