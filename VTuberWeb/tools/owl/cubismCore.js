// Node.js 上で Live2D Cubism Core を読み込み、moc3 を検証するためのヘルパー
// live2dcubismcore.min.js は public/ 直下（SETUP.md Step 1）から読み込む。

const fs   = require('fs');
const path = require('path');

const DEFAULT_CORE = path.join(__dirname, '../../public/live2dcubismcore.min.js');

async function loadCore(corePath = process.env.CUBISM_CORE ?? DEFAULT_CORE) {
  if (!fs.existsSync(corePath)) {
    throw new Error(`Cubism Core が見つかりません: ${corePath}\n(SETUP.md Step 1 を参照、または CUBISM_CORE で指定)`);
  }
  const src = fs.readFileSync(corePath, 'utf8');
  // Emscripten の Node 判定用に __dirname / require を渡す
  // eslint-disable-next-line no-new-func
  const core = new Function('__dirname', '__filename', 'require', `${src}\nreturn Live2DCubismCore;`)(
    path.dirname(corePath), corePath, require,
  );

  // ランタイムの初期化は非同期なので、API が呼べるようになるまで待つ
  for (let i = 0; i < 200; i++) {
    try {
      core.Version.csmGetVersion();
      return core;
    } catch {
      await new Promise(r => setTimeout(r, 10));
    }
  }
  throw new Error('Cubism Core の初期化がタイムアウトしました');
}

/** moc3 を読み込み、整合性チェックとモデル初期化を行う */
function openModel(core, mocBuffer) {
  const ab = mocBuffer.buffer.slice(mocBuffer.byteOffset, mocBuffer.byteOffset + mocBuffer.byteLength);
  const logs = [];
  core.Logging.csmSetLogFunction(msg => logs.push(msg));

  const moc = core.Moc.fromArrayBuffer(ab);
  if (!moc) throw new Error(`Moc の読み込みに失敗\n${logs.join('\n')}`);
  const consistent = moc.hasMocConsistency ? moc.hasMocConsistency(ab) : 1;
  if (!consistent) throw new Error(`moc3 の整合性チェックに失敗\n${logs.join('\n')}`);

  const model = core.Model.fromMoc(moc);
  if (!model) throw new Error(`Model の初期化に失敗\n${logs.join('\n')}`);
  return { moc, model, logs };
}

/** パラメータを設定して更新し、描画オブジェクトの頂点を返す */
function evaluate(model, values = {}) {
  const p = model.parameters;
  for (let i = 0; i < p.count; i++) {
    p.values[i] = values[p.ids[i]] ?? p.defaultValues[i];
  }
  model.update();
  const d = model.drawables;
  const out = {};
  for (let i = 0; i < d.count; i++) {
    out[d.ids[i]] = {
      vertices:    Array.from(d.vertexPositions[i]),
      opacity:     d.opacities[i],
      renderOrder: d.renderOrders[i],
    };
  }
  return out;
}

module.exports = { loadCore, openModel, evaluate };
