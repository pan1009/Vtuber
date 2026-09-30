import { FaceLandmarker, FilesetResolver }
  from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3';

export class FaceTracker {
  constructor() {
    this._landmarker = null;
    this._video      = null;
    this._rafId      = null;
    this._lastTime   = -1;
    this.isRunning   = false;
    /** @type {(data: {matrix: Float32Array, blendshapes: Array}) => void} */
    this.onUpdate    = null;
    this.onLost      = null;
  }

  /** @param {MediaStream} stream カメラの映像ストリーム */
  async init(stream) {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
    );

    // スマホでは GPU が使えないことがあるので CPU にフォールバック
    try {
      this._landmarker = await this._create(vision, 'GPU');
    } catch (e) {
      console.warn('GPU で顔認識を起動できないため CPU を使います:', e);
      this._landmarker = await this._create(vision, 'CPU');
    }

    // iOS Safari は DOM に無い video のフレームを更新しないことがあるため、見えない形で置く
    this._video = document.createElement('video');
    this._video.className = 'camera-feed';
    this._video.muted = true;
    this._video.setAttribute('playsinline', '');
    this._video.setAttribute('muted', '');
    this._video.srcObject = stream;
    document.body.appendChild(this._video);
    await new Promise(res => {
      if (this._video.readyState >= 2) res();
      else this._video.onloadeddata = res;
    });
    await this._video.play();

    this.isRunning = true;
    this._loop();
  }

  _create(vision, delegate) {
    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true
    });
  }

  _loop() {
    if (!this.isRunning) return;

    // 新しいフレームが来たときだけ解析する
    const v = this._video;
    if (v.readyState >= 2 && v.currentTime !== this._lastTime) {
      this._lastTime = v.currentTime;
      const results = this._landmarker.detectForVideo(v, performance.now());

      if (results.facialTransformationMatrixes?.length > 0) {
        this.onUpdate?.({
          matrix:      results.facialTransformationMatrixes[0].data,
          blendshapes: results.faceBlendshapes?.[0]?.categories ?? []
        });
      } else {
        this.onLost?.();
      }
    }

    this._rafId = requestAnimationFrame(() => this._loop());
  }

  stop() {
    this.isRunning = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._video?.srcObject?.getTracks().forEach(t => t.stop());
    this._video?.remove();
  }
}
