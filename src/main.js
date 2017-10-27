import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ClusteredForwardPlusRenderer from './renderers/clusteredForwardPlus';
import ClusteredDeferredRenderer from './renderers/clusteredDeferred';
import Scene from './scene';

const FORWARD = 'Forward';
const CLUSTERED_FORWARD_PLUS = 'Clustered Forward+';
const CLUSTERED_DEFFERED = 'Clustered Deferred';

const params = {
  renderer: CLUSTERED_DEFFERED,
  _renderer: null,
};

setRenderer(params.renderer);

//For performance analysis
var RenderTimes = [0,0,0];
var renderType;

function setRenderer(renderer) {
  switch(renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer();
      renderType = 0;
      break;
    case CLUSTERED_FORWARD_PLUS:
      params._renderer = new ClusteredForwardPlusRenderer(15, 15, 15);
      renderType = 1;
      break;
    case CLUSTERED_DEFFERED:
      params._renderer = new ClusteredDeferredRenderer(15, 15, 15);
      renderType = 2;
      break;
  }
}

gui.add(params, 'renderer', [FORWARD, CLUSTERED_FORWARD_PLUS, CLUSTERED_DEFFERED]).onChange(setRenderer);

const scene = new Scene();
scene.loadGLTF('models/sponza/sponza.gltf');

camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 8, 0);
gl.enable(gl.DEPTH_TEST);


var t0, t1;

function render() {
  if(RenderTimes[renderType] == 0){
    t0 = performance.now();
  }
  if(RenderTimes[renderType] == 150){
    t1 = performance.now();
    console.log(renderType + ' totaltime = ' + (t1 - t0));
  }
  scene.update();
  params._renderer.render(camera, scene);
  RenderTimes[renderType]++;

}


makeRenderLoop(render)();

