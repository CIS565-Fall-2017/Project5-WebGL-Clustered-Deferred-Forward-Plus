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
/* WINDOW SILL
camera.position.set(-10,6.7,3);
cameraControls.target.set(-4, 5,-10);*/

camera.position.set(-10,5,0);
cameraControls.target.set(0,2,0);

gl.enable(gl.DEPTH_TEST);
setRenderer(params.renderer);

function setRenderer(renderer) {
  var xDim = 15;
  var yDim = 15;
  var zDim= 15;

  switch(renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer();
      break;
    case CLUSTERED_FORWARD_PLUS:
      params._renderer = new ClusteredForwardPlusRenderer(xDim, yDim, zDim, camera);
      break;
    case CLUSTERED_DEFFERED:
      params._renderer = new ClusteredDeferredRenderer(xDim, yDim, zDim, camera);
      break;
  }
}

gui.add(params, 'renderer', [FORWARD, CLUSTERED_FORWARD_PLUS, CLUSTERED_DEFFERED]).onChange(setRenderer);

const scene = new Scene();
scene.loadGLTF('models/sponza/sponza.gltf');

function render() {
  scene.update();
  params._renderer.render(camera, scene);
}

makeRenderLoop(render)();