// Pure physics sim (matter-js). Deterministic fixed step; used by the game and by the headless solver.
import Matter from 'matter-js';
const { Engine, Bodies, Body, Composite, Vertices } = Matter;

const norm = a => Math.atan2(Math.sin(a), Math.cos(a));
export const CAR_W = 60, CAR_H = 22, DT = 1000 / 60;
const LIFT = 0.00175, STEER = 0.00055, DRIVE = 0.0018, HOP = 7.2, SPIN = 0.011, MAXSPIN = 0.22;

export function createSim(L) {
  const LA = L.mode === 'launch';
  const T = Object.assign({ lift: 1, spin: 1, grip: 1, top: 9.5, boostPow: 0, boostCap: 0, steer: 1 }, L.tune || {});
  const engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
  const world = engine.world;
  const statics = [];
  const add = (r, opts = {}) => {
    const b = Bodies.rectangle(r[0] + r[2] / 2, r[1] + r[3] / 2, r[2], r[3], { isStatic: true, friction: 0.9, ...opts });
    Composite.add(world, b); return b;
  };
  for (const s of L.solids) { const b = add(s.r, s.t === 'cone' ? { chamfer: { radius: 4 } } : {}); b.kind = s.t; b.carKind = s.kind; statics.push(b); }
  // ramp: convex quads under a polyline profile
  for (const poly of (L.ramp || [])) {
    for (let i = 0; i < poly.length - 1; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[i + 1], bot = Math.max(y1, y2) + 400;
      const verts = [{ x: x1, y: y1 }, { x: x2, y: y2 }, { x: x2, y: bot }, { x: x1, y: bot }];
      const c = Vertices.centre(verts);
      const b = Bodies.fromVertices(c.x, c.y, [verts], { isStatic: true, isSensor: true, friction: 0.9 }); // ridden via the suction rail below
      Body.setPosition(b, { x: b.position.x + (c.x - Vertices.centre(b.vertices).x), y: b.position.y + (c.y - Vertices.centre(b.vertices).y) });
      b.kind = 'ramp'; Composite.add(world, b); statics.push(b);
    }
  }
  const car = Bodies.rectangle(L.start.x, L.start.y, CAR_W, CAR_H, {
    chamfer: { radius: [9, 4, 3, 3] }, friction: 0, frictionStatic: 0, frictionAir: 0.012, restitution: 0.05, density: 0.002, label: 'car' });
  if (L.tune && L.tune.drag) car.frictionAir = L.tune.drag;
  Composite.add(world, car);
  const movers = (L.movers || []).map(m => {
    const b = add(m.r, { friction: 1 }); b.kind = m.t;
    return { ...m, b, x0: m.r[0] + m.r[2] / 2, y0: m.r[1] + m.r[3] / 2, stopped: false };
  });
  const carts = (L.carts || []).map(([x, y]) => {
    const b = Bodies.rectangle(x, y, 26, 22, { friction: 0.02, frictionAir: 0.002, density: 0.0008, label: 'cart' });
    Composite.add(world, b); Body.setVelocity(b, { x: -1.2, y: 0 }); return b;
  });
  let gate = null;
  if (L.gate) { gate = add(L.gate.r); gate.kind = 'gate'; }

  const S = { engine, car, statics, movers, carts, gate, L,
    frame: 0, facing: 1, boost: T.boostCap, boosting: false, maxX: 0, spotIdx: -1, taken: new Set(), rivalsOut: [], stolen: false, gFrames: 0, onRamp: false, flipBank: 0, airFlips: 0, idleF: 0, slowF: 0, roofF: 0, lot: [], lastHop: -99, fuel: L.fuel, grounded: false, parkHold: 0, parked: false, failed: null,
    airRot: 0, flips: 0, style: 0, combo: 0, bumps: 0, lastBumpF: -99, events: [], inSpot: false, gateOpen: false,
    thrusting: { up: false, l: false, r: false } };

  const SPOTS = L.spots || [L.spot];
  S.spots = SPOTS;
  S.rivals = (L.rivals || []).map(r => ({ ...r, arrived: false }));
  S.spotRect = (i = 0) => {
    const sp = SPOTS[i];
    if (sp.on !== undefined) { const m = movers[sp.on]; const b = m.b.bounds;
      return { x: b.min.x + m.spotDx, y: b.min.y, w: sp.w }; }
    return sp;
  };

  // lot behaviours (launch): pullout / late / blocker / snatch
  S.lot = (L.lotcars || []).map(lc => {
    const b = Bodies.rectangle(lc.x, lc.y, lc.w, lc.h, { isStatic: true }); b.kind = 'car'; Composite.add(world, b);
    if (lc.beh === 'pullout' || lc.beh === 'late') S.taken.add(lc.spot);
    return { ...lc, b, phase: 'wait', f: 0, gone: false };
  });
  S.step = (inp) => {
    S.events.length = 0;
    if (S.parked || S.failed) { Engine.update(engine, DT); S.frame++; return; }
    const t = S.frame;
    const a = car.angle, ux = Math.sin(a), uy = -Math.cos(a), fx = Math.cos(a), fy = Math.sin(a);
    const m = car.mass;
    const fuelRate = L.fuelRate || 1;
    S.thrusting = { up: false, l: false, r: false };
    S.events.length = 0;
    // lift (thrusters along car "up")
    if (inp.up && S.fuel > 0) { Body.applyForce(car, car.position, { x: ux * LIFT * T.lift * m, y: uy * LIFT * T.lift * m });
      S.fuel -= 0.2 * fuelRate; S.thrusting.up = true; }
    // fan suction: glued to the ramp surface
    // boost gauge: extra top speed + push on the ground, forward shove in the air
    S.boosting = !!(inp.boost && S.boost > 0);
    if (S.boosting) { S.boost = Math.max(0, S.boost - 0.6);
      if (!S.grounded) Body.applyForce(car, car.position, { x: fx * 0.0009 * (1 + T.boostPow / 8) * m * S.facing * (Math.cos(a) > 0 ? 1 : -1), y: fy * 0.0009 * m * S.facing });
      else if (!inp.left && !inp.right) inp = { ...inp, [S.facing > 0 ? 'right' : 'left']: true };
    }
    // horizontal
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) {
      if (S.grounded && Math.abs(Math.cos(a)) > 0.6) {
        // wheel traction: accelerate along the car's forward axis toward top speed (no fuel)
        const sgn = Math.cos(a) > 0 ? 1 : -1, vf = car.velocity.x * fx + car.velocity.y * fy, target = dir * sgn * (LA && car.position.x > L.lipX + 150 ? 4.5 : T.top + (S.boosting ? T.boostPow : 0));
        const acc = vf * Math.sign(target) >= Math.abs(target) ? 0 : Math.sign(target - vf) * Math.min(Math.abs(target - vf), (vf * target < 0 ? 0.9 : 0.42) * T.grip * (S.boosting ? 1.6 : 1));
        Body.setVelocity(car, { x: car.velocity.x + fx * acc, y: car.velocity.y + fy * acc });
      } else if (S.fuel > 0) {
        Body.applyForce(car, car.position, { x: STEER * T.steer * m * dir, y: 0 });
        S.fuel -= 0.07 * fuelRate; if (dir > 0) S.thrusting.r = true; else S.thrusting.l = true;
      }
    }
    if (dir) S.facing = dir;
    else if (S.grounded) Body.setVelocity(car, { x: car.velocity.x * 0.9, y: car.velocity.y }); // rolling brake (car has no surface friction; traction is modelled here)
    // hop: free jump off the floor (no fuel), along the car's up vector
    const hopCost = LA && car.position.x > L.lipX ? 8 : 0;
    if (inp.hop && S.grounded && t - S.lastHop > 24 && (!LA || S.gFrames >= 20) && S.fuel >= hopCost) {
      S.fuel -= hopCost;
      S.lastHop = t; Body.setVelocity(car, { x: car.velocity.x + ux * HOP, y: Math.min(car.velocity.y, 0) + uy * HOP }); S.events.push('hop');
    }
    // spin
    const sd = (inp.spinR ? 1 : 0) - (inp.spinL ? 1 : 0);
    if (sd && S.grounded) Body.setAngularVelocity(car, Math.max(-0.09, Math.min(0.09, car.angularVelocity + 0.012 * sd))); // wheelie / kick-up
    else if (sd && !S.grounded) Body.setAngularVelocity(car, Math.max(-MAXSPIN * T.spin, Math.min(MAXSPIN * T.spin, car.angularVelocity + SPIN * T.spin * sd)));
    else if (!S.grounded) Body.setAngularVelocity(car, car.angularVelocity * 0.97);
    // self-righting assist when stuck on roof/side
    if (S.grounded && Math.cos(a) < 0.3 && Math.hypot(car.velocity.x, car.velocity.y) < 1.5) {
      Body.setAngularVelocity(car, car.angularVelocity + (Math.sin(a) > 0 ? -0.02 : 0.02));
      Body.applyForce(car, car.position, { x: 0, y: -0.0012 * m });
    }
    if (L.wind && car.position.y < L.wind.yAbove) Body.applyForce(car, car.position, { x: L.wind.fx * m * 10, y: 0 });
    // movers
    for (const mv of movers) {
      if (mv.t === 'pad') {
        const y = mv.y0 - mv.ay * (0.5 - 0.5 * Math.cos(2 * Math.PI * t / mv.period));
        Body.setPosition(mv.b, { x: mv.x0, y }, true);
      } else if (mv.t === 'thief' && t > mv.delay && !mv.stopped) {
        const nx = mv.b.position.x + mv.vx, left = nx - mv.r[2] / 2;
        const sp = L.spot, cb = car.bounds;
        const guarding = !S.taken.size && cb.max.x > sp.x - 10 && cb.min.x < sp.x + sp.w + 10 && cb.max.y > sp.y - 120;
        if (guarding) { if (!mv.honked) { S.events.push('honk'); mv.honked = true; } if (S.inSpot) mv.stopped = true; }
        else if (left > sp.x + sp.w - 24) Body.setPosition(mv.b, { x: nx, y: mv.b.position.y }, true);
        else { mv.stopped = true; S.fail('SPOT STOLEN'); }
      }
    }
    for (const o of S.lot) {
      if (o.gone) continue;
      const sp = S.spotRect(o.spot), cx = sp.x + sp.w / 2, see = car.position.x > sp.x - 950;
      if (o.beh === 'blocker') { Body.setPosition(o.b, { x: cx + Math.sin(t / 45) * 150, y: sp.y - 100 + Math.sin(t / 23) * 20 }, true); continue; }
      if (o.phase === 'wait' && ((o.beh === 'late' && t >= o.at) || (o.beh !== 'late' && see))) { o.phase = 'go'; o.f = 0; S.events.push('lot:' + o.beh + ':' + o.spot); }
      if (o.phase !== 'go') continue;
      o.f++;
      if (o.beh === 'pullout' || o.beh === 'late') {          // lifts off and flies away, freeing the spot
        Body.setPosition(o.b, { x: o.b.position.x + Math.min(5, o.f * 0.08), y: o.b.position.y - Math.min(4, o.f * 0.1) }, true);
        if (o.b.position.y < sp.y - 110 && S.taken.has(o.spot) && !S.rivals.some(r => r.arrived && r.spot === o.spot)) { S.taken.delete(o.spot); S.events.push('open:' + o.spot); }
        if (o.b.position.y < -400) { o.gone = true; Composite.remove(world, o.b); }
      } else if (o.beh === 'snatch') {                          // swoops down into the spot after ~2.5s
        const k = Math.min(1, o.f / 150), tx = cx, ty = sp.y - o.h / 2 - 1;
        if (S.claimed === o.spot) { Body.setPosition(o.b, { x: o.b.position.x + 4, y: o.b.position.y - 3 }, true); if (o.b.position.y < -400) { o.gone = true; Composite.remove(world, o.b); } continue; }
        if (S.taken.has(o.spot) && k < 1) { o.gone = true; Composite.remove(world, o.b); continue; }
        Body.setPosition(o.b, { x: o.x + (tx - o.x) * k, y: o.y + (ty - o.y) * (k * k) }, true);
        if (k >= 1 && !S.taken.has(o.spot) && SPOTS.length - S.taken.size <= Math.max(3, Math.ceil(SPOTS.length / 2))) { o.phase = 'done'; o.gone = true; Composite.remove(world, o.b); continue; }
        if (k >= 1 && !S.taken.has(o.spot)) { S.taken.add(o.spot); o.phase = 'done'; S.events.push('taken:' + o.spot); }
      }
    }
    const prevA = car.angle;
    Engine.update(engine, DT);
    S.frame++;
    // fan suction: within reach of the ramp surface the car is glued to it and rides the curve (until the kicker lip)
    const wasGlued = S.glued;
    if (L.prof && car.position.x < L.lipX - 4 && car.position.x > L.prof[0][0]) {
      const P = L.prof; let i = 0; while (i < P.length - 2 && car.position.x > P[i + 1][0]) i++;
      const [x1, y1] = P[i], [x2, y2] = P[i + 1], k = (car.position.x - x1) / (x2 - x1), sy = y1 + (y2 - y1) * k;
      const sa = Math.atan2(y2 - y1, x2 - x1), up = norm(car.angle - sa);
      const gap = sy - (car.position.y + CAR_H / 2);
      if (gap < 40) {
        const tx = Math.cos(sa), ty = Math.sin(sa), vt = car.velocity.x * tx + car.velocity.y * ty;
        Body.setPosition(car, { x: car.position.x, y: sy - CAR_H / 2 - 0.5 });
        Body.setAngle(car, sa); Body.setAngularVelocity(car, 0);
        Body.setVelocity(car, { x: tx * vt, y: ty * vt });
        S.glued = true; car.frictionAir = 0.004;
      } else S.glued = false;
    } else S.glued = false;
    if (!S.glued && L.tune && L.tune.drag) car.frictionAir = L.tune.drag;
    if (wasGlued && !S.glued && car.position.x >= L.lipX - 6 && T.kick) { Body.setVelocity(car, { x: car.velocity.x * T.kick, y: car.velocity.y * T.kick }); S.events.push('kick'); }
    // contacts
    let g = false, bump = false, ramp = false;
    for (const p of engine.pairs.list) {
      if (!p.isActive) continue;
      const other = p.bodyA === car ? p.bodyB : p.bodyB === car ? p.bodyA : null;
      if (!other) continue;
      for (const c of p.contacts) if (c && c.vertex && c.vertex.y >= car.position.y - 2) g = true;
      if (other.kind === 'ramp') ramp = true;
      if (other.kind === 'car' || other.kind === 'thief' || other.label === 'cart') bump = true;
    }
    if (bump && S.frame - S.lastBumpF > 30) { S.bumps++; S.events.push('bump'); }
    if (bump) S.lastBumpF = S.frame;
    if (S.glued) g = true;
    const wasG = S.grounded; S.grounded = g; S.onRamp = ramp; S.rampF = ramp ? 0 : (S.rampF ?? 99) + 1; S.gFrames = g ? S.gFrames + 1 : 0;
    if (!g) S.airRot += car.angle - prevA;
    if (Math.abs(S.airRot) > Math.PI * 2 - 0.4) { S.airRot = 0; S.flips++; S.airFlips++; S.combo++; S.style += 100 * S.combo; S.events.push('flip');
      if (gate && !S.gateOpen) { S.gateOpen = true; Composite.remove(world, gate); S.events.push('gate'); } }
    if (g && !wasG) {
      if (S.airFlips > 0) {
        if (Math.cos(car.angle) > 0.7) { const n = S.airFlips, amt = [0, 8, 25, 55, 100][Math.min(4, n)] + Math.max(0, n - 4) * 60;
          S.flipBank += amt; S.style += 50 * S.combo; S.events.push('flipland:' + n + ':' + amt); }
        else { const amt = Math.round(([0, 8, 25, 55, 100][Math.min(4, S.airFlips)] + Math.max(0, S.airFlips - 4) * 60) / 2); S.flipBank += amt; S.events.push('bail:' + amt); }
      }
      S.combo = 0; S.airRot = 0; S.airFlips = 0; }
    // parking check
    const b = car.bounds; let inside = false, which = -1;
    for (let i = 0; i < SPOTS.length; i++) {
      if (S.taken.has(i)) continue;
      const sp = S.spotRect(i);
      if (b.min.x >= sp.x - 8 && b.max.x <= sp.x + sp.w + 8 && Math.abs(b.max.y - sp.y) < 12 && Math.cos(car.angle) > 0.85) { inside = true; which = i; break; }
    }
    S.inSpot = inside; S.spotIdx = which;
    const sp0 = SPOTS[Math.max(0, which)];
    const rel = sp0.on !== undefined ? movers[sp0.on].b.velocity : { x: 0, y: 0 };
    const slow = Math.hypot(car.velocity.x - rel.x, car.velocity.y - rel.y) < 1.0;
    if (inside && g && slow) { S.parkHold++; if (S.parkHold >= 18) { S.parked = true; S.parkedSpot = which;
      const r = S.rivals.find(r => r.spot === which && !r.arrived);
      const rb = S.rivals.find(r => r.spot === which && (r.blocked || (!r.arrived && r.arrive - S.frame < 120)));
      if (rb || S.lot.some(o => o.spot === which && o.beh === 'snatch' && o.phase === 'go')) { S.stolen = true; S.events.push('stolen'); }
      S.events.push('parked'); } } else S.parkHold = 0;
    // player claim: being in or right over a free spot reserves it (rivals veer off)
    S.claimed = -1;
    for (let i = 0; i < SPOTS.length; i++) {
      if (S.taken.has(i)) continue; const sp = S.spotRect(i), cx = car.position.x;
      if (cx > sp.x - 30 && cx < sp.x + sp.w + 30 && car.position.y > sp.y - 170 && car.position.y < sp.y + 10) { S.claimed = i; break; }
    }
    if (S.parked) S.claimed = S.parkedSpot;
    // rivals claim spots when they arrive, unless you're claiming it, or too few would be left free
    for (const r of S.rivals) if (!r.arrived && S.frame >= r.arrive) {
      r.arrived = true;
      const free = SPOTS.length - S.taken.size;
      if (S.claimed === r.spot || (S.parked && S.parkedSpot === r.spot)) { r.blocked = true; r.blockedF = S.frame; S.events.push('veer:' + r.spot); continue; }
      if (free <= Math.max(3, Math.ceil(SPOTS.length / 2))) { r.blocked = true; r.blockedF = S.frame; continue; }
      if (S.taken.has(r.spot)) { r.blocked = true; continue; }
      S.taken.add(r.spot); const sp = S.spotRect(r.spot);
      const rb = Bodies.rectangle(sp.x + sp.w / 2, sp.y - 20, Math.min(sp.w - 8, 110), 40, { isStatic: true }); rb.kind = 'car';
      Composite.add(world, rb); S.rivalsOut.push({ r, b: rb }); S.events.push('taken:' + r.spot);
    }
    S.maxX = Math.max(S.maxX, car.position.x);
    if (LA && !S.parked) {
      const any = inp.left || inp.right || inp.up || inp.hop || inp.spinL || inp.spinR || inp.boost;
      const sp = Math.hypot(car.velocity.x, car.velocity.y);
      S.idleF = any || !g || S.inSpot ? 0 : S.idleF + 1;
      S.slowF = sp < 0.4 && !S.inSpot && t > 90 ? S.slowF + 1 : 0;
      S.roofF = Math.cos(car.angle) < -0.2 && g ? S.roofF + 1 : 0;
      if (S.roofF > 150) S.fail('FLIPPED');
      else if (S.idleF > 180 && car.position.x > L.lipX) S.fail('STALLED');
      else if (S.slowF > 150 && S.fuel < 3 && S.boost < 3) S.fail('OUT OF JUICE');
      else if (S.slowF > 240) S.fail('STUCK');
    }
    if (L.pits) for (const [px1, px2, py] of L.pits) if (car.position.x > px1 && car.position.x < px2 && car.position.y > py) S.fail('IN THE PIT');
    if (car.position.y > L.h + 150 || car.position.x < -100 || car.position.x > L.w + 100) S.fail('LEFT THE LOT');
    if (S.frame > 60 * (L.timeLimit || 45)) S.fail('METER EXPIRED');
    if (S.fuel < 0) S.fuel = 0;
  };
  S.fail = (why) => { if (!S.failed && !S.parked) { S.failed = why; S.events.push('fail'); } };
  S.time = () => S.frame / 60;
  return S;
}

export function starsFor(L, t) { return t <= L.par[1] ? 3 : t <= L.par[0] ? 2 : 1; }
