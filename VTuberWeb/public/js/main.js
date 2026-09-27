import { Live2DCharacter } from './live2dCharacter.js';
import { FaceTracker }     from './faceTracker.js';
import { AudioTracker }    from './audioTracker.js';

// モデルの .model3.json ファイルへのパス（モデル配置後に変更）
const MODEL_PATH = 'models/your_model/your_model.model3.json';

// ── Pixi.js ──────────────────────────────────────────────────
const app = new PIXI.Application({
  view:            document.getElementById('canvas'),
  width:           window.innerWidth,
  height:          window.innerHeight,
  antialias:       true,
  backgroundColor: 0x0d0d2e,
  resolution:      Math.min(window.devicePixelRatio, 2),
  autoDensity:     true,
});

window.addEventListener('resize', () => {
  app.renderer.resize(window.innerWidth, window.innerHeight);
  character.resize();
});

// ── Character & Trackers ──────────────────────────────────────
const character    = new Live2DCharacter(app);
const faceTracker  = new FaceTracker();
const audioTracker = new AudioTracker();

// ── Tracking state ─────────────────────────────────────────────
const state = {
  mouthTarget: 0,
  mouthSmooth: 0,
  head:  { x: 0, y: 0, z: 0 },
  eye:   { left: 0, right: 0 },
  brow:  { innerUp: 0, downLeft: 0, downRight: 0 },
};

// ── Audio callback ─────────────────────────────────────────────
const volBar = document.getElementById('vol-bar');
audioTracker.onUpdate = (rms, isAbove) => {
  state.mouthTarget = isAbove
    ? Math.min(rms / (audioTracker.threshold * 4), 1.0)
    : 0;

  const pct = Math.min(rms / 0.1 * 100, 100);
  volBar.style.width      = pct + '%';
  volBar.style.background = isAbove ? '#4ade80' : '#60a5fa';
};

// ── Face callback ──────────────────────────────────────────────
faceTracker.onUpdate = ({ matrix, blendshapes }) => {
  state.head = eulerFromMatrix(matrix);

  const get = name => blendshapes.find(b => b.categoryName === name)?.score ?? 0;
  state.eye  = { left: get('eyeBlinkLeft'), right: get('eyeBlinkRight') };
  state.brow = {
    innerUp:   get('browInnerUp'),
    downLeft:  get('browDownLeft'),
    downRight: get('browDownRight'),
  };

  setStatus('face', true);
};

faceTracker.onLost = () => setStatus('face', false);

// ── Render loop ────────────────────────────────────────────────
app.ticker.add(() => {
  state.mouthSmooth += (state.mouthTarget - state.mouthSmooth) * 0.25;

  character.setHeadRotation(state.head.x, state.head.y, state.head.z);
  character.setEyeBlink(state.eye.left, state.eye.right);
  character.setMouthOpen(state.mouthSmooth);
  character.setBrow(state.brow.innerUp, state.brow.downLeft, state.brow.downRight);
});

// ── Start button ───────────────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', async () => {
  document.getElementById('start-screen').style.display = 'none';
  setStatus('face',  false);
  setStatus('audio', false);

  try {
    await Promise.all([
      faceTracker.init().then(() => setStatus('face',  true)),
      audioTracker.init().then(() => setStatus('audio', true)),
    ]);
  } catch (e) {
    alert('カメラ/マイクのアクセスが必要です:\n' + e.message);
    return;
  }

  character.load(MODEL_PATH).catch(e =>
    console.warn('Live2D モデルのロードに失敗:', e)
  );
});

// ── Threshold slider ───────────────────────────────────────────
const slider = document.getElementById('threshold-slider');
const label  = document.getElementById('threshold-value');
slider.addEventListener('input', () => {
  audioTracker.threshold = parseFloat(slider.value);
  label.textContent      = slider.value;
});

// ── Utilities ──────────────────────────────────────────────────
function setStatus(type, ok) {
  const el = document.getElementById(`status-${type}`);
  if (!el) return;
  el.textContent = ok ? '●' : '○';
  el.style.color = ok ? '#4ade80' : '#f87171';
}

// MediaPipe の列優先 4x4 行列から YXZ オイラー角（ラジアン）を取得
function eulerFromMatrix(data) {
  const m12 = data[9], m02 = data[8], m22 = data[10];
  const m10 = data[1], m11 = data[5], m20 = data[2], m00 = data[0];
  const x = Math.asin(-Math.max(-1, Math.min(1, m12)));
  return Math.abs(m12) < 0.9999999
    ? { x, y: Math.atan2(m02, m22), z: Math.atan2(m10, m11) }
    : { x, y: Math.atan2(-m20, m00), z: 0 };
}
