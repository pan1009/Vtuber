// 最小限の .moc3 (フォーマット V3.00) ライター
//
// 公式の Cubism Editor を使わずにテスト用モデルを生成するためのもの。
// バイナリレイアウトは以下のリバースエンジニアリング資料に基づく:
//   - https://github.com/OpenL2D/moc3ingbird (src/moc3.hexpat)
//   - https://github.com/Ludentes/py-moc3
// グルー・マスク・ブレンドシェイプなどは未対応（テストモデルには不要）。

const HEADER_SIZE  = 64;
const SOT_COUNT    = 160;
const BODY_OFFSET  = 0x7C0;  // SOT(0x40..0x2C0) + ランタイム領域(0x2C0..0x740) の後
const ALIGN        = 64;
const RUNTIME_UNIT = 8;

const DEFORMER_WARP     = 0;
const DEFORMER_ROTATION = 1;

// 描画フラグ: bit0-1 ブレンドモード(0=通常) / bit2 両面描画
const FLAG_DOUBLE_SIDED = 1 << 2;

/**
 * @param {object} def  モデル定義（generate.js 参照）
 * @returns {Buffer}
 */
function buildMoc3(def) {
  const paramIndex = new Map(def.parameters.map((p, i) => [p.id, i]));
  const partIndex  = new Map(def.parts.map((p, i) => [p.id, i]));
  const defIndex   = new Map((def.deformers ?? []).map((d, i) => [d.id, i]));
  const idx = (map, id, kind) => {
    if (id == null) return -1;
    if (!map.has(id)) throw new Error(`Unknown ${kind}: ${id}`);
    return map.get(id);
  };

  // ── キーフォームバインディング ─────────────────────────────
  // オブジェクトごとの bindings [{param, keys}] を
  //   keyformBinding(band) → parameterBindingIndices → parameterBinding → keys
  // に展開する。parameterBinding はパラメータ単位で連続している必要がある。
  const pendingBindings = def.parameters.map(() => []);  // param -> [{keys, ref}]
  const bands = [];                                     // [{refs: [ref...]}]

  function addBand(bindings = []) {
    const refs = bindings.map(b => {
      const ref = { keys: b.keys, index: -1 };
      pendingBindings[idx(paramIndex, b.param, 'parameter')].push(ref);
      return ref;
    });
    bands.push({ refs });
    return bands.length - 1;
  }

  function keyformCount(bindings = []) {
    return bindings.reduce((n, b) => n * b.keys.length, 1);
  }

  const parts = def.parts.map(p => ({
    ...p,
    band:   addBand(p.bindings),
    parent: idx(partIndex, p.parent, 'part'),
  }));

  const deformers = (def.deformers ?? []).map(d => {
    const n = keyformCount(d.bindings);
    if (d.keyforms.length !== n) throw new Error(`${d.id}: keyforms ${d.keyforms.length} != ${n}`);
    return {
      ...d,
      band:           addBand(d.bindings),
      parentPart:     idx(partIndex, d.parentPart, 'part'),
      parentDeformer: idx(defIndex,  d.parentDeformer, 'deformer'),
    };
  });

  const meshes = def.artMeshes.map(m => {
    const n = keyformCount(m.bindings);
    if (m.keyforms.length !== n) throw new Error(`${m.id}: keyforms ${m.keyforms.length} != ${n}`);
    for (const kf of m.keyforms) {
      if (kf.positions.length !== m.uvs.length) throw new Error(`${m.id}: positions/uvs mismatch`);
    }
    return {
      ...m,
      band:           addBand(m.bindings),
      parentPart:     idx(partIndex, m.parentPart, 'part'),
      parentDeformer: idx(defIndex,  m.parentDeformer, 'deformer'),
    };
  });

  // parameterBinding / keys をパラメータ順に確定
  const pb = { keysBegin: [], keysCount: [] };
  const keys = [];
  const paramBindBegin = [], paramBindCount = [];
  pendingBindings.forEach(list => {
    paramBindBegin.push(pb.keysBegin.length);
    paramBindCount.push(list.length);
    for (const ref of list) {
      ref.index = pb.keysBegin.length;
      pb.keysBegin.push(keys.length);
      pb.keysCount.push(ref.keys.length);
      keys.push(...ref.keys);
    }
  });

  const pbIndices = [];
  const bandBegin = [], bandCount = [];
  for (const band of bands) {
    bandBegin.push(pbIndices.length);
    bandCount.push(band.refs.length);
    pbIndices.push(...band.refs.map(r => r.index));
  }

  // ── キーフォーム ──────────────────────────────────────────
  const kfPositions = [];
  const pushPositions = pts => {
    const begin = kfPositions.length;
    for (const [x, y] of pts) kfPositions.push(x, y);
    return begin;
  };

  const partKf = { drawOrders: [] };
  const partKfBegin = [], partKfCount = [];
  for (const p of parts) {
    partKfBegin.push(partKf.drawOrders.length);
    partKfCount.push(1);
    partKf.drawOrders.push(p.drawOrder ?? 500);
  }

  const warps = [], rots = [];
  const warpKf = { opacities: [], posBegin: [] };
  const rotKf  = { opacities: [], angles: [], ox: [], oy: [], scales: [], rx: [], ry: [] };
  const deformerSpecific = [];
  for (const d of deformers) {
    if (d.type === 'warp') {
      deformerSpecific.push(warps.length);
      warps.push({
        band: d.band, kfBegin: warpKf.opacities.length, kfCount: d.keyforms.length,
        vertexCount: (d.rows + 1) * (d.cols + 1), rows: d.rows, cols: d.cols,
      });
      for (const kf of d.keyforms) {
        if (kf.grid.length !== (d.rows + 1) * (d.cols + 1)) throw new Error(`${d.id}: grid size`);
        warpKf.opacities.push(kf.opacity ?? 1);
        warpKf.posBegin.push(pushPositions(kf.grid));
      }
    } else {
      deformerSpecific.push(rots.length);
      rots.push({ band: d.band, kfBegin: rotKf.opacities.length, kfCount: d.keyforms.length,
                  baseAngle: d.baseAngle ?? 0 });
      for (const kf of d.keyforms) {
        rotKf.opacities.push(kf.opacity ?? 1);
        rotKf.angles.push(kf.angle ?? 0);
        rotKf.ox.push(kf.origin[0]);
        rotKf.oy.push(kf.origin[1]);
        rotKf.scales.push(kf.scale ?? 1);
        rotKf.rx.push(0);
        rotKf.ry.push(0);
      }
    }
  }

  const amKf = { opacities: [], drawOrders: [], posBegin: [] };
  const uvs = [], posIndices = [];
  const am = { kfBegin: [], kfCount: [], uvBegin: [], idxBegin: [], idxCount: [] };
  for (const m of meshes) {
    am.kfBegin.push(amKf.opacities.length);
    am.kfCount.push(m.keyforms.length);
    for (const kf of m.keyforms) {
      amKf.opacities.push(kf.opacity ?? 1);
      amKf.drawOrders.push(kf.drawOrder ?? m.drawOrder ?? 500);
      amKf.posBegin.push(pushPositions(kf.positions));
    }
    am.uvBegin.push(uvs.length);
    for (const [u, v] of m.uvs) uvs.push(u, v);
    am.idxBegin.push(posIndices.length);
    am.idxCount.push(m.indices.length);
    posIndices.push(...m.indices);
  }

  // ── 描画順グループ ────────────────────────────────────────
  // グループ 0 = ルート。各パーツは自分の子を並べるグループを持つ。
  const dog = { begin: [], count: [], total: [], max: [], min: [] };
  const dogo = { types: [], indices: [], self: [] };
  const partGroup = new Map();
  let nextGroup = 1;
  parts.forEach((_, i) => partGroup.set(i, nextGroup++));
  const groupOrder = [{ parent: -1 }, ...parts.map((_, i) => ({ parent: i }))];

  const totalMeshes = partI => meshes.filter(m => m.parentPart === partI).length +
    parts.reduce((n, p, j) => n + (p.parent === partI ? totalMeshes(j) : 0), 0);

  groupOrder.forEach(({ parent }) => {
    const objs = [];
    parts.forEach((p, j) => { if (p.parent === parent) objs.push({ type: 1, index: j, self: partGroup.get(j), order: p.drawOrder ?? 500 }); });
    meshes.forEach((m, j) => { if (m.parentPart === parent) objs.push({ type: 0, index: j, self: -1, order: m.drawOrder ?? 500 }); });
    dog.begin.push(dogo.types.length);
    dog.count.push(objs.length);
    dog.total.push(totalMeshes(parent));
    const orders = objs.map(o => o.order);
    dog.max.push(orders.length ? Math.max(...orders) : 0);
    dog.min.push(orders.length ? Math.min(...orders) : 0);
    for (const o of objs) {
      dogo.types.push(o.type);
      dogo.indices.push(o.index);
      dogo.self.push(o.self);
    }
  });

  // ── バイナリ出力 ──────────────────────────────────────────
  const counts = [
    parts.length, deformers.length, warps.length, rots.length, meshes.length,
    def.parameters.length,
    partKf.drawOrders.length, warpKf.opacities.length, rotKf.opacities.length, amKf.opacities.length,
    kfPositions.length, pbIndices.length, bandBegin.length, pb.keysBegin.length, keys.length,
    uvs.length, posIndices.length,
    0,                                   // drawable masks
    dog.begin.length, dogo.types.length,
    0, 0, 0,                             // glue / glue info / glue keyforms
  ];

  const w = new Writer();
  const sot = [];
  const section = (kind, values, { align = true } = {}) => {
    if (align) w.align(ALIGN);
    sot.push(BODY_OFFSET + w.length);
    w[kind](values);
  };
  const i32  = v => section('i32', v);
  const f32  = v => section('f32', v);
  const u8   = v => section('u8', v);
  const i16  = v => section('i16', v);
  const ids  = v => section('ids', v, { align: false });
  const rt   = n => section('zeros', n * RUNTIME_UNIT);

  // Count Info
  sot.push(BODY_OFFSET + w.length);
  w.i32(counts);
  w.zeros(128 - counts.length * 4);

  // Canvas Info
  const c = def.canvas;
  sot.push(BODY_OFFSET + w.length);
  w.f32([c.pixelsPerUnit, c.originX, c.originY, c.width, c.height]);
  w.u8([0]);
  w.zeros(64 - 21);

  // Parts
  rt(parts.length);
  ids(parts.map(p => p.id));
  i32(parts.map(p => p.band));
  i32(partKfBegin);
  i32(partKfCount);
  i32(parts.map(() => 1));             // visible
  i32(parts.map(() => 1));             // enabled
  i32(parts.map(p => p.parent));

  // Deformers
  rt(deformers.length);
  ids(deformers.map(d => d.id));
  i32(deformers.map(d => d.band));
  i32(deformers.map(() => 1));
  i32(deformers.map(() => 1));
  i32(deformers.map(d => d.parentPart));
  i32(deformers.map(d => d.parentDeformer));
  i32(deformers.map(d => (d.type === 'warp' ? DEFORMER_WARP : DEFORMER_ROTATION)));
  i32(deformerSpecific);

  // Warp deformers
  i32(warps.map(x => x.band));
  i32(warps.map(x => x.kfBegin));
  i32(warps.map(x => x.kfCount));
  i32(warps.map(x => x.vertexCount));
  i32(warps.map(x => x.rows));
  i32(warps.map(x => x.cols));

  // Rotation deformers
  i32(rots.map(x => x.band));
  i32(rots.map(x => x.kfBegin));
  i32(rots.map(x => x.kfCount));
  f32(rots.map(x => x.baseAngle));

  // Art meshes
  rt(meshes.length); rt(meshes.length); rt(meshes.length); rt(meshes.length);
  ids(meshes.map(m => m.id));
  i32(meshes.map(m => m.band));
  i32(am.kfBegin);
  i32(am.kfCount);
  i32(meshes.map(() => 1));
  i32(meshes.map(() => 1));
  i32(meshes.map(m => m.parentPart));
  i32(meshes.map(m => m.parentDeformer));
  i32(meshes.map(m => m.texture ?? 0));
  u8(meshes.map(() => FLAG_DOUBLE_SIDED));
  i32(meshes.map(m => m.uvs.length));  // vertex counts
  i32(am.uvBegin);
  i32(am.idxBegin);
  i32(am.idxCount);
  i32(meshes.map(() => 0));            // mask begin
  i32(meshes.map(() => 0));            // mask count

  // Parameters
  rt(def.parameters.length);
  ids(def.parameters.map(p => p.id));
  f32(def.parameters.map(p => p.max));
  f32(def.parameters.map(p => p.min));
  f32(def.parameters.map(p => p.default ?? 0));
  i32(def.parameters.map(() => 0));    // repeat
  i32(def.parameters.map(() => 1));    // decimal places
  i32(paramBindBegin);
  i32(paramBindCount);

  f32(partKf.drawOrders);
  f32(warpKf.opacities);  i32(warpKf.posBegin);
  f32(rotKf.opacities); f32(rotKf.angles); f32(rotKf.ox); f32(rotKf.oy);
  f32(rotKf.scales); i32(rotKf.rx); i32(rotKf.ry);
  f32(amKf.opacities); f32(amKf.drawOrders); i32(amKf.posBegin);
  f32(kfPositions);
  i32(pbIndices);
  i32(bandBegin); i32(bandCount);
  i32(pb.keysBegin); i32(pb.keysCount);
  f32(keys);
  f32(uvs);
  i16(posIndices);
  i32([]);                                               // drawable masks
  i32(dog.begin); i32(dog.count); i32(dog.total); i32(dog.max); i32(dog.min);
  i32(dogo.types); i32(dogo.indices); i32(dogo.self);
  rt(0); ids([]); for (let k = 0; k < 7; k++) i32([]);   // glue
  f32([]); i16([]);                                      // glue info
  f32([]);                                               // glue keyforms
  w.align(ALIGN);

  const out = Buffer.alloc(BODY_OFFSET + w.length);
  out.write('MOC3', 0, 'ascii');
  out.writeUInt8(1, 4);                // version: V3.00
  out.writeUInt8(0, 5);                // little endian
  sot.forEach((off, i) => out.writeUInt32LE(off, HEADER_SIZE + i * 4));
  if (sot.length > SOT_COUNT) throw new Error('SOT overflow');
  w.buffer().copy(out, BODY_OFFSET);
  return out;
}

class Writer {
  constructor() { this._chunks = []; this.length = 0; }
  _push(buf) { this._chunks.push(buf); this.length += buf.length; }
  zeros(n) { if (n > 0) this._push(Buffer.alloc(n)); }
  align(a) { this.zeros((a - (this.length % a)) % a); }
  i32(v) { const b = Buffer.alloc(v.length * 4); v.forEach((x, i) => b.writeInt32LE(x, i * 4)); this._push(b); }
  f32(v) { const b = Buffer.alloc(v.length * 4); v.forEach((x, i) => b.writeFloatLE(x, i * 4)); this._push(b); }
  i16(v) { const b = Buffer.alloc(v.length * 2); v.forEach((x, i) => b.writeInt16LE(x, i * 2)); this._push(b); }
  u8(v)  { this._push(Buffer.from(v)); }
  ids(v) {
    const b = Buffer.alloc(v.length * 64);
    v.forEach((s, i) => {
      if (Buffer.byteLength(s) >= 64) throw new Error(`ID too long: ${s}`);
      b.write(s, i * 64, 'utf8');
    });
    this._push(b);
  }
  buffer() { return Buffer.concat(this._chunks); }
}

module.exports = { buildMoc3 };
