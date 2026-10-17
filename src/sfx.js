// Tiny WebAudio synth blips (no assets).
let ctx = null, lastThrust = 0, muted = false, adMute = false;
const apply = () => { if (!ctx) return; if (muted || adMute) ctx.suspend?.().catch(() => {}); else ctx.resume?.().catch(() => {}); };
const ac = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } } if (ctx?.state === 'suspended') ctx.resume(); return ctx; };
function tone(f, d, type = 'square', v = 0.06, f2 = null, delay = 0) {
  if (muted || adMute) return; const c = ac(); if (!c) return; const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(c.destination); o.start(t); o.stop(t + d);
}
function noise(d, v = 0.05) {
  if (muted || adMute) return; const c = ac(); if (!c) return; const b = c.createBuffer(1, c.sampleRate * d, c.sampleRate), a = b.getChannelData(0);
  for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length);
  const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
  s.buffer = b; g.gain.value = v; s.connect(f).connect(g).connect(c.destination); s.start();
}
export const sfx = {
  setMuted(m) { muted = !!m; apply(); }, setAdMute(m) { adMute = !!m; apply(); }, get muted() { return muted; }, get adMuted() { return adMute; },
  thrust() { const n = performance.now(); if (n - lastThrust > 70) { lastThrust = n; noise(0.08, 0.025); } },
  thud(v) { tone(120, 0.15, 'triangle', Math.min(0.2, v * 0.02), 50); },
  flip(c) { tone(500 + c * 120, 0.12, 'square', 0.05, 900 + c * 150); },
  honk() { tone(330, 0.18, 'sawtooth', 0.05); tone(392, 0.18, 'sawtooth', 0.04, null, 0.22); },
  bump() { tone(180, 0.08, 'square', 0.04, 90); },
  park(s) { [523, 659, 784, 1047].slice(0, s + 1).forEach((f, i) => tone(f, 0.18, 'square', 0.05, null, i * 0.09)); },
  fail() { tone(300, 0.5, 'sawtooth', 0.05, 80); },
  click() { tone(800, 0.05, 'square', 0.03); },
  coin(k) { tone(900 + k * 700, 0.05, 'square', 0.025); },
  buy() { [660, 880, 1320].forEach((f, i) => tone(f, 0.1, 'square', 0.05, null, i * 0.06)); noise(0.12, 0.03); },
  whoosh() { noise(0.35, 0.09); tone(220, 0.35, 'sawtooth', 0.04, 880); },
  best() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.14, 'triangle', 0.07, null, i * 0.07)); },
  close() { tone(440, 0.18, 'square', 0.05, 415); tone(415, 0.18, 'square', 0.05, 392, 0.2); tone(392, 0.4, 'square', 0.05, 330, 0.4); },
};
addEventListener('pointerdown', ac, { once: true }); addEventListener('keydown', ac, { once: true });
