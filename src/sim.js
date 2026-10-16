// Pure physics sim (matter-js). Deterministic fixed step; used by the game and by the headless solver.
import Matter from 'matter-js';
const { Engine, Bodies, Body, Composite, Vertices } = Matter;

export const CAR_W = 60, CAR_H = 22, DT = 1000 / 60;
const LIFT = 0.00175, STEER = 0.00055, DRIVE = 0.0018, HOP = 7.2, SPIN = 0.011, MAXSPIN = 0.22;

export function createSim(L) {
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
      const b = Bodies.fromVertices(c.x, c.y, [verts], { isStatic: true, friction: 0.9 });
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
    frame: 0, facing: 1, boost: T.boostCap, boosting: false, maxX: 0, spotIdx: -1, taken: new Set(), rivalsOut: [], stolen: false, lastHop: -99, fuel: L.fuel, grounded: false, parkHold: 0, parked: false, failed: null,
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
        const sgn = Math.cos(a) > 0 ? 1 : -1, vf = car.velocity.x * fx + car.velocity.y * fy, target = dir * sgn * (T.top + (S.boosting ? T.boostPow : 0));
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
    if (inp.hop && S.grounded && t - S.lastHop > 24) {
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
    const prevA = car.angle;
    Engine.update(engine, DT);
    S.frame++;
    // contacts
    let g = false, bump = false;
    for (const p of engine.pairs.list) {
      if (!p.isActive) continue;
      const other = p.bodyA === car ? p.bodyB : p.bodyB === car ? p.bodyA : null;
      if (!other) continue;
      for (const c of p.contacts) if (c && c.vertex && c.vertex.y >= car.position.y - 2) g = true;
      if (other.kind === 'car' || other.kind === 'thief' || other.label === 'cart') bump = true;
    }
    if (bump && S.frame - S.lastBumpF > 30) { S.bumps++; S.events.push('bump'); }
    if (bump) S.lastBumpF = S.frame;
    const wasG = S.grounded; S.grounded = g;
    if (!g) S.airRot += car.angle - prevA;
    if (Math.abs(S.airRot) > Math.PI * 2 - 0.4) { S.airRot = 0; S.flips++; S.combo++; S.style += 100 * S.combo; S.events.push('flip');
      if (gate && !S.gateOpen) { S.gateOpen = true; Composite.remove(world, gate); S.events.push('gate'); } }
    if (g && !wasG) { if (S.combo > 0 && Math.cos(car.angle) > 0.8) { S.events.push('landed'); S.style += 50 * S.combo; } S.combo = 0; S.airRot = 0; }
    // parking check
    const b = car.bounds; let inside = false, which = -1;
    for (let i = 0; i < SPOTS.length; i++) {
      if (S.taken.has(i)) continue;
      const sp = S.spotRect(i);
      if (b.min.x >= sp.x - 2 && b.max.x <= sp.x + sp.w + 2 && Math.abs(b.max.y - sp.y) < 8 && Math.cos(car.angle) > 0.95) { inside = true; which = i; break; }
    }
    S.inSpot = inside; S.spotIdx = which;
    const sp0 = SPOTS[Math.max(0, which)];
    const rel = sp0.on !== undefined ? movers[sp0.on].b.velocity : { x: 0, y: 0 };
    const slow = Math.hypot(car.velocity.x - rel.x, car.velocity.y - rel.y) < 0.6;
    if (inside && g && slow) { S.parkHold++; if (S.parkHold >= 24) { S.parked = true; S.parkedSpot = which;
      const r = S.rivals.find(r => r.spot === which && !r.arrived);
      if (r && r.arrive - S.frame < 90) { S.stolen = true; S.events.push('stolen'); }
      S.events.push('parked'); } } else S.parkHold = 0;
    // rivals claim spots when they arrive (unless you're sitting in it)
    for (const r of S.rivals) if (!r.arrived && S.frame >= r.arrive) {
      r.arrived = true;
      if (S.spotIdx === r.spot) { r.blocked = true; S.events.push('honk'); continue; }
      S.taken.add(r.spot); const sp = S.spotRect(r.spot);
      const rb = Bodies.rectangle(sp.x + sp.w / 2, sp.y - 20, Math.min(sp.w - 8, 110), 40, { isStatic: true }); rb.kind = 'car';
      Composite.add(world, rb); S.rivalsOut.push({ r, b: rb }); S.events.push('taken:' + r.spot);
    }
    S.maxX = Math.max(S.maxX, car.position.x);
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
