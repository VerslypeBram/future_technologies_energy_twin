import * as THREE from 'three';

// Buitenverlichting: straatlantaarns, lamp boven de voordeur en tuinpaaltjes.
// Weinig echte lichten (3 PointLights) en verder emissive vlakken met een gloed, om de render snel te houden.
const WARM = 0xffd9a0;
const glowTexture = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();

export function createOutdoor(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const metal = new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: 0.5, metalness: 0.6 });
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: WARM, emissiveIntensity: 0 });
  const glowMaterial = new THREE.SpriteMaterial({ map: glowTexture, color: WARM, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const poolMaterial = new THREE.MeshBasicMaterial({ map: glowTexture, color: WARM, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

  const lights = []; // { light, base }
  const addLight = (x, y, z, base, distance) => {
    const light = new THREE.PointLight(WARM, 0, distance, 2);
    light.position.set(x, y, z);
    group.add(light);
    lights.push({ light, base });
  };
  const addGlow = (x, y, z, size) => {
    const sprite = new THREE.Sprite(glowMaterial);
    sprite.position.set(x, y, z);
    sprite.scale.set(size, size, 1);
    group.add(sprite);
  };

  // Straatlantaarns langs de stoep (arm boven de straat)
  const streetXs = [-11, 6.5, 24];
  streetXs.forEach((x, i) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 5.2, 10), metal);
    pole.position.set(x, 2.6, 11.0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.3), metal);
    arm.position.set(x, 5.2, 11.6);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.26), lampMaterial);
    head.position.set(x, 5.12, 12.15);
    group.add(pole, arm, head);
    addGlow(x, 5.05, 12.15, 1.7);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), poolMaterial);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.03, 12.2);
    group.add(pool);
    if (i < 2) addLight(x, 5.0, 12.0, 70, 22);
  });

  // Lamp boven de voordeur (huis en oprit)
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.26, 12), lampMaterial);
  lantern.position.set(0, 1.95, 2.14);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.14), metal);
  bracket.position.set(0, 2.1, 2.07);
  group.add(lantern, bracket);
  addGlow(0, 1.95, 2.2, 0.8);
  addLight(0, 1.9, 2.6, 7, 8);

  // Tuinpaaltjes langs de oprit
  const bollardPositions = [];
  [-2.75, 2.75].forEach((x) => [4.6, 7.4, 10.0].forEach((z) => bollardPositions.push([x, z])));
  const bodies = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.07, 0.55, 8), metal, bollardPositions.length);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 10, 8), lampMaterial, bollardPositions.length);
  const m4 = new THREE.Matrix4();
  bollardPositions.forEach(([x, z], i) => {
    m4.makeTranslation(x, 0.28, z);
    bodies.setMatrixAt(i, m4);
    m4.makeTranslation(x, 0.62, z);
    heads.setMatrixAt(i, m4);
    addGlow(x, 0.62, z, 0.45);
  });
  group.add(bodies, heads);

  let on = true;
  let realLights = true;

  return {
    group,
    // level 0..1: 0 uit (dag), 1 vol (nacht)
    update(level) {
      lampMaterial.emissiveIntensity = 2.0 * level;
      glowMaterial.opacity = 0.55 * level;
      poolMaterial.opacity = 0.35 * level;
      lights.forEach(({ light, base }) => (light.intensity = realLights && on ? base * level : 0));
    },
    setLights(enabled) {
      realLights = enabled;
    },
    setVisible(v) {
      on = v;
      group.visible = v;
    },
  };
}
