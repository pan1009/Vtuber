// ピッチシフター（AudioWorklet）
// 2 本の読み出し位置をずらしながら遅延バッファを読み、クロスフェードで繋ぐ方式。
// 軽量で遅延が小さい（約 50ms）のでリアルタイムのボイスチェンジに向く。
class PitchShifter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'ratio', defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: 'k-rate' }];
  }

  constructor() {
    super();
    this._window = Math.round(sampleRate * 0.05);   // 窓の長さ（サンプル）
    this._buf    = new Float32Array(this._window * 2 + 4);
    this._write  = 0;
    this._phase  = 0;
  }

  _read(delay) {
    const len = this._buf.length;
    let pos = this._write - delay;
    while (pos < 0) pos += len;
    const i = Math.floor(pos);
    const f = pos - i;
    return this._buf[i % len] * (1 - f) + this._buf[(i + 1) % len] * f;
  }

  process(inputs, outputs, parameters) {
    const input  = inputs[0][0];
    const output = outputs[0];
    if (!input) return true;

    const ratio = parameters.ratio[0];
    const win   = this._window;
    const step  = (1 - ratio) / win;
    const out0  = output[0];

    for (let n = 0; n < input.length; n++) {
      this._buf[this._write] = input[n];

      const p1 = this._phase;
      const p2 = (p1 + 0.5) % 1;
      const g1 = Math.sin(Math.PI * p1) ** 2;
      const g2 = Math.sin(Math.PI * p2) ** 2;
      out0[n] = this._read(p1 * win) * g1 + this._read(p2 * win) * g2;

      this._phase = ((p1 + step) % 1 + 1) % 1;
      this._write = (this._write + 1) % this._buf.length;
    }

    for (let c = 1; c < output.length; c++) output[c].set(out0);
    return true;
  }
}

registerProcessor('pitch-shifter', PitchShifter);
