// テスト用フクロウ Live2D モデル（.moc3 + テクスチャ + .model3.json）を生成する
//
//   node tools/owl/generate.js
//
// 出力先: public/models/test_owl/
// パラメータ ID は Live2D 標準（public/js/live2dCharacter.js の PARAMS と同じ）。

const fs   = require('fs');
const path = require('path');
const { buildMoc3 } = require('./moc3Writer');
const { encodePng } = require('./png');

const OUT_DIR   = path.join(__dirname, '../../public/models/test_owl');
const MODEL     = 'test_owl';
const CANVAS_W  = 1000;
const CANVAS_H  = 1200;
const PPU       = CANVAS_W;             // 1 unit = キャンバス幅
const ORIGIN    = [CANVAS_W / 2, CANVAS_H / 2];
const TEX_SIZE  = 2048;
const GRID_DIV  = 4;                    // メッシュの分割数（5x5 頂点）

// ── 色 ────────────────────────────────────────────────────────
const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
const C = {
  outline:   hex('#3b2412'),
  body:      hex('#8a5a2e'),
  bodyDark:  hex('#5e3a1a'),
  head:      hex('#976234'),
  tuft:      hex('#6b4220'),
  tuftInner: hex('#a8743f'),
  belly:     hex('#ead5a8'),
  chevron:   hex('#b08a5a'),
  wing:      hex('#6f4522'),
  wingTip:   hex('#4e2f15'),
  faceRim:   hex('#c9a774'),
  face:      hex('#f3e3c3'),
  iris:      hex('#f7c331'),
  irisLight: hex('#ffe38a'),
  pupil:     hex('#1e140c'),
  white:     hex('#ffffff'),
  lid:       hex('#86542a'),
  brow:      hex('#fbf3e2'),
  beak:      hex('#efa83a'),
  beakDark:  hex('#c47f22'),
  mouth:     hex('#7a2230'),
  foot:      hex('#e39a36'),
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp01 = t => Math.max(0, Math.min(1, t));

// ── 距離関数（負 = 内側、単位 px） ─────────────────────────────
const circle  = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) - r;
const ellipse = (cx, cy, rx, ry, rotDeg = 0) => {
  const c = Math.cos(-rotDeg * Math.PI / 180), s = Math.sin(-rotDeg * Math.PI / 180);
  return (x, y) => {
    const dx = x - cx, dy = y - cy;
    const lx = dx * c - dy * s, ly = dx * s + dy * c;
    return (Math.hypot(lx / rx, ly / ry) - 1) * Math.min(rx, ry);
  };
};
const segment = (ax, ay, bx, by, r) => (x, y) => {
  const px = x - ax, py = y - ay, vx = bx - ax, vy = by - ay;
  const h = clamp01((px * vx + py * vy) / (vx * vx + vy * vy));
  return Math.hypot(px - vx * h, py - vy * h) - r;
};
const polygon = pts => (x, y) => {
  let d = Infinity, inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j], [bx, by] = pts[i];
    d = Math.min(d, segment(ax, ay, bx, by, 0)(x, y));
    if ((by > y) !== (ay > y) && x < ((ax - bx) * (y - by)) / (ay - by) + bx) inside = !inside;
  }
  return inside ? -d : d;
};
const union     = (...fs) => (x, y) => Math.min(...fs.map(f => f(x, y)));
const intersect = (a, b) => (x, y) => Math.max(a(x, y), b(x, y));
const grow      = (f, r) => (x, y) => f(x, y) - r;
const mirrorX   = f => (x, y) => f(CANVAS_W - x, y);

// ── パーツ定義 ────────────────────────────────────────────────
// rect: メッシュ矩形 [x0, y0, x1, y1]（キャンバス px, Y 下向き）
// layers: 奥 → 手前の順に塗る { sdf, color: rgb | (x, y) => rgb }
const shaded = (base, dark, cx, cy, rx, ry, k = 0.55) => (x, y) =>
  mix(base, dark, Math.pow(clamp01(Math.hypot((x - cx) / rx, (y - cy) / ry)), 3) * k);

const bodySdf  = ellipse(500, 820, 260, 300);
const bellySdf = ellipse(500, 880, 172, 218);
const chevrons = (x, y) => {
  const row = Math.floor((y - 700) / 40);
  const lx  = ((x - 500 + (row % 2) * 22) % 44 + 44) % 44 - 22;
  const ly  = ((y - 700) % 40 + 40) % 40 - 20;
  return union(segment(-9, -4, 0, 4, 2.2), segment(0, 4, 9, -4, 2.2))(lx, ly);
};
const wingSdf = ellipse(265, 830, 85, 215, 12);
const wingTips = union(ellipse(250, 1000, 40, 50, 12), ellipse(290, 1010, 30, 40, 12));
const tuftSdf  = grow(polygon([[298, 232], [335, 400], [432, 372]]), 4);
const tuftIn   = polygon([[312, 262], [345, 385], [405, 368]]);
const headSdf  = ellipse(500, 470, 250, 210);
const faceSdf  = union(circle(395, 470, 135), circle(605, 470, 135));
const toes = fx => union(circle(fx - 24, 1108, 17), circle(fx, 1116, 18), circle(fx + 24, 1108, 17));
const feetSdf  = union(toes(430), toes(570));

function eyeLayers(cx, cy) {
  return [
    { sdf: circle(cx, cy, 84), color: C.outline },
    { sdf: circle(cx, cy, 77), color: (x, y) => mix(C.irisLight, C.iris, clamp01(Math.hypot(x - cx, y - cy) / 60)) },
    { sdf: circle(cx, cy, 44), color: C.pupil },
    { sdf: circle(cx - 18, cy - 20, 14), color: C.white },
    { sdf: circle(cx + 17, cy + 16, 6), color: C.white },
  ];
}

function lidLayers(cx, cy) {
  const lid = circle(cx, cy, 86);
  return [
    { sdf: lid, color: C.lid },
    // 閉じた目の線（下向きの弧）
    { sdf: intersect(lid, (x, y) => Math.abs(Math.hypot(x - cx, y - (cy - 70)) - 78) - 4.5), color: C.outline },
  ];
}

const browSdf = segment(320, 366, 466, 392, 12);

const SHAPES = {
  Body:      { rect: [236, 516, 764, 1124], layers: [
    { sdf: bodySdf, color: shaded(C.body, C.bodyDark, 500, 820, 260, 300) }] },
  Feet:      { rect: [388, 1084, 612, 1140], layers: [
    { sdf: grow(feetSdf, 3), color: C.outline },
    { sdf: feetSdf, color: C.foot }] },
  Belly:     { rect: [322, 656, 678, 1104], layers: [
    { sdf: bellySdf, color: shaded(C.belly, C.chevron, 500, 880, 172, 218, 0.35) },
    { sdf: intersect(chevrons, grow(bellySdf, -14)), color: C.chevron }] },
  WingR:     { rect: [160, 600, 370, 1060], layers: [
    { sdf: wingSdf, color: shaded(C.wing, C.wingTip, 265, 830, 85, 215, 0.4) },
    { sdf: intersect(wingTips, wingSdf), color: C.wingTip }] },
  TuftR:     { rect: [288, 222, 444, 410], layers: [
    { sdf: tuftSdf, color: C.tuft },
    { sdf: tuftIn, color: C.tuftInner }] },
  Head:      { rect: [246, 256, 754, 684], layers: [
    { sdf: headSdf, color: shaded(C.head, C.bodyDark, 500, 470, 250, 210, 0.45) }] },
  Face:      { rect: [256, 331, 744, 609], layers: [
    { sdf: faceSdf, color: C.faceRim },
    { sdf: grow(faceSdf, -8), color: C.face }] },
  EyeR:      { rect: [312, 380, 488, 556], layers: eyeLayers(400, 468) },
  EyeLidR:   { rect: [310, 378, 490, 558], layers: lidLayers(400, 468) },
  BrowR:     { rect: [300, 346, 486, 412], layers: [
    { sdf: grow(browSdf, 4), color: C.outline },
    { sdf: browSdf, color: C.brow }] },
  Mouth:     { rect: [470, 536, 530, 614], layers: [
    { sdf: ellipse(500, 575, 26, 34), color: C.mouth }] },
  BeakLower: { rect: [468, 550, 532, 620], layers: [
    { sdf: grow(polygon([[478, 560], [522, 560], [500, 608]]), 7), color: C.outline },
    { sdf: grow(polygon([[478, 560], [522, 560], [500, 608]]), 3), color: C.beakDark }] },
  BeakUpper: { rect: [452, 505, 548, 610], layers: [
    { sdf: grow(polygon([[466, 518], [534, 518], [500, 596]]), 8), color: C.outline },
    { sdf: grow(polygon([[466, 518], [534, 518], [500, 596]]), 4), color: C.beak }] },
};

// 左右対称パーツ（R = モデルの右 = 画面左、L はその鏡像）
const mirrorShape = s => ({
  rect:   [CANVAS_W - s.rect[2], s.rect[1], CANVAS_W - s.rect[0], s.rect[3]],
  layers: s.layers.map(l => ({
    sdf:   mirrorX(l.sdf),
    color: typeof l.color === 'function' ? (x, y) => l.color(CANVAS_W - x, y) : l.color,
  })),
});
for (const name of ['WingR', 'TuftR', 'EyeR', 'EyeLidR', 'BrowR']) {
  SHAPES[name.replace(/R$/, 'L')] = mirrorShape(SHAPES[name]);
}

// ── テクスチャアトラス ─────────────────────────────────────────
function buildAtlas(shapes) {
  const pixels = Buffer.alloc(TEX_SIZE * TEX_SIZE * 4);
  const cells  = {};
  const PAD    = 4;
  let cx = PAD, cy = PAD, rowH = 0;

  for (const [name, s] of Object.entries(shapes)) {
    const w = s.rect[2] - s.rect[0], h = s.rect[3] - s.rect[1];
    if (cx + w + PAD > TEX_SIZE) { cx = PAD; cy += rowH + PAD; rowH = 0; }
    if (cy + h + PAD > TEX_SIZE) throw new Error('テクスチャに収まりません');
    cells[name] = [cx, cy];

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const x = s.rect[0] + px + 0.5, y = s.rect[1] + py + 0.5;
        let rgb = null, a = 0;
        for (const l of s.layers) {
          const cov = clamp01(0.5 - l.sdf(x, y));
          const col = typeof l.color === 'function' ? l.color(x, y) : l.color;
          if (!rgb) rgb = col;              // 透明部分にも色を入れて縁の黒ずみを防ぐ
          if (cov <= 0) continue;
          const na = cov + a * (1 - cov);
          rgb = rgb.map((v, i) => (col[i] * cov + v * a * (1 - cov)) / na);
          a = na;
        }
        const o = ((cy + py) * TEX_SIZE + cx + px) * 4;
        pixels[o]     = Math.round(rgb[0]);
        pixels[o + 1] = Math.round(rgb[1]);
        pixels[o + 2] = Math.round(rgb[2]);
        pixels[o + 3] = Math.round(a * 255);
      }
    }
    cx += w + PAD;
    rowH = Math.max(rowH, h);
  }
  return { png: encodePng(TEX_SIZE, TEX_SIZE, pixels), cells };
}

// ── メッシュ ───────────────────────────────────────────────────
function gridMesh(rect, cell) {
  const [x0, y0, x1, y1] = rect;
  const pts = [], uvs = [], indices = [];
  for (let j = 0; j <= GRID_DIV; j++) {
    for (let i = 0; i <= GRID_DIV; i++) {
      const x = x0 + (x1 - x0) * i / GRID_DIV, y = y0 + (y1 - y0) * j / GRID_DIV;
      pts.push([x, y]);
      uvs.push([(cell[0] + x - x0) / TEX_SIZE, (cell[1] + y - y0) / TEX_SIZE]);
    }
  }
  const n = GRID_DIV + 1;
  for (let j = 0; j < GRID_DIV; j++) {
    for (let i = 0; i < GRID_DIV; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  return { pts, uvs, indices };
}

// 親デフォーマの座標系への変換（入力はキャンバス px, Y 下向き）
const toRoot = ([x, y]) => [(x - ORIGIN[0]) / PPU, (y - ORIGIN[1]) / PPU];
const toRotation = origin => ([x, y]) => [(x - origin[0]) / PPU, (y - origin[1]) / PPU];
const toWarp = ([x0, y0, x1, y1]) => ([x, y]) => [(x - x0) / (x1 - x0), (y - y0) / (y1 - y0)];

// ── デフォーマ ─────────────────────────────────────────────────
const NECK       = [500, 690];
const HEAD_RECT  = [220, 210, 780, 700];
const FACE_RECT  = [240, 300, 760, 665];
const WARP_DIV   = 4;
const ANGLE_KEYS = [-30, 0, 30];

// 顔の向き（X: 左右, Y: 上下）に応じて中央ほど大きく動かす
function warpKeyforms(rect, shift, bulge) {
  const toLocal = toRotation(NECK);
  const kfs = [];
  for (const ay of ANGLE_KEYS) {        // 後ろのバインディングほど外側のループ
    for (const ax of ANGLE_KEYS) {
      const grid = [];
      for (let j = 0; j <= WARP_DIV; j++) {
        for (let i = 0; i <= WARP_DIV; i++) {
          const u = i / WARP_DIV, v = j / WARP_DIV;
          const k = shift + bulge * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
          const x = rect[0] + (rect[2] - rect[0]) * u + (ax / 30) * k;
          const y = rect[1] + (rect[3] - rect[1]) * v - (ay / 30) * k;
          grid.push(toLocal([x, y]));
        }
      }
      kfs.push({ grid });
    }
  }
  return kfs;
}

const angleBindings = [
  { param: 'ParamAngleX', keys: ANGLE_KEYS },
  { param: 'ParamAngleY', keys: ANGLE_KEYS },
];

const deformers = [
  {
    id: 'Rotation_Head', type: 'rotation', parentPart: 'Part_Owl',
    bindings: [{ param: 'ParamAngleZ', keys: ANGLE_KEYS }],
    // 正の角度 = 画面上で時計回り。ParamAngleZ + で反時計回りに傾ける
    keyforms: ANGLE_KEYS.map(a => ({ origin: toRoot(NECK), angle: -a * 0.5 })),
  },
  {
    id: 'Warp_Head', type: 'warp', parentPart: 'Part_Owl', parentDeformer: 'Rotation_Head',
    rows: WARP_DIV, cols: WARP_DIV, bindings: angleBindings,
    keyforms: warpKeyforms(HEAD_RECT, 8, 14),
  },
  {
    id: 'Warp_Face', type: 'warp', parentPart: 'Part_Owl', parentDeformer: 'Rotation_Head',
    rows: WARP_DIV, cols: WARP_DIV, bindings: angleBindings,
    keyforms: warpKeyforms(FACE_RECT, 22, 26),
  },
];

// ── アートメッシュ ─────────────────────────────────────────────
// deform: (pts, keyValue) => pts  キーごとの変形（キャンバス px）
const scaleY = (pts, cy, s) => pts.map(([x, y]) => [x, cy + (y - cy) * s]);
const moveY  = (pts, dy) => pts.map(([x, y]) => [x, y + dy]);

const eyeOpen = (cx, cy) => ({
  keys: [0, 1],
  deform: (pts, k) => (k === 1 ? pts : scaleY(pts, cy + 6, 0.06)),
});
const lid = (cx, cy) => ({
  keys: [0, 1],
  deform: (pts, k) => (k === 0 ? pts : scaleY(pts, cy - 86, 0.08)),
  opacity: k => 1 - k,
});
const brow = innerX => ({
  keys: [-1, 0, 1],
  deform: (pts, k) => {
    const outerX = CANVAS_W - innerX > innerX ? innerX - 146 : innerX + 146;
    return pts.map(([x, y]) => {
      const t = clamp01((x - outerX) / (innerX - outerX));
      return [x, y - k * 24 * (0.6 + 0.4 * t)];
    });
  },
});

const MESHES = [
  { id: 'Body',      order: 300 },
  { id: 'Feet',      order: 310 },
  { id: 'Belly',     order: 320 },
  { id: 'WingR',     order: 330 },
  { id: 'WingL',     order: 330 },
  { id: 'TuftR',     order: 390, warp: 'Warp_Head' },
  { id: 'TuftL',     order: 390, warp: 'Warp_Head' },
  { id: 'Head',      order: 400, warp: 'Warp_Head' },
  { id: 'Face',      order: 410, warp: 'Warp_Face' },
  { id: 'EyeR',      order: 420, warp: 'Warp_Face', param: 'ParamEyeROpen', ...eyeOpen(400, 468) },
  { id: 'EyeL',      order: 420, warp: 'Warp_Face', param: 'ParamEyeLOpen', ...eyeOpen(600, 468) },
  { id: 'EyeLidR',   order: 430, warp: 'Warp_Face', param: 'ParamEyeROpen', ...lid(400, 468) },
  { id: 'EyeLidL',   order: 430, warp: 'Warp_Face', param: 'ParamEyeLOpen', ...lid(600, 468) },
  { id: 'BrowR',     order: 440, warp: 'Warp_Face', param: 'ParamBrowRY', ...brow(466) },
  { id: 'BrowL',     order: 440, warp: 'Warp_Face', param: 'ParamBrowLY', ...brow(534) },
  { id: 'Mouth',     order: 445, warp: 'Warp_Face', param: 'ParamMouthOpenY', keys: [0, 1],
    deform: (pts, k) => (k === 0 ? scaleY(pts, 548, 0.05) : moveY(scaleY(pts, 541, 1.3), 7)) },
  { id: 'BeakLower', order: 450, warp: 'Warp_Face', param: 'ParamMouthOpenY', keys: [0, 1],
    deform: (pts, k) => moveY(pts, k * 38) },
  { id: 'BeakUpper', order: 460, warp: 'Warp_Face' },
];

const WARP_RECTS = { Warp_Head: HEAD_RECT, Warp_Face: FACE_RECT };

function buildArtMeshes(cells) {
  return MESHES.map(m => {
    const { pts, uvs, indices } = gridMesh(SHAPES[m.id].rect, cells[m.id]);
    const convert = m.warp ? toWarp(WARP_RECTS[m.warp]) : toRoot;
    const keys = m.param ? m.keys : [null];
    return {
      id:             `ArtMesh_${m.id}`,
      parentPart:     'Part_Owl',
      parentDeformer: m.warp ? m.warp : null,
      drawOrder:      m.order,
      uvs, indices,
      bindings:       m.param ? [{ param: m.param, keys: m.keys }] : [],
      keyforms:       keys.map(k => ({
        positions: (m.deform ? m.deform(pts, k) : pts).map(convert),
        opacity:   m.opacity ? m.opacity(k) : 1,
      })),
    };
  });
}

// ── 出力 ──────────────────────────────────────────────────────
const PARAMETERS = [
  { id: 'ParamAngleX',     min: -30, max: 30, default: 0 },
  { id: 'ParamAngleY',     min: -30, max: 30, default: 0 },
  { id: 'ParamAngleZ',     min: -30, max: 30, default: 0 },
  { id: 'ParamEyeLOpen',   min: 0,   max: 1,  default: 1 },
  { id: 'ParamEyeROpen',   min: 0,   max: 1,  default: 1 },
  { id: 'ParamMouthOpenY', min: 0,   max: 1,  default: 0 },
  { id: 'ParamBrowLY',     min: -1,  max: 1,  default: 0 },
  { id: 'ParamBrowRY',     min: -1,  max: 1,  default: 0 },
];

function generate() {
  const { png, cells } = buildAtlas(SHAPES);
  const moc = buildMoc3({
    canvas: { pixelsPerUnit: PPU, originX: ORIGIN[0], originY: ORIGIN[1], width: CANVAS_W, height: CANVAS_H },
    parameters: PARAMETERS,
    parts:      [{ id: 'Part_Owl' }],
    deformers,
    artMeshes:  buildArtMeshes(cells),
  });

  const model3 = {
    Version: 3,
    FileReferences: {
      Moc:      `${MODEL}.moc3`,
      Textures: ['textures/texture_00.png'],
    },
    Groups: [
      { Target: 'Parameter', Name: 'EyeBlink', Ids: ['ParamEyeLOpen', 'ParamEyeROpen'] },
      { Target: 'Parameter', Name: 'LipSync',  Ids: ['ParamMouthOpenY'] },
    ],
  };

  fs.mkdirSync(path.join(OUT_DIR, 'textures'), { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${MODEL}.moc3`), moc);
  fs.writeFileSync(path.join(OUT_DIR, 'textures/texture_00.png'), png);
  fs.writeFileSync(path.join(OUT_DIR, `${MODEL}.model3.json`), JSON.stringify(model3, null, 2) + '\n');
  console.log(`生成しました: ${path.relative(process.cwd(), OUT_DIR)}/ (moc3 ${moc.length} bytes)`);
}

if (require.main === module) generate();

module.exports = { PARAMETERS, OUT_DIR, MODEL };
