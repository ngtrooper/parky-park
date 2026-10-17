// Purchase path (cheapest-first) -> range after each buy; and a human-run economy sim.
import { UPGRADES, costOf } from '../src/launch.js'; import { far as range } from './range2.mjs';
export function path() { const up = {}, out = [{ n: 0, up: { ...up }, r: range(up), spent: 0 }]; let spent = 0;
  for (;;) { const c = UPGRADES.filter(u => (up[u.k] || 0) < u.max).map(u => ({ u, c: costOf(u, up[u.k] || 0) })).sort((a, b) => a.c - b.c)[0]; if (!c) break;
    spent += c.c; up[c.u.k] = (up[c.u.k] || 0) + 1; out.push({ n: out.length, k: c.u.k, up: { ...up }, r: range(up), spent }); }
  return out; }
if ((process.argv[1] || '').endsWith('econ.mjs')) for (const p of path()) console.log(p.n, p.k || '-', 'range', p.r, 'spent', p.spent);
