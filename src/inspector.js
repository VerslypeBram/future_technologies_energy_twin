import * as THREE from 'three';
import { state, world, evPercent, batteryPercent, comfortScore, roomTemps, copAt, batteryCapacity, tankPercent } from './simulation.js';
import { fmt } from './ui.js';

// Hover-inspector: wijs een onderdeel aan voor een outline en live details.
export function createInspector({ camera, canvas, inspectables, outline }) {
  const tooltip = document.createElement('div');
  tooltip.id = 'tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  document.body.appendChild(tooltip);

  const byId = new Map(inspectables.map((i) => [i.id, i]));
  const meshes = [];
  inspectables.forEach((i) => i.objects.forEach((o) => o.traverse((m) => m.isMesh && meshes.push(m))));

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerClient = null;
  let hovered = null;

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointerClient = { x: e.clientX, y: e.clientY };
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  });
  canvas.addEventListener('pointerleave', () => {
    pointerClient = null;
  });

  // Een verborgen groep (bijv. de uitgeschakelde warmtepomp) mag niet meer reageren
  const isShown = (o) => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };

  const kw = (n) => fmt(n, 1) + ' kW';

  function describe(id) {
    const f = state.flows;
    if (id === 'house') {
      const rooms = roomTemps(state);
      return [`Binnen ${fmt(state.insideTemp, 1)} °C`, `Woonkamer ${fmt(rooms.woonkamer, 1)} °C`, `Slaapkamer ${fmt(rooms.slaapkamer, 1)} °C`, `CO₂ ${fmt(state.co2ppm, 0)} ppm`, `Comfortindex ${comfortScore()}/100`];
    }
    if (id === 'solar') return [`Opwek ${kw(f.solar)}`, `Totaal ${fmt(state.solarKwh, 2)} kWh`];
    if (id === 'battery') return [`SoC ${fmt(batteryPercent(), 0)} %`, f.batteryKw > 0.05 ? `Laden ${kw(f.batteryKw)}` : f.batteryKw < -0.05 ? `Ontladen ${kw(-f.batteryKw)}` : 'Stand-by'];
    if (id === 'heater') return [state.heaterActive ? 'Bedrijf 2,0 kW' : 'Uit', `Setpoint ${fmt(state.targetTemp, 1)} °C`];
    if (id === 'heatpump') {
      const cop = copAt(world.outsideTemp, state.heatPump);
      return [state.heaterActive ? `Bedrijf ${kw(state.heaterKw)}` : 'Stand-by', `COP ${fmt(cop, 1)}`, `Warmte ${kw(state.heaterKw * cop)}`, `Buiten ${fmt(world.outsideTemp, 1)} °C`];
    }
    if (id === 'battery2') return [`SoC ${fmt(batteryPercent(), 0)} %`, `Capaciteit ${fmt(batteryCapacity(), 0)} kWh totaal`];
    if (id === 'barrel') return [`Inhoud ${fmt(state.tankL, 0)} l (${fmt(tankPercent(), 0)} %)`, state.pumpKw > 0 ? `Pomp aan ${fmt(state.pumpKw * 1000, 0)} W` : 'Pomp uit'];
    if (id === 'meter') return [`Huis ${kw(f.home)}`, `Laadpalen ${kw(f.ev)}`, `Net ${kw(f.grid)}`];
    if (id === 'grid') return [world.gridOnline ? (f.export > 0.01 ? `Teruglevering ${kw(f.export)}` : `Afname ${kw(f.grid)}`) : 'Storing', `Kosten ${fmt(state.cost, 2)} €`];
    if (id.startsWith('car')) {
      const i = +id.slice(3);
      const car = state.cars[i];
      return car.away ? ['Afwezig'] : [`SoC ${fmt(evPercent(state, i), 0)} %`, car.charging ? 'Laden 3,7 kW' : 'Aangesloten'];
    }
    if (id.startsWith('charger')) {
      const car = state.cars[+id.slice(7)];
      return [car.charging ? 'Laden 3,7 kW' : car.away ? 'Vrij' : 'Aangesloten'];
    }
    if (id.startsWith('wind')) return [`Windsnelheid ${fmt(world.wind * 15, 1)} m/s`, `Opwek ${kw(f.wind / 2)}`];
    if (id.startsWith('window')) {
      const i = +id.slice(6);
      return [state.windowsOpen[i] ? 'Open' : 'Dicht', 'Klik om te wisselen'];
    }
    return [];
  }

  function show(id) {
    const entry = byId.get(id);
    if (!entry) return;
    const lines = describe(id);
    tooltip.innerHTML = `<strong>${entry.label}</strong>` + lines.map((l) => `<div>${l}</div>`).join('');
    tooltip.hidden = false;
  }

  return {
    update() {
      if (!pointerClient) {
        if (hovered) {
          hovered = null;
          outline.selectedObjects = [];
        }
        tooltip.hidden = true;
        return;
      }
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(meshes, false).find((h) => isShown(h.object) && h.object.userData.inspectId);
      const id = hit ? hit.object.userData.inspectId : null;
      if (id !== hovered) {
        hovered = id;
        outline.selectedObjects = id ? byId.get(id).objects : [];
      }
      if (id) {
        show(id);
        tooltip.style.transform = `translate(${pointerClient.x + 14}px, ${pointerClient.y + 14}px)`;
        canvas.style.cursor = id.startsWith('window') ? 'pointer' : 'default';
      } else {
        tooltip.hidden = true;
        canvas.style.cursor = 'default';
      }
    },
  };
}
