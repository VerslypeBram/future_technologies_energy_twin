import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Bloom op felle (emissive) dingen en een outline voor de hover-inspector.
export function createPost(renderer, scene, camera) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const size = new THREE.Vector2();
  renderer.getSize(size);
  const pixelRatio = renderer.getPixelRatio();
  const target = new THREE.WebGLRenderTarget(size.x * pixelRatio, size.y * pixelRatio, {
    type: THREE.HalfFloatType,
    samples: 4, // anti-aliasing blijft werken met de composer
  });

  const composer = new EffectComposer(renderer, target);
  target.texture.name = 'scene';
  composer.addPass(new RenderPass(scene, camera));

  const outline = new OutlinePass(size, scene, camera);
  outline.edgeStrength = 3;
  outline.edgeThickness = 1;
  outline.edgeGlow = 0;
  outline.pulsePeriod = 0;
  outline.visibleEdgeColor.set(0xffffff);
  outline.hiddenEdgeColor.set(0x335577);
  composer.addPass(outline);

  const bloom = new UnrealBloomPass(size, 0.35, 0.4, 1.5);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let enabled = true;

  return {
    composer,
    outline,
    bloom,
    get enabled() {
      return enabled;
    },
    setEnabled(value) {
      enabled = value;
    },
    setBloom(on) {
      bloom.enabled = on;
    },
    resize(width, height) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(width, height);
    },
    render() {
      if (enabled) composer.render();
      else renderer.render(scene, camera);
    },
  };
}
