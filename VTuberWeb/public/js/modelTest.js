// test.html 用: モデルを読み込み、全パラメータをスライダーで操作する
const DEFAULT_MODEL = 'models/test_owl/test_owl.model3.json';

const query     = new URLSearchParams(location.search);
const modelPath = query.get('model') ?? DEFAULT_MODEL;
document.getElementById('model-path').textContent = modelPath;

const app = new PIXI.Application({
  view:            document.getElementById('canvas'),
  width:           window.innerWidth,
  height:          window.innerHeight,
  antialias:       true,
  backgroundColor: 0x0d0d2e,
  resolution:      Math.min(window.devicePixelRatio, 2),
  autoDensity:     true,
});

try {
  const model = await PIXI.live2d.Live2DModel.from(modelPath, { autoInteract: false });
  app.stage.addChild(model);

  const natW = model.width, natH = model.height;
  const fit = () => {
    const { width: sw, height: sh } = app.screen;
    const scale = Math.min(sw / natW, sh / natH) * 0.9;
    model.scale.set(scale);
    model.position.set((sw - natW * scale) / 2, (sh - natH * scale) / 2);
  };
  fit();
  window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    fit();
  });

  const core    = model.internalModel.coreModel;
  const params  = core.getModel().parameters;
  const values  = Float32Array.from(params.defaultValues);
  const sliders = [];
  const list    = document.getElementById('params');

  for (let i = 0; i < params.count; i++) {
    const id  = params.ids[i];
    const row = document.createElement('div');
    row.className = 'param';
    row.innerHTML = `<label for="p-${id}">${id}</label><input id="p-${id}" type="range"><output></output>`;
    const input = row.querySelector('input');
    const out   = row.querySelector('output');
    Object.assign(input, {
      min:  params.minimumValues[i],
      max:  params.maximumValues[i],
      step: (params.maximumValues[i] - params.minimumValues[i]) / 100,
    });
    const set = v => {
      values[i]       = v;
      input.value     = v;
      out.textContent = v.toFixed(2);
    };
    set(query.has(id) ? parseFloat(query.get(id)) : params.defaultValues[i]);
    input.addEventListener('input', () => set(parseFloat(input.value)));
    sliders.push(() => set(params.defaultValues[i]));
    list.appendChild(row);
  }

  document.getElementById('reset-btn').addEventListener('click', () => sliders.forEach(reset => reset()));

  // 自動まばたき・呼吸などより後に適用してスライダー値を優先する
  model.internalModel.on('beforeModelUpdate', () => {
    values.forEach((v, i) => core.setParameterValueByIndex(i, v));
  });
  document.body.dataset.ready = 'true';
} catch (e) {
  document.getElementById('error').textContent =
    `モデルの読み込みに失敗しました\n${e?.message ?? e}\n\nlive2dcubismcore.min.js とモデルパスを確認してください`;
  console.error(e);
}
