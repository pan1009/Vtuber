import { Live2DCharacter } from './live2dCharacter.js';
import { FaceTracker }     from './faceTracker.js';
import { AudioTracker }    from './audioTracker.js';
import { MODEL_PATH, STAGE_CHANNEL, createPixiApp } from './config.js';

// ホスト画面：顔認識・ボイスチェンジを行い、動きをゲスト画面（stage.html）へ送る

// ── Pixi.js ──────────────────────────────────────────────────
const app = createPixiApp(document.getElementById('canvas'));

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

  if (stageConnected) stage.postMessage({ type: 'params', params: character.params });
});

// ── Guest screen (stage.html) ──────────────────────────────────
// 同じブラウザの別ウィンドウと BroadcastChannel でやりとりする
const stage = new BroadcastChannel(STAGE_CHANNEL);
let stageConnected = false;
let stageLastSeen  = 0;

stage.onmessage = ({ data }) => {
  if (data.type === 'stage-hello') {
    stageLastSeen = performance.now();
    setStageStatus(true);
  } else if (data.type === 'stage-bye') {
    setStageStatus(false);
  }
};

// ゲスト画面は 1 秒ごとに hello を送ってくる。3 秒来なければ切断扱い
setInterval(() => {
  if (stageConnected && performance.now() - stageLastSeen > 3000) setStageStatus(false);
}, 1000);

function setStageStatus(ok) {
  stageConnected = ok;
  setStatus('stage', ok);
}

document.getElementById('open-stage-btn').addEventListener('click', () => {
  window.open('stage.html', 'owl-stage', 'popup,width=1280,height=720');
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
        updateDeviceLists();
      })
      .catch(e => showMessage('マイクの初期化に失敗: ' + e.message));
  }
  if (video) {
    faceCameraSel.dataset.current = video.getVideoTracks()[0]?.getSettings().deviceId ?? '';
    faceTracker.init(video)
      .then(() => setStatus('face', true))
      .catch(e => showMessage('顔認識の初期化に失敗: ' + e.message));
  }

  updateDeviceLists();
  navigator.mediaDevices.addEventListener?.('devicechange', updateDeviceLists);
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

// ── Head direction（動きの向きの反転。ブラウザに保存する）──────────
const INVERT_KEY = 'vtuber-owl-invert';
const invertChecks = {
  leftRight: document.getElementById('invert-lr'),
  upDown:    document.getElementById('invert-ud'),
  tilt:      document.getElementById('invert-tilt'),
};

try {
  Object.assign(character.invert, JSON.parse(localStorage.getItem(INVERT_KEY)) ?? {});
} catch { /* 保存できない環境では毎回初期値 */ }

for (const [key, el] of Object.entries(invertChecks)) {
  el.checked = character.invert[key];
  el.addEventListener('change', () => {
    character.invert[key] = el.checked;
    try { localStorage.setItem(INVERT_KEY, JSON.stringify(character.invert)); } catch {}
  });
}

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

// ── Devices（顔認識カメラ・ゲスト確認カメラ・声の出力先）──────────
const faceCameraSel  = document.getElementById('face-camera');
const guestCameraSel = document.getElementById('guest-camera');
const inputSel       = document.getElementById('audio-input');
const outputSel      = document.getElementById('audio-output');
const guestPreview   = document.getElementById('guest-preview');

// 許可をもらった後でないと機器の名前が取れないので、開始後に一覧を作る
async function updateDeviceLists() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams    = devices.filter(d => d.kind === 'videoinput');
  const outs    = devices.filter(d => d.kind === 'audiooutput');
  const name    = (d, i, kind) => d.label || `${kind} ${i + 1}`;

  const mics    = devices.filter(d => d.kind === 'audioinput');

  fillSelect(faceCameraSel, cams.map((d, i) => [d.deviceId, name(d, i, 'カメラ')]));
  if (!inputSel.dataset.current) inputSel.dataset.current = audioTracker.inputDeviceId;
  fillSelect(inputSel, mics.map((d, i) => [d.deviceId, name(d, i, 'マイク')]));
  fillSelect(guestCameraSel, [['', '使わない'], ...cams.map((d, i) => [d.deviceId, name(d, i, 'カメラ')])]);

  if (audioTracker.canSelectOutput) {
    fillSelect(outputSel, [['', '既定の出力'], ...outs.filter(d => d.deviceId !== 'default')
      .map((d, i) => [d.deviceId, name(d, i, 'スピーカー')])]);
    outputSel.disabled = false;
  } else {
    fillSelect(outputSel, [['', 'このブラウザでは選べません（Chrome 推奨）']]);
    outputSel.disabled = true;
  }
}

// 選択中の値（dataset.current）を保ったまま選択肢を入れ替える
function fillSelect(sel, options) {
  const current = sel.dataset.current ?? sel.value;
  sel.replaceChildren(...options.map(([value, text]) => new Option(text, value)));
  if (options.some(([v]) => v === current)) sel.value = current;
}

faceCameraSel.addEventListener('change', async () => {
  faceCameraSel.dataset.current = faceCameraSel.value;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: faceCameraSel.value }, width: { ideal: 640 }, height: { ideal: 480 } },
    });
    await faceTracker.setStream(stream);
  } catch (e) {
    showMessage('カメラを切り替えられません: ' + e.message);
  }
});

// ゲストの様子をホストだけが見るためのカメラ
guestCameraSel.addEventListener('change', async () => {
  guestCameraSel.dataset.current = guestCameraSel.value;
  guestPreview.srcObject?.getTracks().forEach(t => t.stop());
  guestPreview.srcObject = null;
  guestPreview.hidden = true;
  if (!guestCameraSel.value) return;

  try {
    guestPreview.srcObject = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: guestCameraSel.value } },
    });
    guestPreview.hidden = false;
    await guestPreview.play();
  } catch (e) {
    showMessage('ゲスト確認カメラを使えません: ' + e.message);
  }
});

// 声の入力（例：入力はイヤホンのマイク、出力は TV のスピーカー）
inputSel.addEventListener('change', async () => {
  inputSel.dataset.current = inputSel.value;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: inputSel.value }, echoCancellation: true, noiseSuppression: true },
    });
    audioTracker.setInputStream(stream);
  } catch (e) {
    showMessage('マイクを切り替えられません: ' + e.message);
  }
});

outputSel.addEventListener('change', async () => {
  outputSel.dataset.current = outputSel.value;
  try {
    await audioTracker.setOutputDevice(outputSel.value);
  } catch (e) {
    showMessage('声の出力先を変更できません: ' + e.message);
  }
});

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
