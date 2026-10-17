// Records CrazyGames preview videos from the real game, frame by frame (deterministic: the Phaser loop is driven manually).
// node tools/preview_video.mjs landscape|portrait  -> art/preview_<mode>.mp4
import { chromium } from 'playwright'; import fs from 'node:fs'; import { execSync } from 'node:child_process';
import { genLot } from '../src/launch.js'; import { run, UP } from './preview_gen.mjs';
const mode = process.argv[2] || 'landscape', [W, H] = mode === 'portrait' ? [1080, 1920] : [1920, 1080];
const SEED = 30, SPOT = 4, BF = 60, FA = 150, FPS = 30, STEP = 1000 / FPS;
const L = genLot(SEED, UP, false, 4), { S, rec } = run(L, SPOT, BF, FA);
console.log('scripted run: parked', S.parked, 'spot', S.parkedSpot + 1, 'stolen', S.stolen, 'frames', rec.length);
const dir = `shots/pv_${mode}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: W / 2, height: H / 2 }, deviceScaleFactor: 2 })).newPage();
await p.addInitScript(up => localStorage.setItem('parkypark_v1', JSON.stringify({ tut: 1, econ: 2, upVer: 2, up, coins: 1840, bestSpot: 4, bestDist: 90, streak: 3, bestStreak: 3,
  skin: 'red', paints: ['red', 'eblue', 'chrome'], flame: 'blue', flames: ['classic', 'blue'], stats: { parks: 12, steals: 4, triple: 0, dailies: 0 } })), UP);
await p.goto('http://localhost:4173/'); await p.waitForFunction(() => window.__pp && document.querySelector('.menu'));
let n = 0, t = 1000;
const step = k => p.evaluate(([k, t0, dt]) => { const g = window.__game; for (let i = 0; i < k; i++) g.step(t0 + i * dt, dt); const sc = window.__pp.scene; if (sc?.autoT) { clearTimeout(sc.autoT); sc.autoT = null; } }, [k, t, STEP / k]);
const shot = async () => { await p.screenshot({ path: `${dir}/f${String(n++).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 }); };
await p.evaluate(() => { window.__game = window.__pp.scene?.game || window.__pp.game; });
await p.evaluate(([s, i]) => { window.__pp.playLaunch(s, i); }, [SEED, rec]);
await p.evaluate(() => { window.__game = window.__game || window.__pp.scene.game; window.__game.loop.sleep(); });
// flight: ~the scripted frames at 60 Hz sim => 2 sim steps per video frame
const flightFrames = Math.ceil(rec.length / 2) + 8;
for (let f = 0; f < flightFrames; f++) { await step(1); t += STEP; await shot(); }
// results (coins count-up runs on real timers; give it real time while we capture)
for (let f = 0; f < FPS * 4.2; f++) { await step(1); t += STEP; await p.waitForTimeout(12); await shot(); }
// shop + paint glimpse
await p.evaluate(() => window.__pp.openShop()); await p.waitForSelector('.paints');
await p.evaluate(() => document.querySelector('.garage.paints').scrollIntoView({ block: 'center' }));
for (let f = 0; f < FPS * 1.4; f++) { await step(1); t += STEP; await shot(); }
await p.click('[data-s=eblue]'); await p.evaluate(() => document.querySelector('.garage.paints').scrollIntoView({ block: 'center' }));
for (let f = 0; f < FPS * 1.8; f++) { await step(1); t += STEP; await shot(); }
await b.close();
const out = `art/preview_${mode}.mp4`;
execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i ${dir}/f%04d.jpg -c:v libx264 -preset slow -crf 20 -vf scale=out_range=tv,format=yuv420p -color_range tv -movflags +faststart -an ${out}`);
console.log(out, (fs.statSync(out).size / 1048576).toFixed(1) + ' MB', (n / FPS).toFixed(1) + ' s');
