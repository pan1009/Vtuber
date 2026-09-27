// Live2D パラメータ ID — モデルに合わせて変更してください
const PARAMS = {
  angleX:    'ParamAngleX',
  angleY:    'ParamAngleY',
  angleZ:    'ParamAngleZ',
  eyeLOpen:  'ParamEyeLOpen',
  eyeROpen:  'ParamEyeROpen',
  mouthOpen: 'ParamMouthOpenY',
  browLY:    'ParamBrowLY',
  browRY:    'ParamBrowRY',
};

export class Live2DCharacter {
  constructor(pixiApp) {
    this._app    = pixiApp;
    this._model  = null;
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
    this._app.stage.addChild(model);
    this._fit();

    // motions が競合する場合は beforeModelUpdate でパラメータを上書き
    model.on('beforeModelUpdate', () => {
      const c = model.internalModel.coreModel;
      const p = this._params;
      c.setParameterValueById(PARAMS.angleX,    p.angleX);
      c.setParameterValueById(PARAMS.angleY,    p.angleY);
      c.setParameterValueById(PARAMS.angleZ,    p.angleZ);
      c.setParameterValueById(PARAMS.eyeLOpen,  p.eyeLOpen);
      c.setParameterValueById(PARAMS.eyeROpen,  p.eyeROpen);
      c.setParameterValueById(PARAMS.mouthOpen, p.mouthOpen);
      c.setParameterValueById(PARAMS.browLY,    p.browLY);
      c.setParameterValueById(PARAMS.browRY,    p.browRY);
    });

    return this;
  }

  _fit() {
    const m = this._model;
    if (!m) return;
    const { width: sw, height: sh } = this._app.screen;

    m.scale.set(1);
    const naturalW = m.width;
    const naturalH = m.height;
    const scale = Math.min(sw / naturalW, sh / naturalH) * 0.9;

    m.scale.set(scale);
    m.position.set(
      (sw - naturalW * scale) / 2,
      (sh - naturalH * scale) / 2,
    );
  }

  // 頭の回転（ラジアン、YXZ オイラー角）
  setHeadRotation(x, y, z) {
    const toDeg = r => r * (180 / Math.PI);
    this._params.angleY = -toDeg(y);   // 鏡像補正
    this._params.angleX =  toDeg(x);
    this._params.angleZ =  toDeg(z);
  }

  // まばたき（0 = 開, 1 = 閉）
  setEyeBlink(left, right) {
    this._params.eyeLOpen = 1 - left;
    this._params.eyeROpen = 1 - right;
  }

  // 口開き（0〜1）
  setMouthOpen(value) {
    this._params.mouthOpen = value;
  }

  // 眉毛
  setEyebrow(browInnerUp, browDownLeft, browDownRight) {
    this._params.browLY = browInnerUp - browDownLeft;
    this._params.browRY = browInnerUp - browDownRight;
  }

  resize() { this._fit(); }

  get isReady() { return this._model !== null; }
}
