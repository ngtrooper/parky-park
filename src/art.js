// Placeholder pixel-style textures drawn at half resolution, displayed at 2x with nearest filtering.
const PAL = { sedan: ['#3b6fd1', '#27489a'], suv: ['#d1453b', '#8f2a24'], van: ['#e0a534', '#a2731c'], truck: ['#5d6b7a', '#3a4450'],
  mini: ['#47b36b', '#2c7a47'], thief: ['#b05bd6', '#743a90'] };
function px(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h), c = t.getContext();
  c.imageSmoothingEnabled = false; draw(c, w, h); t.refresh();
}
const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
export function makeArt(scene) {
  // Player: white wedge roadster, 32x12 px (world 64x24 -> body 60x22)
  px(scene, 'car', 32, 12, c => {
    const o = '#1b1f2a';
    // body outline wedge
    const rows = [[3, 26], [2, 29], [1, 31], [0, 32], [0, 32], [0, 32], [1, 31]]; // y=4..10
    rows.forEach(([a, b], i) => { R(c, o, a, 4 + i, b - a, 1); });
    const fill = [[4, 25], [3, 28], [2, 30], [1, 31], [1, 31]];
    fill.forEach(([a, b], i) => R(c, i < 2 ? '#ffffff' : '#e3e8f0', a, 5 + i, b - a, 1));
    R(c, '#c5ccd8', 2, 9, 28, 1);
    // canopy
    R(c, o, 9, 1, 11, 1); R(c, o, 7, 2, 15, 1); R(c, o, 6, 3, 18, 1);
    R(c, '#7fd3ff', 10, 2, 9, 1); R(c, '#4aa8e0', 8, 3, 14, 1); R(c, '#bfefff', 12, 2, 3, 1);
    // thruster nozzle + light
    R(c, '#59606e', 0, 6, 2, 3); R(c, '#ff5a3c', 1, 5, 2, 1); R(c, '#fff3a0', 30, 6, 2, 1);
    // wheels
    for (const wx of [5, 22]) { R(c, o, wx, 8, 6, 4); R(c, '#3b4252', wx + 1, 9, 4, 2); R(c, '#aab3c2', wx + 2, 9, 2, 1); }
  });
  for (const [k, [w, h]] of Object.entries({ sedan: [59, 20], suv: [62, 29], van: [70, 35], truck: [75, 32], mini: [48, 18], thief: [70, 34] })) {
    const [a, b] = PAL[k];
    px(scene, 'p_' + k, w, h, c => {
      const o = '#1b1f2a', bodyTop = k === 'truck' ? 6 : Math.floor(h * 0.3), wh = 6;
      if (k === 'truck') { R(c, o, w - 30, 0, 30, h - 3); R(c, a, w - 29, 1, 28, h - 6); R(c, '#9fd8f5', w - 26, 3, 10, 7); }
      R(c, o, 0, bodyTop, w, h - bodyTop - 2); R(c, a, 1, bodyTop + 1, w - 2, h - bodyTop - 5); R(c, b, 1, h - 7, w - 2, 3);
      if (k !== 'truck') { const cx = k === 'sedan' || k === 'mini' ? 0.22 : 0.08, cw = k === 'sedan' || k === 'mini' ? 0.5 : 0.8;
        R(c, o, Math.floor(w * cx), 0, Math.floor(w * cw), bodyTop + 1); R(c, a, Math.floor(w * cx) + 1, 1, Math.floor(w * cw) - 2, bodyTop);
        const n = k === 'van' || k === 'thief' ? 3 : 2, ww = Math.floor((w * cw - 4) / n) - 2;
        for (let i = 0; i < n; i++) R(c, '#9fd8f5', Math.floor(w * cx) + 3 + i * (ww + 2), 2, ww, bodyTop - 2); }
      R(c, '#fff3a0', w - 3, bodyTop + 2, 2, 2); R(c, '#ff5a3c', 1, bodyTop + 2, 2, 2);
      for (const wx of [6, w - 6 - wh - 2]) { R(c, o, wx, h - wh, wh + 2, wh); R(c, '#3b4252', wx + 1, h - wh + 1, wh, wh - 2); R(c, '#aab3c2', wx + 3, h - wh + 2, 2, 2); }
      if (k === 'thief') { R(c, '#ffffff', 20, bodyTop + 5, 30, 5); R(c, o, 22, bodyTop + 6, 26, 3); }
    });
  }
  px(scene, 'asphalt', 16, 16, c => { R(c, '#3a3d46', 0, 0, 16, 16); R(c, '#2f3139', 0, 0, 16, 2); R(c, '#9aa0aa', 0, 0, 16, 1);
    [[3, 6], [10, 9], [6, 13], [13, 4]].forEach(([x, y]) => R(c, '#454954', x, y, 1, 1)); });
  px(scene, 'dirt', 16, 16, c => { R(c, '#2b2d34', 0, 0, 16, 16); [[2, 3], [9, 7], [5, 12], [13, 13]].forEach(([x, y]) => R(c, '#33363e', x, y, 2, 1)); });
  px(scene, 'concrete', 16, 16, c => { R(c, '#8b93a3', 0, 0, 16, 16); R(c, '#a4abb9', 0, 0, 16, 1); R(c, '#6d7483', 0, 15, 16, 1); R(c, '#6d7483', 15, 0, 1, 16);
    [[4, 5], [11, 10], [7, 12]].forEach(([x, y]) => R(c, '#7c8494', x, y, 1, 1)); });
  px(scene, 'cone', 9, 11, c => { R(c, '#1b1f2a', 3, 0, 3, 1); R(c, '#ff7a1a', 3, 1, 3, 3); R(c, '#ffffff', 2, 4, 5, 2); R(c, '#ff7a1a', 2, 6, 5, 3); R(c, '#1b1f2a', 0, 9, 9, 2); });
  px(scene, 'cart', 13, 11, c => { R(c, '#c9d2e0', 0, 0, 13, 1); R(c, '#c9d2e0', 1, 1, 1, 6); R(c, '#c9d2e0', 11, 1, 1, 6); R(c, '#8e9bb0', 2, 2, 9, 1); R(c, '#8e9bb0', 2, 4, 9, 1);
    R(c, '#c9d2e0', 1, 7, 11, 1); R(c, '#1b1f2a', 2, 9, 2, 2); R(c, '#1b1f2a', 9, 9, 2, 2); });
  px(scene, 'spark', 4, 4, c => { R(c, '#ffffff', 1, 0, 2, 4); R(c, '#ffffff', 0, 1, 4, 2); });
  px(scene, 'puff', 6, 6, c => { R(c, '#ffffff', 1, 0, 4, 6); R(c, '#ffffff', 0, 1, 6, 4); });
  px(scene, 'star', 8, 8, c => { R(c, '#ffd23f', 3, 0, 2, 8); R(c, '#ffd23f', 0, 3, 8, 2); R(c, '#ffd23f', 1, 1, 6, 6); R(c, '#fff3a0', 3, 2, 2, 2); });
  // skylines for parallax
  for (let s = 0; s < 2; s++) px(scene, 'city' + s, 240, 90, c => {
    let x = 0, seed = 7 + s * 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    while (x < 240) { const w = 14 + Math.floor(rnd() * 24), h = 25 + Math.floor(rnd() * (s ? 55 : 40));
      R(c, s ? '#2a2f4a' : '#3b4266', x, 90 - h, w, h);
      for (let wy = 90 - h + 4; wy < 86; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 5) if (rnd() > 0.55) R(c, s ? '#f7d774' : '#6b78a8', wx, wy, 2, 2);
      x += w + 1 + Math.floor(rnd() * 4); }
  });
}
export const SKIES = [['#7ec8ff', '#d9f1ff'], ['#ff9e6b', '#ffe0a8'], ['#2b3a67', '#6f7fb8'], ['#5a7bd6', '#b9d5ff']];
