// マイク音量の取得（口パク用）とボイスチェンジャー
//
//   mic ─ input ─┬─ analyser（口パク：加工前の声で判定）
//                └─ pitchShifter ─ robot ─ monitor ─ スピーカー / イヤホン
export class AudioTracker {
  constructor() {
    this._ctx       = null;
    this._source    = null;   // マイク（切り替え時に差し替える）
    this._input     = null;   // マイクをまとめて各処理へ分配するノード
    this._analyser  = null;
    this._buffer    = null;
    this._rafId     = null;
    this._shifter   = null;
    this._robot     = null;
    this._robotOsc  = null;
    this._robotDepth = null;
    this._dry       = null;
    this._wet       = null;
    this._monitor   = null;
    this.threshold  = 0.02;   // RMS threshold (adjustable from UI)
    /** @type {(rms: number, isAboveThreshold: boolean) => void} */
    this.onUpdate   = null;

    this._voice = { semitones: 0, robot: false, monitor: false };
  }

  /**
   * @param {AudioContext} ctx  ユーザー操作の中で作った AudioContext（iOS 対策）
   * @param {MediaStream} stream マイクの音声ストリーム
   */
  async init(ctx, stream) {
    this._ctx = ctx;
    if (ctx.state === 'suspended') await ctx.resume();

    this._input = ctx.createGain();
    this.setInputStream(stream);

    this._analyser = ctx.createAnalyser();
    this._analyser.fftSize = 1024;
    this._analyser.smoothingTimeConstant = 0.6;
    this._input.connect(this._analyser);
    this._buffer = new Float32Array(this._analyser.fftSize);

    await this._buildVoiceChain(this._input);
    this._applyVoice();
    this._loop();
  }

  /** 声の入力（マイク）を切り替える */
  setInputStream(stream) {
    if (this._source) {
      this._source.disconnect();
      this._source.mediaStream.getTracks().forEach(t => t.stop());
    }
    this._source = this._ctx.createMediaStreamSource(stream);
    this._source.connect(this._input);
  }

  /** 使用中のマイクの deviceId */
  get inputDeviceId() {
    return this._source?.mediaStream.getAudioTracks()[0]?.getSettings().deviceId ?? '';
  }

  async _buildVoiceChain(source) {
    const ctx = this._ctx;

    // ロボット声：低い周波数で振幅を揺らすリングモジュレーション
    this._robot = ctx.createGain();
    this._robot.gain.value = 1;
    this._robotOsc = ctx.createOscillator();
    this._robotOsc.frequency.value = 50;
    this._robotDepth = ctx.createGain();
    this._robotDepth.gain.value = 0;
    this._robotOsc.connect(this._robotDepth).connect(this._robot.gain);
    this._robotOsc.start();

    this._monitor = ctx.createGain();
    this._monitor.gain.value = 0;
    this._robot.connect(this._monitor).connect(ctx.destination);

    // ピッチ 0 のときは加工せずそのまま流す（音質・遅延のため）
    this._dry = ctx.createGain();
    source.connect(this._dry).connect(this._robot);

    try {
      await ctx.audioWorklet.addModule(new URL('./pitchShifterWorklet.js', import.meta.url));
      this._shifter = new AudioWorkletNode(ctx, 'pitch-shifter');
      this._wet = ctx.createGain();
      source.connect(this._shifter).connect(this._wet).connect(this._robot);
    } catch (e) {
      console.warn('ピッチ変更が使えないブラウザです:', e);
    }
  }

  /** @param {{semitones?: number, robot?: boolean, monitor?: boolean}} opts */
  setVoice(opts) {
    Object.assign(this._voice, opts);
    this._applyVoice();
  }

  get canShiftPitch() { return this._shifter !== null; }

  // 声の出力先（TV のスピーカーなど）を選べるか（Chrome / Edge のみ）
  get canSelectOutput() { return typeof this._ctx?.setSinkId === 'function'; }

  /** @param {string} deviceId '' で既定の出力 */
  async setOutputDevice(deviceId) {
    if (this.canSelectOutput) await this._ctx.setSinkId(deviceId);
  }

  _applyVoice() {
    if (!this._ctx) return;
    const { semitones, robot, monitor } = this._voice;
    const t = this._ctx.currentTime;
    const shifting = this._shifter && semitones !== 0;

    if (this._shifter) {
      this._shifter.parameters.get('ratio').setValueAtTime(2 ** (semitones / 12), t);
      this._wet.gain.setTargetAtTime(shifting ? 1 : 0, t, 0.02);
    }
    this._dry.gain.setTargetAtTime(shifting ? 0 : 1, t, 0.02);

    // ロボット ON: gain = 0 + 1.5·sin(50Hz)（リングモジュレーション）, OFF: gain = 1
    this._robot.gain.setTargetAtTime(robot ? 0 : 1, t, 0.02);
    this._robotDepth.gain.setTargetAtTime(robot ? 1.5 : 0, t, 0.02);

    this._monitor.gain.setTargetAtTime(monitor ? 1 : 0, t, 0.02);
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
