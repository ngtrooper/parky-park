// Waypoint autopilot used to prove each level is beatable (and to make demo ghosts).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const norm = a => Math.atan2(Math.sin(a), Math.cos(a));
export function makePilot(L, tune = {}) {
  let i = 0, flipStart = null;
  const kx = tune.kx ?? 0.04, vmax = tune.vmax ?? 6.5;
  return (S) => {
    const c = S.car, p = c.position, v = c.velocity;
    const inp = { left: false, right: false, up: false, spinL: false, spinR: false };
    const wps = L.wps; let wp = wps[Math.min(i, wps.length - 1)];
    let tx, ty, final = i >= wps.length - 1;
    if (wp[0] === 'flip') {
      if (flipStart === null) flipStart = S.flips;
      if (S.flips > flipStart && Math.cos(c.angle) > 0.9) { i++; return inp; }
      inp.spinR = Math.cos(c.angle) < 0.9 || S.flips === flipStart; inp.up = v.y > 0.2 && Math.cos(c.angle) > 0; return inp;
    }
    if (wp[0] === 'pad') { const r = S.spotRect(); tx = r.x + r.w / 2; ty = r.y + wp[1]; }
    else { tx = wp[0]; ty = wp[1]; }
    const ex = tx - p.x, ey = ty - p.y;
    const reach = final ? 0 : 22;
    if (!final && Math.hypot(ex, ey) < reach) i++;
    let dvx = clamp(ex * kx, -vmax, vmax);
    if (final) dvx = clamp(ex * 0.06, -2.5, 2.5);
    if (S.grounded && final) {
      if (Math.abs(ex) > 6) { if (v.x < dvx - 0.3) inp.right = true; else if (v.x > dvx + 0.3) inp.left = true; }
      else { if (v.x > 0.25) inp.left = true; else if (v.x < -0.25) inp.right = true; }
      return inp;
    }
    if (v.x < dvx - 0.25) inp.right = true; else if (v.x > dvx + 0.25) inp.left = true;
    let dvy = clamp(ey * 0.05, -5.5, 4);
    if (final) dvy = Math.abs(ex) > 10 ? clamp(ey * 0.05, -3, 0.6) : 1.6;
    const pad = L.movers && L.movers.find(m => m.t === 'pad');
    if (final && pad) dvy += S.movers[0].b.velocity.y;
    if (v.y > dvy) inp.up = true;
    const a = norm(c.angle), want = -a * 0.15;
    if (!S.grounded) { if (c.angularVelocity < want - 0.008) inp.spinR = true; else if (c.angularVelocity > want + 0.008) inp.spinL = true; }
    return inp;
  };
}
