// Rough human economy: reach from tools/human_bot.mjs tiers (minus one spot, humans are worse), 45% park at reach, 25% one lower, 30% fail.
import { UPGRADES, costOf, SPOT_VALUES } from '../src/launch.js';
const REACH = { 0: 2, 2: 2, 4: 3, 6: 6, 8: 6, 10: 8, 13: 10 };
let up = {}, coins = 0, n = 0, runs = 0, streak = 0, rs = 7; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647, log = [];
const reach = () => Math.max(1, (REACH[Object.keys(REACH).map(Number).filter(k => k <= n).pop()]) - 1);
while (n < 24 && runs < 1000) {
  runs++; const r = rnd(), k = reach(), spot = r < 0.45 ? k : r < 0.7 ? Math.max(1, k - 1) : 0;
  let pay = 8; // quick-win challenge (about every run)
  if (spot) { streak++; pay += Math.round(SPOT_VALUES[spot - 1] * 1.12 * (1 + 0.1 * Math.min(5, streak - 1)) * (1 + 0.1 * (up.mult || 0))); } else { streak = 0; pay += 2; }
  coins += pay;
  for (;;) { const c = UPGRADES.filter(u => (up[u.k] || 0) < u.max).map(u => ({ u, c: costOf(u, up[u.k] || 0) })).sort((a, b) => a.c - b.c)[0];
    if (!c || coins < c.c) break; coins -= c.c; up[c.u.k] = (up[c.u.k] || 0) + 1; n++; log.push(runs); }
}
console.log('runs to max:', runs, '| buys at runs:', log.join(' '));
