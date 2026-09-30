// 生成したテスト用フクロウモデルを Cubism Core で読み込み、各パラメータの動作を検証する
//
//   node tools/owl/verify.js
//
// public/live2dcubismcore.min.js が必要（CUBISM_CORE 環境変数でパス指定も可）。

const fs   = require('fs');
const path = require('path');
const { loadCore, openModel, evaluate } = require('./cubismCore');
const { OUT_DIR, MODEL } = require('./generate');

// app 側 (public/js/live2dCharacter.js) が操作するパラメータ
const APP_PARAMS = [
  'ParamAngleX', 'ParamAngleY', 'ParamAngleZ',
  'ParamEyeLOpen', 'ParamEyeROpen', 'ParamMouthOpenY',
  'ParamBrowLY', 'ParamBrowRY',
];

let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failed++;
}

const bounds = vs => {
  const xs = vs.filter((_, i) => i % 2 === 0), ys = vs.filter((_, i) => i % 2 === 1);
  return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2,
           h: Math.max(...ys) - Math.min(...ys) };
};

(async () => {
  const core = await loadCore();
  const moc3 = fs.readFileSync(path.join(OUT_DIR, `${MODEL}.moc3`));
  const { model } = openModel(core, moc3);
  check('moc3 の読み込み・整合性チェック', true, `Core ${core.Version.csmGetVersion().toString(16)}`);

  const ids = Array.from(model.parameters.ids);
  for (const id of APP_PARAMS) check(`パラメータ ${id} が存在`, ids.includes(id));

  const model3 = JSON.parse(fs.readFileSync(path.join(OUT_DIR, `${MODEL}.model3.json`), 'utf8'));
  for (const f of [model3.FileReferences.Moc, ...model3.FileReferences.Textures]) {
    check(`model3.json の参照ファイル ${f}`, fs.existsSync(path.join(OUT_DIR, f)));
  }

  const base = evaluate(model);
  const at = values => evaluate(model, values);
  const B = id => bounds(base[`ArtMesh_${id}`].vertices);
  const V = (r, id) => bounds(r[`ArtMesh_${id}`].vertices);

  // 出力座標は Y 上向き
  let r = at({ ParamEyeLOpen: 0 });
  check('ParamEyeLOpen=0 で左目が閉じる', V(r, 'EyeL').h < B('EyeL').h * 0.2 && r.ArtMesh_EyeLidL.opacity > 0.99);
  check('ParamEyeLOpen=0 で右目は開いたまま', Math.abs(V(r, 'EyeR').h - B('EyeR').h) < 1e-6);
  r = at({ ParamEyeROpen: 0 });
  check('ParamEyeROpen=0 で右目が閉じる', V(r, 'EyeR').h < B('EyeR').h * 0.2);
  check('目を開いている時はまぶたが透明', base.ArtMesh_EyeLidL.opacity < 0.01);

  r = at({ ParamMouthOpenY: 1 });
  check('ParamMouthOpenY=1 で下くちばしが下がる', V(r, 'BeakLower').cy < B('BeakLower').cy - 0.02);
  check('ParamMouthOpenY=1 で口の中が見える', V(r, 'Mouth').h > B('Mouth').h * 5);

  r = at({ ParamBrowLY: 1 });
  check('ParamBrowLY=1 で左眉が上がる', V(r, 'BrowL').cy > B('BrowL').cy + 0.01);
  r = at({ ParamBrowRY: -1 });
  check('ParamBrowRY=-1 で右眉が下がる', V(r, 'BrowR').cy < B('BrowR').cy - 0.01);

  r = at({ ParamAngleX: 30 });
  check('ParamAngleX=30 で顔が画面右を向く', V(r, 'Face').cx > B('Face').cx + 0.01);
  check('ParamAngleX=30 で体は動かない', Math.abs(V(r, 'Body').cx - B('Body').cx) < 1e-6);
  r = at({ ParamAngleY: 30 });
  check('ParamAngleY=30 で顔が上を向く', V(r, 'Face').cy > B('Face').cy + 0.01);
  r = at({ ParamAngleZ: 30 });
  const headTop = rr => rr.ArtMesh_Head.vertices[2 * 2];  // 上辺中央の頂点の x
  check('ParamAngleZ=30 で頭が反時計回りに傾く', headTop(r) < headTop(base) - 0.01);

  r = at({ ParamAngleX: 30, ParamAngleY: -30, ParamAngleZ: -30, ParamMouthOpenY: 1, ParamEyeLOpen: 0 });
  check('全パラメータ同時変更で NaN が出ない',
    Object.values(r).every(d => d.vertices.every(Number.isFinite)));

  console.log(failed ? `\n${failed} 件失敗` : '\nすべて成功');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
