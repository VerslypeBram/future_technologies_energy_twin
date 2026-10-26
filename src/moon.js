import * as THREE from 'three';
import { moonAt, sunAt } from './realdata.js';

// Maan met echte stand en fase (SunCalc) plus koel maanlicht dat de nacht leesbaar houdt.
// De schijf is groter dan in het echt (±2,5°), anders is hij op deze afstand een stipje.
const DISTANCE = 380;
const RADIUS = 9;

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Bol-schaduw op een plat vlak: lichtrichting in schijfcoördinaten bepaalt de fase.
const fragmentShader = `
  uniform vec3 uLight;
  uniform float uOpacity;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float edge = 1.0 - smoothstep(0.96, 1.0, r);
    if (edge <= 0.0) discard;
    vec3 n = vec3(p, sqrt(max(0.0, 1.0 - r * r)));
    float lit = smoothstep(-0.03, 0.05, dot(n, normalize(uLight)));
    float maria = 0.72 + 0.28 * noise(p * 3.0 + 4.0) * noise(p * 6.0);
    float craters = 0.92 + 0.08 * noise(p * 14.0);
    vec3 surface = vec3(0.93, 0.93, 0.86) * maria * craters;
    vec3 color = mix(vec3(0.015, 0.02, 0.03), surface * 1.1, lit); // schaduwkant: zwak aardlicht
    gl_FragColor = vec4(color, edge * uOpacity);
  }
`;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createMoon(scene) {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uLight: { value: new THREE.Vector3(0, 0, 1) }, uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(RADIUS * 2, RADIUS * 2), material);
  disc.renderOrder = 1;
  scene.add(disc);

  const light = new THREE.DirectionalLight(0x9db4ff, 0);
  scene.add(light);

  const m = new THREE.Vector3();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3();
  const right = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);
  let visible = true;

  return {
    // date: simulatietijd, sunUp 0..1 (zon aan de hemel), cloud 0..1
    update(date, sunUp, cloud) {
      const moon = moonAt(date);
      m.set(moon.x, moon.y, moon.z);
      const dark = 1 - Math.min(1, sunUp * 4);
      const aboveHorizon = smooth(-0.02, 0.12, moon.y);
      const clear = 1 - 0.85 * cloud;

      disc.position.copy(m).multiplyScalar(DISTANCE);
      disc.lookAt(0, 0, 0);
      material.uniforms.uOpacity.value = visible ? aboveHorizon * Math.max(0.15, dark) * clear : 0;

      // Fase: de verlichte kant wijst naar de zon (geprojecteerd op de schijf, gezien vanaf het huis)
      const sun = sunAt(date);
      s.set(sun.x, sun.y, sun.z);
      up.copy(Y).addScaledVector(m, -m.dot(Y)).normalize();
      right.crossVectors(m, up);
      const bx = s.dot(right);
      const by = s.dot(up);
      const len = Math.hypot(bx, by) || 1;
      const phaseAngle = Math.acos(Math.min(1, Math.max(-1, 2 * moon.fraction - 1))); // 0 = vol
      material.uniforms.uLight.value.set((Math.sin(phaseAngle) * bx) / len, (Math.sin(phaseAngle) * by) / len, Math.cos(phaseAngle));

      light.position.copy(m).multiplyScalar(60);
      light.intensity = visible ? 0.55 * moon.fraction * aboveHorizon * dark * clear : 0;
      return { fraction: moon.fraction, altitude: moon.altitude };
    },
    setVisible(v) {
      visible = v;
      disc.visible = v;
    },
  };
}
