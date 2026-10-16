import Phaser from 'phaser';
import { LEVELS } from './levels.js';
import { createSim, starsFor, DT, CAR_W, CAR_H } from './sim.js';
import { makeArt, SKIES } from './art.js';
import { sfx } from './sfx.js';
import { genLot, dailySeed, UPGRADES, costOf, payout } from './launch.js';

// ---------- save ----------
const SAVE_KEY = "parkypark_v1";
const save = Object.assign({ stars: {}, best: {}, slips: 0, coins: 0, up: {}, runs: 0, bestSpot: 0, daily: {} }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
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
let hud, overlay, menuEl, touchEl, shopEl;

function buildTouch() {
  touchEl = h(`<div class="touch p"><div><button data-k="left">◀</button><button data-k="right">▶</button></div>
    <div><button data-k="spinL">⟲</button><button data-k="spinR">⟳</button><button data-k="hop">⤒</button><button data-k="boost">⚡</button><button data-k="up">▲</button></div></div>`);
  touchEl.querySelectorAll('button').forEach(b => {
    const k = b.dataset.k;
    const on = e => { e.preventDefault(); input[k] = true; b.classList.add('held'); };
    const off = e => { e.preventDefault(); input[k] = false; b.classList.remove('held'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  });
  if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || location.search.includes('touch')) touchEl.classList.add('on');
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
    <div class="keys">◀ ▶ drive / air-steer &nbsp; SHIFT / B boost &nbsp; ▲ / W / SPACE thrusters &nbsp; S / ↓ hop &nbsp; Q / E spin &amp; flip<br>R instant retry &nbsp; ENTER run again / next &nbsp; ESC menu</div></div>`);
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
function startLaunch(daily = false, seed = null) {
  menuEl?.remove(); menuEl = null; closeShop();
  game.scene.getScene('play').scene.restart({ mode: 'launch', daily, seed: seed ?? (daily ? dailySeed() : Math.floor(Math.random() * 1e9)) });
}
function openShop(after) {
  closeShop(); overlay?.remove(); hud && (hud.style.display = 'none');
  const sc = game.scene.getScene('play'); if (sc) sc.paused = true;
  const draw = () => {
    shopEl.innerHTML = `<h2>🛠 PIT SHOP <span class="coins">🪙 ${save.coins}</span></h2><div class="ups">${UPGRADES.map(u => {
      const l = save.up[u.k] || 0, c = costOf(u, l), maxed = l >= u.max;
      return `<div class="up"><b>${u.name}</b><div class="pips">${'■'.repeat(l)}<i>${'■'.repeat(u.max - l)}</i></div><small>${u.desc}</small>
        <button data-k="${u.k}" ${maxed || save.coins < c ? 'disabled' : ''}>${maxed ? 'MAX' : '🪙 ' + c}</button></div>`; }).join('')}</div>
      <div class="btns"><button class="main" data-a="go">▶ Run again (Enter)</button><button data-a="menu">Menu</button></div>`;
    shopEl.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      const u = UPGRADES.find(x => x.k === b.dataset.k), l = save.up[u.k] || 0, c = costOf(u, l);
      if (save.coins >= c && l < u.max) { save.coins -= c; save.up[u.k] = l + 1; persist(); sfx.park(2); draw(); }
    });
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
      Phaser.Display.Color.HexStringToColor(top), Phaser.Display.Color.HexStringToColor(bot), 15, i).color, 1); sky.fillRect(-900, -620 + i * 110, 2760, 112); }
    this.add.tileSprite(-600, 0, 3200, 180, 'city0').setOrigin(0, 0).setTileScale(2).setScrollFactor(0.15, 0).setDepth(-9).setY(560 - 180 - 60).setAlpha(0.6);
    this.add.tileSprite(0, 0, L.w + 400, 180, 'city1').setOrigin(0, 0).setTileScale(2).setScrollFactor(0.35, 0.6).setDepth(-8).setPosition(-100, L.h - 330);
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
    // ghost
    this.ghostData = this.isLaunch ? null : JSON.parse(localStorage.getItem(ghostKey(L.id)) || 'null');
    this.ghost = this.add.image(0, 0, 'car').setScale(2).setAlpha(0.35).setTintFill(0x9fd8ff).setVisible(!!this.ghostData).setDepth(4);
    // car
    this.carImg = this.add.image(L.start.x, L.start.y, 'car').setScale(2).setDepth(5);
    // particles
    this.flameAngle = 90;
    this.flame = this.add.particles(0, 0, 'puff', { angle: { onEmit: () => this.flameAngle + Phaser.Math.Between(-14, 14) }, lifespan: { min: 220, max: 420 }, speed: { min: 60, max: 160 }, scale: { start: 1.4, end: 0.2 },
      alpha: { start: 1, end: 0 }, tint: [0xfff3a0, 0xffa23f, 0xff5a3c, 0xcccccc], emitting: false }).setDepth(4);
    this.sparks = this.add.particles(0, 0, 'spark', { lifespan: 900, speed: { min: 120, max: 420 }, gravityY: 600, scale: { start: 2, end: 0.5 },
      tint: [0xffd23f, 0x3ddc84, 0xffffff, 0xff7a1a, 0x7fd3ff], emitting: false }).setDepth(6);
    this.dust = this.add.particles(0, 0, 'puff', { lifespan: 500, speedX: { min: -90, max: 90 }, speedY: { min: -60, max: -10 }, scale: { start: 1.2, end: 0 },
      alpha: { start: 0.7, end: 0 }, tint: 0xd8d2c4, emitting: false }).setDepth(4);
    // camera
    const cam = this.cameras.main;
    cam.setBounds(0, -200, L.w, L.h + 200);
    cam.setZoom(this.isLaunch ? 0.62 : Phaser.Math.Clamp(540 / (L.h * 0.92), 0.6, 1));
    if (this.isLaunch) cam.setFollowOffset(-180, 40);
    cam.startFollow(this.carImg, true, 0.12, 0.12);
    cam.setRoundPixels(false);
    this.buildHud();
    this.events.once('shutdown', () => { hud?.remove(); overlay?.remove(); });
    this.lastVy = 0;
    window.__pp.scene = this;
  }
  drawSolid(s) {
    const [x, y, w, hh] = s.r;
    if (s.t === 'ground') {
      this.add.tileSprite(x, y, w / 2, 8, 'asphalt').setOrigin(0).setScale(2);
      this.add.tileSprite(x, y + 16, w / 2, (hh - 16) / 2 + 200, 'dirt').setOrigin(0).setScale(2);
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
    hud = h(`<div><div class="hud"><div class="l">${L.mode === 'launch' ? '🚀 ' + L.name : L.id + '. ' + L.name}<small>${L.hint}</small>
      <div class="fuel"><i></i></div>${L.mode === 'launch' ? '<div class="fuel boost"><i></i></div>' : ''}<div class="style"></div></div>
      <div style="text-align:right"><div class="timer">0.00</div><div class="pars"><span class="p2">★★ ${L.par[0]}s</span><span class="p3">★★★ ${L.par[1]}s</span></div>
      <div class="pars"><span>${L.mode === 'launch' ? 'farthest spot: #' + save.bestSpot : save.best[L.id] ? 'BEST ' + fmt(save.best[L.id]) : 'no best yet'}</span></div></div></div>
      <div class="topbtns p"><button data-a="r">↻ R</button><button data-a="m">☰</button></div></div>`);
    hud.querySelector('[data-a=r]').onclick = () => this.restartLevel();
    hud.querySelector('[data-a=m]').onclick = () => showMenu();
    ui.insertBefore(hud, ui.firstChild);
    this.hTimer = hud.querySelector('.timer'); this.hFuel = hud.querySelector('.fuel i'); this.hBoost = hud.querySelector('.boost i'); this.hStyle = hud.querySelector('.style');
    this.hP2 = hud.querySelector('.p2'); this.hP3 = hud.querySelector('.p3');
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
      if (this.replay) { const v = this.replay[S.frame] || 0; inp = { left: !!(v & 1), right: !!(v & 2), up: !!(v & 4), spinL: !!(v & 8), spinR: !!(v & 16), hop: !!(v & 32), boost: !!(v & 64) }; }
      const vyBefore = S.car.velocity.y, wasG = S.grounded;
      S.step(inp);
      if (!S.parked && !S.failed) this.ghostRec.push(Math.round(S.car.position.x), Math.round(S.car.position.y), Math.round(S.car.angle * 100));
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
      if (typeof e === 'string' && e.startsWith('flipland:')) { const [, n, amt] = e.split(':'); this.toast(`${['', 'FLIP', 'DOUBLE FLIP', 'TRIPLE FLIP'][n] || 'INSANE x' + n}! 🪙+${amt}`); sfx.park(Math.min(3, +n)); cam.flash(90, 255, 230, 120); }
      if (typeof e === 'string' && e.startsWith('bail')) { this.toast(`SLOPPY LANDING! 🪙+${e.split(':')[1] || 0}`); sfx.bump(); }
      if (typeof e === 'string' && e.startsWith('veer:')) { this.toast('BACK OFF! IT\'S MINE!'); sfx.honk(); cam.shake(150, 0.008); }
      if (e === 'go' && this.isLaunch) { this.toast('GO!'); sfx.park(1); }
      if (e === 'kick') { cam.shake(120, 0.01); this.sparks.emitParticleAt(c.position.x, c.position.y + 10, 16); }
      if (typeof e === 'string' && e.startsWith('lot:')) { const b = e.split(':')[1]; this.toast({ pullout: 'SOMEONE IS LEAVING!', late: 'SPOT OPENING…', snatch: 'SNATCHER INCOMING!' }[b] || ''); }
      if (typeof e === 'string' && e.startsWith('open:')) { this.toast(`SPOT #${+e.slice(5) + 1} OPEN!`); sfx.flip(1); }
      if (e === 'stolen') { this.toast('STOLEN! +50%'); cam.shake(200, 0.01); }
      if (typeof e === 'string' && e.startsWith('taken:')) { const i = +e.slice(6); this.toast(`RIVAL TOOK 🪙${S.spots[i].value}`); sfx.honk(); }
      if (e === 'parked' && !this.done) this.onParked();
      if (e === 'fail' && !this.done) this.onFail();
    }
  }
  render(S) {
    const c = S.car;
    this.carImg.setPosition(c.position.x, c.position.y).setRotation(c.angle).setFlipX(S.facing < 0);
    // flip car texture when driving left? keep facing right (simple)
    S.movers.forEach((m, i) => this.moverGfx[i].setPosition(m.b.position.x, m.b.position.y));
    S.carts.forEach((b, i) => this.cartGfx[i].setPosition(b.position.x, b.position.y).setRotation(b.angle));
    if (this.ghostData && !this.done) { const f = Math.min(S.frame, this.ghostData.length / 3 - 1) * 3;
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
      else { const d = Math.max(0, Math.floor((S.maxX - this.L.lipX) / 60)); this.hP2.textContent = '📏 ' + d + 'm'; this.hP3.textContent = '🪙 ' + save.coins; }
    }
    this.hFuel.style.width = Math.max(0, S.fuel / (this.L.fuel || 100) * 100) + '%';
    if (this.hBoost) this.hBoost.style.width = (S.boost / (this.L.tune.boostCap || 1) * 100) + '%';
    if (this.isLaunch) this.hStyle.textContent = (S.flipBank ? `FLIPS 🪙${S.flipBank}` : '') + (S.airFlips ? `  in air: ${S.airFlips}` : ''); else this.hStyle.textContent = S.style ? `STYLE ${S.style}${S.combo ? '  combo x' + S.combo : ''}` : '';
  }
  onParked() {
    if (this.isLaunch) return this.launchResult();
    const S = this.sim, L = this.L, t = S.time(); this.done = true;
    const stars = starsFor(L, t), prevBest = save.best[L.id];
    const newBest = !prevBest || t < prevBest;
    if (newBest) { save.best[L.id] = t; localStorage.setItem(ghostKey(L.id), JSON.stringify(this.ghostRec)); }
    save.stars[L.id] = Math.max(save.stars[L.id] || 0, stars); persist();
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
    const S = this.sim, L = this.L; this.done = true;
    const p = payout(L, S); save.coins += p.total; save.runs++;
    if (S.parked) save.bestSpot = Math.max(save.bestSpot, S.parkedSpot + 1);
    if (L.daily) save.daily[L.seed] = Math.max(save.daily[L.seed] || 0, p.total);
    persist();
    const cam = this.cameras.main;
    if (S.parked) { cam.shake(260, 0.012); cam.flash(120, 255, 255, 255); this.sparks.emitParticleAt(S.car.position.x, S.car.position.y - 10, 60); sfx.park(3); }
    else { cam.shake(300, 0.016); sfx.fail(); }
    const next = UPGRADES.map(u => ({ u, c: costOf(u, save.up[u.k] || 0), l: save.up[u.k] || 0 })).filter(x => x.l < x.u.max).sort((a, b) => a.c - b.c)[0];
    const line = (k, v) => v ? `<div class="row"><span>${k}</span><b>+${v}</b></div>` : '';
    overlay = h(`<div><div class="stamp ${S.parked ? '' : 'fail'}">${S.parked ? (S.stolen ? 'STOLEN!' : 'PARKED!') : S.failed}</div><div class="panel p">
      ${S.parked ? `<div style="font-size:15px">Spot #${S.parkedSpot + 1} of ${L.spots.length}</div>` : `<div class="slip">PARKING DATE SLIPPED → <b>Q${(save.runs % 4) + 1} ${2028 + Math.floor(save.runs / 6)}</b></div>`}
      <div class="rows">${line('Spot', p.spot)}${line('Distance', p.dist)}${line('Style', p.style)}${line('Flips', p.flips)}${line('Stolen bonus', p.stolen)}${line('No dings', p.clean)}
      ${L.mult > 1 ? `<div class="row"><span>Coin Magnet</span><b>x${L.mult.toFixed(1)}</b></div>` : ''}</div>
      <div class="t">🪙 +${p.total} &nbsp;·&nbsp; total 🪙 ${save.coins}</div>
      ${next ? `<div style="font-size:12px;opacity:.85">${save.coins >= next.c ? '✅ You can afford ' + next.u.name + '!' : 'Next upgrade: ' + next.u.name + ' at 🪙' + next.c}</div>` : ''}
      <div class="btns"><button class="main" data-a="r">↻ Run again (R/Enter)</button><button data-a="s">🛠 Shop</button><button data-a="m">Menu</button></div></div></div>`);
    overlay.querySelector('[data-a=r]').onclick = () => startLaunch(L.daily);
    const cancel = () => { clearTimeout(this.autoT); const c = overlay?.querySelector('.auto'); if (c) c.remove(); };
    overlay.querySelector('[data-a=s]').addEventListener('pointerdown', cancel); overlay.querySelector('[data-a=m]').addEventListener('pointerdown', cancel);
    overlay.querySelector('.panel').addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') startLaunch(L.daily); });
    if (!S.parked) { overlay.querySelector('.btns').insertAdjacentHTML('beforebegin', '<div class="auto" style="font-size:12px;opacity:.8">next run in 2.5s… (tap to go now)</div>');
      this.autoT = setTimeout(() => { if (!shopEl && !menuEl && this.done && this.scene.isActive()) startLaunch(L.daily); }, 2500); }
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
      <div class="slip">PARKING DATE SLIPPED<br><s>${from}</s> → <b>Q${q} ${y0}</b><br><span style="font-size:12px;opacity:.7">(${save.slips} delay${save.slips > 1 ? 's' : ''} and counting)</span></div>
      <div class="btns"><button class="main" data-a="r">↻ Retry (R)</button><button data-a="m">Levels</button></div></div></div>`);
    overlay.querySelector('[data-a=r]').onclick = () => this.restartLevel();
    overlay.querySelector('[data-a=m]').onclick = () => showMenu();
    ui.appendChild(overlay);
    requestAnimationFrame(() => overlay?.querySelector('.stamp').classList.add('go'));
  }
}

window.__pp = { LEVELS, save, startLevel, startLaunch, openShop, showMenu, playLaunch: (seed, inputs) => { menuEl?.remove(); menuEl = null; closeShop(); game.scene.getScene('play').scene.restart({ mode: 'launch', seed, replay: inputs }); }, play: (id, inputs) => { menuEl?.remove(); menuEl = null; game.scene.getScene('play').scene.restart({ id, replay: inputs }); } };
const game = new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: 960, height: 540, pixelArt: true, backgroundColor: '#12141c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [Play] });
buildTouch();
game.events.once('ready', () => { if (location.hash.startsWith('#l')) startLevel(+location.hash.slice(2)); else showMenu(); });
