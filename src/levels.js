// Parky Park level data. Rects are [x, y, w, h] (top-left, y down). Ground surface usually y=500.
// spot: {x, y (surface y), w}. par: [twoStarSec, threeStarSec].
const G = (x, w, y = 500, h = 80) => ({ t: 'ground', r: [x, y, w, h] });
const W = (x, y, w, h) => ({ t: 'wall', r: [x, y, w, h] });
const C = (x, kind, y = 500) => { // parked car resting on surface y
  const sz = { sedan: [118, 40], suv: [124, 58], van: [140, 70], truck: [150, 64], mini: [96, 36] }[kind];
  return { t: 'car', kind, r: [x, y - sz[1], sz[0], sz[1]] };
};
const K = (x, y = 500) => ({ t: 'cone', r: [x, y - 22, 18, 22] });

export const LEVELS = [
  {
    id: 1, name: 'The Tight One', hint: 'Hold ▲ to hover. Hop the SUV and drop into the gap.',
    w: 1300, h: 620, start: { x: 140, y: 470 }, fuel: 100, par: [6.5, 4], sky: 0,
    solids: [G(0, 1300), W(-20, -400, 20, 1100), W(1300, -400, 20, 1100),
      C(560, 'suv'), C(684, 'suv'), C(888, 'sedan'), C(1006, 'suv')],
    spot: { x: 808, y: 500, w: 80 },
    wps: [[480, 380], [760, 380], [848, 470]],
  },
  {
    id: 2, name: 'Spot Thief', hint: 'That minivan wants your spot. Get there first!',
    w: 1700, h: 620, start: { x: 120, y: 470 }, fuel: 100, par: [7, 4.7], sky: 1,
    solids: [G(0, 1700), W(-20, -400, 20, 1100), W(1700, -400, 20, 1100),
      C(560, 'sedan'), C(820, 'truck'), C(970, 'sedan')],
    spot: { x: 1088, y: 500, w: 90 },
    movers: [{ t: 'thief', r: [1560, 432, 140, 68], vx: -2.2, delay: 90 }],
    wps: [[480, 400], [1000, 380], [1133, 470]],
  },
  {
    id: 3, name: 'Tetris Lot', hint: 'Drop down through the levels. Mind the ceilings.',
    w: 1240, h: 720, start: { x: 120, y: 170 }, fuel: 100, par: [11, 7.3], sky: 2,
    solids: [G(0, 1240, 640), W(-20, -400, 20, 1200), W(1240, -400, 20, 1200),
      W(0, 200, 380, 20),               // top start ledge
      W(220, 400, 760, 20),             // middle shelf
      C(300, 'van', 400), C(600, 'sedan', 400), C(840, 'mini', 400),
      W(380, 0, 20, 120), W(700, 0, 20, 290), // hanging beams
      C(760, 'sedan', 640), C(1010, 'suv', 640), C(120, 'truck', 640)],
    spot: { x: 900, y: 640, w: 100 },
    wps: [[450, 150], [660, 330], [1100, 330], [1110, 520], [1100, 540], [950, 560], [950, 610]],
  },
  {
    id: 4, name: 'Penthouse Reserved', hint: 'The view is great. The fuel is limited.',
    w: 1400, h: 900, start: { x: 120, y: 770 }, fuel: 100, par: [10, 6.5], sky: 3,
    solids: [G(0, 1400, 800, 100), W(-20, -600, 20, 1600), W(1400, -600, 20, 1600),
      W(520, 380, 70, 420),             // billboard pole + board
      W(470, 300, 170, 90),
      W(900, 200, 260, 600),            // tower
      W(905, 168, 26, 32), W(1110, 160, 40, 40), // AC units
      C(240, 'sedan', 800)],
    spot: { x: 960, y: 200, w: 110 },
    wps: [[300, 500], [420, 250], [560, 230], [800, 120], [1015, 120], [1015, 170]],
    fuelRate: 1.15,
  },
  {
    id: 5, name: 'Different Floor', hint: 'Ramps are coned off. Take the elevator shaft. You ARE the elevator.',
    w: 1400, h: 760, start: { x: 380, y: 670 }, fuel: 100, par: [14, 9], sky: 1,
    solids: [G(0, 1400, 700), W(-20, -400, 20, 1300), W(1400, -400, 20, 1300),
      W(260, 0, 30, 560),                       // garage back wall
      W(290, 540, 840, 18), W(290, 380, 840, 18), W(290, 220, 840, 18), // floors 1-3 (floor 3 surface y=220)
      W(290, 60, 1000, 18),                     // roof
      W(1290, 78, 20, 470),                     // shaft outer wall
      K(700, 700), K(760, 700), K(820, 700), K(1000, 540), K(1040, 540), K(700, 380), K(740, 380),
      C(320, 'sedan', 220), C(620, 'suv', 220), C(560, 'sedan', 380), C(420, 'mini', 540)],
    spot: { x: 500, y: 220, w: 100 },
    wps: [[1180, 640], [1210, 600], [1210, 140], [1000, 150], [740, 150], [550, 160], [550, 190]],
  },
  {
    id: 6, name: 'Bulk Store Saturday', hint: 'One spot by the entrance. Everyone wants it.',
    w: 2200, h: 640, start: { x: 120, y: 470 }, fuel: 70, par: [10, 6.5], sky: 0,
    solids: [G(0, 2200), W(-20, -400, 20, 1100), W(2200, -400, 20, 1100),
      C(420, 'suv'), C(560, 'van'), C(720, 'sedan'), C(980, 'truck'), C(1150, 'suv'), C(1300, 'van'),
      C(1460, 'sedan'), C(1700, 'mini'), W(1910, 430, 14, 70), W(1924, 470, 80, 10), // cart corral
      W(2040, 200, 160, 300)],         // store front
    spot: { x: 1598, y: 500, w: 100 },
    carts: [[880, 470], [1620 - 400, 440], [1840, 470]],
    wps: [[360, 360], [1450, 330], [1640, 330], [1648, 470]],
  },
  {
    id: 7, name: 'Premium Parking', hint: 'Land on the moving pad. Starbayse valet only.',
    w: 1500, h: 900, start: { x: 120, y: 770 }, fuel: 100, par: [13, 10.3], sky: 3,
    solids: [G(0, 1500, 800, 100), W(-20, -600, 20, 1600), W(1500, -600, 20, 1600),
      W(1200, 120, 60, 680),             // launch tower
      W(1260, 120, 200, 680),            // rocket body
      W(1180, 300, 20, 14), W(1180, 520, 20, 14),
      W(700, 560, 40, 240), C(330, 'truck', 800)],
    spot: { x: 0, y: 0, w: 120, on: 0 },
    movers: [{ t: 'pad', r: [1040, 500, 140, 18], ay: 160, period: 300, spotDx: 10 }],
    wind: { yAbove: 420, fx: -0.000025 },
    wps: [[200, 620], [600, 480], [900, 300], ['pad', -60], ['pad', -26]],
  },
  {
    id: 8, name: 'Kickflip Required', hint: 'The gate only opens for style. Do a flip in the air!',
    w: 1300, h: 760, start: { x: 140, y: 670 }, fuel: 100, par: [9, 6.7], sky: 2,
    solids: [G(0, 1300, 700), W(-20, -400, 20, 1300), W(1300, -400, 20, 1300),
      W(840, 520, 20, 60), W(1060, 520, 20, 180), W(840, 500, 240, 20), // garage box
      C(1100, 'sedan', 700)],
    gate: { r: [840, 580, 20, 120] },
    spot: { x: 900, y: 700, w: 130 },
    wps: [[300, 300], ['flip'], [450, 450], [700, 660], [780, 664], [960, 665], [965, 680]],
  },
];
