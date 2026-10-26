import * as THREE from 'three';
import { LAYOUT } from './house.js';
import { state, world } from './simulation.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const M = LAYOUT.meter;
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Kabelroutes: vlak boven de grond, rond het huis heen
const PATHS = {
  solar: [LAYOUT.panels, v(-1.4, 2.85, 1.55), v(-2.15, 2.5, 1.9), v(-2.15, 1.2, 1.9), v(-2.15, 0.06, 1.9), v(-2.15, 0.06, 0.5), v(-2.15, 0.06, -1), M],
  wind0: [LAYOUT.turbines[0], v(5.5, 0.06, -1.8), v(3, 0.06, -3), v(-3, 0.06, -3), v(-3, 0.06, -1), v(-2.1, 0.06, -1), M],
  wind1: [LAYOUT.turbines[1], v(7, 0.06, -4.3), v(3, 0.06, -3.4), v(-3, 0.06, -3.4), v(-3, 0.06, -1.2), v(-2.1, 0.06, -1), M],
  grid: [LAYOUT.pole, v(-6, 0.06, 1.5), v(-3.8, 0.06, 1), v(-2.5, 0.06, -0.6), M],
  battery: [M, v(-2.4, 0.06, -0.9), v(-3, 0.06, -0.6), LAYOUT.battery],
  home: [M, v(-2.2, 0.06, -1.2), v(-2.2, 0.06, -2.5), v(2.6, 0.06, -2.5), v(2.6, 0.06, 0), v(2.1, 0.5, 0)],
  ev0: [M, v(-2.2, 0.06, -1), v(-2.3, 0.06, 2.5), v(-0.55, 0.06, 3.0), LAYOUT.chargers[0]],
  ev1: [M, v(-2.2, 0.06, -1), v(-2.3, 0.06, 2.6), v(0, 0.06, 3.3), v(0.55, 0.06, 3.0), LAYOUT.chargers[1]],
};

const COLORS = {
  solar: 0xffd23f,
  wind: 0x39d0ff,
  grid: 0xff5a4d,
  battery: 0x4cd137,
  home: 0xffa94d,
  ev: 0xc77dff,
};

// Deeltjes die langs de kabels lopen; snelheid en zichtbaarheid volgen het vermogen.
export function createFlows(scene) {
  const sphere = new THREE.SphereGeometry(0.06, 8, 8);
  const COUNT = 18;
  const dummy = new THREE.Object3D();

  function makeFlow(points, color, getKw, getReverse = () => false) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);
    const cable = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 80, 0.012, 4),
      new THREE.MeshBasicMaterial({ color: 0x20252b, transparent: true, opacity: 0.55 })
    );
    scene.add(cable);

    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5), toneMapped: false });
    const mesh = new THREE.InstancedMesh(sphere, material, COUNT);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { curve, mesh, cable, getKw, getReverse, phase: Math.random() };
  }

  const flows = [
    makeFlow(PATHS.solar, COLORS.solar, (f) => f.solar),
    makeFlow(PATHS.wind0, COLORS.wind, (f) => f.wind / 2),
    makeFlow(PATHS.wind1, COLORS.wind, (f) => f.wind / 2),
    makeFlow(PATHS.grid, COLORS.grid, (f) => f.grid),
    makeFlow(PATHS.battery, COLORS.battery, (f) => Math.abs(f.batteryKw), (f) => f.batteryKw < 0),
    makeFlow(PATHS.home, COLORS.home, (f) => f.home),
    makeFlow(PATHS.ev0, COLORS.ev, () => (state.cars[0].charging ? 3.7 : 0)),
    makeFlow(PATHS.ev1, COLORS.ev, () => (state.cars[1].charging ? 3.7 : 0)),
  ];

  return {
    setVisible(visible) {
      flows.forEach((f) => {
        f.cable.visible = visible;
        if (!visible) f.mesh.visible = false;
      });
      this.hidden = !visible;
    },
    update(dt) {
      if (this.hidden) return;
      const f = state.flows;
      flows.forEach((flow) => {
        const kw = flow.getKw(f);
        const active = kw > 0.03 && !world.paused;
        flow.mesh.visible = active;
        if (!active) return;
        const speed = (0.06 + kw * 0.1) * (REDUCED ? 0.3 : 1);
        flow.phase = (flow.phase + dt * speed) % 1;
        const reverse = flow.getReverse(f);
        const scale = 0.8 + Math.min(1.2, kw / 2);
        for (let i = 0; i < COUNT; i++) {
          let t = (flow.phase + i / COUNT) % 1;
          if (reverse) t = 1 - t;
          dummy.position.copy(flow.curve.getPointAt(t));
          dummy.scale.setScalar(scale);
          dummy.updateMatrix();
          flow.mesh.setMatrixAt(i, dummy.matrix);
        }
        flow.mesh.instanceMatrix.needsUpdate = true;
      });
    },
  };
}
