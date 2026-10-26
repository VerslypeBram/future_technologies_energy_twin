import * as THREE from 'three';

// Doorsnede ("poppenhuis"): 0-50% haalt het dak weg, 50-100% snijdt de voorkant weg.
export function createCut(renderer, house) {
  renderer.localClippingEnabled = true;
  const roofPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10); // verbergt alles boven y = constant
  const frontPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 10); // verbergt alles voor z = constant
  const planes = [roofPlane, frontPlane];

  const materials = new Set();
  house.traverse((m) => {
    if (m.isMesh && m.userData.clip) [].concat(m.material).forEach((mat) => materials.add(mat));
  });
  materials.forEach((mat) => {
    mat.clippingPlanes = planes;
    mat.clipShadows = true;
    mat.side = THREE.DoubleSide;
  });

  let value = 0;
  return {
    planes,
    get value() {
      return value;
    },
    set(v) {
      value = v;
      roofPlane.constant = v <= 0 ? 10 : THREE.MathUtils.lerp(10, 2.46, Math.min(1, v / 0.5));
      frontPlane.constant = v <= 0.5 ? 10 : THREE.MathUtils.lerp(3, -0.4, (v - 0.5) / 0.5);
    },
  };
}
