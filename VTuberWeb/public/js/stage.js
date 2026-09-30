import { Live2DCharacter } from './live2dCharacter.js';
import { MODEL_PATH, STAGE_CHANNEL, createPixiApp } from './config.js';

// ゲスト画面：ホスト画面（index.html）から届いた動きでフクロウを表示するだけ
//   stage.html?bg=00ff00 で背景色を変えられる（クロマキー用など）

const bgParam = new URLSearchParams(location.search).get('bg');
const bgColor = /^[0-9a-f]{6}$/i.test(bgParam ?? '') ? parseInt(bgParam, 16) : 0x0d0d2e;
document.body.style.background = '#' + bgColor.toString(16).padStart(6, '0');

const app       = createPixiApp(document.getElementById('canvas'), bgColor);
const character = new Live2DCharacter(app, { portraitHeight: 1 });

character.load(MODEL_PATH).catch(e => {
  console.warn('Live2D モデルのロードに失敗:', e);
  showHint('モデルを読み込めませんでした: ' + e.message);
});

window.addEventListener('resize', () => {
  app.renderer.resize(window.innerWidth, window.innerHeight);
  character.resize();
});

// ── ホスト画面との通信 ──────────────────────────────────────────
const channel = new BroadcastChannel(STAGE_CHANNEL);
let lastParamsAt = 0;

channel.onmessage = ({ data }) => {
  if (data.type !== 'params') return;
  character.setParams(data.params);
  lastParamsAt = performance.now();
};

// 生きていることをホストに知らせる（ホストはこれを見て動きを送り始める）
const hello = () => channel.postMessage({ type: 'stage-hello' });
hello();
setInterval(hello, 1000);
window.addEventListener('pagehide', () => channel.postMessage({ type: 'stage-bye' }));

// ── 案内表示 ────────────────────────────────────────────────────
const hint = document.getElementById('hint');

function showHint(text) {
  hint.textContent = text;
  hint.hidden = false;
}

// ホストから動きが届いていないときだけ案内を出す（全画面中は出さない）
setInterval(() => {
  const receiving = performance.now() - lastParamsAt < 2000;
  if (!receiving) {
    showHint('ホスト画面の接続待ち… ／ ダブルクリックで全画面');
  } else if (!document.fullscreenElement) {
    showHint('ダブルクリックで全画面');
  } else {
    hint.hidden = true;
  }
}, 500);

// ── 全画面・カーソル ─────────────────────────────────────────────
document.addEventListener('dblclick', toggleFullscreen);
document.addEventListener('keydown', e => { if (e.key === 'f') toggleFullscreen(); });

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
}

// 2 秒動かさなければマウスカーソルを隠す
let cursorTimer = null;
document.addEventListener('mousemove', () => {
  document.body.classList.remove('hide-cursor');
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(() => document.body.classList.add('hide-cursor'), 2000);
});
