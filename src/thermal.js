import * as THREE from 'three';
import { state, world, sunEff } from './simulation.js';

const vertexShader = `
  varying vec3 vPos;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPos = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// Kleurverloop van koud (donkerblauw) naar heet (wit), -5 tot 30 graden
const fragmentShader = `
  uniform float uInside;
  uniform float uOutside;
  uniform float uK;
  varying vec3 vPos;
  vec3 ramp(float t) {
    vec3 c0 = vec3(0.02, 0.02, 0.25);
    vec3 c1 = vec3(0.45, 0.0, 0.55);
    vec3 c2 = vec3(0.95, 0.25, 0.1);
    vec3 c3 = vec3(1.0, 0.85, 0.15);
    vec3 c4 = vec3(1.0);
    if (t < 0.25) return mix(c0, c1, t / 0.25);
    if (t < 0.5) return mix(c1, c2, (t - 0.25) / 0.25);
    if (t < 0.75) return mix(c2, c3, (t - 0.5) / 0.25);
    return mix(c3, c4, (t - 0.75) / 0.25);
  }
  void main() {
    float temp = mix(uOutside, uInside, uK) + uK * 1.2 * smoothstep(0.0, 2.5, vPos.y);
    float t = clamp((temp + 5.0) / 35.0, 0.0, 1.0);
    gl_FragColor = vec4(ramp(t), 1.0);
  }
`;

// Warmte-camera: elk onderdeel krijgt een temperatuur uit isolatie (userData.heat) en actuele toestand.
export function createThermal(root, extraMeshes = []) {
  const shared = { uInside: { value: 20 }, uOutside: { value: 5 } };
  const entries = [];

  const register = (mesh, base) => {
    const uK = { value: base };
    const shader = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: { ...shared, uK } });
    entries.push({ mesh, orig: mesh.material, shader, uK, base });
  };
  root.traverse((m) => m.isMesh && register(m, m.userData.heat ?? 0.1));
  extraMeshes.forEach((m) => register(m, 0));

  const legend = document.createElement('div');
  legend.id = 'irLegend';
  legend.hidden = true;
  legend.innerHTML = '<span>-5 °C</span><i></i><span>30 °C</span>';
  (document.getElementById('view') ?? document.body).appendChild(legend);

  let on = false;

  function heatOf(entry) {
    const m = entry.mesh;
    const id = m.userData.inspectId;
    const shutter = state.shuttersClosed ? 0.6 : 1;
    if (m.userData.windowIndex !== undefined) return (state.windowsOpen[m.userData.windowIndex] ? 1 : 0.9) * shutter;
    if (id && id.startsWith('window')) return 0.8 * shutter;
    if (id === 'heater') return state.heaterActive ? 1 : 0.3;
    if (id === 'solar') return 0.2 + 0.6 * sunEff();
    if (id && id.startsWith('car')) return 0.25 + (state.cars[+id.slice(3)].charging ? 0.35 : 0);
    if (id && id.startsWith('charger')) return state.cars[+id.slice(7)].charging ? 0.7 : 0.15;
    if (id === 'battery') return 0.3 + Math.min(0.5, Math.abs(state.flows.batteryKw) * 0.25);
    if (id === 'meter') return 0.35;
    return entry.base;
  }

  return {
    get on() {
      return on;
    },
    set(value) {
      on = value;
      legend.hidden = !on;
      entries.forEach((e) => (e.mesh.material = on ? e.shader : e.orig));
    },
    update() {
      if (!on) return;
      shared.uInside.value = state.insideTemp;
      shared.uOutside.value = world.outsideTemp;
      entries.forEach((e) => (e.uK.value = heatOf(e)));
    },
  };
}
