import Phaser from 'phaser';
import { LEVELS } from './levels.js';
import { createSim, starsFor, DT, CAR_W, CAR_H, FAIL_WHY, WARN } from './sim.js';
import { makeArt, SKIES } from './art.js';
import { sfx } from './sfx.js';
import { genLot, dailySeed, UPGRADES, costOf, payout, flipMult } from './launch.js';
import { showRewarded, onRunStart, isNative, adsOn } from './ads.js';
import { simpleInput as simpleMap } from './controls.js';
const simpleInput = S => simpleMap(S, zone);

// ---------- save ----------
const SAVE_KEY = "parkypark_v1";
const save = Object.assign({ stars: {}, best: {}, slips: 0, coins: 0, up: {}, runs: 0, bestSpot: 0, daily: {}, bestDist: 0, streak: 0, bestStreak: 0,
  stats: { parks: 0, steals: 0, triple: 0, dailies: 0 }, skin: 'white' }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
if (save.econ !== 2) { // v2 economy: old saves were inflated by the flip exploit; keep upgrades, trim coins
  save.coins = Math.min(save.coins, 150); save.econ = 2; }
for (const u of UPGRADES) if ((save.up[u.k] || 0) > u.max) save.up[u.k] = u.max;

// ---------- car skins (unlocked by milestones) ----------
const SKINS = [
  { k: 'white', name: 'Showroom', tint: 0xffffff, req: 'Default', ok: () => true },
  { k: 'midnight', name: 'Midnight', tint: 0x7b8cff, req: 'Park 5 times', ok: () => save.stats.parks >= 5 },
  { k: 'flame', name: 'Hot Rod', tint: 0xff7a4a, req: 'Land a triple flip', ok: () => save.stats.triple >= 1 },
  { k: 'mint', name: 'Mint', tint: 0x8affc8, req: 'Steal 3 spots', ok: () => save.stats.steals >= 3 },
  { k: 'gold', name: 'Gold', tint: 0xffd23f, req: 'Park in spot #5', ok: () => save.bestSpot >= 5 },
  { k: 'neon', name: 'Neon', tint: 0xff5ad8, req: '5-park streak', ok: () => save.bestStreak >= 5 },
  { k: 'stealth', name: 'Stealth', tint: 0x6a6f7c, req: 'Park in spot #10', ok: () => save.bestSpot >= 10 },
];
const skinTint = () => (SKINS.find(k => k.k === save.skin && k.ok()) || SKINS[0]).tint;
const unlockedSkins = () => SKINS.filter(k => k.ok()).map(k => k.k);
// ---------- quick-win challenge (one per run, small reward, usually achievable) ----------
function pickQuest() {
  const d = Math.max(10, Math.round((save.bestDist || 12) * 0.75 / 5) * 5);
  const Q = [
    { txt: `Fly ${d}m`, pay: 8, test: (S, p) => p.dist >= d },
    { txt: 'Land a flip', pay: 10, test: S => S.cleanFlips >= 1 },
    { txt: 'Park anywhere', pay: 8, test: S => S.parked },
    { txt: 'Park with no dings', pay: 12, test: S => S.parked && !S.bumps },
    ...(save.stats.parks >= 3 ? [{ txt: 'Land 2 flips', pay: 15, test: S => S.cleanFlips >= 2 }, { txt: 'Park and flip', pay: 15, test: S => S.parked && S.cleanFlips >= 1 }] : []),
    ...(save.bestSpot >= 2 ? [{ txt: `Park in spot #${save.bestSpot}+`, pay: 15, test: S => S.parked && S.parkedSpot + 1 >= save.bestSpot }] : []),
  ];
  return Q[Math.floor(Math.random() * Q.length)];
}
const persist = () => localStorage.setItem(SAVE_KEY, JSON.stringify(save));
const ghostKey = id => 'parkypark_ghost_' + id;

// ---------- input ----------
const input = { left: false, right: false, up: false, spinL: false, spinR: false, hop: false, boost: false };
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', Space: 'up',
  KeyQ: 'spinL', KeyZ: 'spinL', KeyE: 'spinR', KeyX: 'spinR', KeyS: 'hop', ArrowDown: 'hop', ShiftLeft: 'boost', ShiftRight: 'boost', KeyB: 'boost' };
addEventListener('keydown', e => {
  if (KEYMAP[e.code]) { input[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === 'KeyR') game.scene.getScene('play')?.restartLevel();
  if (e.code === 'Enter' || e.code === 'KeyN') game.scene.getScene('play')?.next();
  if (e.code === 'Escape') { if (shopEl) closeShop(); else showMenu(); }
  if (e.code === 'Enter' && menuEl && !shopEl) { sfx.click(); startLaunch(); }
});
addEventListener('keyup', e => { if (KEYMAP[e.code]) input[KEYMAP[e.code]] = false; });
addEventListener('blur', () => Object.keys(input).forEach(k => input[k] = false));

// ---------- DOM UI ----------
const ui = document.getElementById('ui');
const h = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; };
const fmt = t => t.toFixed(2) + 's';
const starStr = n => '★'.repeat(n) + '<i>' + '★'.repeat(3 - n) + '</i>';
let hud, overlay, menuEl, touchEl, shopEl, zonesEl, tutEl;
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || location.search.includes('touch');
const zone = { l: false, r: false };
function buildZones() {
  zonesEl = h(`<div class="zones"><div class="zl"><span><b>HOLD</b>◀ brake · flip</span></div><div class="zr"><span><b>HOLD</b>go · boost · fly ▶</span></div></div>`);
  const [zl, zr] = zonesEl.children, ptr = new Map();
  const upd = () => { zone.l = [...ptr.values()].includes('l'); zone.r = [...ptr.values()].includes('r'); zl.classList.toggle('held', zone.l); zr.classList.toggle('held', zone.r); };
  const side = e => (e.clientX < innerWidth / 2 ? 'l' : 'r');
  zonesEl.addEventListener('pointerdown', e => { e.preventDefault(); ptr.set(e.pointerId, side(e)); upd(); });
  zonesEl.addEventListener('pointermove', e => { if (ptr.has(e.pointerId)) { ptr.set(e.pointerId, side(e)); upd(); } });
  const end = e => { ptr.delete(e.pointerId); upd(); };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => zonesEl.addEventListener(t, end));
  ui.insertBefore(zonesEl, ui.firstChild);
}
function setZones(on, btns = !on) { zonesEl?.classList.toggle('on', on && TOUCH); touchEl?.classList.toggle('on', btns && TOUCH); if (!on) { zone.l = zone.r = false; } }
function showTutorial(done) {
  const steps = TOUCH ? [['Hold RIGHT', 'Hold the right side to race down the ramp. Keep holding in the air to fly (thrusters).', '▶'],
    ['Hold LEFT', 'In the air, hold the left side to FLIP. Flips multiply your pay, but only if you park! On the ground it brakes. Both sides = hop.', '⟲'],
    ['Steal the spot', 'Let go to drop into a spot, then stop. Farther spots pay more. Beat the rivals!', '🅿️']]
    : [['Hold ▶ (or D)', 'Hold ▶ to race down the ramp. SHIFT boosts. Keep holding ▶ in the air to fly: it fires the thrusters.', '▶'],
    ['Q / E to flip', 'Flip in the air with Q / E. Each clean flip adds +25% to your pay, but only if you park! ◀ brakes, ↓ hops.', '⟲'],
    ['Steal the spot', 'Let go to drop into a spot, then stop. Farther spots pay more. Beat the rivals! R = retry.', '🅿️']];
  let k = 0;
  const draw = () => { tutEl.innerHTML = `<div class="card"><div style="font-size:48px">${steps[k][2]}</div><h3>${steps[k][0]}</h3><div>${steps[k][1]}</div>
    <div class="dots">${steps.map((_, j) => j === k ? '<b>●</b>' : '●').join('')}</div><div style="margin-top:8px;font-size:13px;opacity:.7">${TOUCH ? 'tap' : 'click or press any key'} to continue</div></div>`; };
  tutEl = h('<div class="tut p"></div>'); draw(); ui.appendChild(tutEl);
  const adv = e => { e.preventDefault(); e.stopPropagation(); k++; if (k >= steps.length) { tutEl.remove(); tutEl = null; removeEventListener('keydown', key, true); save.tut = 1; persist(); done(); } else draw(); };
  const key = e => { if (tutEl && !e.repeat) adv(e); };
  tutEl.addEventListener('pointerdown', adv); addEventListener('keydown', key, true);
}
function goFullscreen() {
  if (isNative() || !TOUCH || document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
}

function buildTouch() {
  touchEl = h(`<div class="touch p"><div><button data-k="left">◀</button><button data-k="right">▶</button></div>
    <div><button data-k="spinL">⟲</button><button data-k="spinR">⟳</button><button data-k="hop">⤒</button><button data-k="boost">⚡</button><button data-k="up">▲</button></div></div>`);
  touchEl.querySelectorAll('button').forEach(b => {
    const k = b.dataset.k;
    const on = e => { e.preventDefault(); input[k] = true; b.classList.add('held'); };
    const off = e => { e.preventDefault(); input[k] = false; b.classList.remove('held'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  });
  
  ui.appendChild(touchEl);
}

function showMenu() {
  const sc = game.scene.getScene('play'); if (sc) sc.paused = true;
  menuEl?.remove(); overlay?.remove(); hud && (hud.style.display = 'none');
  const total = Object.values(save.stars).reduce((a, b) => a + b, 0);
  const ds = dailySeed();
  menuEl = h(`<div class="menu p"><h1>SPOT THIEF</h1>
    <div class="sub">Your car can fly. So can everyone else's. Take the spot first.</div>
    <div class="modes"><button class="big main" data-a="launch">▶ LAUNCH<small>endless lots · coins · upgrades</small></button>
      <button class="big" data-a="daily">📅 DAILY LOT<small>${save.daily[ds] ? 'best ' + save.daily[ds] + ' coins' : 'same lot for everyone today'}</small></button>
      <button class="big" data-a="shop">🛠 SHOP<small>🪙 ${save.coins} coins</small></button></div>
    <div class="sub" style="margin:6px 0 0">PUZZLE MODE · ★ ${total} / ${LEVELS.length * 3}</div>
    <div class="grid">${LEVELS.map((L, i) => {
      const locked = i > 0 && !save.stars[LEVELS[i - 1].id];
      return `<div class="lv ${locked ? 'locked' : ''}" data-id="${L.id}"><div class="n">${L.id}</div><div class="nm">${L.name}</div>
        <div class="s">${starStr(save.stars[L.id] || 0)}</div><div class="bt">${save.best[L.id] ? 'best ' + fmt(save.best[L.id]) : 'par ' + L.par[1] + 's'}</div></div>`;
    }).join('')}</div>
    <div class="keys">${TOUCH ? 'Hold RIGHT to go &amp; fly · hold LEFT to brake / flip · both = hop<br>' : ''}▶ drive (hold in the air to fly) &nbsp; ◀ brake &nbsp; SHIFT boost &nbsp; ▲ / SPACE thrust &nbsp; ↓ hop &nbsp; Q / E flip<br>R instant retry &nbsp; ENTER run again / next &nbsp; ESC menu</div></div>`);
  menuEl.querySelectorAll('.lv').forEach(el => el.addEventListener('click', () => { sfx.click(); startLevel(+el.dataset.id); }));
  menuEl.querySelector('[data-a=launch]').onclick = () => { sfx.click(); startLaunch(); };
  menuEl.querySelector('[data-a=daily]').onclick = () => { sfx.click(); startLaunch(true); };
  menuEl.querySelector('[data-a=shop]').onclick = () => { sfx.click(); openShop(); };
  ui.appendChild(menuEl);
}
function startLevel(id) {
  menuEl?.remove(); menuEl = null; closeShop();
  game.scene.getScene('play').scene.restart({ id });
}
async function startLaunch(daily = false, seed = null) {
  menuEl?.remove(); menuEl = null; closeShop(); goFullscreen();
  await onRunStart(); // interstitial pacing (between runs only)
  game.scene.getScene('play').scene.restart({ mode: 'launch', daily, seed: seed ?? (daily ? dailySeed() : Math.floor(Math.random() * 1e9)) });
}
function openShop(after) {
  closeShop(); overlay?.remove(); hud && (hud.style.display = 'none');
  const sc = game.scene.getScene('play'); if (sc) sc.paused = true;
  const draw = () => {
    shopEl.innerHTML = `<h2>🛠 PIT SHOP <span class="coins">🪙 ${save.coins}</span></h2><div class="ups">${UPGRADES.map(u => {
      const l = save.up[u.k] || 0, c = costOf(u, l), maxed = l >= u.max, a = u.stat(l), b = maxed ? null : u.stat(l + 1);
      return `<div class="up"><b>${u.name}</b><div class="pips">${'■'.repeat(l)}<i>${'■'.repeat(u.max - l)}</i></div><small>${u.desc}</small>
        <div class="stat">${a.label}: <b>${a.v}</b>${b ? ` → <b class="nx">${b.v}</b>` : ''}</div>
        <button data-k="${u.k}" ${maxed || save.coins < c ? 'disabled' : ''}>${maxed ? 'MAX' : '🪙 ' + c}</button></div>`; }).join('')}</div>
      <div class="garage"><b>GARAGE</b>${SKINS.map(k => `<button class="sk ${save.skin === k.k ? 'sel' : ''}" data-s="${k.k}" ${k.ok() ? '' : 'disabled'} title="${k.req}">
        <i style="background:#${k.tint.toString(16).padStart(6, '0')}"></i>${k.ok() ? k.name : '🔒 ' + k.req}</button>`).join('')}</div>
      <div class="btns"><button class="main" data-a="go">▶ Run again (Enter)</button><button data-a="menu">Menu</button><button class="danger" data-a="reset">⟲ Reset progress</button></div>`;
    shopEl.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      const u = UPGRADES.find(x => x.k === b.dataset.k), l = save.up[u.k] || 0, c = costOf(u, l);
      if (save.coins >= c && l < u.max) { save.coins -= c; save.up[u.k] = l + 1; persist(); sfx.buy(); draw(); }
    });
    const rb = shopEl.querySelector('[data-a=reset]');
    rb.onclick = () => { if (!rb.dataset.armed) { rb.dataset.armed = 1; rb.textContent = '⚠ Tap again: erase ALL coins, upgrades, stars & skins'; setTimeout(() => { if (rb.isConnected) { delete rb.dataset.armed; rb.textContent = '⟲ Reset progress'; } }, 4000); return; }
      Object.keys(localStorage).filter(k => k.startsWith('parkypark')).forEach(k => localStorage.removeItem(k)); location.reload(); };
    shopEl.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { save.skin = b.dataset.s; persist(); sfx.click(); draw(); });
    shopEl.querySelector('[data-a=go]').onclick = () => startLaunch(after?.daily);
    shopEl.querySelector('[data-a=menu]').onclick = () => { closeShop(); showMenu(); };
  };
  shopEl = h('<div class="shop p"></div>'); draw(); ui.appendChild(shopEl);
  shopEl.addEventListener('keydown', e => e.stopPropagation());
}
function closeShop() { shopEl?.remove(); shopEl = null; }
addEventListener('keydown', e => { if (shopEl && e.code === 'Enter') { e.stopImmediatePropagation(); startLaunch(); } }, true);

// ---------- Play scene ----------
class Play extends Phaser.Scene {
  constructor() { super('play'); }
  init(data) { this.mode = data.mode || 'puzzle'; this.daily = !!data.daily; this.seed = data.seed; this.levelId = data.id || 1; this.replay = data.replay || null; }
  create() {
    makeArt(this);
    const L = this.L = this.mode === 'launch' ? genLot(this.seed, save.up, this.daily, save.bestSpot) : LEVELS.find(l => l.id === this.levelId);
    this.isLaunch = this.mode === 'launch';
    this.sim = createSim(L);
    this.acc = 0; this.paused = false; this.done = false; this.ghostRec = [];
    const [top, bot] = SKIES[L.sky];
    // sky
    const sky = this.add.graphics().setScrollFactor(0).setDepth(-10);
    for (let i = 0; i < 16; i++) { sky.fillStyle(Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.HexStringToColor(top), Phaser.Display.Color.HexStringToColor(bot), 15, i).color, 1); sky.fillRect(-20000, -9000 + i * 1200, 40000, 1202); }
    this.city0 = this.add.tileSprite(-1500, 0, 4000, 180, 'city0').setOrigin(0, 0).setTileScale(2).setScrollFactor(0.15, 0).setDepth(-9).setY(560 - 180 - 60).setAlpha(0.6);
    this.city1 = this.add.tileSprite(-1500, 0, 4000, 180, 'city1').setOrigin(0, 0).setTileScale(2).setScrollFactor(0, 0.6).setDepth(-8).setY(L.h - 330); // fixed width (huge tile sprites overflow GL max texture size)
    // solids
    for (const s of L.solids) this.drawSolid(s);
    if (L.ramp) for (const poly of L.ramp) {
      const g = this.add.graphics();
      g.fillStyle(0x3a3d46, 1); g.beginPath(); g.moveTo(poly[0][0], poly[0][1]);
      for (const [x, y] of poly) g.lineTo(x, y);
      g.lineTo(poly[poly.length - 1][0], 1100); g.lineTo(poly[0][0], 1100); g.closePath(); g.fillPath();
      g.lineStyle(6, 0x9aa0aa, 1); g.beginPath(); g.moveTo(poly[0][0], poly[0][1]); for (const [x, y] of poly) g.lineTo(x, y); g.strokePath();
      g.lineStyle(3, 0xffd23f, 1); for (let i = 2; i < poly.length - 1; i += 2) { const [x1, y1] = poly[i], [x2, y2] = poly[i + 1]; g.lineBetween(x1, y1 + 10, (x1 + x2) / 2, (y1 + y2) / 2 + 10); }
      this.add.text(L.lipX - 30, L.lipY - 60, '⚡ BOOST!', { font: 'bold 18px monospace', color: '#7fd3ff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
    }
    if (this.isLaunch) {
      this.spotLabels = L.spots.map(sp => this.add.text(sp.x + sp.w / 2, sp.y - 92, '🪙' + sp.value, { font: 'bold 16px monospace', color: '#ffd23f', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(2));
      this.rivalGfx = L.rivals.map((r, i) => this.add.image(r.startX, 0, 'p_thief').setDisplaySize(84, 40).setTint([0xffffff, 0xff9e9e, 0x9effc0, 0x9ec8ff, 0xffe08a][i % 5]).setDepth(3));
      this.takenGfx = {};
      this.lotGfx = this.sim.lot.map(o => this.add.image(o.x, o.y, 'p_' + o.kind).setDisplaySize(o.w, o.h + 4).setDepth(2));
    }
    this.moverGfx = this.sim.movers.map(m => {
      if (m.t === 'thief') return this.add.image(m.b.position.x, m.b.position.y, 'p_thief').setDisplaySize(m.r[2], m.r[3]);
      const g = this.add.tileSprite(m.b.position.x, m.b.position.y, m.r[2] / 2, m.r[3] / 2, 'concrete').setScale(2);
      return g;
    });
    this.cartGfx = this.sim.carts.map(() => this.add.image(0, 0, 'cart').setScale(2));
    if (this.sim.gate) { const r = L.gate.r; this.gateGfx = this.add.graphics();
      for (let y = 0; y < r[3]; y += 12) { this.gateGfx.fillStyle((y / 12) % 2 ? 0xffffff : 0xe23b3b); this.gateGfx.fillRect(r[0], r[1] + y, r[2], 12); }
      this.gateTxt = this.add.text(r[0] + r[2] / 2, r[1] - 16, 'FLIP TO OPEN', { font: 'bold 13px monospace', color: '#ffd23f', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5); }
    this.spotG = this.add.graphics().setDepth(1);
    if (this.isLaunch && save.bestDist > 0) { // flag at your previous best distance
      const fx = L.lipX + save.bestDist * 60, fy = 620, f = this.add.graphics().setDepth(2);
      f.fillStyle(0xffffff, 1); f.fillRect(fx - 2, fy - 150, 4, 150); f.fillStyle(0xff7a1a, 1); f.fillTriangle(fx + 2, fy - 150, fx + 2, fy - 118, fx + 46, fy - 134);
      this.add.text(fx + 6, fy - 176, 'FARTHEST FLIGHT ' + save.bestDist + 'm', { font: 'bold 20px monospace', color: '#ffffff', stroke: '#000', strokeThickness: 5 }).setDepth(2);
      this.bestFlagX = fx; }
    if (this.isLaunch && save.bestSpot > 0) { const sp = L.spots[save.bestSpot - 1];
      this.add.text(sp.x + sp.w / 2, sp.y - 128, '★ BEST SPOT', { font: 'bold 18px monospace', color: '#3ddc84', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(2); }
    this.predG = this.add.graphics().setDepth(6);
    this.quest = this.isLaunch ? pickQuest() : null; this.gotBestDist = false;
    // ghost
    this.ghostData = this.isLaunch ? null : JSON.parse(localStorage.getItem(ghostKey(L.id)) || 'null');
    this.ghost = this.add.image(0, 0, 'car').setScale(2).setAlpha(0.35).setTintFill(0x9fd8ff).setVisible(!!this.ghostData).setDepth(4);
    // car
    this.carImg = this.add.image(L.start.x, L.start.y, 'car').setScale(2).setDepth(5).setTint(this.isLaunch ? skinTint() : 0xffffff);
    // particles
    this.flameAngle = 90;
    this.flame = this.add.particles(0, 0, 'puff', { angle: { onEmit: () => this.flameAngle + Phaser.Math.Between(-14, 14) }, lifespan: { min: 220, max: 420 }, speed: { min: 60, max: 160 }, scale: { start: 1.4, end: 0.2 },
      alpha: { start: 1, end: 0 }, tint: [0xfff3a0, 0xffa23f, 0xff5a3c, 0xcccccc], emitting: false }).setDepth(4);
    this.sparks = this.add.particles(0, 0, 'spark', { lifespan: 900, speed: { min: 120, max: 420 }, gravityY: 600, scale: { start: 2, end: 0.5 },
      tint: [0xffd23f, 0x3ddc84, 0xffffff, 0xff7a1a, 0x7fd3ff], emitting: false }).setDepth(6);
    this.lines = this.add.particles(0, 0, 'spark', { lifespan: 380, speedX: { min: -2600, max: -1800 }, scaleX: { start: 22, end: 12 }, scaleY: 0.8,
      alpha: { start: 0.8, end: 0 }, tint: 0xffffff, emitting: false }).setDepth(7);
    this.dust = this.add.particles(0, 0, 'puff', { lifespan: 500, speedX: { min: -90, max: 90 }, speedY: { min: -60, max: -10 }, scale: { start: 1.2, end: 0 },
      alpha: { start: 0.7, end: 0 }, tint: 0xd8d2c4, emitting: false }).setDepth(4);
    // camera
    const cam = this.cameras.main;
    cam.setBounds(0, -9000, L.w, L.h + 9000); // tall: high flights stay on screen
    cam.setZoom(this.isLaunch ? 0.62 : Phaser.Math.Clamp(540 / (L.h * 0.92), 0.6, 1));
    this.camT = this.add.zone(L.start.x, L.start.y, 1, 1);
    cam.startFollow(this.isLaunch ? this.camT : this.carImg, true, 0.2, 0.2);
    cam.setRoundPixels(false);
    this.buildHud();
    this.events.once('shutdown', () => { hud?.remove(); overlay?.remove(); });
    this.lastVy = 0;
    window.__pp.scene = this;
    setZones(this.isLaunch);
    this.uiScale();
    if (this.isLaunch && !save.tut && !this.replay) { this.paused = true; showTutorial(() => { this.paused = false; }); }
    this.applyZoom = () => { const W = this.scale.width, H = this.scale.height; this.cameras.main.setSize(W, H); const f = W < H ? Math.max((W / 960) * 1.35, H / (L.h + 380) / (this.isLaunch ? 0.62 : 0.8)) : Math.min(W / 960, H / 540);
      this.baseZoom = (this.isLaunch ? 0.62 : Phaser.Math.Clamp(540 / (L.h * 0.92), 0.6, 1)) * f; this.cameras.main.setZoom(this.baseZoom); this.uiScale(); };
    this.applyZoom(); this.scale.on('resize', this.applyZoom); this.events.once('shutdown', () => this.scale.off('resize', this.applyZoom));
  }
  surfaceAt(x) { let y = 620, what = 'ground';
    for (const s of this.L.solids) if ((s.t === 'car' || s.t === 'cone') && x > s.r[0] - 20 && x < s.r[0] + s.r[2] + 20 && s.r[1] < y) { y = s.r[1]; what = 'roof'; }
    for (const [a, b] of this.L.pits || []) if (x > a && x < b) what = 'pit';
    return { y, what }; }
  drawPrediction(S) { // where you'd land if you let go now, plus an arrow to the next free spot
    const g = this.predG, c = S.car; g.clear();
    const show = !S.grounded && c.position.x > this.L.lipX - 40 && !this.done;
    if (show) {
      let x = c.position.x, y = c.position.y, vx = c.velocity.x, vy = c.velocity.y; const drag = 1 - (this.L.tune.drag || 0.02), gr = 0.00082 * DT * DT;
      for (let i = 0; i < 600; i++) { vy += gr; vx *= drag; vy *= drag; x += vx; y += vy; if (vy > 0 && y + 11 >= this.surfaceAt(x).y) break; }
      const surf = this.surfaceAt(x); let spot = -1;
      S.spots.forEach((sp, i) => { const r = S.spotRect(i); if (!S.taken.has(i) && x > r.x - 10 && x < r.x + r.w + 10) spot = i; });
      const col = spot >= 0 ? 0x3ddc84 : surf.what === 'ground' ? 0xffffff : 0xff5a5a, z = this.cameras.main.zoom, sc = Math.max(1, 0.62 / z);
      g.fillStyle(0x000000, 0.35); g.fillEllipse(x, surf.y - 2, 70 * sc, 14 * sc);
      g.lineStyle(4 * sc, col, 0.95); g.strokeEllipse(x, surf.y - 2, 70 * sc, 14 * sc);
      g.fillStyle(col, 0.95); g.fillTriangle(x - 14 * sc, surf.y - 40 * sc, x + 14 * sc, surf.y - 40 * sc, x, surf.y - 16 * sc);
      this.predSpot = spot;
    }
    // next free spot ahead (or behind) that is off screen
    const vw = this.cameras.main.worldView; let best = null;
    S.spots.forEach((sp, i) => { if (S.taken.has(i)) return; const cx = sp.x + sp.w / 2, d = cx - c.position.x;
      if (cx > vw.right || cx < vw.x) if (!best || Math.abs(d) < Math.abs(best.d)) best = { i, d, v: sp.value }; });
    const el = this.hArrow; if (!el) return;
    const txt = best && !this.done ? (best.d > 0 ? `🅿️ #${best.i + 1} 🪙${best.v} · ${Math.round(best.d / 60)}m ▶` : `◀ 🅿️ #${best.i + 1} 🪙${best.v} · ${Math.round(-best.d / 60)}m`) : '';
    if (el.textContent !== txt) { el.textContent = txt; el.className = 'spotarrow ' + (best && best.d < 0 ? 'left' : 'right') + (txt ? ' on' : ''); }
  }
  refreshHud() { // keep HUD numbers in sync after results (best spot, distance, coins)
    if (!hud) return; const b = hud.querySelector('.bestline');
    if (b) b.textContent = this.isLaunch ? `best spot #${save.bestSpot} · farthest ${save.bestDist}m` : save.best[this.L.id] ? 'BEST ' + fmt(save.best[this.L.id]) : 'no best yet';
    if (this.isLaunch && this.hP3) this.hP3.textContent = '🪙 ' + save.coins; }
  uiScale() { // bold UI that grows with the screen (was tiny at 1080p+)
    const z = Math.max(1, Math.min(2.4, Math.min(innerWidth / 960, innerHeight / 600) * 1.2)), r = document.documentElement.style;
    r.setProperty('--z', z.toFixed(3)); r.setProperty('--zp', Math.min(z, 1.7).toFixed(3)); r.setProperty('--zm', Math.max(1, Math.min(z, innerHeight / 720)).toFixed(3)); }
  drawSolid(s) {
    const [x, y, w, hh] = s.r;
    if (s.t === 'ground') {
      for (let cx = x; cx < x + w; cx += 2000) { const cw = Math.min(2000, x + w - cx); // chunked: keep each texture well under GL limits
        this.add.tileSprite(cx, y, cw / 2, 8, 'asphalt').setOrigin(0).setScale(2);
        this.add.tileSprite(cx, y + 16, cw / 2, (hh - 16) / 2 + 200, 'dirt').setOrigin(0).setScale(2); }
      const g = this.add.graphics(); g.fillStyle(0xffd23f, 0.9);
      for (let i = x + 20; i < x + w; i += 120) g.fillRect(i, y + 8, 40, 3);
    } else if (s.t === 'wall') this.add.tileSprite(x, y, w / 2, hh / 2, 'concrete').setOrigin(0).setScale(2);
    else if (s.t === 'car') this.add.image(x, y, 'p_' + s.kind).setOrigin(0).setDisplaySize(w, hh);
    else if (s.t === 'pit') { const g = this.add.graphics(); g.fillStyle(0x16181f, 1); g.fillRect(x, y, w, hh); g.fillStyle(0xffd23f, 1);
      for (let i = x; i < x + w; i += 24) g.fillRect(i, y, 12, 6); }
    else if (s.t === 'cone') this.add.image(x, y, 'cone').setOrigin(0).setDisplaySize(w, hh);
  }
  buildHud() {
    hud?.remove(); overlay?.remove(); overlay = null;
    const L = this.L;
    const LA = L.mode === 'launch';
    hud = h(`<div><div class="hud"><div class="l"><div class="ttl">${LA ? '🚀 ' + L.name : L.id + '. ' + L.name}</div>${LA ? '' : `<small>${L.hint}</small>`}
      ${LA && this.quest ? `<div class="quest">🎯 ${this.quest.txt} <b>🪙+${this.quest.pay}</b></div>` : ''}
      <div class="bar"><span>AIR</span><div class="fuel"><i></i></div></div>${LA ? '<div class="bar"><span>BOOST</span><div class="fuel boost"><i></i></div></div>' : ''}<div class="style"></div></div>
      <div class="r"><div class="timer">${LA ? '0m' : '0.00'}</div><div class="pars"><span class="p2">★★ ${L.par[0]}s</span><span class="p3">★★★ ${L.par[1]}s</span></div>
      <div class="pars"><span class="bestline">${LA ? `best spot #${save.bestSpot} · farthest ${save.bestDist}m` : save.best[L.id] ? 'BEST ' + fmt(save.best[L.id]) : 'no best yet'}</span></div>
      ${LA && save.streak ? `<div class="streak">🔥 ${save.streak} park streak · +${Math.min(5, save.streak) * 10}%</div>` : ''}</div></div>
      <div class="warn"></div>${LA ? '<div class="spotarrow"></div>' : ''}
      <div class="topbtns p"><button data-a="r">↻ R</button><button data-a="m">☰</button></div></div>`);
    hud.querySelector('[data-a=r]').onclick = () => this.restartLevel();
    hud.querySelector('[data-a=m]').onclick = () => showMenu();
    ui.insertBefore(hud, ui.firstChild);
    this.hTimer = hud.querySelector('.timer'); this.hFuel = hud.querySelector('.fuel i'); this.hBoost = hud.querySelector('.boost i'); this.hStyle = hud.querySelector('.style');
    this.hP2 = hud.querySelector('.p2'); this.hP3 = hud.querySelector('.p3'); this.hWarn = hud.querySelector('.warn'); this.hArrow = hud.querySelector('.spotarrow');
  }
  restartLevel() { if (menuEl || shopEl) return; if (this.isLaunch) return startLaunch(this.daily); this.scene.restart({ id: this.levelId }); }
  next() {
    if (menuEl || shopEl || !this.done) return;
    if (this.isLaunch) return startLaunch(this.daily);
    if (this.sim.failed) return this.restartLevel();
    const i = LEVELS.findIndex(l => l.id === this.levelId);
    if (i + 1 < LEVELS.length) this.scene.restart({ id: LEVELS[i + 1].id }); else showMenu();
  }
  toast(txt) { const t = h(`<div class="toast">${txt}</div>`); ui.appendChild(t); setTimeout(() => t.remove(), 1000); }
  update(time, delta) {
    if (this.paused) return;
    const S = this.sim;
    this.acc += Math.min(delta, 100);
    let steps = 0;
    while (this.acc >= DT && steps < 6) {
      this.acc -= DT; steps++;
      let inp = input;
      if (this.isLaunch && TOUCH && (zone.l || zone.r)) inp = { ...input, ...simpleInput(S) };
      else if (this.isLaunch && !S.grounded && input.right) inp = { ...input, up: true, boost: true }; // hold ▶ in the air = fly
      if (this.replay) { const v = this.replay[S.frame] || 0; inp = { left: !!(v & 1), right: !!(v & 2), up: !!(v & 4), spinL: !!(v & 8), spinR: !!(v & 16), hop: !!(v & 32), boost: !!(v & 64) }; }
      const vyBefore = S.car.velocity.y, wasG = S.grounded;
      S.step(inp);
      if (!S.parked && !S.failed && S.started) this.ghostRec.push(Math.round(S.car.position.x), Math.round(S.car.position.y), Math.round(S.car.angle * 100));
      this.handleEvents(S, vyBefore, wasG, inp);
    }
    if (S.failed && !this.done) this.onFail();
    this.render(S);
  }
  handleEvents(S, vyBefore, wasG, inp) {
    const c = S.car, cam = this.cameras.main;
    if (S.thrusting.up || S.thrusting.l || S.thrusting.r) {
      const a = c.angle, cos = Math.cos(a), sin = Math.sin(a);
      if (S.thrusting.up) for (const lx of [-20, 18]) {
        const wx = c.position.x + lx * cos - 10 * sin, wy = c.position.y + lx * sin + 10 * cos;
        this.flameAngle = Phaser.Math.RadToDeg(a) + 90;
        this.flame.emitParticleAt(wx, wy, 1);
      }
      const side = S.thrusting.r ? -1 : 1;
      if (S.thrusting.l || S.thrusting.r) { this.flameAngle = Phaser.Math.RadToDeg(a) + (side < 0 ? 180 : 0); }
      if (S.thrusting.l || S.thrusting.r) this.flame.emitParticleAt(c.position.x + side * 32 * cos, c.position.y + side * 32 * sin, 1);
      sfx.thrust();
    }
    if (S.grounded && !wasG && vyBefore > 3) {
      cam.shake(120, Math.min(0.012, vyBefore * 0.0012));
      this.dust.emitParticleAt(c.position.x, c.position.y + 10, Math.min(14, Math.round(vyBefore * 2)));
      sfx.thud(vyBefore);
    }
    for (const e of S.events) {
      if (e === 'flip') { this.toast(this.isLaunch ? `+FLIP ${S.airFlips > 1 ? 'x' + S.airFlips : ''}` : `FLIP${S.combo > 1 ? ' x' + S.combo : ''}! +${100 * S.combo}`); sfx.flip(S.combo); this.sparks.emitParticleAt(c.position.x, c.position.y, 10); }
      if (e === 'landed') { this.toast('STUCK THE LANDING!'); }
      if (e === 'gate') { this.gateGfx?.destroy(); this.gateTxt?.setText('OPEN!'); cam.flash(150, 255, 230, 120); }
      if (e === 'honk') { sfx.honk(); this.toast('HONK HONK'); }
      if (e === 'bump') sfx.bump();
      if (e === 'hop') { sfx.thud(4); this.dust.emitParticleAt(c.position.x, c.position.y + 10, 6); }
      if (typeof e === 'string' && e.startsWith('flipland:')) { const n = +e.split(':')[1]; if (n >= 3) { save.stats.triple++; persist(); }
        this.toast(`${['', 'FLIP', 'DOUBLE FLIP', 'TRIPLE FLIP'][n] || 'INSANE x' + n}! PAY ×${flipMult(S).toFixed(2)} IF YOU PARK`); sfx.park(Math.min(3, n)); cam.flash(90, 255, 230, 120); }
      if (typeof e === 'string' && e.startsWith('bail')) { this.toast(`SLOPPY LANDING! ×${flipMult(S).toFixed(2)}`); sfx.bump(); }
      if (e === 'magnet') { sfx.thud(3); this.toast('SO CLOSE… IN YOU GO!'); }
      if (e === 'unstick') { sfx.thud(4); this.dust.emitParticleAt(c.position.x, c.position.y + 10, 8); }
      if (typeof e === 'string' && e.startsWith('veer:')) { this.toast('BACK OFF! IT\'S MINE!'); sfx.honk(); cam.shake(150, 0.008); }
      if (e === 'go' && this.isLaunch) { this.toast('GO!'); sfx.park(1); }
      if (e === 'kick') { sfx.whoosh(); cam.shake(160, 0.014); this.sparks.emitParticleAt(c.position.x, c.position.y + 10, 16); }
      if (typeof e === 'string' && e.startsWith('lot:')) { const b = e.split(':')[1]; this.toast({ pullout: 'SOMEONE IS LEAVING!', late: 'SPOT OPENING…', snatch: 'SNATCHER INCOMING!' }[b] || ''); }
      if (typeof e === 'string' && e.startsWith('open:')) { this.toast(`SPOT #${+e.slice(5) + 1} OPEN!`); sfx.flip(1); }
      if (e === 'stolen') { this.toast('STOLEN! +50%'); cam.shake(200, 0.01); }
      if (typeof e === 'string' && e.startsWith('taken:')) { const i = +e.slice(6); this.toast(`RIVAL TOOK 🪙${S.spots[i].value}`); sfx.honk(); }
      if (e === 'stolen') { save.stats.steals++; persist(); }
      if (e === 'parked' && !this.done) this.onParked();
      if (e === 'fail' && !this.done) this.onFail();
    }
  }
  render(S) {
    const c = S.car;
    if (this.isLaunch) { // speed feel + framing: zoom out so the ground and spots stay in view at peak height
      const v = Math.hypot(c.velocity.x, c.velocity.y), k = Phaser.Math.Clamp((v - 9) / 14, 0, 1), cam = this.cameras.main;
      this.speedK = (this.speedK || 0) + (k - (this.speedK || 0)) * 0.06;
      const gy = 620, gap = Math.max(0, gy - c.position.y), air = c.position.x > this.L.lipX - 200;
      const fit = air ? cam.height / (gap + 520) : 9, zt = Math.max(this.baseZoom * 0.3, Math.min(this.baseZoom * (1 - 0.22 * this.speedK), fit));
      this.zoomNow = (this.zoomNow || zt) + (zt - (this.zoomNow || zt)) * 0.15; cam.setZoom(this.zoomNow);
      const vh = cam.height / this.zoomNow, ty = air ? Math.min(c.position.y + vh / 2 - 140, Math.max(c.position.y - 40, gy + 150 - vh / 2)) : c.position.y - 40; // ground pinned near the bottom, car kept on screen
      this.camT.setPosition(c.position.x + 180 / this.zoomNow * this.baseZoom, ty);
      const fade = Phaser.Math.Clamp(1 - gap / 1400, 0, 1); this.city0?.setAlpha(0.6 * fade); this.city1.setAlpha(fade);
      if (k > 0.15 && !S.grounded && Math.random() < k * 1.6) { const vw = cam.worldView;
        this.lines.emitParticleAt(vw.right + 40, vw.y + Math.random() * vw.height, 1); }
      this.drawPrediction(S);
    }
    this.city1.tilePositionX = this.cameras.main.scrollX * 0.35 / 2;
    this.carImg.setPosition(c.position.x, c.position.y).setRotation(c.angle).setFlipX(S.facing < 0);
    // flip car texture when driving left? keep facing right (simple)
    S.movers.forEach((m, i) => this.moverGfx[i].setPosition(m.b.position.x, m.b.position.y));
    S.carts.forEach((b, i) => this.cartGfx[i].setPosition(b.position.x, b.position.y).setRotation(b.angle));
    if (this.ghostData && !this.done) { const f = Math.min(Math.max(0, S.rf), this.ghostData.length / 3 - 1) * 3;
      this.ghost.setPosition(this.ghostData[f], this.ghostData[f + 1]).setRotation(this.ghostData[f + 2] / 100); }
    // spots
    const g = this.spotG; g.clear();
    S.spots.forEach((_, i) => {
      const sp = S.spotRect(i), taken = S.taken.has(i), mine = S.parked && S.parkedSpot === i, here = S.inSpot && S.spotIdx === i;
      const col = taken ? 0xff5a5a : mine ? 0x3ddc84 : here ? 0xffd23f : 0xffffff;
      const pulse = 0.35 + 0.25 * Math.sin(S.frame / 8 + i);
      g.fillStyle(col, here ? 0.45 : taken ? 0.25 : pulse * 0.5); g.fillRect(sp.x, sp.y - 34, sp.w, 34);
      g.fillStyle(col, 1); g.fillRect(sp.x, sp.y - 2, sp.w, 3);
      g.lineStyle(3, col, 1); g.strokeRect(sp.x, sp.y - 34, sp.w, 34);
      if (here && S.parkHold > 0 && !S.parked) { g.fillStyle(0x3ddc84, 1); g.fillRect(sp.x, sp.y - 40, sp.w * S.parkHold / 24, 5); }
      g.fillStyle(taken ? 0x8a2a2a : 0x2f6fe0, 1); g.fillRect(sp.x + sp.w / 2 - 9, sp.y - 70, 18, 20); g.fillStyle(0xffffff, 1);
      g.fillRect(sp.x + sp.w / 2 - 5, sp.y - 67, 3, 14); g.fillRect(sp.x + sp.w / 2 - 5, sp.y - 67, 9, 3); g.fillRect(sp.x + sp.w / 2 + 2, sp.y - 67, 3, 8); g.fillRect(sp.x + sp.w / 2 - 5, sp.y - 61, 9, 3);
      if (this.spotLabels && taken) this.spotLabels[i].setText('TAKEN').setColor('#ff7a7a');
    });
    // rivals race from the start: down the ramp (behind you), off the kicker, arcing to their spot
    if (this.isLaunch) {
      const L = this.L, prof = L.prof;
      const yAt = x => { for (let i = 0; i < prof.length - 1; i++) if (x <= prof[i + 1][0]) { const [x1, y1] = prof[i], [x2, y2] = prof[i + 1]; return y1 + (y2 - y1) * (x - x1) / (x2 - x1); } return prof[prof.length - 1][1]; };
      const rf = S.rf;
      S.rivals.forEach((r, i) => {
        const im = this.rivalGfx[i], sp = S.spotRect(r.spot), tx = sp.x + sp.w / 2, ty = sp.y - 20;
        if (rf < 0) { // waiting at the line, revving
          const x = 60 - 30 - i * 26; im.setPosition(x, yAt(Math.max(-30, x)) - 18 - r.lane * 3 + (S.frame % 6 < 3 ? -1 : 1)).setRotation(0);
          if (S.frame % 5 === i % 5) this.flame.emitParticleAt(x - 40, im.y + 8, 1); return; }
        if (r.arrived) {
          if (r.blocked) { const k = (rf - r.blockedF) / 60;
            im.setPosition(tx + k * 420, sp.y - 120 - k * 260 + Math.max(0, 40 - k * 200)).setRotation(k * 6).setVisible(k < 3); }
          else im.setPosition(tx, ty).setRotation(0);
          return; }
        if (rf < r.lipF) { const x = r.path[rf], x2 = r.path[Math.min(r.path.length - 1, rf + 1)];
          im.setPosition(x, yAt(x) - 18 - r.lane * 3).setRotation(x2 > x ? Math.atan2(yAt(x2 + 6) - yAt(x2 - 6), 12) : 0); return; }
        const ft = rf - r.lipF, t = Math.min(1, ft / r.flight);
        const aimX = r.mistake === 'overshoot' ? tx + 260 : tx;
        let x = L.lipX + (aimX - L.lipX) * t, y = L.lipY - 20 + (ty - L.lipY + 20) * t - Math.sin(Math.PI * t) * r.arcH;
        y += Math.sin(ft / r.wobF + r.phase) * r.wobA * Math.sin(Math.PI * t);
        let rot = Math.sin(ft / 9 + r.phase) * 0.1 + (t > 0.15 && t < 0.75 ? ((t - 0.15) / 0.6) * Math.PI * 2 * r.flips : 0);
        if (r.mistake === 'bail' && t > r.bailT) { const k = (t - r.bailT) * r.flight / 60; // tumbles out of the sky
          x = L.lipX + (aimX - L.lipX) * r.bailT + k * 200; y = Math.min(sp.y - 20, L.lipY - 20 + (ty - L.lipY + 20) * r.bailT - Math.sin(Math.PI * r.bailT) * r.arcH + k * k * 500); rot = k * 9;
          if (y >= sp.y - 21 && !r.crashed) { r.crashed = true; this.dust.emitParticleAt(x, y + 10, 14); this.toast('RIVAL BAILED! 😂'); }
          im.setAlpha(r.crashed ? 0.5 : 1); }
        else if (t >= 1) { const k = (ft - r.flight) / Math.max(1, r.arrive - r.lipF - r.flight); // post-landing correction
          if (r.mistake === 'overshoot') x = aimX + (tx - aimX) * Math.min(1, k);
          if (r.mistake === 'bounce') { x = tx - 60 * Math.sin(Math.PI * Math.min(1, k)); y = ty - Math.abs(Math.sin(Math.PI * 2 * Math.min(1, k))) * 70; }
          else y = ty; }
        else if (S.frame % 3 === 0) this.flame.emitParticleAt(x - 40, y + 10, 1);
        if (t < 1 && Math.sin(ft / 7 + r.phase) > 0.8) this.flame.emitParticleAt(x, y + 16, 1); // little thrust corrections
        im.setPosition(x, y).setRotation(rot);
      });
      S.lot.forEach((o, i) => this.lotGfx[i].setVisible(!o.gone).setPosition(o.b.position.x, o.b.position.y));
      S.spots.forEach((sp, i) => { if (!S.taken.has(i) && this.spotLabels[i].text === 'TAKEN') this.spotLabels[i].setText('🪙' + sp.value).setColor('#ffd23f'); });
    }
    // hud
    if (!this.done) {
      const t = S.time();
      this.hTimer.textContent = t.toFixed(2);
      if (!this.isLaunch) { this.hP3.classList.toggle('miss', t > this.L.par[1]); this.hP2.classList.toggle('miss', t > this.L.par[0]); }
      else { const d = Math.max(0, Math.floor((S.maxX - this.L.lipX) / 60)); this.hTimer.textContent = d + 'm'; this.hP2.textContent = '⏱ ' + t.toFixed(1) + 's'; this.hP3.textContent = '🪙 ' + save.coins;
        if (this.bestFlagX && !this.gotBestDist && S.maxX > this.bestFlagX) { this.gotBestDist = true; this.toast('NEW BEST DISTANCE!'); sfx.best(); this.cameras.main.flash(120, 255, 200, 120); } }
      const w = !S.started && this.isLaunch ? (TOUCH ? 'Hold RIGHT to go!' : 'Hold ▶ to go!') : S.warn ? (TOUCH ? WARN[S.warn].replace('(↓ / both sides)', '(hold both sides)').replace('◀ or ▶', 'a side').replace('drive ▶ or hop ↓', 'hold RIGHT or both sides to hop').replace('Hold ▶', 'Hold RIGHT') : WARN[S.warn]) : '';
      if (this.hWarn.textContent !== w) { this.hWarn.textContent = w; this.hWarn.classList.toggle('on', !!w); }
    }
    this.hFuel.style.width = Math.max(0, S.fuel / (this.L.fuel || 100) * 100) + '%';
    if (this.hBoost) this.hBoost.style.width = (S.boost / (this.L.tune.boostCap || 1) * 100) + '%';
    if (this.isLaunch) this.hStyle.textContent = (S.cleanFlips || S.sloppyFlips ? `PARK PAY ×${flipMult(S).toFixed(2)}` : '') + (S.airFlips ? `  · in air: ${S.airFlips}` : ''); else this.hStyle.textContent = S.style ? `STYLE ${S.style}${S.combo ? '  combo x' + S.combo : ''}` : '';
  }
  onParked() {
    if (this.isLaunch) return this.launchResult();
    const S = this.sim, L = this.L, t = S.time(); this.done = true;
    const stars = starsFor(L, t), prevBest = save.best[L.id];
    const newBest = !prevBest || t < prevBest;
    if (newBest) { save.best[L.id] = t; localStorage.setItem(ghostKey(L.id), JSON.stringify(this.ghostRec)); }
    save.stars[L.id] = Math.max(save.stars[L.id] || 0, stars); persist(); this.refreshHud();
    this.cameras.main.shake(260, 0.012); this.cameras.main.flash(120, 255, 255, 255);
    this.sparks.emitParticleAt(S.car.position.x, S.car.position.y - 10, 60);
    sfx.park(stars);
    overlay = h(`<div><div class="stamp">PARKED!</div><div class="panel p">
      <div class="stars">${[0, 1, 2].map(i => i < stars ? '<b>★</b>' : '★').join('')}</div>
      <div class="t">${fmt(t)} ${newBest ? '<span class="nb">NEW BEST!</span>' : '· best ' + fmt(prevBest)}</div>
      <div style="font-size:13px;opacity:.85">★★ ${L.par[0]}s · ★★★ ${L.par[1]}s${S.style ? ' · style ' + S.style : ''}${S.bumps ? ' · dings ' + S.bumps : ' · no dings'}</div>
      <div class="btns"><button data-a="r">↻ Retry (R)</button><button class="main" data-a="n">Next ▶ (Enter)</button></div></div></div>`);
    overlay.querySelector('[data-a=r]').onclick = () => this.restartLevel();
    overlay.querySelector('[data-a=n]').onclick = () => this.next();
    ui.appendChild(overlay);
    requestAnimationFrame(() => overlay?.querySelector('.stamp').classList.add('go'));
  }
  launchResult() {
    const S = this.sim, L = this.L; this.done = true; setZones(false, false); if (this.hWarn) { this.hWarn.textContent = ''; this.hWarn.classList.remove('on'); }
    const before = unlockedSkins(), prevStreak = save.streak || 0;
    const p0 = payout(L, S), questOk = !!(this.quest && this.quest.test(S, p0));
    const p = payout(L, S, { quest: questOk ? this.quest.pay : 0, streak: S.parked ? prevStreak : 0 });
    save.coins += p.total; save.runs++;
    save.streak = S.parked ? prevStreak + 1 : 0; save.bestStreak = Math.max(save.bestStreak || 0, save.streak);
    const newDist = p.dist > (save.bestDist || 0); if (newDist) save.bestDist = p.dist;
    const newSpot = S.parked && S.parkedSpot + 1 > save.bestSpot;
    if (S.parked) { save.bestSpot = Math.max(save.bestSpot, S.parkedSpot + 1); save.stats.parks++; }
    if (L.daily) { save.daily[L.seed] = Math.max(save.daily[L.seed] || 0, p.total); save.stats.dailies++; }
    persist(); this.refreshHud(); this.predG.clear(); this.hArrow && (this.hArrow.className = 'spotarrow');
    const newSkins = unlockedSkins().filter(k => !before.includes(k));
    // near miss: ended just short of / next to a free spot
    let close = null;
    if (!S.parked) { const cx = S.car.position.x;
      S.spots.forEach((sp, i) => { if (S.taken.has(i)) return; const d = Math.abs(cx - (sp.x + sp.w / 2)); if (d < 220 && (!close || d < close.d)) close = { i, d }; }); }
    const cam = this.cameras.main;
    if (S.parked) { cam.shake(260, 0.012); cam.flash(120, 255, 255, 255); this.sparks.emitParticleAt(S.car.position.x, S.car.position.y - 10, 60); sfx.park(3); }
    else if (close) { cam.shake(200, 0.01); sfx.close(); } else { cam.shake(300, 0.016); sfx.fail(); }
    const next = UPGRADES.map(u => ({ u, c: costOf(u, save.up[u.k] || 0), l: save.up[u.k] || 0 })).filter(x => x.l < x.u.max).sort((a, b) => a.c - b.c)[0];
    const line = (k, v) => v ? `<div class="row"><span>${k}</span><b>+${v}</b></div>` : '';
    const stamp = S.parked ? (S.stolen ? 'STOLEN!' : 'PARKED!') : close ? 'SO CLOSE!' : S.failed;
    const why = S.parked ? `Spot #${S.parkedSpot + 1} of ${L.spots.length}${newSpot ? ' · <b class="nb">NEW BEST SPOT!</b>' : ''}`
      : close ? `${S.failed}: ${Math.max(1, Math.round(close.d / 60))}m from the 🪙${S.spots[close.i].value} spot!` : FAIL_WHY[S.failed] || '';
    const share = L.daily ? `Spot Thief Daily ${String(L.seed).replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3')}: ${S.parked ? '🅿️ spot #' + (S.parkedSpot + 1) : '💥 ' + S.failed} · ${p.dist}m · 🪙${p.total}${S.cleanFlips ? ' · ' + '🔄'.repeat(Math.min(5, S.cleanFlips)) : ''}` : '';
    overlay = h(`<div><div class="stamp ${S.parked ? '' : 'fail'}">${stamp}</div><div class="panel res p">
      <div class="why">${why}</div>
      <div class="cols"><div class="rows">${line('Spot', p.spot)}${p.fm > 1 ? `<div class="row"><span>Flips ×${p.fm.toFixed(2)}</span><b>+${p.flips}</b></div>` : line('Flips (no park: 20%)', p.flips)}
        ${line('Stolen bonus', p.stolen)}${line('No dings', p.clean)}${line('🔥 Streak', p.streak)}${questOk ? line('🎯 ' + this.quest.txt, p.quest) : this.quest ? `<div class="row miss"><span>🎯 ${this.quest.txt}</span><b>✗</b></div>` : ''}
        ${L.mult > 1 ? `<div class="row"><span>Coin Magnet</span><b>x${L.mult.toFixed(1)}</b></div>` : ''}</div>
      <div class="sum"><div class="t">🪙 +<span class="cnt">0</span></div><div class="tot">total 🪙 ${save.coins}</div>
        <div class="tags">${p.dist}m${newDist ? ' <b class="nb">NEW BEST DISTANCE!</b>' : ''}${save.streak > 1 ? ` · 🔥 ${save.streak} streak` : ''}${!S.parked && prevStreak > 1 ? ` · streak of ${prevStreak} lost` : ''}</div>
        ${newSkins.length ? `<div class="nb">🎨 NEW SKIN: ${newSkins.map(k => SKINS.find(x => x.k === k).name).join(', ')}! (Shop)</div>` : ''}
        ${next ? `<div class="hint">${save.coins >= next.c ? '✅ You can afford ' + next.u.name + '!' : 'Next: ' + next.u.name + ' at 🪙' + next.c}</div>` : ''}</div></div>
      ${L.daily ? `<div class="daily">🏆 Daily best today: 🪙${save.daily[L.seed]} · leaderboard coming soon <button data-a="share">📋 Copy result</button></div>` : ''}
      ${adsOn() ? `<div class="btns"><button class="adbtn" data-a="ad2">📺 Watch ad: 2x coins</button>${!S.parked && !S.revived ? '<button class="adbtn" data-a="adc">📺 Watch ad: continue</button>' : ''}</div>` : ''}
      <div class="btns"><button class="main" data-a="r">↻ Run again (R/Enter)</button><button data-a="s">🛠 Shop</button><button data-a="m">Menu</button></div></div></div>`);
    // coin count-up with ticks
    const cnt = overlay.querySelector('.cnt'); let shown = 0; const step = Math.max(1, Math.ceil(p.total / 24));
    const tick = () => { if (!overlay || !cnt.isConnected) return; shown = Math.min(p.total, shown + step); cnt.textContent = shown; sfx.coin(shown / Math.max(1, p.total)); if (shown < p.total) setTimeout(tick, 40); };
    if (p.total > 0) setTimeout(tick, 250);
    overlay.querySelector('[data-a=r]').onclick = () => startLaunch(L.daily);
    const cancel = () => { clearTimeout(this.autoT); const c = overlay?.querySelector('.auto'); if (c) c.remove(); };
    const ad2 = overlay.querySelector('[data-a=ad2]'), adc = overlay.querySelector('[data-a=adc]'), sh = overlay.querySelector('[data-a=share]');
    if (ad2) { ad2.addEventListener('pointerdown', cancel); if (p.total <= 0) ad2.style.display = 'none';
      ad2.onclick = () => showRewarded(() => { save.coins += p.total; persist(); ad2.disabled = true; ad2.textContent = `✅ +${p.total} bonus coins`; this.toast('2x COINS!'); }); }
    if (adc) { adc.addEventListener('pointerdown', cancel);
      adc.onclick = () => showRewarded(() => { save.coins -= p.total; if (S.parked === false) save.streak = prevStreak; persist(); overlay?.remove(); overlay = null; this.done = false; S.revive(); setZones(true); this.toast('BACK IN THE RACE!'); }); }
    if (sh) { sh.addEventListener('pointerdown', cancel); sh.onclick = () => { navigator.clipboard?.writeText(share).then(() => { sh.textContent = '✅ Copied!'; }).catch(() => { sh.textContent = share; }); }; }
    overlay.querySelector('[data-a=s]').addEventListener('pointerdown', cancel); overlay.querySelector('[data-a=m]').addEventListener('pointerdown', cancel);
    overlay.querySelector('.panel').addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') startLaunch(L.daily); });
    if (!S.parked) { overlay.querySelector('.btns:last-child').insertAdjacentHTML('beforebegin', '<div class="auto">next run in 3s… (tap to go now)</div>');
      this.autoT = setTimeout(() => { if (!shopEl && !menuEl && this.done && this.scene.isActive()) startLaunch(L.daily); }, 3000); }
    this.events.once('shutdown', () => clearTimeout(this.autoT));
    overlay.querySelector('[data-a=s]').onclick = () => openShop({ daily: L.daily });
    overlay.querySelector('[data-a=m]').onclick = () => showMenu();
    ui.appendChild(overlay);
    requestAnimationFrame(() => overlay?.querySelector('.stamp').classList.add('go'));
  }
  onFail() {
    if (this.isLaunch) return this.launchResult();
    const S = this.sim; this.done = true;
    save.slips++; persist();
    const y0 = 2028 + Math.floor((save.slips - 1) / 2), q = ((save.slips - 1) % 4) + 1;
    const from = save.slips > 1 ? `Q${((save.slips - 2) % 4) + 1} ${2028 + Math.floor((save.slips - 2) / 2)}` : 'Q4 2027';
    this.cameras.main.shake(300, 0.016);
    sfx.fail();
    overlay = h(`<div><div class="stamp fail">${S.failed}</div><div class="panel p">
      <div class="why">${FAIL_WHY[S.failed] || ''}</div><div class="slip">PARKING DATE SLIPPED<br><s>${from}</s> → <b>Q${q} ${y0}</b><br><span style="font-size:12px;opacity:.7">(${save.slips} delay${save.slips > 1 ? 's' : ''} and counting)</span></div>
      <div class="btns"><button class="main" data-a="r">↻ Retry (R)</button><button data-a="m">Levels</button></div></div></div>`);
    overlay.querySelector('[data-a=r]').onclick = () => this.restartLevel();
    overlay.querySelector('[data-a=m]').onclick = () => showMenu();
    ui.appendChild(overlay);
    requestAnimationFrame(() => overlay?.querySelector('.stamp').classList.add('go'));
  }
}

window.__pp = { LEVELS, save, startLevel, startLaunch, openShop, showMenu, playLaunch: (seed, inputs) => { menuEl?.remove(); menuEl = null; closeShop(); game.scene.getScene('play').scene.restart({ mode: 'launch', seed, replay: inputs }); }, play: (id, inputs) => { menuEl?.remove(); menuEl = null; game.scene.getScene('play').scene.restart({ id, replay: inputs }); } };
const game = new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: 960, height: 540, pixelArt: true, backgroundColor: '#12141c',
  scale: { mode: Phaser.Scale.RESIZE }, scene: [Play] });
buildTouch(); buildZones();
game.events.once('ready', () => { if (location.hash.startsWith('#l')) startLevel(+location.hash.slice(2)); else showMenu(); });
