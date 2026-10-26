import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(5, 10, 5);
scene.add(sun);

// Floor
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x4a7c3a }));
floor.rotation.x = -Math.PI * 0.5;
scene.add(floor);

// House container
const house = new THREE.Group();
scene.add(house);

// Walls
const walls = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 4), new THREE.MeshStandardMaterial({ color: 0xe8d8b0 }));
walls.position.set(0, 1.25, 0);
house.add(walls);

// Roof
const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 1.5, 4), new THREE.MeshStandardMaterial({ color: 0xb03a2e }));
roof.position.set(0, 3.25, 0);
roof.rotation.y = Math.PI / 4;
house.add(roof);

// Door
const door = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.6), new THREE.MeshStandardMaterial({ color: 0x6b4423 }));
door.position.set(0, 0.8, 2.01);
house.add(door);

//bushes
const bushGeometry = new THREE.SphereGeometry(0.5, 16, 16);
const bushMaterial = new THREE.MeshStandardMaterial({ color: 0x2e8b57 });

const bush1 = new THREE.Mesh(bushGeometry, bushMaterial);
bush1.position.set(2, 0.5, 1.5);
house.add(bush1);

const bush2 = new THREE.Mesh(bushGeometry, bushMaterial);
bush2.position.set(2, 0.5, 2);
house.add(bush2);

const bush3 = new THREE.Mesh(bushGeometry, bushMaterial);
bush3.position.set(-2, 0.5, 1.5);
house.add(bush3);

const bush4 = new THREE.Mesh(bushGeometry, bushMaterial);
bush4.position.set(-2, 0.5, 2);
house.add(bush4);

// Camera
camera.position.set(0, 4, 10);
camera.lookAt(0, 1.2, 0);

function animate() {
  house.rotation.y += 0.015;
  renderer.render(scene, camera);
}
