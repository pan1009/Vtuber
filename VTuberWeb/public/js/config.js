// ホスト画面（index.html）とゲスト画面（stage.html）で共通の設定

// モデルの .model3.json ファイルへのパス（自分のモデルを配置したら変更）
export const MODEL_PATH = 'models/test_owl/test_owl.model3.json';

// ホスト画面 → ゲスト画面の通信に使う BroadcastChannel の名前
export const STAGE_CHANNEL = 'vtuber-owl-stage';

// Pixi.js のアプリを作る（両画面で同じ設定）
export function createPixiApp(canvas, backgroundColor = 0x0d0d2e) {
  return new PIXI.Application({
    view:            canvas,
    width:           window.innerWidth,
    height:          window.innerHeight,
    antialias:       true,
    backgroundColor,
    resolution:      Math.min(window.devicePixelRatio, 2),
    autoDensity:     true,
  });
}
