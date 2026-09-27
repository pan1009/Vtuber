export class AudioTracker {
  constructor() {
    this._analyser  = null;
    this._buffer    = null;
    this._rafId     = null;
    this.threshold  = 0.02;   // RMS threshold (adjustable from UI)
    /** @type {(rms: number, isAboveThreshold: boolean) => void} */
    this.onUpdate   = null;
  }

  async init() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Resume on user interaction (required by some browsers)
    if (ctx.state === 'suspended') await ctx.resume();

    const source = ctx.createMediaStreamSource(stream);
    this._analyser = ctx.createAnalyser();
    this._analyser.fftSize = 1024;
    this._analyser.smoothingTimeConstant = 0.6;
    source.connect(this._analyser);

    this._buffer = new Float32Array(this._analyser.fftSize);
    this._loop();
  }

  _loop() {
    this._analyser.getFloatTimeDomainData(this._buffer);

    // RMS (Root Mean Square) = volume level
    let sum = 0;
    for (const v of this._buffer) sum += v * v;
    const rms = Math.sqrt(sum / this._buffer.length);

    this.onUpdate?.(rms, rms > this.threshold);

    this._rafId = requestAnimationFrame(() => this._loop());
  }

  stop() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }
}
