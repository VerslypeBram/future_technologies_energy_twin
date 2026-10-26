import * as THREE from 'three';

// Sneeuwlaag als wit, doorschijnend vlak boven het gras en het dak; de panelen hebben een eigen laag
// (die smelt sneller en kost opbrengst). De straat en stoep blijven schoon (geruimd).
export function createSnow({ yard, terrain, roofs, solarGroup, house, scene, clippingPlanes }) {
  const make = (extra = {}) =>
    new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.95, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...extra });

  const groundMat = make();
  const roofMat = make({ clippingPlanes, clipShadows: true, side: THREE.DoubleSide });
  const panelMat = make({ clippingPlanes, clipShadows: true, roughness: 0.8 });

  const yardSnow = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), groundMat);
  yardSnow.rotation.x = -Math.PI / 2;
  yardSnow.position.y = 0.014;
  yardSnow.receiveShadow = true;
  scene.add(yardSnow);

  // zelfde vorm als het terrein, net eronder zodat het kavel en de weg erboven uitsteken
  const terrainSnow = new THREE.Mesh(terrain.geometry, groundMat);
  terrainSnow.position.y = 0.012;
  terrainSnow.receiveShadow = true;
  scene.add(terrainSnow);

  const roofSnow = roofs.map((roof) => {
    const m = new THREE.Mesh(roof.geometry, roofMat);
    m.position.copy(roof.position);
    m.rotation.copy(roof.rotation);
    m.translateZ(0.035);
    m.receiveShadow = true;
    house.add(m);
    return m;
  });

  const panelSnow = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.4), panelMat);
  panelSnow.position.z = 0.045;
  solarGroup.add(panelSnow);

  let hidden = false;
  let ground = 0;
  let onPanels = 0;
  function apply() {
    const g = !hidden && ground > 0.01;
    yardSnow.visible = terrainSnow.visible = g;
    roofSnow.forEach((m) => (m.visible = g));
    panelSnow.visible = !hidden && onPanels > 0.01;
  }

  return {
    update(snow, snowOnPanels) {
      ground = Math.min(1, snow * 1.1);
      onPanels = snowOnPanels;
      groundMat.opacity = ground * 0.92;
      roofMat.opacity = ground;
      panelMat.opacity = Math.min(1, snowOnPanels * 1.2);
      apply();
    },
    // warmtecamera: geen sneeuwvlakken
    setVisible(v) {
      hidden = !v;
      apply();
    },
  };
}
