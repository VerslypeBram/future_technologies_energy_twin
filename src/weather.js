import * as THREE from 'three';
import { world } from './simulation.js';
import { cloudPuff } from './textures.js';

const CLOUD_COUNT = 8;
const RAIN_COUNT = 1400;
const SPRITES_PER_CLOUD = 6;

// Wolken als zachte sprite-clusters, regen als korte schuine streepjes
export function createWeather(scene) {
  const puff = cloudPuff();
  const clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const group = new THREE.Group();
    const sprites = [];
    for (let j = 0; j < SPRITES_PER_CLOUD; j++) {
      const material = new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, fog: false, opacity: 0 });
      const sprite = new THREE.Sprite(material);
      const size = 14 + Math.random() * 12;
      sprite.scale.set(size, size * 0.55, 1);
      sprite.position.set((j - 2.5) * 6 + Math.random() * 3, Math.random() * 2.5, Math.random() * 6);
      group.add(sprite);
      sprites.push(sprite);
    }
    group.position.set(-70 + i * 20 + Math.random() * 10, 30 + (i % 3) * 5, -60 + (i % 4) * 22 - 20);
    group.userData = { threshold: i / CLOUD_COUNT, sprites };
    scene.add(group);
    clouds.push(group);
  }

  const positions = new Float32Array(RAIN_COUNT * 6);
  const drops = [];
  for (let i = 0; i < RAIN_COUNT; i++) {
    drops.push({ x: (Math.random() - 0.5) * 30, y: Math.random() * 14, z: (Math.random() - 0.5) * 30 });
  }
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: 0xbfd4e3, transparent: true, opacity: 0.5, fog: false }));
  rain.frustumCulled = false;
  scene.add(rain);

  const white = new THREE.Color(0xffffff);
  const grey = new THREE.Color(0x7d848c);
  const tint = new THREE.Color();

  return {
    update(dt) {
      const cloud = world.cloud;
      tint.copy(white).lerp(grey, cloud);
      clouds.forEach((c) => {
        const fade = Math.min(1, Math.max(0, (cloud - c.userData.threshold * 0.85) * 3)) * 0.85;
        c.visible = fade > 0.01;
        c.userData.sprites.forEach((s) => {
          s.material.opacity = fade;
          s.material.color.copy(tint);
        });
        c.position.x += dt * 0.6;
        if (c.position.x > 90) c.position.x = -90;
      });

      const raining = world.weather === 'regen' && cloud > 0.6;
      rain.visible = raining;
      if (raining) {
        for (let i = 0; i < RAIN_COUNT; i++) {
          const d = drops[i];
          d.y -= dt * 16;
          if (d.y < 0) d.y += 14;
          const o = i * 6;
          positions[o] = d.x;
          positions[o + 1] = d.y;
          positions[o + 2] = d.z;
          positions[o + 3] = d.x + 0.05;
          positions[o + 4] = d.y + 0.55;
          positions[o + 5] = d.z;
        }
        rainGeometry.attributes.position.needsUpdate = true;
      }
    },
  };
}
