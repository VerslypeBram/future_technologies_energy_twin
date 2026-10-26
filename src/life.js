import * as THREE from 'three';

// Leven rond het huis: auto's op de straat, een voetganger op de stoep en vogels in de lucht.
// Beweegt op echte tijd (los van de simulatiesnelheid) en heeft geen invloed op de energie.
const ROAD_Z = [12.7, 14.9]; // rijbanen (de straat ligt tussen z = 11,6 en 16)
const SIDEWALK_Z = 10.8;

export function createLife(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const std = (p) => new THREE.MeshStandardMaterial(p);

  // Auto's: eenvoudige carrosserie met koplampen en achterlichten die 's nachts oplichten
  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.16, 12);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelMat = std({ color: 0x15171a, roughness: 0.9 });
  const glass = std({ color: 0x1d2630, roughness: 0.2, metalness: 0.4 });
  const headMat = std({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 0 });
  const tailMat = std({ color: 0x660000, emissive: 0xff2200, emissiveIntensity: 0 });
  const bodyColors = [0xb3342f, 0x3f6fb5, 0xe0e0dc];

  function buildCar(color) {
    const car = new THREE.Group();
    const bodyMat = std({ color, roughness: 0.45, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.95), bodyMat);
    body.position.y = 0.45;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 0.85), glass);
    cabin.position.set(-0.1, 0.9, 0);
    car.add(body, cabin);
    [[-0.65, 0.48], [0.65, 0.48], [-0.65, -0.48], [0.65, -0.48]].forEach(([x, z]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(x, 0.22, z);
      car.add(w);
    });
    [-0.3, 0.3].forEach((z) => {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.2), headMat);
      h.position.set(1.01, 0.5, z);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.2), tailMat);
      t.position.set(-1.01, 0.5, z);
      car.add(h, t);
    });
    car.traverse((m) => (m.isMesh ? (m.castShadow = true) : 0));
    group.add(car);
    return car;
  }
  const cars = bodyColors.map((c, i) => ({ mesh: buildCar(c), x: 0, dir: 1, speed: 0, wait: 2 + i * 6, active: false }));

  // Voetganger
  const person = new THREE.Group();
  const coat = std({ color: 0x3a5f8a, roughness: 0.8 });
  const skin = std({ color: 0xd9b38c, roughness: 0.8 });
  const trousers = std({ color: 0x2b2f36, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.62, 10), coat);
  torso.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skin);
  head.position.y = 1.65;
  person.add(torso, head);
  const legs = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.9, side * 0.09);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), trousers);
    leg.position.y = -0.42;
    pivot.add(leg);
    person.add(pivot);
    return pivot;
  });
  person.traverse((m) => (m.isMesh ? (m.castShadow = true) : 0));
  group.add(person);
  const walker = { x: -30, dir: 1, active: false, wait: 8 };

  // Vogels: twee vleugels die flapperen, cirkelend boven de kavel
  const birdMat = std({ color: 0x20242a, roughness: 0.9, side: THREE.DoubleSide });
  const wingGeo = new THREE.PlaneGeometry(0.5, 0.18);
  wingGeo.translate(0.25, 0, 0);
  const birds = Array.from({ length: 7 }, (_, i) => {
    const b = new THREE.Group();
    const left = new THREE.Mesh(wingGeo, birdMat);
    const right = new THREE.Mesh(wingGeo, birdMat);
    right.rotation.y = Math.PI;
    b.add(left, right);
    b.userData = { left, right, angle: (i / 7) * Math.PI * 2, radius: 16 + (i % 3) * 4, height: 13 + (i % 4) * 2.5, speed: 0.22 + (i % 3) * 0.04, phase: i };
    group.add(b);
    return b;
  });
  let time = 0;

  return {
    // ctx: { sunUp 0..1, weather, snowing, hour }
    update(dt, { sunUp, weather, snowing, hour }) {
      time += dt;
      const dark = 1 - Math.min(1, sunUp * 3);
      headMat.emissiveIntensity = 2.2 * dark;
      tailMat.emissiveIntensity = 1.4 * dark;

      cars.forEach((c, i) => {
        if (!c.active) {
          c.wait -= dt;
          if (c.wait > 0) return;
          c.active = true;
          c.dir = Math.random() < 0.5 ? 1 : -1;
          c.speed = 5 + Math.random() * 4;
          c.x = -c.dir * 55;
          c.mesh.position.z = ROAD_Z[c.dir > 0 ? 1 : 0];
          c.mesh.rotation.y = c.dir > 0 ? 0 : Math.PI;
        }
        c.x += c.dir * c.speed * dt;
        c.mesh.position.x = c.x;
        c.mesh.visible = true;
        if (Math.abs(c.x) > 60) {
          c.active = false;
          c.mesh.visible = false;
          c.wait = 6 + Math.random() * 14 + i * 3;
        }
      });
      cars.forEach((c) => !c.active && (c.mesh.visible = false));

      // Voetganger: overdag en 's avonds, niet in de regen
      const walkingHours = hour >= 7 && hour < 22 && weather !== 'regen';
      if (!walker.active) {
        walker.wait -= dt;
        if (walker.wait <= 0 && walkingHours) {
          walker.active = true;
          walker.dir = Math.random() < 0.5 ? 1 : -1;
          walker.x = -walker.dir * 22;
        }
      } else {
        walker.x += walker.dir * 1.4 * dt;
        if (Math.abs(walker.x) > 24) {
          walker.active = false;
          walker.wait = 15 + Math.random() * 20;
        }
      }
      person.visible = walker.active;
      if (walker.active) {
        person.position.set(walker.x, 0.012, SIDEWALK_Z);
        person.rotation.y = walker.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        const swing = Math.sin(time * 5) * 0.5;
        legs[0].rotation.x = swing;
        legs[1].rotation.x = -swing;
      }

      // Vogels: bij dag en droog weer
      const flying = sunUp > 0.25 && weather !== 'regen' && !snowing;
      birds.forEach((b) => {
        b.visible = flying;
        if (!flying) return;
        const d = b.userData;
        d.angle += d.speed * dt;
        b.position.set(Math.cos(d.angle) * d.radius, d.height + Math.sin(time * 0.7 + d.phase) * 0.8, Math.sin(d.angle) * d.radius);
        b.rotation.y = -d.angle;
        const flap = Math.sin(time * 9 + d.phase) * 0.7;
        d.left.rotation.z = flap;
        d.right.rotation.z = flap;
      });
    },
    setVisible(v) {
      group.visible = v;
    },
  };
}
