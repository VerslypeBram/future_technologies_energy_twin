import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './style.css';
import { createHouse } from './src/house.js';
import { createUI } from './src/ui.js';
import { createChart } from './src/chart.js';
import { createWeather } from './src/weather.js';
import { createPost } from './src/post.js';
import { createSky } from './src/sky.js';
import { createFlows } from './src/flows.js';
import { createInspector } from './src/inspector.js';
import { createLabels } from './src/labels.js';
import { createSankey } from './src/sankey.js';
import { createHistory } from './src/history.js';
import { createAlerts } from './src/alerts.js';
import { createThermal } from './src/thermal.js';
import { createEnvironment } from './src/environment.js';
import { createCut } from './src/cut.js';
import { createCameraRig } from './src/camera.js';
import { createHud } from './src/hud.js';
import { initRealData, sunAt, onLocationChange } from './src/realdata.js';
import { createSatellite } from './src/satellite.js';
import { createMoon } from './src/moon.js';
import { createOutdoor } from './src/outdoor.js';
import { applyScenario, updateScenario } from './src/scenarios.js';
import { state, baseline, world, step, comfortScore, sunFactor, sunEff, dateAt, outdoorLevel, isHome, batteryPercent, roomTemps } from './src/simulation.js';

// Het 3D-venster is een vast vak in de layout; alles schaalt mee met dat vak
const view = document.getElementById('view');
const viewSize = () => ({ w: Math.max(1, view.clientWidth), h: Math.max(1, view.clientHeight) });
const initial = viewSize();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, initial.w / initial.h, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(initial.w, initial.h);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.setAnimationLoop(animate);
view.appendChild(renderer.domElement);

// Hulpelementen die alleen bij "Analyse" zichtbaar zijn: zonneboog, zonnebol en kompasletters
const guides = new THREE.Group();
guides.visible = false;
scene.add(guides);

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(5, 10, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -9;
sun.shadow.camera.right = 9;
sun.shadow.camera.top = 9;
sun.shadow.camera.bottom = -9;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3;
scene.add(sun);

// Kompas: huis kijkt naar het zuiden (+z), oost is rechts (+x)
const SUN_RADIUS = 13;
function sunDirection(hour) {
  const p = sunAt(dateAt(hour)); // echte zonnestand (SunCalc) voor de gekozen locatie
  return new THREE.Vector3(p.x, p.y, p.z);
}

const sunBall = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 24), new THREE.MeshBasicMaterial({ color: 0xffdd55 }));
guides.add(sunBall);

const arc = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffdd55, transparent: true, opacity: 0.5 }));
guides.add(arc);
// Zonneboog van vandaag (alleen het deel boven de horizon); opnieuw opgebouwd als de locatie bekend is
function rebuildArc() {
  const pts = [];
  for (let h = 0; h <= 24; h += 0.25) {
    const d = sunDirection(h);
    if (d.y > 0) pts.push(d.multiplyScalar(SUN_RADIUS));
  }
  arc.geometry.setFromPoints(pts);
}
rebuildArc();
onLocationChange(rebuildArc);
initRealData();

function label(text, x, z) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.font = 'bold 90px system-ui';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 68);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: true }));
  sprite.position.set(x, 0.6, z);
  sprite.scale.set(1.2, 1.2, 1);
  guides.add(sprite);
}
label('N', 0, -8.5);
label('Z', 0, 8.5);
label('O', 8.5, 0);
label('W', -8.5, 0);

// Floor
const env = createEnvironment(scene);

// House
const { house, windows, fan, heaterMaterial, indoorLight, panelMaterial, shutters, batteryFill, resident, residentParts, rotors, cars, chargerMaterials, floorMaterials, inspectables } = createHouse();
scene.add(house);
house.traverse((o) => {
  if (!o.isMesh) return;
  o.castShadow = !windows.some((w) => w.pane === o); // glas werpt geen schaduw
  o.receiveShadow = true;
});

// Camera + controls
camera.position.set(8.8, 4.2, 8.8);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-0.3, 1.6, 0.3);
controls.maxPolarAngle = Math.PI * 0.49; // niet onder de grond
controls.minDistance = 3;
controls.maxDistance = 45;
controls.enableDamping = true;
controls.update();

const satellite = createSatellite(env.terrain);
onLocationChange((loc) => satellite.load(loc.lat, loc.lon));
const ui = createUI(camera, renderer.domElement, windows, { onSatellite: (on) => satellite.set(on) });
const weather = createWeather(scene);
const post = createPost(renderer, scene, camera);
post.resize(initial.w, initial.h);
const skyBox = createSky(scene, renderer);
const moon = createMoon(scene);
const outdoor = createOutdoor(scene);
const flows = createFlows(scene);
flows.setVisible(false);
const inspector = createInspector({ camera, canvas: renderer.domElement, inspectables, outline: post.outline });
const labels = createLabels({ scene, cars, container: view, width: initial.w, height: initial.h });
const history = createHistory();
const thermal = createThermal(house, [env.yard, env.terrain]);
const cut = createCut(renderer, house);
const rig = createCameraRig(camera, controls, cars);

let quality = 'high';
let cutValue = 0;
const hud = createHud({
  history,
  actions: {
    flyTo: (name) => rig.flyTo(name),
    follow: (index) => rig.follow(index),
    setThermal(on) {
      thermal.set(on);
      env.setThermal(on);
      skyBox.setVisible(!on);
      moon.setVisible(!on);
      outdoor.setVisible(!on);
      scene.background = on ? new THREE.Color(0x05060a) : null;
      post.setBloom(!on);
      cut.set(on ? 0 : cutValue);
      labels.setRooms(!on && cutValue > 0.5);
    },
    setLayer(name, on) {
      if (name === 'labels') labels.setLabels(on);
      else if (name === 'pins') labels.setPins(on);
      else if (name === 'flows') flows.setVisible(on);
      else if (name === 'guides') guides.visible = on;
    },
    setCut(v) {
      cutValue = v;
      cut.set(thermal.on ? 0 : v);
      labels.setRooms(!thermal.on && v > 0.5);
    },
    setScenario(name) {
      applyScenario(name);
      alerts.reset();
    },
    setQuality(q) {
      quality = q;
      post.setEnabled(q === 'high');
      outdoor.setLights(q === 'high');
    },
  },
});
const alerts = createAlerts(hud.toast);
const chart = createChart();
const sankey = createSankey();

if (import.meta.env.DEV) window.__sim = { state, baseline, world, post, scene, camera, controls, renderer, step, history }; // handig voor testen in de console

const SHUTTER_HEIGHT = 0.9;
let walk = 0; // 0 = binnen, 1 = weg
const WALK_PATH = [new THREE.Vector3(0, 0, 2.6), new THREE.Vector3(0, 0, 5.2), new THREE.Vector3(3.2, 0, 8.6), new THREE.Vector3(3.2, 0, 11.2)];
const heading = new THREE.Vector3();
const nightTint = new THREE.Color(0x7f98c8);
const dayTint = new THREE.Color(0xffffff);
const timer = new THREE.Timer();

// Kleur van de kamervloer volgt de temperatuur (blauw, groen, rood)
const floorCold = new THREE.Color(0x4a78c2);
const floorMid = new THREE.Color(0x6fbf73);
const floorHot = new THREE.Color(0xe05a3a);
function tempColor(target, t) {
  const k = Math.min(1, Math.max(0, (t - 14) / 14));
  return k < 0.5 ? target.copy(floorCold).lerp(floorMid, k * 2) : target.copy(floorMid).lerp(floorHot, (k - 0.5) * 2);
}

function animate() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  step(dt);

  // Ramen open/dicht animeren
  windows.forEach((w, i) => {
    const target = state.windowsOpen[i] ? 1 : 0;
    w.open += (target - w.open) * Math.min(1, dt * 6);
    w.pivot.rotation.y = -w.open * 1.2;
  });

  // Ventilator draait enkel als aan
  if (state.fanOn) fan.rotation.y += dt * 15;

  // Radiator gloeit als verwarming echt stookt
  const glow = state.heaterActive ? 1.6 : 0;
  heaterMaterial.emissiveIntensity += (glow - heaterMaterial.emissiveIntensity) * Math.min(1, dt * 5);

  // Zon beweegt over de lucht
  const sunUp = sunFactor(); // zon aan de hemel
  const sunPower = sunEff(); // zon na bewolking
  const sunDir = sunDirection(world.hour);
  const sunPos = sunDir.clone().multiplyScalar(SUN_RADIUS);
  sunBall.position.copy(sunPos);
  sunBall.visible = sunUp > 0;
  sun.position.copy(sunPos);
  sun.intensity = 2 * sunPower;
  ambient.intensity = 0.3 + 0.1 * sunUp * (1 - 0.3 * world.cloud);
  ambient.color.copy(nightTint).lerp(dayTint, Math.min(1, sunUp * 2.5)); // 's nachts koel maanlicht

  // Bloom alleen als het donker is (lampen, ruiten, laadpalen); overdag vrijwel uit
  post.bloom.strength = 0.04 + 0.4 * (1 - Math.min(1, sunUp * 3));

  // Lucht, sterren en mist
  skyBox.update(sunDir, sunUp, world.cloud);
  moon.update(dateAt(), sunUp, world.cloud);
  outdoor.update(outdoorLevel(state));

  // Zonnepanelen gloeien licht bij opbrengst
  panelMaterial.emissiveIntensity = sunPower * 0.6;

  // Rolluiken zakken, batterij vult, bewoner loopt
  shutters.forEach((s) => {
    const target = state.shuttersClosed ? SHUTTER_HEIGHT : 0.001;
    s.scale.y += (target - s.scale.y) * Math.min(1, dt * 4);
    s.visible = s.scale.y > 0.02;
  });
  batteryFill.scale.y = Math.max(0.001, batteryPercent() / 100);

  const walkDir = isHome() ? -1 : 1;
  walk = Math.min(1, Math.max(0, walk + (walkDir * dt * world.hoursPerSec) / 0.25));
  resident.visible = walk > 0 && walk < 1;
  if (resident.visible) {
    const seg = walk * (WALK_PATH.length - 1);
    const i = Math.min(WALK_PATH.length - 2, Math.floor(seg));
    resident.position.lerpVectors(WALK_PATH[i], WALK_PATH[i + 1], seg - i);
    // kijkrichting en loopanimatie
    heading.subVectors(WALK_PATH[i + 1], WALK_PATH[i]).multiplyScalar(walkDir);
    resident.rotation.y = Math.atan2(heading.x, heading.z);
    const swing = Math.sin(walk * 70) * 0.55;
    residentParts.legL.rotation.x = swing;
    residentParts.legR.rotation.x = -swing;
    residentParts.armL.rotation.x = -swing * 0.8;
    residentParts.armR.rotation.x = swing * 0.8;
  }

  // Auto's rijden weg (naar het zuiden, uit beeld) en komen terug; palen gloeien bij laden
  const driveStep = (walkDir * dt * world.hoursPerSec) / 0.4;
  cars.forEach((car, i) => {
    const p = Math.min(1, Math.max(0, (car.userData.drive ?? 0) + driveStep));
    car.userData.drive = p;
    car.visible = p < 1;
    car.position.z = 4.3 + p * 12;
    const charging = state.cars[i].charging ? 3.5 : 0;
    chargerMaterials[i].emissiveIntensity += (charging - chargerMaterials[i].emissiveIntensity) * Math.min(1, dt * 5);
  });

  // Windmolens draaien sneller bij meer wind
  rotors.forEach((r, i) => (r.rotation.z -= dt * (0.3 + world.wind * 7) * (i ? 0.9 : 1)));

  // Ruiten gloeien warm 's nachts als er iemand thuis is
  const windowGlow = sunUp === 0 && isHome() ? 2.5 : 0;
  windows.forEach((w) => {
    const m = w.pane.material;
    m.emissiveIntensity += (windowGlow - m.emissiveIntensity) * Math.min(1, dt * 3);
  });

  // Kamervloeren kleuren mee met de temperatuur
  const rooms = roomTemps(state);
  tempColor(floorMaterials[0].color, rooms.slaapkamer);
  tempColor(floorMaterials[1].color, rooms.woonkamer);

  weather.update(dt);
  flows.update(dt);
  inspector.update();

  // Binnenlicht toont comfort
  indoorLight.intensity = (comfortScore() / 100) * 3;

  thermal.update();
  rig.update(dt);
  controls.update();
  post.render();
  labels.update(camera);
  ui.update();
  chart.update(dt);
  sankey.update();
  history.update();
  alerts.update();
  updateScenario(hud.toast);
  hud.update();
}

new ResizeObserver(() => {
  const { w, h } = viewSize();
  camera.aspect = w / h;
  camera.fov = camera.aspect < 1 ? Math.min(80, 40 / Math.pow(camera.aspect, 0.85)) : 40; // staand scherm: bredere hoek
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  post.resize(w, h);
  labels.resize(w, h);
}).observe(view);
