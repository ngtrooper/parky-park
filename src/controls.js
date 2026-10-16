// Simplified 2-input phone scheme (hold LEFT / RIGHT half of the screen), mapped onto the full input set.
export function simpleInput(S, zone) {
  const g = S.grounded, i = { assist: true };
  if (zone.r && zone.l) { if (g) i.hop = true; else { i.up = true; if (S.car.velocity.x > 1) i.left = true; } }
  else if (zone.r) { if (g) { i.right = true; i.boost = true; } else { i.up = true; i.right = true; i.boost = true; } }
  else if (zone.l) { if (g) i.left = true; else i.spinL = true; }
  return i;
}
