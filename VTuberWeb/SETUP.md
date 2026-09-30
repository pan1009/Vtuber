# Live2D モデル セットアップ手順

## 前提条件
- Node.js がインストール済み
- Live2D モデルファイル一式（`.moc3` + テクスチャ + `.model3.json`）が手元にある

---

## Step 1 — Live2D Cubism Core を配置する

1. 以下の URL から **Cubism SDK for Web** をダウンロード  
   https://www.live2d.com/download/cubism-sdk/download-web/

2. ZIP を展開し、以下のファイルを `public/` 直下にコピー

   ```
   CubismSdkForWeb-*/Core/live2dcubismcore.min.js
         ↓ コピー先
   VTuberWeb/public/live2dcubismcore.min.js
   ```

---

## テスト用フクロウモデル（自分のモデルが無くても動作確認できる）

`public/models/test_owl/` に、スクリプトで生成したテスト用のフクロウモデルが入っている。  
`MODEL_PATH` の初期値はこのモデルなので、Step 1 だけ済ませればすぐに Step 5 へ進める。

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

`verify.js` は `public/live2dcubismcore.min.js`（Step 1）を使う。  
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
  angleX:    'ParamAngleX',      // 頭：左右傾き
  angleY:    'ParamAngleY',      // 頭：左右向き
  angleZ:    'ParamAngleZ',      // 頭：回転
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
- [ ] 頭を左右・上下に動かすとモデルが追従する
- [ ] まばたきをするとモデルの目が閉じる
- [ ] 声を出すと口が開く（音量メーターも反応することを確認）
- [ ] 眉を動かすとモデルの眉が動く

---

## トラブルシューティング

### モデルが表示されない
- ブラウザのコンソール（F12）でエラーメッセージを確認する
- `live2dcubismcore.min.js` が `public/` 直下に存在するか確認する
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
