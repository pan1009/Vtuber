// Live2D パラメータ ID — モデルに合わせて変更してください
const PARAMS = {
  angleX:    'ParamAngleX',      // 顔の向き：左右
  angleY:    'ParamAngleY',      // 顔の向き：上下
  angleZ:    'ParamAngleZ',      // 頭の傾き
  eyeLOpen:  'ParamEyeLOpen',
  eyeROpen:  'ParamEyeROpen',
  mouthOpen: 'ParamMouthOpenY',
  browLY:    'ParamBrowLY',
  browRY:    'ParamBrowRY',
};

const DEG = r => r * (180 / Math.PI);

export class Live2DCharacter {
  constructor(pixiApp) {
    this._app    = pixiApp;
    this._model  = null;
    this._natW   = 0;
    this._natH   = 0;
    this._params = {
      angleX: 0, angleY: 0, angleZ: 0,
      eyeLOpen: 1, eyeROpen: 1,
      mouthOpen: 0,
      browLY: 0, browRY: 0,
    };
  }

  async load(modelPath) {
    const model = await PIXI.live2d.Live2DModel.from(modelPath, {
      autoInteract: false,
    });

    this._model = model;
    this._natW  = model.width;
    this._natH  = model.height;
    this._app.stage.addChild(model);
    this._fit();

    // beforeModelUpdate は Live2DModel ではなく internalModel が発火する
    model.internalModel.on('beforeModelUpdate', () => this._applyParams());
    return this;
  }

  _applyParams() {
    const c = this._model.internalModel.coreModel;
    const p = this._params;
    c.setParameterValueById(PARAMS.angleX,    p.angleX);
    c.setParameterValueById(PARAMS.angleY,    p.angleY);
    c.setParameterValueById(PARAMS.angleZ,    p.angleZ);
    c.setParameterValueById(PARAMS.eyeLOpen,  p.eyeLOpen);
    c.setParameterValueById(PARAMS.eyeROpen,  p.eyeROpen);
    c.setParameterValueById(PARAMS.mouthOpen, p.mouthOpen);
    c.setParameterValueById(PARAMS.browLY,    p.browLY);
    c.setParameterValueById(PARAMS.browRY,    p.browRY);
  }

  _fit() {
    const { width: sw } = this._app.screen;
    // 縦長（スマホ縦持ち）では下の設定パネルに隠れないよう上 70% に収める
    const sh = this._app.screen.height * (this._app.screen.height > sw ? 0.7 : 1);
    const scale = Math.min(sw / this._natW, sh / this._natH) * 0.9;
    this._model.scale.set(scale);
    this._model.position.set(
      (sw - this._natW * scale) / 2,
      (sh - this._natH * scale) / 2,
    );
  }

  // x: ピッチ（上下）, y: ヨー（左右）, z: ロール（傾き） — ラジアン
  // Live2D 標準: ParamAngleX = 左右, ParamAngleY = 上下, ParamAngleZ = 傾き
  setHeadRotation(x, y, z) {
    this._params.angleX =  DEG(y);   // 鏡のように同じ側へ向く
    this._params.angleY = -DEG(x);
    this._params.angleZ =  DEG(z);
  }

  setEyeBlink(left, right) {
    this._params.eyeLOpen = 1 - left;
    this._params.eyeROpen = 1 - right;
  }

  setMouthOpen(value) {
    this._params.mouthOpen = value;
  }

  setBrow(innerUp, downLeft, downRight) {
    this._params.browLY = innerUp - downLeft;
    this._params.browRY = innerUp - downRight;
  }

  resize() {
    if (this._model) this._fit();
  }

  get isReady() { return this._model !== null; }
}
