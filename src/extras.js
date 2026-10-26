import * as THREE from 'three';

// Extra installaties rond het huis: warmtepomp (buitenunit), tweede batterij en regenton met pomp.
export function createExtras(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const std = (p) => new THREE.MeshStandardMaterial(p);
  const casing = std({ color: 0xc9ced2, roughness: 0.55, metalness: 0.35 });
  const dark = std({ color: 0x1a1d21, roughness: 0.7 });
  const bladeMat = std({ color: 0x6b7279, roughness: 0.5, metalness: 0.5 });
  const put = (mesh, x, y, z, cast = true) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    return mesh;
  };

  // Warmtepomp: kast tegen de westgevel met een draaiende ventilator
  const heatPump = new THREE.Group();
  heatPump.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85, 0.95), casing), 0, 0, 0));
  heatPump.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 24), dark), -0.215, 0.05, 0, false));
  heatPump.children[1].rotation.z = Math.PI / 2;
  const fan = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.28, 0.07), bladeMat);
    blade.position.y = 0.14;
    const arm = new THREE.Group();
    arm.rotation.x = (i * Math.PI * 2) / 3;
    arm.add(blade);
    fan.add(arm);
  }
  fan.position.set(-0.23, 0.05, 0);
  heatPump.add(fan);
  const status = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), std({ color: 0x111111, emissive: 0x00ff66, emissiveIntensity: 0 }));
  status.position.set(-0.215, -0.33, 0.38);
  heatPump.add(status);
  heatPump.position.set(-3.0, 0.45, -1.7);
  group.add(heatPump);

  // Tweede batterij naast de eerste (die staat op x = -3, z = 0)
  const battery2 = new THREE.Group();
  battery2.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.5), std({ color: 0xd8dcdf, metalness: 0.3, roughness: 0.5 })), 0, 0, 0));
  battery2.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.05, 0.54), std({ color: 0x4a4f55, roughness: 0.7 })), 0, 0.625, 0));
  battery2.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.04, 0.02), dark), 0, 0.02, 0.255, false));
  const fillGeometry = new THREE.BoxGeometry(0.46, 0.9, 0.02);
  fillGeometry.translate(0, 0.45, 0); // onderkant op de oorsprong
  const fill2 = new THREE.Mesh(fillGeometry, std({ color: 0x3f9f63, emissive: 0x1a7a40, emissiveIntensity: 0.6 }));
  fill2.position.set(0, -0.5, 0.27);
  battery2.add(fill2);
  battery2.position.set(-3, 0.6, -0.65);
  group.add(battery2);

  // Regenton met pomp en peilmeter, tegen de oostgevel (noordkant)
  const barrel = new THREE.Group();
  barrel.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 1.0, 20), std({ color: 0x2f5d73, roughness: 0.6 })), 0, 0, 0));
  barrel.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 20), std({ color: 0x244858, roughness: 0.6 })), 0, 0.52, 0));
  barrel.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.02), dark), 0, 0, 0.345, false));
  const levelGeometry = new THREE.BoxGeometry(0.05, 0.76, 0.02);
  levelGeometry.translate(0, 0.38, 0);
  const level = new THREE.Mesh(levelGeometry, std({ color: 0x4aa8e0, emissive: 0x1a6fa0, emissiveIntensity: 0.7 }));
  level.position.set(0, -0.38, 0.356);
  level.scale.y = 0.001;
  barrel.add(level);
  const pump = put(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.2), casing), 0.5, -0.4, 0);
  const pumpLed = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), std({ color: 0x111111, emissive: 0x00ff66, emissiveIntensity: 0 }));
  pumpLed.position.set(0.5, -0.3, 0.105);
  barrel.add(pump, pumpLed);
  barrel.position.set(2.55, 0.5, -1.6);
  group.add(barrel);

  let shown = true;

  return {
    group,
    update(dt, { heatPumpOn, heating, extraBattery, batteryFraction, tankFraction, pumping }) {
      heatPump.visible = shown && heatPumpOn;
      battery2.visible = shown && extraBattery;
      barrel.visible = shown;
      if (heatPumpOn && heating) fan.rotation.x += dt * 14;
      status.material.emissiveIntensity = heatPumpOn && heating ? 2 : 0;
      fill2.scale.y = Math.max(0.001, batteryFraction);
      level.scale.y = Math.max(0.001, tankFraction);
      pumpLed.material.emissiveIntensity = pumping ? 2 : 0;
    },
    setVisible(v) {
      shown = v;
    },
  };
}
