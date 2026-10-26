import * as THREE from 'three';

// Zichtbare zon aan de hemel: heldere schijf met gloed die over de lucht beweegt (en roder wordt bij opkomst en ondergang).
// De schijf is groter dan in het echt (±2°), zodat je hem ook in een tijdlapse goed volgt.
const DISTANCE = 390;
const RADIUS = 13;

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float r = length(vUv * 2.0 - 1.0);
    float core = 1.0 - smoothstep(0.16, 0.2, r);
    float halo = pow(max(0.0, 1.0 - r), 2.2) * 0.9;
    float a = clamp(core + halo, 0.0, 1.0) * uOpacity;
    if (a <= 0.003) discard;
    gl_FragColor = vec4(uColor * (core * 2.6 + halo), a);
  }
`;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createSunDisc(scene) {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uColor: { value: new THREE.Color(1, 0.9, 0.7) }, uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(RADIUS * 6, RADIUS * 6), material); // groot vlak voor de gloed
  disc.renderOrder = 2;
  scene.add(disc);

  const noon = new THREE.Color(1, 0.96, 0.85);
  const low = new THREE.Color(1, 0.55, 0.25);
  let visible = true;

  return {
    // dir: genormaliseerde zonrichting (ook onder de horizon), cloud 0..1
    update(dir, cloud) {
      disc.position.copy(dir).multiplyScalar(DISTANCE);
      disc.lookAt(0, 0, 0);
      const up = smooth(-0.04, 0.04, dir.y);
      material.uniforms.uOpacity.value = visible ? up * (1 - 0.65 * cloud) : 0;
      material.uniforms.uColor.value.copy(low).lerp(noon, smooth(0.0, 0.45, dir.y));
      disc.visible = visible && up > 0.001;
    },
    setVisible(v) {
      visible = v;
      disc.visible = v;
    },
  };
}
