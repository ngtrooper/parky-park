// LAUNCH mode: procedural lots, upgrades, rivals, economy.
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const dailySeed = (d = new Date()) => +`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

export const UPGRADES = [
  { k: 'boostCap', name: 'Boost Tank', desc: 'More boost to burn on the ramp', base: 30, max: 6 },
  { k: 'boostPow', name: 'Boost Power', desc: 'Higher top speed while boosting', base: 40, max: 6 },
  { k: 'air', name: 'Air Tank', desc: 'More thruster fuel in the air', base: 35, max: 6 },
  { k: 'thrust', name: 'Thrusters', desc: 'Stronger lift and air-steer', base: 45, max: 6 },
  { k: 'spin', name: 'Spin Gyro', desc: 'Faster flips = more style', base: 25, max: 4 },
  { k: 'grip', name: 'Tire Grip', desc: 'Quicker acceleration and braking', base: 25, max: 4 },
  { k: 'mult', name: 'Coin Magnet', desc: '+20% coins per level', base: 80, max: 5 },
];
export const costOf = (u, lvl) => Math.round(u.base * Math.pow(1.75, lvl) / 5) * 5;

export function tuneFrom(up) {
  const g = k => up[k] || 0;
  return {
    tune: { boostCap: 30 + 20 * g('boostCap'), boostPow: 2 + 1.5 * g('boostPow'), lift: 1 + 0.07 * g('thrust'), steer: 1 + 0.25 * g('thrust'),
      spin: 1 + 0.2 * g('spin'), grip: 1 + 0.25 * g('grip'), top: 9.5, kick: 1.6 + 0.04 * g('boostPow'), drag: 0.022 - 0.0015 * g('thrust') },
    fuel: 30 + 14 * g('air'),
    mult: 1 + 0.2 * g('mult'),
  };
}
export const progressOf = up => UPGRADES.reduce((a, u) => a + (up[u.k] || 0), 0) / UPGRADES.reduce((a, u) => a + u.max, 0);

const KINDS = ['sedan', 'suv', 'van', 'truck', 'mini'];
const SZ = { sedan: [118, 40], suv: [124, 58], van: [140, 70], truck: [150, 64], mini: [96, 36] };
export const SPOT_VALUES = [10, 18, 30, 45, 65, 90, 125, 170, 230, 310];

export function genLot(seed, up = {}, daily = false, bestSpot = 0) {
  const R = rng(seed), T = tuneFrom(up), gy = 620;
  const solids = [], spots = [], pits = [];
  // ramp: start deck, curved drop, kicker
  const prof = [[-40, 140], [160, 140]];
  for (let i = 1; i <= 14; i++) { const t = i / 14; prof.push([160 + 700 * t, 140 + 400 * (0.5 - 0.5 * Math.cos(Math.PI * t))]); }
  const kick = 0.42 + R() * 0.1; // kicker steepness
  for (let i = 1; i <= 6; i++) { const t = i / 6; prof.push([860 + 220 * t, 540 - 120 * kick * 2 * t * t]); }
  const lipX = 1080, lipY = prof[prof.length - 1][1];
  // lot
  let x = 1180;
  solids.push({ t: 'wall', r: [-60, -600, 20, 1600] });
  const nSpots = 10;
  for (let i = 0; i < nSpots; i++) {
    const gap = 260 + i * 120 + R() * 160;
    // stuff between spots: parked cars, cones, a pit sometimes
    let cx = x, end = x + gap;
    while (cx < end - 140) {
      const roll = R();
      if (roll < 0.55) { const k = KINDS[Math.floor(R() * KINDS.length)]; const [w, h] = SZ[k];
        if (cx + w > end) break; solids.push({ t: 'car', kind: k, r: [cx, gy - h, w, h] }); cx += w + 4 + R() * 30; }
      else if (roll < 0.7 && i > 1 && cx + 200 < end) { const pw = 120 + R() * 80; pits.push([cx, cx + pw, gy + 30]); solids.push({ t: 'pit', r: [cx, gy, pw, 200] }); cx += pw + 20; }
      else if (roll < 0.85) { solids.push({ t: 'cone', r: [cx, gy - 22, 18, 22] }); cx += 40 + R() * 40; }
      else cx += 60 + R() * 80;
    }
    x = end;
    const w = Math.max(76, 118 - i * 4 - R() * 14);
    // flanking cars so you have to drop in
    const lk = KINDS[Math.floor(R() * KINDS.length)], rk = KINDS[Math.floor(R() * KINDS.length)];
    solids.push({ t: 'car', kind: lk, r: [x, gy - SZ[lk][1], SZ[lk][0], SZ[lk][1]] }); x += SZ[lk][0];
    spots.push({ x, y: gy, w, value: SPOT_VALUES[i] }); x += w;
    solids.push({ t: 'car', kind: rk, r: [x, gy - SZ[rk][1], SZ[rk][0], SZ[rk][1]] }); x += SZ[rk][0] + 20;
  }
  // ground pieces with holes for pits
  let gx = 900; const sortedPits = [...pits].sort((a, b) => a[0] - b[0]);
  for (const [a, b] of sortedPits) { solids.push({ t: 'ground', r: [gx, gy, a - gx, 120] }); solids.push({ t: 'ground', r: [a, gy + 200, b - a, 40] }); gx = b; }
  solids.push({ t: 'ground', r: [gx, gy, x + 600 - gx, 120] });
  solids.push({ t: 'wall', r: [x + 600, -600, 20, 1600] });
  // lot behaviours mixed in (not on spot #1 so the first spot is always learnable)
  const lotcars = [];
  let lastSnatch = -9;
  for (let i = 1; i < nSpots; i++) {
    const roll = R(), sp = spots[i], cx = sp.x + sp.w / 2, k = KINDS[Math.floor(R() * 2)];
    const [w, h] = SZ[k];
    if (roll < 0.16) lotcars.push({ spot: i, beh: 'pullout', kind: k, x: cx, y: gy - 20, w: Math.min(sp.w - 6, 96), h: 36 });
    else if (roll < 0.28) lotcars.push({ spot: i, beh: 'late', at: 200 + Math.floor(R() * 300), kind: k, x: cx, y: gy - 20, w: Math.min(sp.w - 6, 96), h: 36 });
    else if (roll < 0.42) lotcars.push({ spot: i, beh: 'blocker', kind: 'mini', x: cx, y: gy - 100, w: 96, h: 36 });
    else if (roll < 0.5 && i >= 4 && i - lastSnatch > 2 && (lastSnatch = i)) lotcars.push({ spot: i, beh: 'snatch', kind: 'sedan', x: cx + 420, y: gy - 300, w: Math.min(sp.w - 6, 96), h: 36 });
  }
  // rivals: start with you on their own ramp lane, race for the spots just past your best
  const prog = progressOf(up), nR = Math.min(4, 2 + Math.round(prog * 2));
  const vr = 9 + prog * 5, vf = 10 + prog * 4.5, rivals = [];
  const base = Math.max(1, Math.min(nSpots - 2, bestSpot));
  const PERS = ['cautious', 'reckless', 'showoff'];
  for (let j = 0; j < nR; j++) {
    const pers = PERS[Math.floor(R() * 3)];
    // weighted target: mostly just past your best, sometimes greedy (far) or lazy (near)
    const w = R(); let spot = base + j + (w < 0.2 ? -1 : w > 0.8 ? 2 : 0) + (pers === 'reckless' ? 1 : 0);
    spot = Math.max(1, Math.min(nSpots - 1, spot));
    while (rivals.some(r => r.spot === spot) && spot < nSpots - 1) spot++;
    const spd = { cautious: 0.85, reckless: 1.15, showoff: 1 }[pers] * (0.9 + R() * 0.2);
    const hes = Math.floor(R() * (pers === 'cautious' ? 45 : 18)); // hesitation at GO
    const path = []; let rx = 60, v = 0, f = 0;
    for (let k = 0; k < hes; k++) { path.push(60); f++; }
    while (rx < lipX) { v = Math.min((vr + j * 0.4) * spd, v + 0.22 * spd); rx += v; f++; path.push(Math.round(rx)); }
    const sx = spots[spot].x + spots[spot].w / 2;
    let flight = Math.ceil((sx - lipX) / ((vf - j * 0.3) * spd)) + 25;
    const m = R(), mistake = m < (pers === 'reckless' ? 0.3 : 0.12) ? 'overshoot' : m < (pers === 'reckless' ? 0.45 : 0.2) ? 'bounce' : m < (pers === 'reckless' ? 0.55 : 0.25) ? 'bail' : null;
    const extra = mistake === 'overshoot' ? 70 : mistake === 'bounce' ? 50 : 0;
    rivals.push({ spot, lane: j, pers, path, lipF: f, flight, arrive: f + flight + extra + (spot <= 2 ? 70 : 0), mistake, never: mistake === 'bail',
      bailT: 0.35 + R() * 0.4, arcH: 140 + R() * 220 * (pers === 'cautious' ? 0.6 : 1.2), wobA: 4 + R() * (pers === 'reckless' ? 26 : 10), wobF: 6 + R() * 10,
      flips: pers === 'showoff' ? 1 + Math.floor(R() * 3) : R() < 0.15 ? 1 : 0, phase: R() * 6 });
  }
  return { id: 'launch', mode: 'launch', daily, seed, name: daily ? 'Daily Lot' : 'Lot #' + (seed % 10000),
    hint: 'Hold ▶ + BOOST down the ramp, fly, flip, park far. Rivals are coming for the best spots!',
    w: x + 620, h: 900, start: { x: 60, y: 120 }, fuel: T.fuel, tune: T.tune, mult: T.mult, par: [99, 99], sky: Math.floor(R() * 4),
    ramp: [prof], prof, solids, spots, pits, rivals, lotcars, lipX, lipY, timeLimit: 40 };
}

export function payout(L, S) {
  const style = S.style;
  const dist = Math.max(0, Math.floor((S.maxX - L.lipX) / 60));
  const flips = S.flipBank || 0;
  if (!S.parked) return { total: Math.round((dist + flips) * L.mult), dist, flips, spot: 0, style: 0, stolen: 0 };
  const spot = L.spots[S.parkedSpot].value, st = Math.round(style / 10), stolen = S.stolen ? Math.round(spot * 0.5) : 0, clean = S.bumps ? 0 : 5;
  return { total: Math.round((spot + st + stolen + clean + dist + flips) * L.mult), dist, flips, spot, style: st, stolen, clean };
}
