import Phaser from 'phaser';
import { LEVELS } from './levels.js';
import { createSim, starsFor, DT, CAR_W, CAR_H } from './sim.js';
import { makeArt, SKIES } from './art.js';
import { sfx } from './sfx.js';

// ---------- save ----------
const SAVE_KEY = 'parkypark_v1';
const save = Object.assign({ stars: {}, best: {}, slips: 0 }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
const persist = () => localStorage.setItem(SAVE_KEY, JSON.stringify(save));
const ghostKey = id => 'parkypark_ghost_' + id;

// ---------- input ----------
const input = { left: false, right: false, up: false, spinL: false, spinR: false };
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', Space: 'up',
  KeyQ: 'spinL', KeyZ: 'spinL', KeyE: 'spinR', KeyX: 'spinR' };
addEventListener('keydown', e => {
  if (KEYMAP[e.code]) { input[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === 'KeyR') game.scene.getScene('play')?.restartLevel();
  if (e.code === 'Enter' || e.code === 'KeyN') game.scene.getScene('play')?.next();
  if (e.code === 'Escape') showMenu();
});
addEventListener('keyup', e => { if (KEYMAP[e.code]) input[KEYMAP[e.code]] = false; });
addEventListener('blur', () => Object.keys(input).forEach(k => input[k] = false));

// ---------- DOM UI ----------
const ui = document.getElementById('ui');
const h = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; };
const fmt = t => t.toFixed(2) + 's';
const starStr = n => '★'.repeat(n) + '<i>' + '★'.repeat(3 - n) + '</i>';
let hud, overlay, menuEl, touchEl;

function buildTouch() {
  touchEl = h(`<div class="touch p"><div><button data-k="left">◀</button><button data-k="right">▶</button></div>
    <div><button data-k="spinL">⟲</button><button data-k="spinR">⟳</button><button data-k="up">▲</button></div></div>`);
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
  menuEl?.remove();
  const total = Object.values(save.stars).reduce((a, b) => a + b, 0);
  menuEl = h(`<div class="menu p"><h1>PARKY PARK</h1>
    <div class="sub">The car can fly. Parking is still hard.<br>★ ${total} / ${LEVELS.length * 3}</div>
    <div class="grid">${LEVELS.map((L, i) => {
      const locked = i > 0 && !save.stars[LEVELS[i - 1].id];
      return `<div class="lv ${locked ? 'locked' : ''}" data-id="${L.id}"><div class="n">${L.id}</div><div class="nm">${L.name}</div>
        <div class="s">${starStr(save.stars[L.id] || 0)}</div><div class="bt">${save.best[L.id] ? 'best ' + fmt(save.best[L.id]) : 'par ' + L.par[1] + 's'}</div></div>`;
    }).join('')}</div>
    <div class="keys">◀ ▶ drive / air-steer &nbsp; ▲ or SPACE thrusters &nbsp; Q / E spin (flips = style!)<br>R instant retry &nbsp; ENTER next &nbsp; ESC levels</div></div>`);
  menuEl.querySelectorAll('.lv').forEach(el => el.addEventListener('click', () => { sfx.click(); startLevel(+el.dataset.id); }));
  ui.appendChild(menuEl);
}
function startLevel(id) {
  menuEl?.remove(); menuEl = null;
  const sc = game.scene.getScene('play');
  sc.scene.restart({ id });
}

// ---------- Play scene ----------
class Play extends Phaser.Scene {
  constructor() { super('play'); }
  init(data) { this.levelId = data.id || 1; this.replay = data.replay || null; }
  create() {
    makeArt(this);
    const L = this.L = LEVELS.find(l => l.id === this.levelId);
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
    this.ghostData = JSON.parse(localStorage.getItem(ghostKey(L.id)) || 'null');
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
    cam.setZoom(Phaser.Math.Clamp(540 / (L.h * 0.92), 0.6, 1));
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
    else if (s.t === 'cone') this.add.image(x, y, 'cone').setOrigin(0).setDisplaySize(w, hh);
  }
  buildHud() {
    hud?.remove(); overlay?.remove(); overlay = null;
    const L = this.L;
    hud = h(`<div><div class="hud"><div class="l">${L.id}. ${L.name}<small>${L.hint}</small>
      <div class="fuel"><i></i></div><div class="style"></div></div>
      <div style="text-align:right"><div class="timer">0.00</div><div class="pars"><span class="p2">★★ ${L.par[0]}s</span><span class="p3">★★★ ${L.par[1]}s</span></div>
      <div class="pars"><span>${save.best[L.id] ? 'BEST ' + fmt(save.best[L.id]) : 'no best yet'}</span></div></div></div>
      <div class="topbtns p"><button data-a="r">↻ R</button><button data-a="m">☰</button></div></div>`);
    hud.querySelector('[data-a=r]').onclick = () => this.restartLevel();
    hud.querySelector('[data-a=m]').onclick = () => showMenu();
    ui.insertBefore(hud, ui.firstChild);
    this.hTimer = hud.querySelector('.timer'); this.hFuel = hud.querySelector('.fuel i'); this.hStyle = hud.querySelector('.style');
    this.hP2 = hud.querySelector('.p2'); this.hP3 = hud.querySelector('.p3');
  }
  restartLevel() { if (menuEl) return; this.scene.restart({ id: this.levelId }); }
  next() {
    if (menuEl || !this.done) return;
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
      if (this.replay) { const v = this.replay[S.frame] || 0; inp = { left: !!(v & 1), right: !!(v & 2), up: !!(v & 4), spinL: !!(v & 8), spinR: !!(v & 16) }; }
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
      if (e === 'flip') { this.toast(`FLIP${S.combo > 1 ? ' x' + S.combo : ''}! +${100 * S.combo}`); sfx.flip(S.combo); this.sparks.emitParticleAt(c.position.x, c.position.y, 10); }
      if (e === 'landed') { this.toast('STUCK THE LANDING!'); }
      if (e === 'gate') { this.gateGfx?.destroy(); this.gateTxt?.setText('OPEN!'); cam.flash(150, 255, 230, 120); }
      if (e === 'honk') { sfx.honk(); this.toast('HONK HONK'); }
      if (e === 'bump') sfx.bump();
      if (e === 'parked' && !this.done) this.onParked();
      if (e === 'fail' && !this.done) this.onFail();
    }
  }
  render(S) {
    const c = S.car;
    this.carImg.setPosition(c.position.x, c.position.y).setRotation(c.angle);
    // flip car texture when driving left? keep facing right (simple)
    S.movers.forEach((m, i) => this.moverGfx[i].setPosition(m.b.position.x, m.b.position.y));
    S.carts.forEach((b, i) => this.cartGfx[i].setPosition(b.position.x, b.position.y).setRotation(b.angle));
    if (this.ghostData && !this.done) { const f = Math.min(S.frame, this.ghostData.length / 3 - 1) * 3;
      this.ghost.setPosition(this.ghostData[f], this.ghostData[f + 1]).setRotation(this.ghostData[f + 2] / 100); }
    // spot
    const sp = S.spotRect(), g = this.spotG; g.clear();
    const col = S.parked ? 0x3ddc84 : S.inSpot ? 0xffd23f : 0xffffff;
    const pulse = 0.35 + 0.25 * Math.sin(S.frame / 8);
    g.fillStyle(col, S.inSpot ? 0.45 : pulse * 0.5); g.fillRect(sp.x, sp.y - 34, sp.w, 34);
    g.fillStyle(col, 1); g.fillRect(sp.x, sp.y - 4, 4, 4); g.fillRect(sp.x + sp.w - 4, sp.y - 4, 4, 4); g.fillRect(sp.x, sp.y - 2, sp.w, 3);
    g.lineStyle(3, col, 1); g.strokeRect(sp.x, sp.y - 34, sp.w, 34);
    if (S.parkHold > 0 && !S.parked) { g.fillStyle(0x3ddc84, 1); g.fillRect(sp.x, sp.y - 40, sp.w * S.parkHold / 24, 5); }
    // P sign
    g.fillStyle(0x2f6fe0, 1); g.fillRect(sp.x + sp.w / 2 - 9, sp.y - 70, 18, 20); g.fillStyle(0xffffff, 1);
    g.fillRect(sp.x + sp.w / 2 - 5, sp.y - 67, 3, 14); g.fillRect(sp.x + sp.w / 2 - 5, sp.y - 67, 9, 3); g.fillRect(sp.x + sp.w / 2 + 2, sp.y - 67, 3, 8); g.fillRect(sp.x + sp.w / 2 - 5, sp.y - 61, 9, 3);
    // hud
    if (!this.done) {
      const t = S.time();
      this.hTimer.textContent = t.toFixed(2);
      this.hP3.classList.toggle('miss', t > this.L.par[1]); this.hP2.classList.toggle('miss', t > this.L.par[0]);
    }
    this.hFuel.style.width = Math.max(0, S.fuel) + '%';
    this.hStyle.textContent = S.style ? `STYLE ${S.style}${S.combo ? '  combo x' + S.combo : ''}` : '';
  }
  onParked() {
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
  onFail() {
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

window.__pp = { LEVELS, save, startLevel, showMenu, play: (id, inputs) => { menuEl?.remove(); menuEl = null; game.scene.getScene('play').scene.restart({ id, replay: inputs }); } };
const game = new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: 960, height: 540, pixelArt: true, backgroundColor: '#12141c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [Play] });
buildTouch();
game.events.once('ready', () => { if (location.hash.startsWith('#l')) startLevel(+location.hash.slice(2)); else showMenu(); });
