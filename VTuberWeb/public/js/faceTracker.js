import { FaceLandmarker, FilesetResolver }
  from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3';

export class FaceTracker {
  constructor() {
    this._landmarker = null;
    this._video      = null;
    this._rafId      = null;
    this.isRunning   = false;
    /** @type {(data: {matrix: Float32Array, blendshapes: Array}) => void} */
    this.onUpdate    = null;
    this.onLost      = null;
  }

  async init() {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
    );

    this._landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true
    });

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 }
    });

    this._video = document.createElement('video');
    this._video.srcObject = stream;
    this._video.setAttribute('playsinline', '');
    await new Promise(res => { this._video.onloadeddata = res; });
    await this._video.play();

    this.isRunning = true;
    this._loop();
  }

  _loop() {
    if (!this.isRunning) return;

    const results = this._landmarker.detectForVideo(this._video, performance.now());

    if (results.facialTransformationMatrixes?.length > 0) {
      this.onUpdate?.({
        matrix:      results.facialTransformationMatrixes[0].data,
        blendshapes: results.faceBlendshapes?.[0]?.categories ?? []
      });
    } else {
      this.onLost?.();
    }

    this._rafId = requestAnimationFrame(() => this._loop());
  }

  stop() {
    this.isRunning = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._video?.srcObject?.getTracks().forEach(t => t.stop());
  }
}
