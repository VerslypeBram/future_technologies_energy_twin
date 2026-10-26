import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

// Fysisch gebaseerde lucht, sterren, mist en een groot grasveld tot de horizon.
export function createSky(scene, renderer) {
  const sky = new Sky();
  sky.scale.setScalar(450);
  scene.add(sky);
  // De lucht mag niet fel genoeg worden om de bloom te triggeren
  sky.material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <tonemapping_fragment>',
      'gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(1.0));\n#include <tonemapping_fragment>'
    );
  };
  const u = sky.material.uniforms;
  u.mieDirectionalG.value = 0.8;

  // Omgevingslicht uit de lucht (voor reflecties op glas, panelen en lak); wordt zo nu en dan ververst
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(450);
  envScene.add(envSky);
  const eu = envSky.material.uniforms;
  let envTarget = null;
  let lastEnv = 0;
  let lastKey = '';

  const starCount = 700;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = Math.acos(Math.random()); // alleen boven de horizon
    positions[i * 3] = Math.sin(e) * Math.cos(a) * 400;
    positions[i * 3 + 1] = Math.cos(e) * 400;
    positions[i * 3 + 2] = Math.sin(e) * Math.sin(a) * 400;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  scene.fog = new THREE.FogExp2(0xcfd8e3, 0.004);

  const fogDay = new THREE.Color(0xcfd8e3);
  const fogRain = new THREE.Color(0x8d949c);
  const fogNight = new THREE.Color(0x0b1220);

  return {
    sky,
    // sunDir: genormaliseerde richting van de zon (ook onder de horizon), sunUp 0..1, cloud 0..1
    update(sunDir, sunUp, cloud) {
      u.sunPosition.value.copy(sunDir);
      u.turbidity.value = 3 + cloud * 14;
      u.rayleigh.value = 1.6 - cloud * 1.0;
      u.mieCoefficient.value = 0.005 + cloud * 0.03;
      starMaterial.opacity = Math.max(0, 1 - sunUp * 4) * (1 - cloud * 0.9);

      scene.fog.color.copy(fogDay).lerp(fogRain, cloud).lerp(fogNight, 1 - Math.min(1, sunUp * 3));
      scene.fog.density = 0.004 + Math.max(0, cloud - 0.6) * 0.03;

      const now = performance.now();
      const key = `${Math.round(sunDir.y * 25)}|${Math.round(sunDir.x * 8)}|${Math.round(cloud * 4)}`;
      if (key !== lastKey && now - lastEnv > 1500) {
        lastKey = key;
        lastEnv = now;
        ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG'].forEach((n) => (eu[n].value = u[n].value));
        eu.sunPosition.value.copy(sunDir);
        const target = pmrem.fromScene(envScene, 0, 0.1, 1000);
        envTarget?.dispose();
        envTarget = target;
        scene.environment = target.texture;
      }
      scene.environmentIntensity = 0.03 + 0.2 * sunUp * (1 - 0.4 * cloud);
    },
    setVisible(visible) {
      sky.visible = visible;
      stars.visible = visible;
    },
  };
}
