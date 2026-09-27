import * as THREE   from 'three';
import { OwlCharacter } from './owl.js';
import { FaceTracker }  from './faceTracker.js';
import { AudioTracker } from './audioTracker.js';

// ── Three.js Setup ───────────────────────────────────────────
const canvas   = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x0d0d2e);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 10);
camera.position.set(0, 0, 0.7);
camera.lookAt(0, 0, 0);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

// ── Owl ──────────────────────────────────────────────────────
const owl = new OwlCharacter(scene);

// ── Trackers ─────────────────────────────────────────────────
const faceTracker  = new FaceTracker();
const audioTracker = new AudioTracker();

// ── State ────────────────────────────────────────────────────
let mouthTarget  = 0;
let mouthCurrent = 0;

// ── Audio → mouth ────────────────────────────────────────────
audioTracker.onUpdate = (rms, isAbove) => {
  mouthTarget = isAbove
    ? Math.min(rms / (audioTracker.threshold * 4), 1.0)
    : 0;

  // Volume meter UI
  const pct = Math.min(rms / 0.1 * 100, 100);
  document.getElementById('vol-bar').style.width = pct + '%';
  document.getElementById('vol-bar').style.background =
    isAbove ? '#4ade80' : '#60a5fa';
};

// ── Face → head rotation + eye blink + ear tuft ──────────────
faceTracker.onUpdate = ({ matrix, blendshapes }) => {
  // Build Three.js Matrix4 from MediaPipe column-major float array
  const mat4  = new THREE.Matrix4().fromArray(matrix);
  const euler = new THREE.Euler().setFromRotationMatrix(mat4, 'YXZ');

  owl.root.rotation.order = 'YXZ';
  owl.root.rotation.y = -euler.y;   // negate for mirror effect
  owl.root.rotation.x =  euler.x;
  owl.root.rotation.z =  euler.z;

  const get = name => blendshapes.find(b => b.categoryName === name)?.score ?? 0;
  owl.setEyeBlink(get('eyeBlinkLeft'), get('eyeBlinkRight'));
  owl.setEarTuft(get('browInnerUp'), get('browDownLeft'), get('browDownRight'));

  setStatus('face', true);
};

faceTracker.onLost = () => setStatus('face', false);

// ── Start button ─────────────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', async () => {
  document.getElementById('start-screen').style.display = 'none';

  try {
    setStatus('face',  false);
    setStatus('audio', false);

    await Promise.all([
      faceTracker.init().then(() => setStatus('face',  true)),
      audioTracker.init().then(() => setStatus('audio', true))
    ]);
  } catch (e) {
    alert('カメラ/マイクのアクセスが必要です:\n' + e.message);
  }
});

// ── Threshold slider ─────────────────────────────────────────
const slider = document.getElementById('threshold-slider');
const label  = document.getElementById('threshold-value');
slider.addEventListener('input', () => {
  audioTracker.threshold = parseFloat(slider.value);
  label.textContent = slider.value;
});

// ── Render loop ───────────────────────────────────────────────
(function animate() {
  requestAnimationFrame(animate);

  // Smooth mouth interpolation
  mouthCurrent += (mouthTarget - mouthCurrent) * 0.25;
  owl.setMouthOpen(mouthCurrent);

  renderer.render(scene, camera);
})();

// ── Helpers ───────────────────────────────────────────────────
function setStatus(type, ok) {
  const el = document.getElementById(`status-${type}`);
  if (!el) return;
  el.textContent = ok ? '●' : '○';
  el.style.color = ok ? '#4ade80' : '#f87171';
}
