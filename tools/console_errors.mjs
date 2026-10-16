import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:4173/';
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] }); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); const errs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); }); p.on('pageerror', e => errs.push('pageerror: ' + e.message));
p.on('requestfailed', r => errs.push('reqfail: ' + r.url())); p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
await p.goto(url); await p.waitForTimeout(1500); await p.keyboard.press('Enter'); await p.waitForTimeout(800); await p.mouse.click(900, 500); await p.mouse.click(900, 500); await p.mouse.click(900, 500);
await p.keyboard.down('ArrowRight'); await p.waitForTimeout(6000); await p.keyboard.up('ArrowRight'); await p.waitForTimeout(8000);
await p.screenshot({ path: 'shots/desk_1080.png' });
console.log(errs.filter(e => !e.includes('GPU stall')).join('\n') || 'no errors'); await b.close();
