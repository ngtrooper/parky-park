// LAUNCH mode: procedural lots, upgrades, rivals, economy.
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const dailySeed = (d = new Date()) => +`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

// Each level is a clearly felt step: big early steps, diminishing later (cumulative share of the max bonus).
export const CURVE = [0, 0.3, 0.52, 0.7, 0.84, 0.94, 1];
const cv = (l, max) => CURVE[Math.round((l / max) * 6)] ?? 1;
export const UPGRADES = [
  { k: 'boostPow', name: 'Boost Power', desc: 'Stronger ramp booster (hold BOOST on the ramp)', base: 50, max: 4, stat: l => ({ label: 'Boost thrust', v: Math.round(tuneFrom({ boostPow: l }).tune.boostAcc / 0.4 * 100) + '%' }) },
  { k: 'air', name: 'Air Tank', desc: 'Fly longer (hold ▶ in the air)', base: 65, max: 4, stat: l => ({ label: 'Flight fuel', v: Math.round(tuneFrom({ air: l }).fuel) }) },
  { k: 'thrust', name: 'Thrusters', desc: 'Stronger lift and air-steer', base: 110, max: 4, stat: l => ({ label: 'Thrust', v: Math.round(tuneFrom({ thrust: l }).tune.lift * 100) + '%' }) },
  { k: 'boostCap', name: 'Boost Tank', desc: 'More booster fuel for the ramp', base: 80, max: 3, stat: l => ({ label: 'Boost', v: Math.round(tuneFrom({ boostCap: l }).tune.boostCap) }) },
  { k: 'grip', name: 'Tires', desc: 'Drive faster in the lot to fix short landings', base: 150, max: 3, stat: l => ({ label: 'Lot speed', v: tuneFrom({ grip: l }).tune.lotTop.toFixed(1) }) },
  { k: 'spin', name: 'Spin Gyro', desc: 'Faster flips (flips multiply your parking pay)', base: 150, max: 3, stat: l => ({ label: 'Flip speed', v: Math.round(tuneFrom({ spin: l }).tune.spin * 100) + '%' }) },
  { k: 'mult', name: 'Coin Magnet', desc: '+10% coins per level', base: 400, max: 3, stat: l => ({ label: 'Coins', v: '+' + l * 10 + '%' }) },
];
export const costOf = (u, lvl) => Math.round(u.base * Math.pow(1.4, lvl) / 5) * 5;

export function tuneFrom(up) {
  const c = k => { const u = UPGRADES.find(x => x.k === k); return cv(Math.min(up[k] || 0, u.max), u.max); };
  return {
    tune: { boostCap: 45 + 45 * c('boostCap'), boostPow: 2 + 6 * c('boostPow'), lift: 1 + 0.3 * c('thrust'), steer: 1 + 1 * c('thrust'),
      spin: 1 + 0.8 * c('spin'), grip: 1 + 1 * c('grip'), lotTop: 4.5 + 3 * c('grip'), top: 9.5, boostAcc: 0.4 + 0.35 * c('boostPow'), drag: 0.0035 } /* light air drag: true momentum */,
    fuel: 45 + 70 * c('air'),
    mult: 1 + 0.1 * (up.mult || 0),
  };
}
export const progressOf = up => UPGRADES.reduce((a, u) => a + (up[u.k] || 0), 0) / UPGRADES.reduce((a, u) => a + u.max, 0);

const KINDS = ['sedan', 'suv', 'van', 'truck', 'mini'];
const SZ = { sedan: [118, 40], suv: [124, 58], van: [140, 70], truck: [150, 64], mini: [96, 36] };
export const SPOT_VALUES = [20, 30, 45, 60, 80, 100, 125, 155, 190, 230];
// Spot distances (m past the kicker). Tuned to a human-ish flight model (tools/range2.mjs, tools/human_bot.mjs): fresh reaches #1-2, each upgrade tier adds about one.
export const LADDER = [18, 40, 76, 124, 180, 240, 306, 378, 456, 540];

export function genLot(seed, up = {}, daily = false, bestSpot = 0) {
  const R = rng(seed), T = tuneFrom(up), gy = 620;
  const solids = [], spots = [], pits = [];
  // ramp: start deck, curved drop, kicker
  const prof = [[-40, 140], [160, 140]];
  for (let i = 1; i <= 14; i++) { const t = i / 14; prof.push([160 + 700 * t, 140 + 400 * (0.5 - 0.5 * Math.cos(Math.PI * t))]); }
  const kick = 0.62 + R() * 0.1; // kicker steepness (steeper = higher arc)
  for (let i = 1; i <= 6; i++) { const t = i / 6; prof.push([860 + 220 * t, 540 - 120 * kick * 2 * t * t]); }
  const lipX = 1080, lipY = prof[prof.length - 1][1];
  // lot
  let x = 1180;
  solids.push({ t: 'wall', r: [-60, -600, 20, 1600] });
  const nSpots = 10;
  for (let i = 0; i < nSpots; i++) {
    const w = Math.max(112, 160 - i * 4 - R() * 10); // big, wide spots
    const lk = KINDS[Math.floor(R() * KINDS.length)], rk = KINDS[Math.floor(R() * KINDS.length)];
    const center = lipX + LADDER[i] * 60 * (0.96 + R() * 0.08);
    const end = Math.max(x, center - w / 2 - SZ[lk][0]);
    let cx = x;
    while (cx < end - 140) {
      const roll = R();
      if (roll < 0.38) { const k = KINDS[Math.floor(R() * KINDS.length)]; const [w, h] = SZ[k];
        if (cx + w > end) break; solids.push({ t: 'car', kind: k, r: [cx, gy - h, w, h] }); cx += w + 4 + R() * 30; }
      else if (roll < 0.7 && i > 1 && cx + 200 < end) { const pw = 120 + R() * 80; pits.push([cx, cx + pw, gy + 30]); solids.push({ t: 'pit', r: [cx, gy, pw, 200] }); cx += pw + 20; }
      else if (roll < 0.85) { solids.push({ t: 'cone', r: [cx, gy - 22, 18, 22] }); cx += 40 + R() * 40; }
      else cx += 60 + R() * 80;
    }
    x = end;
    const flL = i >= 3 && R() < 0.5, flR = i >= 3 && R() < 0.5; // fewer cars boxing spots in
    if (flL) solids.push({ t: 'car', kind: lk, r: [x, gy - SZ[lk][1], SZ[lk][0], SZ[lk][1]] }); x += flL ? SZ[lk][0] : 30;
    spots.push({ x, y: gy, w, value: SPOT_VALUES[i] }); x += w;
    if (flR) solids.push({ t: 'car', kind: rk, r: [x, gy - SZ[rk][1], SZ[rk][0], SZ[rk][1]] }); x += (flR ? SZ[rk][0] : 30) + 20;
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
  const prog = progressOf(up), nR = Math.min(4, 1 + Math.round(prog * 3)); // fewer rivals early
  const vr = 7 + prog * 7, vf = 7.5 + prog * 7, rivals = []; // slower rivals early
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

export const flipMult = S => 1 + 0.25 * Math.min(8, S.cleanFlips || 0) + 0.1 * Math.min(4, S.sloppyFlips || 0);
// Parking is the dominant reward: spot value x flip multiplier (+ steal / clean / streak bonuses). Not parked: 20% of flip value only.
export function payout(L, S, ctx = {}) {
  const quest = ctx.quest || 0, streak = ctx.streak || 0, m = L.mult;
  const dist = Math.max(0, Math.floor((S.maxX - L.lipX) / 60));
  if (!S.parked) { const flips = Math.min(10, Math.round((S.flipBank || 0) * 0.2)); return { total: Math.round((flips + quest) * m), dist, flips, quest, spot: 0, fm: 1 }; }
  const spot = L.spots[S.parkedSpot].value, fm = flipMult(S), flips = Math.round(spot * (fm - 1));
  const stolen = S.stolen ? Math.round(spot * 0.5) : 0, clean = S.bumps ? 0 : Math.round(spot * 0.1), streakB = Math.round(spot * 0.1 * Math.min(5, streak));
  return { total: Math.round((spot + flips + stolen + clean + streakB + quest) * m), dist, flips, fm, spot, stolen, clean, streak: streakB, quest };
}
