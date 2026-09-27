import * as THREE from 'three';

const BROWN      = 0x855a2e;
const DARK_BROWN = 0x381800;
const EYE_RING   = 0x47200a;
const CREAM      = 0xf7eed1;
const BEAK       = 0xebb01e;

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}
function basic(color) {
  return new THREE.MeshBasicMaterial({ color });
}

export class OwlCharacter {
  constructor(scene) {
    // ── Lighting ────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(1, 2, 2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8899ff, 0.4);
    fill.position.set(-2, 0, 1);
    scene.add(fill);

    // ── Scene root (receives head rotation) ─────────────────
    this.root = new THREE.Group();
    scene.add(this.root);

    this._lowerBeakBaseY = -0.060;
    this._leftTuftBaseY  =  0.155;
    this._rightTuftBaseY =  0.155;

    this._build();
  }

  _build() {
    const r = this.root;

    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), lambert(BROWN));
    body.scale.set(0.22, 0.26, 0.14);
    body.position.set(0, -0.20, -0.04);
    r.add(body);

    // Head group
    const h = new THREE.Group();
    r.add(h);
    h.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 32, 20), lambert(BROWN)));

    // Face disc
    const disc = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 20), lambert(CREAM));
    disc.scale.set(0.28, 0.26, 0.04);
    disc.position.set(0, 0.005, 0.096);
    h.add(disc);

    // Eye rings
    for (const sx of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.SphereGeometry(0.060, 24, 16), lambert(EYE_RING));
      ring.position.set(sx * 0.072, 0.022, 0.119);
      h.add(ring);
    }

    // Eyes
    this._leftEye  = this._makeEye(h, -0.072);
    this._rightEye = this._makeEye(h,  0.072);

    // Upper beak (fixed)
    const ub = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.022, 0.020), lambert(BEAK));
    ub.position.set(0, -0.040, 0.143);
    h.add(ub);

    // Lower beak (animated)
    this._lowerBeak = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.016, 0.018), lambert(BEAK));
    this._lowerBeak.position.set(0, this._lowerBeakBaseY, 0.141);
    h.add(this._lowerBeak);

    // Ear tufts
    this._leftTuft  = this._makeTuft(h, -0.065,  0.155, false);
    this._rightTuft = this._makeTuft(h,  0.065,  0.155, true);

    this._headGroup = h;
  }

  _makeEye(parent, x) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 24, 16),
      basic(0xf7f4eb)
    );
    eye.position.set(x, 0.022, 0.135);
    parent.add(eye);

    // Pupil
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.030, 16, 12), basic(0x000000));
    pupil.position.set(0, 0, 0.036);
    eye.add(pupil);

    // Glint
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), basic(0xffffff));
    glint.position.set(0.016, 0.016, 0.048);
    eye.add(glint);

    return eye;
  }

  _makeTuft(parent, x, y, flipped) {
    const tuft = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.060, 0.010),
      lambert(DARK_BROWN)
    );
    tuft.position.set(x, y, 0.055);
    tuft.rotation.z = (flipped ? 1 : -1) * Math.PI / 14;
    parent.add(tuft);
    return tuft;
  }

  // ── Animation API ────────────────────────────────────────

  setMouthOpen(value) {
    this._lowerBeak.position.y = this._lowerBeakBaseY - value * 0.025;
  }

  setEyeBlink(left, right) {
    this._leftEye.scale.y  = Math.max(0.08, 1.0 - left  * 0.92);
    this._rightEye.scale.y = Math.max(0.08, 1.0 - right * 0.92);
  }

  setEarTuft(browInnerUp, browDownLeft, browDownRight) {
    this._leftTuft.position.y  = this._leftTuftBaseY  + browInnerUp * 0.020 - browDownLeft  * 0.012;
    this._rightTuft.position.y = this._rightTuftBaseY + browInnerUp * 0.020 - browDownRight * 0.012;
  }
}
