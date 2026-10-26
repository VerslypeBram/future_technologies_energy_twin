import * as THREE from 'three';
import * as tex from './textures.js';

const std = (params) => new THREE.MeshStandardMaterial(params);
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Zacht golvend terrein buiten de kavel; vlak bij het huis en rond de weg
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  const hills =
    0.5 * (Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.05) + 0.5 * Math.sin(x * 0.13 + z * 0.09) + 0.8 * Math.sin(x * 0.031 - z * 0.047)) * 6 +
    0.3 * Math.sin(x * 0.4 + z * 0.3) * Math.cos(z * 0.35);
  const awayFromYard = smooth(16, 60, r);
  const awayFromRoad = z > 0 ? smooth(4, 16, Math.abs(z - 13.8)) : 1;
  return hills * awayFromYard * awayFromRoad;
}

// Willekeurige maar herhaalbare getallen
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Een onregelmatige bladerbol voor bomen en struiken
function blobGeometry(radius, seed, detail = 1) {
  const rand = rng(seed);
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position;
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, 1 + (rand() - 0.5) * 0.3);
    const k = seen.get(key);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.9, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

export function createEnvironment(scene) {
  const decor = new THREE.Group();
  scene.add(decor);

  // Kavel (20 x 20) met fijn gras
  const yardTex = tex.grass([14, 14]);
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), std({ map: yardTex.map, bumpMap: yardTex.bump, bumpScale: 1.5, roughness: 1 }));
  yard.rotation.x = -Math.PI / 2;
  yard.receiveShadow = true;
  scene.add(yard);

  // Terrein daaromheen
  const terrainTex = tex.grass([90, 90]);
  const terrainGeometry = new THREE.PlaneGeometry(600, 600, 180, 180);
  terrainGeometry.rotateX(-Math.PI / 2);
  const tp = terrainGeometry.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setY(i, groundHeight(tp.getX(i), tp.getZ(i)) - 0.03);
  terrainGeometry.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeometry, std({ map: terrainTex.map, bumpMap: terrainTex.bump, bumpScale: 1, roughness: 1, color: 0xd8e4d0 }));
  scene.add(terrain);

  // Oprit en voetpad van klinkers
  const paverTex = tex.pavers([3, 6]);
  const pavers = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 9.1), std({ map: paverTex.map, bumpMap: paverTex.bump, bumpScale: 1.5, roughness: 0.95 }));
  pavers.rotation.x = -Math.PI / 2;
  pavers.position.set(0, 0.012, 7.05);
  pavers.receiveShadow = true;
  decor.add(pavers);
  const kerbMat = std({ color: 0x8c8a86, roughness: 0.95 });
  [-2.44, 2.44].forEach((x) => {
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 9.1), kerbMat);
    kerb.position.set(x, 0.04, 7.05);
    decor.add(kerb);
  });

  // Stoep en straat langs de kavel
  const sidewalkTex = tex.pavers([60, 1]);
  const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(300, 1.6), std({ map: sidewalkTex.map, bumpMap: sidewalkTex.bump, bumpScale: 1, roughness: 0.95, color: 0xbfbfbf }));
  sidewalk.rotation.x = -Math.PI / 2;
  sidewalk.position.set(0, 0.011, 10.8);
  sidewalk.receiveShadow = true;
  decor.add(sidewalk);
  const roadTex = tex.asphalt([60, 1]);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(300, 4.4), std({ map: roadTex.map, roughness: 0.95 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.008, 13.8);
  decor.add(road);
  [11.6, 16.0].forEach((z) => {
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(300, 0.12, 0.2), kerbMat);
    kerb.position.set(0, 0.06, z);
    decor.add(kerb);
  });
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.6, 0.12), std({ color: 0xdcdcd6, roughness: 0.9 }), 60);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) {
    m4.makeRotationX(-Math.PI / 2).setPosition(-90 + i * 3.1, 0.012, 13.8);
    dashes.setMatrixAt(i, m4);
  }
  decor.add(dashes);

  // Schutting (noord, oost, west) met palen en regels
  const woodTex = tex.wood([128, 96, 64], [10, 1], 8);
  const fenceMat = std({ map: woodTex.map, roughness: 0.9, side: THREE.DoubleSide });
  const fenceRuns = [
    { x: 0, z: -9.7, rot: 0, len: 19.4 },
    { x: 9.7, z: 0, rot: Math.PI / 2, len: 19.4 },
    { x: -9.7, z: 0, rot: Math.PI / 2, len: 19.4 },
  ];
  const postGeometry = new THREE.BoxGeometry(0.1, 1.35, 0.1);
  const postMat = std({ color: 0x6a5a48, roughness: 0.95 });
  fenceRuns.forEach(({ x, z, rot, len }) => {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.1), fenceMat);
    board.position.set(x, 0.75, z);
    board.rotation.y = rot;
    board.castShadow = true;
    board.receiveShadow = true;
    decor.add(board);
    const posts = Math.floor(len / 1.6) + 1;
    for (let i = 0; i < posts; i++) {
      const post = new THREE.Mesh(postGeometry, postMat);
      const offset = -len / 2 + i * (len / (posts - 1));
      post.position.set(rot ? x : x + offset, 0.675, rot ? z + offset : z);
      post.castShadow = true;
      decor.add(post);
    }
  });

  // Haag langs de straatkant, met opening voor de oprit
  const leafTex = tex.leaves([4, 1]);
  const hedgeMat = std({ map: leafTex.map, roughness: 1 });
  [[-6.1, 7.0], [6.1, 7.0]].forEach(([x, len]) => {
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(len, 1.0, 0.75), hedgeMat);
    hedge.position.set(x, 0.5, 9.65);
    hedge.castShadow = true;
    hedge.receiveShadow = true;
    decor.add(hedge);
  });

  // Bomen: stam + onregelmatige bladerkroon (flat shaded, twee groentinten)
  const barkMat = std({ color: 0x5a4632, roughness: 1 });
  const canopyA = std({ color: 0x4a7d3b, roughness: 0.95, flatShading: true });
  const canopyB = std({ color: 0x3b6a33, roughness: 0.95, flatShading: true });
  const blobs = [blobGeometry(1, 3), blobGeometry(1, 7), blobGeometry(1, 11)];
  const treeBlobs = []; // { mesh, base } voor seizoenen: bladeren groeien en vallen
  function tree(x, z, s, seed) {
    const rand = rng(seed);
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.22 * s, 2.4 * s, 8), barkMat);
    trunk.position.y = 1.2 * s;
    trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 5; i++) {
      const blob = new THREE.Mesh(blobs[i % 3], i % 2 ? canopyA : canopyB);
      const r = (0.9 + rand() * 0.5) * s;
      blob.scale.setScalar(r);
      blob.position.set((rand() - 0.5) * 1.3 * s, (2.7 + rand() * 1.2) * s, (rand() - 0.5) * 1.3 * s);
      blob.rotation.y = rand() * 6;
      blob.castShadow = true;
      g.add(blob);
      treeBlobs.push({ mesh: blob, base: r });
    }
    g.position.set(x, 0, z);
    decor.add(g);
  }
  tree(-7.4, -6.2, 1.25, 1);
  tree(8.2, -8.0, 1.0, 2);
  tree(-8.3, 3.8, 1.1, 3);
  tree(8.6, 4.2, 0.9, 4);
  tree(-4.6, -8.3, 0.8, 5);
  tree(4.2, -8.6, 1.15, 6);

  // Struiken voor de gevel
  const shrubMats = [canopyA, canopyB];
  [[-2.55, 2.25], [2.55, 2.25], [-2.7, 1.1], [2.7, 1.1], [-3.2, -2.2], [3.4, -1.0]].forEach(([x, z], k) => {
    const rand = rng(100 + k);
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const blob = new THREE.Mesh(blobs[(i + k) % 3], shrubMats[(i + k) % 2]);
      const r = 0.28 + rand() * 0.2;
      blob.scale.setScalar(r);
      blob.position.set((rand() - 0.5) * 0.55, r * 0.8, (rand() - 0.5) * 0.45);
      blob.castShadow = true;
      g.add(blob);
    }
    g.position.set(x, 0, z);
    decor.add(g);
  });

  // Bloembedden langs de gevel met kleine bloemen
  const soilMat = std({ color: 0x3a2d23, roughness: 1 });
  [-1.45, 1.45].forEach((x) => {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.32), soilMat);
    bed.position.set(x, 0.05, 2.25);
    decor.add(bed);
  });
  const flowerColors = [0xe8c547, 0xd9534f, 0xf4f1ea, 0xb06ab3];
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 5), std({ roughness: 0.8 }), 90);
  const rf = rng(200);
  const tmp = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < 90; i++) {
    tmp.position.set((i % 2 ? 1.45 : -1.45) + (rf() - 0.5) * 0.9, 0.13 + rf() * 0.1, 2.25 + (rf() - 0.5) * 0.26);
    tmp.updateMatrix();
    flowers.setMatrixAt(i, tmp.matrix);
    flowers.setColorAt(i, color.setHex(flowerColors[(rf() * flowerColors.length) | 0]));
  }
  decor.add(flowers);

  // Grasspollen verspreid over de kavel
  const tuftCount = 900;
  const tuftMat = std({ roughness: 1 });
  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.025, 0.28, 3), tuftMat, tuftCount);
  const rt = rng(300);
  let placed = 0;
  while (placed < tuftCount) {
    const x = (rt() - 0.5) * 19.2;
    const z = (rt() - 0.5) * 19.2;
    const nearHouse = Math.abs(x) < 3.2 && z > -3.2 && z < 3;
    const onDrive = Math.abs(x) < 2.6 && z > 2.3;
    const nearWind = Math.hypot(x - 6.2, z + 3.2) < 1.4;
    if (nearHouse || onDrive || nearWind) continue;
    const s = 0.6 + rt() * 0.9;
    tmp.position.set(x, 0.12 * s, z);
    tmp.scale.set(s, s, s);
    tmp.rotation.set((rt() - 0.5) * 0.3, rt() * 6, (rt() - 0.5) * 0.3);
    tmp.updateMatrix();
    tufts.setMatrixAt(placed, tmp.matrix);
    tufts.setColorAt(placed, color.setRGB(0.09 + rt() * 0.08, 0.2 + rt() * 0.12, 0.05 + rt() * 0.06));
    placed++;
  }
  decor.add(tufts);

  // Brievenbus bij de oprit
  const mailPost = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.0, 0.07), postMat);
  mailPost.position.set(3.1, 0.5, 9.3);
  const mailBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.22), std({ color: 0x2f3a46, roughness: 0.6, metalness: 0.3 }));
  mailBox.position.set(3.1, 1.08, 9.3);
  mailPost.castShadow = mailBox.castShadow = true;
  decor.add(mailPost, mailBox);

  // Bomenrij op afstand: dennen als instanced meshes tegen de horizon
  const pineCount = 220;
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 1.6, 6);
  const coneGeo = new THREE.ConeGeometry(1.3, 5, 7);
  const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, pineCount);
  const cones = new THREE.InstancedMesh(coneGeo, std({ roughness: 1, flatShading: true }), pineCount);
  const rp = rng(400);
  let n = 0;
  while (n < pineCount) {
    const angle = rp() * Math.PI * 2;
    const radius = 28 + rp() * 70;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (z > 6 && z < 21) continue; // niet op de weg
    const y = groundHeight(x, z);
    const s = 0.8 + rp() * 1.1;
    tmp.rotation.set(0, rp() * 6, 0);
    tmp.scale.set(s, s, s);
    tmp.position.set(x, y + 0.8 * s, z);
    tmp.updateMatrix();
    trunks.setMatrixAt(n, tmp.matrix);
    tmp.position.set(x, y + 3.6 * s, z);
    tmp.updateMatrix();
    cones.setMatrixAt(n, tmp.matrix);
    cones.setColorAt(n, color.setRGB(0.1 + rp() * 0.08, 0.25 + rp() * 0.15, 0.12 + rp() * 0.08));
    n++;
  }
  decor.add(trunks, cones);

  return {
    yard,
    terrain,
    decor,
    foliage: { canopyA, canopyB, hedgeMat, tuftMat, treeBlobs },
    // Warmtecamera: alleen de grond blijft, alle versiering verdwijnt
    setThermal(on) {
      decor.visible = !on;
    },
  };
}
