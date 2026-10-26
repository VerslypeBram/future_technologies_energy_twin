import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { state, world, evPercent, batteryPercent, roomTemps } from './simulation.js';
import { drawSparkline } from './sparkline.js';
import { COLORS } from './theme.js';
import { fmt } from './ui.js';

// Platte waardelabels (CSS2D) en klikbare sensorpunten met sparkline. Standaard verborgen.
export function createLabels({ scene, cars, container, width, height }) {
  const renderer = new CSS2DRenderer();
  renderer.setSize(width, height);
  renderer.domElement.id = 'labels';
  container.appendChild(renderer.domElement);

  const items = [];
  const rooms = [];
  let labelsOn = false;
  let pinsOn = false;
  let roomsOn = false;

  function addLabel(parent, position, color, getText, group = items) {
    const div = document.createElement('div');
    div.className = 'label2d';
    div.style.setProperty('--c', color);
    const obj = new CSS2DObject(div);
    obj.position.copy(position);
    obj.visible = false;
    parent.add(obj);
    const item = { div, obj, parent, getText };
    group.push(item);
    return item;
  }

  const kw = (n) => fmt(n, 1) + ' kW';
  addLabel(scene, new THREE.Vector3(-3, 1.7, 0), COLORS.battery, () => `Batterij ${fmt(batteryPercent(), 0)} %`);
  addLabel(scene, new THREE.Vector3(0, 4.7, 1.3), COLORS.solar, () => `Zon ${kw(state.flows.solar)}`);
  addLabel(scene, new THREE.Vector3(6.2, 4.9, -3), COLORS.wind, () => `Wind ${kw(state.flows.wind)} / ${fmt(world.wind * 15, 0)} m/s`);
  addLabel(scene, new THREE.Vector3(-6, 5.4, 1.5), COLORS.grid, () => (world.gridOnline ? `Net ${kw(state.flows.grid)}` : 'Net: storing'));
  cars.forEach((car, i) => {
    addLabel(car, new THREE.Vector3(0, 1.4, 0), COLORS.ev, () => {
      const c = state.cars[i];
      return c.away ? `Auto ${i + 1} afwezig` : `Auto ${i + 1} ${fmt(evPercent(state, i), 0)} %${c.charging ? ' laden' : ''}`;
    });
  });

  // Kamerlabels: alleen zichtbaar bij de doorsnede
  addLabel(scene, new THREE.Vector3(-1, 1.5, -0.4), COLORS.inside, () => `Slaapkamer ${fmt(roomTemps(state).slaapkamer, 1)} °C`, rooms);
  addLabel(scene, new THREE.Vector3(1, 1.5, -0.4), COLORS.inside, () => `Woonkamer ${fmt(roomTemps(state).woonkamer, 1)} °C`, rooms);

  // Sensorpunten: klik voor een sparkline van het laatste etmaal
  const MAX_POINTS = 96;
  const sensors = [
    { tag: 'TI-01', title: 'Temperatuur binnen', pos: [1.2, 2.3, 2.2], get: () => state.insideTemp, fmt: (v) => fmt(v, 1) + ' °C', color: COLORS.inside, min: 10, max: 30 },
    { tag: 'AI-02', title: 'CO₂ binnen', pos: [-1.2, 2.3, 2.2], get: () => state.co2ppm, fmt: (v) => fmt(v, 0) + ' ppm', color: COLORS.battery, min: 400, max: 1600 },
    { tag: 'TI-03', title: 'Temperatuur buiten', pos: [3.6, 1.1, 3.6], get: () => world.outsideTemp, fmt: (v) => fmt(v, 1) + ' °C', color: COLORS.outside, min: -10, max: 35 },
  ];
  let openSensor = null;

  sensors.forEach((sensor) => {
    sensor.values = [];
    const pin = document.createElement('button');
    pin.className = 'pin';
    pin.setAttribute('aria-label', sensor.title);
    pin.setAttribute('aria-expanded', 'false');
    pin.textContent = sensor.tag;
    const popup = document.createElement('div');
    popup.className = 'sensor-popup';
    popup.hidden = true;
    popup.innerHTML = `<strong>${sensor.title}</strong><div class="v"></div><canvas width="180" height="64"></canvas>`;
    pin.appendChild(popup);
    popup.addEventListener('click', (e) => e.stopPropagation());
    pin.addEventListener('click', () => {
      const show = popup.hidden;
      sensors.forEach((s) => {
        s.popup.hidden = true;
        s.pin.setAttribute('aria-expanded', 'false');
      });
      popup.hidden = !show;
      pin.setAttribute('aria-expanded', String(show));
      openSensor = show ? sensor : null;
    });
    const obj = new CSS2DObject(pin);
    obj.position.set(...sensor.pos);
    obj.visible = false;
    scene.add(obj);
    Object.assign(sensor, { pin, popup, obj });
  });

  let lastSlot = -1;
  let lastText = 0;

  return {
    update(camera) {
      // Meetpunten per kwartier gesimuleerde tijd
      const slot = Math.floor(world.simTime * 4);
      if (slot !== lastSlot) {
        lastSlot = slot;
        sensors.forEach((s) => {
          s.values.push(s.get());
          if (s.values.length > MAX_POINTS) s.values.shift();
        });
      }

      const now = performance.now();
      if (now - lastText > 250) {
        lastText = now;
        if (labelsOn) items.forEach((i) => (i.div.textContent = i.getText()));
        if (roomsOn) rooms.forEach((i) => (i.div.textContent = i.getText()));
        if (openSensor) {
          openSensor.popup.querySelector('.v').textContent = openSensor.fmt(openSensor.get());
          drawSparkline(openSensor.popup.querySelector('canvas'), openSensor.values, openSensor);
        }
      }
      items.forEach((i) => (i.obj.visible = labelsOn && i.parent.visible));
      renderer.render(scene, camera);
    },
    setLabels(on) {
      labelsOn = on;
    },
    setPins(on) {
      pinsOn = on;
      sensors.forEach((s) => {
        s.obj.visible = on;
        if (!on) {
          s.popup.hidden = true;
          if (openSensor === s) openSensor = null;
        }
      });
    },
    setRooms(visible) {
      roomsOn = visible;
      rooms.forEach((r) => (r.obj.visible = visible));
    },
    resize(w, h) {
      renderer.setSize(w, h);
    },
  };
}
