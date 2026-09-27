import { Live2DCharacter } from './live2dCharacter.js';
import { FaceTracker }     from './faceTracker.js';
import { AudioTracker }    from './audioTracker.js';

// モデルの .model3.json ファイルへのパス（モデル配置後に変更してください）
const MODEL_PATH = 'models/your_model/your_model.model3.json';

// ── Pixi.js Setup ─────────────────────────────────────────────
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

// ── State ─────────────────────────────────────────────────────
let mouthTarget  = 0;
let mouthCurrent = 0;
let headEuler    = { x: 0, y: 0, z: 0 };
let eyeBlink     = { left: 0, right: 0 };
let eyebrow      = { browInnerUp: 0, browDownLeft: 0, browDownRight: 0 };

// ── Audio → mouth ─────────────────────────────────────────────
audioTracker.onUpdate = (rms, isAbove) => {
  mouthTarget = isAbove ? Math.min(rms / (audioTracker.threshold * 4), 1.0) : 0;

  const pct = Math.min(rms / 0.1 * 100, 100);
  document.getElementById('vol-bar').style.width      = pct + '%';
  document.getElementById('vol-bar').style.background = isAbove ? '#4ade80' : '#60a5fa';
};

// ── Face → params ─────────────────────────────────────────────
faceTracker.onUpdate = ({ matrix, blendshapes }) => {
  headEuler = eulerFromMatrix(matrix);

  const get = name => blendshapes.find(b => b.categoryName === name)?.score ?? 0;
  eyeBlink = { left: get('eyeBlinkLeft'), right: get('eyeBlinkRight') };
  eyebrow  = {
    browInnerUp:   get('browInnerUp'),
    browDownLeft:  get('browDownLeft'),
    browDownRight: get('browDownRight'),
  };

  setStatus('face', true);
};

faceTracker.onLost = () => setStatus('face', false);

// ── スムージングループ ─────────────────────────────────────────
app.ticker.add(() => {
  mouthCurrent += (mouthTarget - mouthCurrent) * 0.25;

  character.setHeadRotation(headEuler.x, headEuler.y, headEuler.z);
  character.setEyeBlink(eyeBlink.left, eyeBlink.right);
  character.setMouthOpen(mouthCurrent);
  character.setEyebrow(eyebrow.browInnerUp, eyebrow.browDownLeft, eyebrow.browDownRight);
});

// ── Start button ──────────────────────────────────────────────
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
    console.warn('Live2D モデルのロードに失敗しました（モデル配置後に再試行してください）:', e)
  );
});

// ── Threshold slider ──────────────────────────────────────────
const slider = document.getElementById('threshold-slider');
const label  = document.getElementById('threshold-value');
slider.addEventListener('input', () => {
  audioTracker.threshold = parseFloat(slider.value);
  label.textContent = slider.value;
});

// ── Helpers ───────────────────────────────────────────────────
function setStatus(type, ok) {
  const el = document.getElementById(`status-${type}`);
  if (!el) return;
  el.textContent = ok ? '●' : '○';
  el.style.color = ok ? '#4ade80' : '#f87171';
}

// MediaPipe の列優先 4x4 行列から YXZ オイラー角（ラジアン）を取得
function eulerFromMatrix(data) {
  // column-major: index = col * 4 + row
  const m12 = data[9];
  const m02 = data[8];
  const m22 = data[10];
  const m10 = data[1];
  const m11 = data[5];
  const m20 = data[2];
  const m00 = data[0];

  const x = Math.asin(-Math.max(-1, Math.min(1, m12)));
  if (Math.abs(m12) < 0.9999999) {
    return { x, y: Math.atan2(m02, m22), z: Math.atan2(m10, m11) };
  }
  return { x, y: Math.atan2(-m20, m00), z: 0 };
}
