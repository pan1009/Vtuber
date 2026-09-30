import { Live2DCharacter } from './live2dCharacter.js';
import { FaceTracker }     from './faceTracker.js';
import { AudioTracker }    from './audioTracker.js';

// モデルの .model3.json ファイルへのパス（自分のモデルを配置したら変更）
const MODEL_PATH = 'models/test_owl/test_owl.model3.json';

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

// スマホの回転・アドレスバーの出し入れにも追従する
function onResize() {
  app.renderer.resize(window.innerWidth, window.innerHeight);
  character.resize();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 300));

// ── Character & Trackers ──────────────────────────────────────
const character    = new Live2DCharacter(app);
const faceTracker  = new FaceTracker();
const audioTracker = new AudioTracker();

// カメラ・マイクの許可を待たずにモデルを表示する
character.load(MODEL_PATH).catch(e => {
  console.warn('Live2D モデルのロードに失敗:', e);
  showMessage('モデルを読み込めませんでした: ' + e.message);
});

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
  // iOS Safari はユーザー操作の中で作らないと音が止まったままになる
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx({ latencyHint: 'interactive' });
  audioCtx.resume();

  document.getElementById('start-screen').style.display = 'none';
  setStatus('face',  false);
  setStatus('audio', false);

  if (!navigator.mediaDevices?.getUserMedia) {
    showMessage('このブラウザ（または http 接続）ではカメラ・マイクを使えません。https で開いてください。');
    return;
  }

  const { video, audio, errors } = await getMediaStreams();
  if (errors.length) showMessage('カメラ/マイクを使えません: ' + errors.join(' / '));

  if (audio) {
    audioTracker.init(audioCtx, audio)
      .then(() => {
        setStatus('audio', true);
        if (!audioTracker.canShiftPitch) disablePitchUI();
        applyVoiceUI();
      })
      .catch(e => showMessage('マイクの初期化に失敗: ' + e.message));
  }
  if (video) {
    faceTracker.init(video)
      .then(() => setStatus('face', true))
      .catch(e => showMessage('顔認識の初期化に失敗: ' + e.message));
  }
});

// カメラとマイクを 1 回の許可でまとめて取得（片方だけ失敗しても、もう片方は使う）
async function getMediaStreams() {
  const videoOpts = { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } };
  const audioOpts = { echoCancellation: true, noiseSuppression: true };
  const gum = c => navigator.mediaDevices.getUserMedia(c);

  try {
    const s = await gum({ video: videoOpts, audio: audioOpts });
    return {
      video:  new MediaStream(s.getVideoTracks()),
      audio:  new MediaStream(s.getAudioTracks()),
      errors: [],
    };
  } catch {
    const [v, a] = await Promise.allSettled([gum({ video: videoOpts }), gum({ audio: audioOpts })]);
    const errors = [];
    if (v.status === 'rejected') errors.push('カメラ: ' + v.reason.message);
    if (a.status === 'rejected') errors.push('マイク: ' + a.reason.message);
    return {
      video: v.status === 'fulfilled' ? v.value : null,
      audio: a.status === 'fulfilled' ? a.value : null,
      errors,
    };
  }
}

// ── Threshold slider ───────────────────────────────────────────
const slider = document.getElementById('threshold-slider');
const label  = document.getElementById('threshold-value');
slider.addEventListener('input', () => {
  audioTracker.threshold = parseFloat(slider.value);
  label.textContent      = slider.value;
});

// ── Voice changer ──────────────────────────────────────────────
const VOICE_PRESETS = {
  none:   { semitones:   0, robot: false },
  high:   { semitones:   5, robot: false },
  cute:   { semitones:   8, robot: false },
  low:    { semitones:  -5, robot: false },
  giant:  { semitones: -10, robot: false },
  robot:  { semitones:   0, robot: true  },
};

const presetSel    = document.getElementById('voice-preset');
const pitchSlider  = document.getElementById('pitch-slider');
const pitchLabel   = document.getElementById('pitch-value');
const robotCheck   = document.getElementById('robot-check');
const monitorCheck = document.getElementById('monitor-check');

function applyVoiceUI() {
  const semitones = parseInt(pitchSlider.value, 10);
  pitchLabel.textContent = (semitones > 0 ? '+' : '') + semitones;
  audioTracker.setVoice({
    semitones,
    robot:   robotCheck.checked,
    monitor: monitorCheck.checked,
  });
}

function disablePitchUI() {
  pitchSlider.disabled = true;
  pitchSlider.value    = 0;
  pitchLabel.textContent = '非対応';
}

presetSel.addEventListener('change', () => {
  const p = VOICE_PRESETS[presetSel.value];
  if (!p) return;
  if (!pitchSlider.disabled) pitchSlider.value = p.semitones;
  robotCheck.checked = p.robot;
  applyVoiceUI();
});

// 手で調整したらプリセット表示を「カスタム」にする
for (const el of [pitchSlider, robotCheck]) {
  el.addEventListener('input', () => {
    presetSel.value = 'custom';
    applyVoiceUI();
  });
}
monitorCheck.addEventListener('change', applyVoiceUI);

// ── Utilities ──────────────────────────────────────────────────
function showMessage(text) {
  const el = document.getElementById('message');
  el.textContent = text;
  el.hidden = false;
}

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
