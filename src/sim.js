// Pure physics sim (matter-js). Deterministic fixed step; used by the game and by the headless solver.
import Matter from 'matter-js';
const { Engine, Bodies, Body, Composite } = Matter;

export const CAR_W = 60, CAR_H = 22, DT = 1000 / 60;
const LIFT = 0.00175, STEER = 0.00055, DRIVE = 0.0011, SPIN = 0.011, MAXSPIN = 0.22;

export function createSim(L) {
  const engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
  const world = engine.world;
  const statics = [];
  const add = (r, opts = {}) => {
    const b = Bodies.rectangle(r[0] + r[2] / 2, r[1] + r[3] / 2, r[2], r[3], { isStatic: true, friction: 0.9, ...opts });
    Composite.add(world, b); return b;
  };
  for (const s of L.solids) { const b = add(s.r, s.t === 'cone' ? { chamfer: { radius: 4 } } : {}); b.kind = s.t; b.carKind = s.kind; statics.push(b); }
  const car = Bodies.rectangle(L.start.x, L.start.y, CAR_W, CAR_H, {
    chamfer: { radius: [9, 4, 3, 3] }, friction: 0.6, frictionAir: 0.012, restitution: 0.05, density: 0.002, label: 'car' });
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
    frame: 0, fuel: L.fuel, grounded: false, parkHold: 0, parked: false, failed: null,
    airRot: 0, flips: 0, style: 0, combo: 0, bumps: 0, lastBumpF: -99, events: [], inSpot: false, gateOpen: false,
    thrusting: { up: false, l: false, r: false } };

  S.spotRect = () => {
    const sp = L.spot;
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
    if (inp.up && S.fuel > 0) { Body.applyForce(car, car.position, { x: ux * LIFT * m, y: uy * LIFT * m });
      S.fuel -= 0.2 * fuelRate; S.thrusting.up = true; }
    // horizontal
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) {
      if (S.grounded && Math.abs(Math.cos(a)) > 0.6) {
        const sgn = Math.cos(a) > 0 ? 1 : -1;
        if (dir * car.velocity.x * sgn < 9) Body.applyForce(car, car.position, { x: fx * DRIVE * m * dir * sgn, y: fy * DRIVE * m * dir * sgn });
      } else if (S.fuel > 0) {
        Body.applyForce(car, car.position, { x: STEER * m * dir, y: 0 });
        S.fuel -= 0.07 * fuelRate; if (dir > 0) S.thrusting.r = true; else S.thrusting.l = true;
      }
    }
    // spin
    const sd = (inp.spinR ? 1 : 0) - (inp.spinL ? 1 : 0);
    if (sd && !S.grounded) Body.setAngularVelocity(car, Math.max(-MAXSPIN, Math.min(MAXSPIN, car.angularVelocity + SPIN * sd)));
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
        const guarding = cb.max.x > sp.x - 10 && cb.min.x < sp.x + sp.w + 10 && cb.max.y > sp.y - 120;
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
    const sp = S.spotRect(), b = car.bounds;
    const inside = b.min.x >= sp.x - 2 && b.max.x <= sp.x + sp.w + 2 && Math.abs(b.max.y - sp.y) < 8 && Math.cos(car.angle) > 0.95;
    S.inSpot = inside;
    const rel = sp.on !== undefined ? movers[sp.on].b.velocity : { x: 0, y: 0 };
    const slow = Math.hypot(car.velocity.x - rel.x, car.velocity.y - rel.y) < 0.6;
    if (inside && g && slow) { S.parkHold++; if (S.parkHold >= 24) { S.parked = true; S.events.push('parked'); } } else S.parkHold = 0;
    if (car.position.y > L.h + 150 || car.position.x < -100 || car.position.x > L.w + 100) S.fail('LEFT THE LOT');
    if (S.frame > 60 * 45) S.fail('METER EXPIRED');
    if (S.fuel < 0) S.fuel = 0;
  };
  S.fail = (why) => { if (!S.failed && !S.parked) { S.failed = why; S.events.push('fail'); } };
  S.time = () => S.frame / 60;
  return S;
}

export function starsFor(L, t) { return t <= L.par[1] ? 3 : t <= L.par[0] ? 2 : 1; }
