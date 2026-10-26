import * as THREE from 'three';
import * as tex from './textures.js';

// Vaste punten voor kabels en deeltjes (zie flows.js)
export const LAYOUT = {
  meter: new THREE.Vector3(-2.1, 1.0, -1),
  pole: new THREE.Vector3(-6, 4.6, 1.5),
  battery: new THREE.Vector3(-3, 0.3, -0.25),
  chargers: [new THREE.Vector3(-0.55, 0.8, 3.1), new THREE.Vector3(0.55, 0.8, 3.1)],
  turbines: [new THREE.Vector3(5.5, 3.5, -1.8), new THREE.Vector3(7, 3.5, -4.3)],
  panels: new THREE.Vector3(0, 3.35, 1.2),
};

// Dakgeometrie: zadeldak met nok in oost-westrichting
const HALF_SPAN = 2.3;
const EAVE_Y = 2.45;
const RIDGE_Y = 4.05;
const SLOPE = Math.atan2(RIDGE_Y - EAVE_Y, HALF_SPAN);

const std = (params) => new THREE.MeshStandardMaterial(params);

function setHeat(root, value) {
  root.traverse((m) => m.isMesh && (m.userData.heat = value));
}

// Lage-poly auto: geëxtrudeerd zijprofiel, ruiten, wielen met velgen, lampen
function createCar(color) {
  const car = new THREE.Group();
  const paint = std({ color, metalness: 0.5, roughness: 0.32 });
  const glass = std({ color: 0x1d2a38, metalness: 0.6, roughness: 0.1 });
  const trim = std({ color: 0x15181b, roughness: 0.8 });

  const extrude = (points, depth, bevel = 0.03) => {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2 });
    geometry.rotateY(-Math.PI / 2); // lengte langs +z
    geometry.translate(depth / 2, 0, 0);
    return geometry;
  };

  const body = new THREE.Mesh(
    extrude([[-1.0, 0.22], [1.0, 0.22], [1.02, 0.45], [0.62, 0.62], [-0.78, 0.62], [-1.02, 0.52]], 0.82),
    paint
  );
  const cabin = new THREE.Mesh(extrude([[0.6, 0.62], [0.34, 0.96], [-0.42, 0.96], [-0.76, 0.62]], 0.74, 0.015), glass);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.03, 0.78), paint);
  roof.position.set(0, 0.97, -0.04);
  const bumperFront = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.1, 0.05), trim);
  bumperFront.position.set(0, 0.3, 1.04);
  const bumperRear = bumperFront.clone();
  bumperRear.position.z = -1.04;
  car.add(body, cabin, roof, bumperFront, bumperRear);

  const tire = new THREE.CylinderGeometry(0.22, 0.22, 0.17, 18);
  tire.rotateZ(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(0.13, 0.13, 0.175, 12);
  rim.rotateZ(Math.PI / 2);
  const tireMat = std({ color: 0x151515, roughness: 0.9 });
  const rimMat = std({ color: 0xb4b9bf, metalness: 0.8, roughness: 0.3 });
  [[-0.43, 0.62], [0.43, 0.62], [-0.43, -0.62], [0.43, -0.62]].forEach(([x, z]) => {
    const t = new THREE.Mesh(tire, tireMat);
    t.position.set(x, 0.22, z);
    const r = new THREE.Mesh(rim, rimMat);
    r.position.set(x, 0.22, z);
    car.add(t, r);
  });

  const head = std({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 0.4 });
  const tail = std({ color: 0xaa1111, emissive: 0xff2200, emissiveIntensity: 0.3 });
  [-0.3, 0.3].forEach((x) => {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.03), head);
    h.position.set(x, 0.45, 1.05);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.03), tail);
    t.position.set(x, 0.5, -1.05);
    car.add(h, t);
  });
  return car;
}

// Lage-poly bewoner met heupen en schouders als draaipunten voor de loopanimatie
function createPerson() {
  const person = new THREE.Group();
  const jacket = std({ color: 0x2f4f5f, roughness: 0.85 });
  const trousers = std({ color: 0x2b2f36, roughness: 0.9 });
  const skin = std({ color: 0xe0b794, roughness: 0.7 });
  const hair = std({ color: 0x3a2a1e, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.32, 4, 8), jacket);
  torso.scale.z = 0.7;
  torso.position.y = 1.0;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), skin);
  head.position.y = 1.4;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair);
  cap.position.y = 1.42;
  person.add(torso, head, cap);

  const limb = (radius, length, material) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 6), material);
    mesh.position.y = -(length / 2 + radius);
    pivot.add(mesh);
    return pivot;
  };
  const legL = limb(0.065, 0.62, trousers);
  const legR = limb(0.065, 0.62, trousers);
  legL.position.set(-0.07, 0.8, 0);
  legR.position.set(0.07, 0.8, 0);
  const armL = limb(0.045, 0.4, jacket);
  const armR = limb(0.045, 0.4, jacket);
  armL.position.set(-0.19, 1.2, 0);
  armR.position.set(0.19, 1.2, 0);
  person.add(legL, legR, armL, armR);
  person.userData.parts = { legL, legR, armL, armR };
  return person;
}

export function createHouse() {
  const house = new THREE.Group();

  // Materialen
  const plasterTex = tex.plaster();
  const wallMat = std({ map: plasterTex.map, bumpMap: plasterTex.bump, bumpScale: 0.6, roughness: 0.95, side: THREE.DoubleSide });
  const brickTex = tex.brick([140, 70, 54], [3, 0.3]);
  const plinthMat = std({ map: brickTex.map, bumpMap: brickTex.bump, bumpScale: 1.2, roughness: 0.9 });
  const tiles = tex.roofTiles();
  [tiles.map, tiles.bump].forEach((t) => t.repeat.set(1.5, 1.1));
  const roofMat = std({ map: tiles.map, bumpMap: tiles.bump, bumpScale: 2, roughness: 0.75, side: THREE.DoubleSide });
  const ridgeMat = std({ color: 0x5b2a22, roughness: 0.8 });
  const white = std({ color: 0xdedbd3, roughness: 0.6 });
  const metal = std({ color: 0x80868c, metalness: 0.6, roughness: 0.45 });

  const walls = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 4), wallMat);
  walls.position.set(0, 1.25, 0);
  house.add(walls);

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.3, 4.1), plinthMat);
  plinth.position.y = 0.15;
  house.add(plinth);

  // Zadeldak: twee dakvlakken, gevels aan de kopse kanten, nokpannen
  const slopeLen = Math.hypot(HALF_SPAN, RIDGE_Y - EAVE_Y);
  const roofSouth = new THREE.Mesh(new THREE.PlaneGeometry(4.8, slopeLen), roofMat);
  roofSouth.rotation.x = -(Math.PI / 2 - SLOPE);
  roofSouth.position.set(0, (EAVE_Y + RIDGE_Y) / 2, HALF_SPAN / 2);
  const roofNorth = new THREE.Mesh(new THREE.PlaneGeometry(4.8, slopeLen), roofMat);
  roofNorth.rotation.x = -(Math.PI / 2 + SLOPE);
  roofNorth.position.set(0, (EAVE_Y + RIDGE_Y) / 2, -HALF_SPAN / 2);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.1, 0.22), ridgeMat);
  ridge.position.y = RIDGE_Y + 0.02;
  house.add(roofSouth, roofNorth, ridge);

  const gableShape = new THREE.Shape([new THREE.Vector2(-2, 2.4), new THREE.Vector2(2, 2.4), new THREE.Vector2(2, 2.66), new THREE.Vector2(0, RIDGE_Y), new THREE.Vector2(-2, 2.66)]);
  const gables = [-2.0, 2.0].map((x) => {
    const geometry = new THREE.ShapeGeometry(gableShape);
    geometry.rotateY(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, wallMat);
    mesh.position.x = x;
    house.add(mesh);
    return mesh;
  });

  // Goten en regenpijpen
  const gutters = [HALF_SPAN + 0.02, -(HALF_SPAN + 0.02)].map((z) => {
    const gutter = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.07, 0.08), metal);
    gutter.position.set(0, EAVE_Y - 0.04, z);
    house.add(gutter);
    return gutter;
  });
  const pipes = [[2.05, 2.06], [-2.05, 2.06]].map(([x, z]) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.35, 8), metal);
    pipe.position.set(x, 1.27, z);
    house.add(pipe);
    return pipe;
  });

  // Voordeur met kozijn, klink en stoep
  const woodTex = tex.wood([108, 72, 46], [1, 1], 3);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.6), std({ map: woodTex.map, roughness: 0.7 }));
  door.position.set(0, 0.8, 2.01);
  house.add(door);
  const doorParts = [door];
  [[-0.54, 0.84, 0.07, 1.68], [0.54, 0.84, 0.07, 1.68], [0, 1.66, 1.15, 0.07]].forEach(([x, y, w, h]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), white);
    bar.position.set(x, y, 2.03);
    house.add(bar);
    doorParts.push(bar);
  });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 8), metal);
  handle.position.set(0.35, 0.85, 2.06);
  house.add(handle);
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.55), std({ color: 0x9a9690, roughness: 0.95 }));
  step.position.set(0, 0.05, 2.28);
  house.add(step);
  doorParts.push(handle, step);

  // Ramen: kozijn met roede, donker interieur erachter, ruit met pivot, vensterbank
  const frameMat = white;
  const windows = [-1.2, 1.2].map((x, index) => {
    const frame = new THREE.Group();
    frame.position.set(x, 1.5, 2.02);
    const bar = (w, h, px, py) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), frameMat);
      m.position.set(px, py, 0);
      frame.add(m);
    };
    bar(0.9, 0.06, 0, 0.42);
    bar(0.9, 0.06, 0, -0.42);
    bar(0.06, 0.9, -0.42, 0);
    bar(0.06, 0.9, 0.42, 0);
    bar(0.035, 0.78, 0, 0);
    bar(0.78, 0.035, 0, 0);
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), std({ color: 0x1a232c, roughness: 0.9 }));
    dark.position.z = -0.005;
    frame.add(dark);
    house.add(frame);

    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.05, 0.18), std({ color: 0xb6b2aa, roughness: 0.9 }));
    sill.position.set(x, 1.04, 2.08);
    house.add(sill);
    frame.userData.sill = sill;

    const pivot = new THREE.Group();
    pivot.position.set(x - 0.4, 1.5, 2.06);
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.8),
      std({ color: 0xa9c9dc, transparent: true, opacity: 0.38, roughness: 0.04, metalness: 0.1, envMapIntensity: 1.4, emissive: 0xffd080, emissiveIntensity: 0 })
    );
    pane.position.x = 0.4;
    pane.userData.windowIndex = index;
    pivot.add(pane);
    house.add(pivot);
    return { pivot, pane, frame, sill, open: 0 };
  });

  // Schoorsteen in baksteen met dakventilator
  const chimneyBrick = tex.brick([132, 64, 48], [1, 2]);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.5), std({ map: chimneyBrick.map, bumpMap: chimneyBrick.bump, bumpScale: 1.2, roughness: 0.9 }));
  chimney.position.set(1.3, 3.95, -0.7);
  const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.62), std({ color: 0x8c8f93, roughness: 0.9 }));
  chimneyCap.position.set(1.3, 4.62, -0.7);
  house.add(chimney, chimneyCap);

  const fan = new THREE.Group();
  fan.position.set(1.3, 4.78, -0.7);
  const bladeMaterial = std({ color: 0xcfd3d6, metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.015, 0.09), bladeMaterial);
    blade.position.x = 0.17;
    const holder = new THREE.Group();
    holder.rotation.y = (i * Math.PI) / 2;
    holder.add(blade);
    fan.add(holder);
  }
  const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 10), metal);
  fan.add(fanHub);
  house.add(fan);

  // Radiator aan de oostkant met ribben; gloeit als verwarming actief is
  const heaterMaterial = std({ color: 0x70767c, emissive: 0xff4a1a, emissiveIntensity: 0, roughness: 0.5, metalness: 0.4 });
  const heater = new THREE.Group();
  const heaterBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 1.4), heaterMaterial);
  heater.add(heaterBody);
  for (let i = 0; i < 9; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.07), heaterMaterial);
    fin.position.set(0.05, 0, -0.6 + i * 0.15);
    heater.add(fin);
  }
  heater.position.set(2.06, 0.9, 0);
  house.add(heater);

  // Zonnepanelen op het zuidelijke dakvlak: 3 x 2 met aluminium kader
  const solarGroup = new THREE.Group();
  const out = 0.05;
  solarGroup.position.set(0, (EAVE_Y + RIDGE_Y) / 2 + out * Math.cos(SLOPE), HALF_SPAN / 2 + out * Math.sin(SLOPE));
  solarGroup.rotation.x = -(Math.PI / 2 - SLOPE);
  const cells = tex.solarCells();
  const panelMaterial = std({ map: cells.map, color: 0xffffff, emissive: 0x2255ff, emissiveIntensity: 0, emissiveMap: cells.map, metalness: 0.6, roughness: 0.22, envMapIntensity: 1.5 });
  const frameAlu = std({ color: 0xaeb4ba, metalness: 0.7, roughness: 0.4 });
  for (let c = -1; c <= 1; c++) {
    for (let r = -0.5; r <= 0.5; r += 1) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.67, 0.03), frameAlu);
      frame.position.set(c * 1.0, r * 0.7, 0);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.62), panelMaterial);
      glass.position.set(c * 1.0, r * 0.7, 0.017);
      solarGroup.add(frame, glass);
    }
  }
  house.add(solarGroup);

  // Rolluiken: zakken over het raam (scale.y 0 = open)
  const shutterGeometry = new THREE.BoxGeometry(0.95, 1, 0.06);
  shutterGeometry.translate(0, -0.5, 0); // bovenkant op de oorsprong
  const shutterMaterial = std({ color: 0x6b7077, roughness: 0.6, metalness: 0.3 });
  const shutters = [-1.2, 1.2].map((x) => {
    const shutter = new THREE.Mesh(shutterGeometry, shutterMaterial);
    shutter.position.set(x, 1.97, 2.14);
    shutter.scale.y = 0.001;
    house.add(shutter);
    return shutter;
  });

  // Thuisbatterij aan de westkant met vulbalk
  const batteryBox = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.5), std({ color: 0xd8dcdf, metalness: 0.3, roughness: 0.5 }));
  batteryBox.position.set(-3, 0.6, 0);
  const batteryTop = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.05, 0.54), std({ color: 0x4a4f55, roughness: 0.7 }));
  batteryTop.position.set(-3, 1.225, 0);
  const batteryDisplay = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.04, 0.02), std({ color: 0x14181c, roughness: 0.6 }));
  batteryDisplay.position.set(-3, 0.62, 0.255);
  house.add(batteryBox, batteryTop, batteryDisplay);
  const fillGeometry = new THREE.BoxGeometry(0.5, 1, 0.04);
  fillGeometry.translate(0, 0.5, 0);
  const batteryFill = new THREE.Mesh(fillGeometry, std({ color: 0x3f9f63, emissive: 0x1a7a40, emissiveIntensity: 0.6 }));
  batteryFill.position.set(-3, 0.1, 0.27);
  batteryFill.scale.y = 0.001;
  house.add(batteryFill);

  // Windmolens in het oosten; rotor kijkt naar het zuiden
  const towerMaterial = std({ color: 0xf0f1f2, roughness: 0.5 });
  const bladeShape = new THREE.Shape([new THREE.Vector2(-0.05, 0), new THREE.Vector2(0.06, 0.1), new THREE.Vector2(0.03, 1.2), new THREE.Vector2(-0.01, 1.25), new THREE.Vector2(-0.05, 0.5)]);
  const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.02, bevelEnabled: false });
  const towers = [];
  const windParts = [];
  const rotors = [[5.5, -2], [7, -4.5]].map(([x, z]) => {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 3.5, 12), towerMaterial);
    tower.position.set(x, 1.75, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.14, 14), std({ color: 0x9c9a95, roughness: 0.95 }));
    base.position.set(x, 0.07, z);
    const nacelle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.5), towerMaterial);
    nacelle.position.set(x, 3.52, z);
    house.add(tower, base, nacelle);
    towers.push(tower);
    windParts.push(base, nacelle);

    const rotor = new THREE.Group();
    rotor.position.set(x, 3.52, z + 0.3);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 12), towerMaterial);
    hub.scale.z = 1.4;
    rotor.add(hub);
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeometry, towerMaterial);
      const holder = new THREE.Group();
      holder.rotation.z = (i * Math.PI * 2) / 3;
      blade.rotation.y = 0.18; // lichte bladhoek
      holder.add(blade);
      rotor.add(holder);
    }
    house.add(rotor);
    return rotor;
  });

  // Elektrische auto's met laadpalen op de oprit
  const cars = [
    { x: -1.4, color: 0x2a5d9f },
    { x: 1.4, color: 0xb7bcc2 },
  ].map(({ x, color }) => {
    const car = createCar(color);
    car.position.set(x, 0, 4.3);
    car.userData.homeX = x;
    house.add(car);
    return car;
  });

  const chargerPosts = [];
  const chargerMaterials = [-1.4, 1.4].map((x) => {
    const ledMaterial = std({ color: 0x1a1a1a, emissive: 0x00ff66, emissiveIntensity: 0 });
    const post = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.14), std({ color: 0x4a4f55, roughness: 0.6, metalness: 0.4 }));
    body.position.y = 0.45;
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.28, 0.02), std({ color: 0x1c2024, roughness: 0.4 }));
    face.position.set(0, 0.68, 0.075);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.02), ledMaterial);
    led.position.set(0, 0.8, 0.088);
    post.add(body, face, led);
    post.position.set(x < 0 ? x + 0.85 : x - 0.85, 0, 3.1);
    house.add(post);
    chargerPosts.push(post);
    return ledMaterial;
  });

  // Bewoner: loopt tussen de voordeur en de straat
  const resident = createPerson();
  resident.visible = false;
  house.add(resident);

  // Binnenlicht dat het comfort toont
  const indoorLight = new THREE.PointLight(0xffcc88, 0, 6);
  indoorLight.position.set(0, 1.5, 0);
  house.add(indoorLight);

  // Binnenkant: slaapkamer (west) en woonkamer (oost) met tussenmuur en meubels
  const interior = [];
  const floorMaterials = [-1, 1].map((x) => {
    const material = std({ color: 0xcccccc });
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 3.9), material);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(x, 0.03, 0);
    house.add(floorMesh);
    interior.push(floorMesh);
    return material;
  });
  const addBox = (w, h, d, x, y, z, color) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std({ color, roughness: 0.85 }));
    mesh.position.set(x, y, z);
    house.add(mesh);
    interior.push(mesh);
  };
  addBox(0.1, 2.2, 2.6, 0, 1.1, -0.7, 0xf4efe2); // tussenmuur met deuropening vooraan
  addBox(1.2, 0.5, 0.6, 1.1, 0.28, -1.5, 0x59606b); // bank
  addBox(0.7, 0.3, 0.7, 1.1, 0.18, -0.3, 0x8a6a4a); // tafel
  addBox(1.0, 0.4, 1.8, -1.1, 0.23, -0.9, 0x6f8fb5); // bed
  addBox(0.5, 1.6, 0.8, -1.7, 0.83, 1.2, 0x8a6a4a); // kast

  // Meterkast, aansluitkabel en elektriciteitspaal (het net)
  const meter = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.3), std({ color: 0xa4abb2, roughness: 0.6, metalness: 0.3 }));
  meter.position.copy(LAYOUT.meter);
  house.add(meter);
  const conduit = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.5, 0.04), std({ color: 0x2a2d31, roughness: 0.8 }));
  conduit.position.set(-2.05, 1.75, -1);
  house.add(conduit);

  const pole = new THREE.Group();
  const woodPole = std({ color: 0x5b4a38, roughness: 0.95 });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 5, 10), woodPole);
  pillar.position.set(LAYOUT.pole.x, 2.5, LAYOUT.pole.z);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), woodPole);
  cross.position.set(LAYOUT.pole.x, 4.7, LAYOUT.pole.z);
  pole.add(pillar, cross);
  [-0.5, 0, 0.5].forEach((dx) => {
    const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 8), std({ color: 0xd9d4c7, roughness: 0.4 }));
    insulator.position.set(LAYOUT.pole.x + dx, 4.79, LAYOUT.pole.z);
    pole.add(insulator);
  });
  // Doorhangende draad van de paal naar de gevel
  const wirePoints = [new THREE.Vector3(LAYOUT.pole.x + 0.5, 4.8, LAYOUT.pole.z), new THREE.Vector3(-4.2, 4.0, 0.7), new THREE.Vector3(-2.15, 2.52, -1)];
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wirePoints), 24, 0.01, 4), std({ color: 0x111111, roughness: 0.8 }));
  pole.add(wire);
  house.add(pole);

  // Tags: doorsnede (clip), isolatiewaarde voor de warmtecamera (heat) en hover-inspector (inspect)
  const clipRoots = [walls, plinth, roofSouth, roofNorth, ridge, ...gables, ...gutters, ...pipes, ...doorParts, chimney, chimneyCap, fan, solarGroup, ...shutters, conduit, ...interior];
  windows.forEach((w) => clipRoots.push(w.frame, w.sill, w.pivot));
  clipRoots.forEach((root) => root.traverse((m) => m.isMesh && (m.userData.clip = true)));

  setHeat(walls, 0.55);
  setHeat(plinth, 0.45);
  [roofSouth, roofNorth, ridge, ...gables].forEach((o) => setHeat(o, 0.35));
  [...doorParts].forEach((o) => setHeat(o, 0.6));
  windows.forEach((w) => {
    setHeat(w.frame, 0.8);
    setHeat(w.pane, 0.9);
    setHeat(w.sill, 0.5);
  });
  setHeat(chimney, 0.5);
  setHeat(heater, 0.3);

  const inspectables = [];
  const tag = (id, label, ...objects) => {
    inspectables.push({ id, label, objects });
    objects.forEach((root) => root.traverse((m) => m.isMesh && (m.userData.inspectId = id)));
  };
  // De hele woning als één geheel, zodat de outline alleen de buitenrand volgt (geen rand rond deur en ramen)
  tag('house', 'Woning', walls, roofSouth, roofNorth, ridge, plinth, ...gables, ...gutters, ...pipes, ...doorParts, chimney, chimneyCap, ...windows.map((w) => w.sill), ...windows.map((w) => w.frame), ...windows.map((w) => w.pivot));
  tag('solar', 'Zonnepanelen', solarGroup);
  tag('battery', 'Thuisbatterij', batteryBox, batteryTop, batteryDisplay, batteryFill);
  tag('heater', 'Radiator', heater);
  tag('meter', 'Meterkast', meter, conduit);
  tag('grid', 'Elektriciteitsnet', pole);
  tag('car0', 'Elektrische auto 1', cars[0]);
  tag('car1', 'Elektrische auto 2', cars[1]);
  tag('charger0', 'Laadpaal 1', chargerPosts[0]);
  tag('charger1', 'Laadpaal 2', chargerPosts[1]);
  tag('wind0', 'Windmolen 1', rotors[0], towers[0]);
  tag('wind1', 'Windmolen 2', rotors[1], towers[1]);
  tag('window0', 'Raam (slaapkamer)', windows[0].frame, windows[0].pane);
  tag('window1', 'Raam (woonkamer)', windows[1].frame, windows[1].pane);

  return {
    house,
    windows,
    fan,
    heaterMaterial,
    indoorLight,
    panelMaterial,
    roofs: [roofSouth, roofNorth],
    solarGroup,
    shutters,
    batteryFill,
    resident,
    residentParts: resident.userData.parts,
    rotors,
    cars,
    chargerMaterials,
    floorMaterials,
    inspectables,
  };
}
