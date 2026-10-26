import * as THREE from 'three';

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const PRESETS = {
  overzicht: { label: 'Overzicht', pos: [8.8, 4.2, 8.8], target: [-0.3, 1.6, 0.3] },
  dak: { label: 'Dak', pos: [2.5, 6.5, 8.5], target: [0, 3.3, 1.2] },
  palen: { label: 'Laadpalen', pos: [-3.2, 2.0, 8.2], target: [0, 0.6, 3.5] },
  wind: { label: 'Windmolens', pos: [10.5, 3.2, 3.5], target: [6.2, 3, -3.2] },
  batterij: { label: 'Batterij', pos: [-6.5, 2.2, 3.5], target: [-3, 0.8, 0] },
};

// Vloeiende camera-vlucht naar een voorinstelling, en een modus die een auto volgt.
export function createCameraRig(camera, controls, cars) {
  let fly = null;
  let follow = null;
  let sun = null; // { dir: () => Vector3, saved: { maxPolar, minDist } }
  const SUN_POS = new THREE.Vector3(0, 1.7, 8.5); // staat voor het huis en kijkt naar de zon
  const tmp = new THREE.Vector3();
  const look = new THREE.Vector3();

  function sunTarget(dir) {
    look.copy(dir);
    look.y = Math.max(look.y, 0.07); // onder de horizon: kijk naar de horizon in die richting
    return look.normalize().multiplyScalar(30).add(SUN_POS);
  }
  function endSun() {
    if (!sun) return;
    controls.maxPolarAngle = sun.saved.maxPolar;
    controls.minDistance = sun.saved.minDist;
    sun = null;
  }

  // wie zelf gaat slepen onderbreekt de vlucht
  controls.addEventListener('start', () => {
    fly = null;
    endSun();
  });

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  return {
    flyTo(name) {
      const p = PRESETS[name];
      if (!p) return;
      follow = null;
      endSun();
      const toPos = new THREE.Vector3(...p.pos);
      const toTarget = new THREE.Vector3(...p.target);
      if (REDUCED) {
        camera.position.copy(toPos);
        controls.target.copy(toTarget);
        return;
      }
      fly = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos, toTarget, t: 0 };
    },
    // Kijk vanaf een vast punt naar de zon en blijf hem volgen terwijl hij beweegt
    followSun(on, dirFn) {
      if (!on) return endSun();
      follow = null;
      if (!sun) sun = { dir: dirFn, saved: { maxPolar: controls.maxPolarAngle, minDist: controls.minDistance } };
      sun.dir = dirFn;
      controls.maxPolarAngle = Math.PI; // de camera kijkt omhoog: geen vloerlimiet
      controls.minDistance = 0.01;
      const toTarget = sunTarget(dirFn());
      if (REDUCED) {
        camera.position.copy(SUN_POS);
        controls.target.copy(toTarget);
        return;
      }
      fly = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos: SUN_POS.clone(), toTarget, t: 0 };
    },
    get sunActive() {
      return sun !== null;
    },
    follow(index) {
      fly = null;
      endSun();
      follow = index === null ? null : cars[index];
    },
    get following() {
      return follow !== null;
    },
    update(dt) {
      if (fly) {
        fly.t = Math.min(1, fly.t + dt / 1.6);
        const e = ease(fly.t);
        camera.position.lerpVectors(fly.fromPos, fly.toPos, e);
        controls.target.lerpVectors(fly.fromTarget, fly.toTarget, e);
        if (fly.t >= 1) fly = null;
      }
      if (sun && !fly) {
        controls.target.lerp(sunTarget(sun.dir()), Math.min(1, dt * 4));
      }
      if (follow) {
        follow.getWorldPosition(tmp);
        tmp.y += 0.6;
        const delta = tmp.sub(controls.target).multiplyScalar(Math.min(1, dt * 4));
        controls.target.add(delta);
        camera.position.add(delta);
      }
    },
  };
}
