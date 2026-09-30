# Live2D モデル セットアップ手順

## 前提条件
- Node.js がインストール済み
- Live2D モデルファイル一式（`.moc3` + テクスチャ + `.model3.json`）が手元にある

---

## Step 1 — Live2D Cubism Core について

アプリ（`index.html` / `test.html`）は Cubism Core を Live2D 公式の配布 URL から読み込むので、配置は不要。

```
https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js
```

検証スクリプト（`tools/owl/verify.js`）を使う場合のみ、ローカルにダウンロードしておく（git 管理外）。

```bash
curl -o VTuberWeb/public/live2dcubismcore.min.js \
  https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js
```

---

## Web に公開する（GitHub Pages・無料）

`main` ブランチに push すると、GitHub Actions（`.github/workflows/pages.yml`）が `VTuberWeb/public/` を GitHub Pages に公開する。

- 公開 URL: https://pan1009.github.io/Vtuber/
- テストページ: https://pan1009.github.io/Vtuber/test.html
- HTTPS なので、PC・iPhone どちらからでもカメラ・マイクが使える（証明書の警告も出ない）
- 手動で再公開: GitHub の Actions タブ →「Deploy to GitHub Pages」→「Run workflow」

> 公開リポジトリのため、`public/` に置いたモデルは誰でもダウンロードできる。  
> 購入したモデルなど再配布できないものは置かないこと。

---

## テスト用フクロウモデル（自分のモデルが無くても動作確認できる）

`public/models/test_owl/` に、スクリプトで生成したテスト用のフクロウモデルが入っている。  
`MODEL_PATH` の初期値はこのモデルなので、すぐに Step 5 へ進める（公開版ならそのまま開くだけ）。

| パラメータ | 動き |
|-----------|------|
| `ParamAngleX` / `ParamAngleY` | 顔の向き（左右 / 上下） |
| `ParamAngleZ` | 頭の傾き |
| `ParamEyeLOpen` / `ParamEyeROpen` | 左目 / 右目の開閉 |
| `ParamMouthOpenY` | くちばしの開閉 |
| `ParamBrowLY` / `ParamBrowRY` | 左眉 / 右眉の上下 |

### カメラ無しで確認する — `test.html`

サーバー起動後に `https://localhost:8443/test.html` を開くと、モデルの全パラメータをスライダーで動かせる。

- 別のモデルを確認: `test.html?model=models/your_owl/your_owl.model3.json`
- 初期値を指定: `test.html?ParamAngleX=30&ParamEyeLOpen=0`

自分のモデルのパラメータ ID を調べるのにも使える（Step 4）。

### モデルの再生成・検証

```bash
cd VTuberWeb
node tools/owl/generate.js   # public/models/test_owl/ を再生成
node tools/owl/verify.js     # Cubism Core で読み込み、各パラメータの動作を検証
```

`verify.js` は `public/live2dcubismcore.min.js`（Step 1 でダウンロード）を使う。  
形や動きは `tools/owl/generate.js` の `SHAPES` / `MESHES` / `deformers` を編集して調整する。

---

## Step 2 — モデルファイルを配置する

`public/models/<モデル名>/` ディレクトリを作り、モデルファイルを一式コピーする。

```
VTuberWeb/public/models/
└── your_owl/                ← 任意のフォルダ名
    ├── your_owl.model3.json ← エントリポイント
    ├── your_owl.moc3
    ├── your_owl.physics3.json  （あれば）
    └── textures/
        └── texture_00.png
```

---

## Step 3 — モデルパスを設定する

`public/js/main.js` の先頭を編集する。

```js
// 変更前
const MODEL_PATH = 'models/your_model/your_model.model3.json';

// 変更後（Step 2 で付けたフォルダ名・ファイル名に合わせる）
const MODEL_PATH = 'models/your_owl/your_owl.model3.json';
```

---

## Step 4 — パラメータ ID を確認・調整する

モデルによってパラメータ ID が異なる場合がある。  
`public/js/live2dCharacter.js` の先頭の `PARAMS` を実際のモデルに合わせて変更する。

```js
const PARAMS = {
  angleX:    'ParamAngleX',      // 顔の向き：左右
  angleY:    'ParamAngleY',      // 顔の向き：上下
  angleZ:    'ParamAngleZ',      // 頭の傾き
  eyeLOpen:  'ParamEyeLOpen',    // 左目開閉
  eyeROpen:  'ParamEyeROpen',    // 右目開閉
  mouthOpen: 'ParamMouthOpenY',  // 口開き
  browLY:    'ParamBrowLY',      // 左眉上下
  browRY:    'ParamBrowRY',      // 右眉上下
};
```

パラメータ ID の確認方法：
- **Live2D Cubism Editor** でモデルを開き、「パラメータ」パネルで各パラメータの ID を確認する

---

## Step 5 — サーバーを起動する

```bash
cd VTuberWeb/server
npm install   # 初回のみ
npm start
```

起動後、以下の URL が表示される。

```
PC:     https://localhost:8443
iPhone: https://<ローカルIP>:8443  ← 同じ Wi-Fi なら iPhone からも接続可
```

---

## Step 6 — ブラウザで初回アクセスする

自己署名証明書のため、警告が表示される。

| ブラウザ | 操作 |
|---------|------|
| Chrome  | 「詳細設定」→「localhost にアクセスする（安全でない）」 |
| Safari  | 「詳細を表示」→「このWebサイトを閲覧する」 |
| iPhone Safari | 「詳細」→「Webサイトを表示」→ 設定アプリで証明書を信頼 |

---

## Step 7 — 動作確認チェックリスト

「はじめる」ボタンを押した後、以下をすべて確認する。

- [ ] HUD の「顔」インジケーターが **緑（●）** になる
- [ ] HUD の「マイク」インジケーターが **緑（●）** になる
- [ ] Live2D モデルが画面中央に表示される
- [ ] 頭を左右・上下に動かすとモデルが鏡のように同じ側へ向く（逆なら「⚙️ 感度・向きの設定」の「動きの向きを反転」で直す。設定はブラウザに保存される）
- [ ] まばたきをするとモデルの目が閉じる
- [ ] 声を出すと口が開く（音量メーターも反応することを確認）
- [ ] 眉を動かすとモデルの眉が動く
- [ ] 「🎤 ボイスチェンジャー」でプリセットを選び、「変えた声を再生する」を ON にすると声が変わって聞こえる（イヤホン推奨）

---

## ホスト画面 / ゲスト画面（タートル・トーク風）

1 台の PC で、ホスト（フクロウ役）用とゲスト（お客さん）用の 2 つのウィンドウを使う。

```
PC ──┬─ ホスト画面 index.html（手元のノート PC の画面）
     │    顔認識・ボイスチェンジ・ゲスト確認カメラの映像を見る
     └─ ゲスト画面 stage.html（TV / プロジェクターに全画面表示）
          フクロウだけを表示
```

### 準備
- ホスト用のカメラ（ノート PC の内蔵カメラなど）で、フクロウ役の顔を映す
- ゲスト確認用の USB カメラをお客さん側に向ける（無くても動く）
- TV / プロジェクターを HDMI で PC につなぎ、「拡張ディスプレイ」にする
- ブラウザは **Chrome** を使う（声の出力先を選べるのは Chrome / Edge のみ）

### 手順
1. ホスト画面を開いて「はじめる」→ カメラ・マイクを許可
2. 「📺 ゲスト画面」の「ゲスト画面を開く」を押す → 新しいウィンドウが開く
3. そのウィンドウを TV / プロジェクターへドラッグし、ダブルクリック（または `F` キー）で全画面にする
4. ホスト画面の HUD で「ゲスト画面」が緑（●）になっていることを確認
5. 「顔認識カメラ」「ゲスト確認カメラ」「声の入力（マイク）」（イヤホンのマイクなど）「声の出力先」（TV のスピーカーなど）を選ぶ
6. 「🎤 ボイスチェンジャー」で声を選び、「変えた声を再生する」を ON

- ゲスト画面の背景色は `stage.html?bg=00ff00` のように変えられる（クロマキー合成用など）
- 2 つのウィンドウは同じブラウザの BroadcastChannel で通信するので、サーバーもネット接続も不要（最初の読み込みを除く）
- ゲストの声は、ホストが同じ部屋で直接聞く想定

---

## ボイスチェンジャー

HUD の「🎤 ボイスチェンジャー」で設定する。

| 項目 | 内容 |
|------|------|
| プリセット | なし / 高い声 / かわいい声 / 低い声 / 巨人 / ロボット |
| 声の高さ | -12〜+12 半音（12 で 1 オクターブ） |
| ロボット声 | 50Hz のリングモジュレーションで機械っぽい声にする |
| 変えた声を再生する | 加工した声をスピーカー / イヤホンから出す（スピーカーだとハウリングする） |

- 配信では OBS の「ブラウザ」ソースや「アプリケーション音声キャプチャ」でブラウザの音を取り込む
- 口パクの判定は加工前の声で行うので、声を変えても口の動きは変わらない
- ピッチ変更は `js/pitchShifterWorklet.js`（AudioWorklet）で処理している

---

## トラブルシューティング

### スマホで表示されない / 動かない
- `https://` の URL（GitHub Pages）で開く。`http://` ではカメラ・マイクが使えない
- iPhone は Safari、Android は Chrome を使う。アプリ内ブラウザ（LINE・Instagram 等）はカメラが使えないことがある
- 許可を拒否した場合: iPhone は「設定 → Safari → カメラ / マイク」、Android は URL バー左のアイコンから許可し直して再読み込み
- カメラやマイクが使えなくてもモデル自体は表示される。画面上部の赤いメッセージで原因を確認する

### モデルが表示されない
- ブラウザのコンソール（F12）でエラーメッセージを確認する
- 開発者ツールの Network タブで `live2dcubismcore.min.js` の読み込みに失敗していないか確認する
- `MODEL_PATH` のファイル名・パスが実際のファイルと一致しているか確認する
- ファイルパスは大文字・小文字を区別するので注意

### パラメータが反応しない
- コンソールに `Unknown parameter: ParamXxx` のようなログが出ていないか確認する
- モデルの実際のパラメータ ID を Step 4 の方法で確認し `PARAMS` を修正する

### カメラ・マイクの許可ダイアログが出ない
- HTTPS でアクセスしているか確認する（HTTP では getUserMedia が使えない）
- ブラウザの設定でカメラ・マイクをブロックしていないか確認する

### 口が開かない / 過剰に開く
- HUD の「⚙️ 感度設定」でしきい値スライダーを調整する
- 静かな環境でしきい値を下げ、うるさい環境では上げる
