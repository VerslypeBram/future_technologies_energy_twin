import * as THREE from 'three';
import {
  state,
  baseline,
  world,
  comfortScore,
  averageComfort,
  tip,
  netKwh,
  costEuro,
  co2Kg,
  priceAt,
  isHome,
  batteryPercent,
  evPercent,
  resetDay,
} from './simulation.js';

const formatters = {};
export function fmt(n, digits = 1) {
  formatters[digits] ??= new Intl.NumberFormat('nl-NL', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return formatters[digits].format(n);
}

const WEATHER_LABEL = { zon: 'Zonnig', bewolkt: 'Bewolkt', regen: 'Regen' };

// Rij met label links en waarde + eenheid rechts
const kv = (label, id, unit = '') =>
  `<div class="kv"><span class="k">${label}</span><span><span class="v" id="${id}"></span>${unit ? `<span class="u">${unit}</span>` : ''}</span></div>`;

const toggle = (label, id) =>
  `<div class="ctl"><span class="k">${label}</span><button id="${id}" class="switch" role="switch" aria-checked="false" aria-label="${label}">UIT</button></div>`;

export function createUI(camera, canvas, windows) {
  const panel = document.createElement('div');
  panel.id = 'panel';
  panel.innerHTML = `
    <details open>
      <summary>Bediening</summary>
      <div class="sec-body">
        ${toggle('Automaatregeling', 'auto')}
        <div id="manual">
          ${toggle('Verwarming', 'heater')}
          ${toggle('Ventilatie', 'fan')}
          ${toggle('Rolluiken dicht', 'shutters')}
          ${toggle('Auto laden', 'evcharge')}
          <div class="field">
            <label for="target">Setpoint <span class="v"><span id="targetLabel"></span> °C</span></label>
            <input id="target" type="range" min="16" max="26" step="0.5">
          </div>
        </div>
        <div class="note">Raam aanklikken in het 3D-venster om te openen of te sluiten.</div>
      </div>
    </details>

    <details>
      <summary>Omgeving</summary>
      <div class="sec-body">
        <div class="field" style="margin-top:0">
          <label for="weatherMode">Weer</label>
          <select id="weatherMode">
            <option value="auto">Automatisch</option>
            <option value="zon">Zonnig</option>
            <option value="bewolkt">Bewolkt</option>
            <option value="regen">Regen</option>
          </select>
        </div>
        <div class="field">
          <label for="out">Basistemperatuur buiten <span class="v"><span id="outLabel"></span> °C</span></label>
          <input id="out" type="range" min="-10" max="35" step="1">
        </div>
        <div class="field">
          <label for="speed">Simulatiesnelheid <span class="v"><span id="speedLabel"></span> u/s</span></label>
          <input id="speed" type="range" min="0" max="1" step="0.05">
        </div>
        <div style="margin-top:8px">
          ${kv('Weer nu', 'weatherNow')}
          ${kv('Wind', 'wind', 'm/s')}
          ${kv('Buiten nu', 'outNow', '°C')}
          ${kv('Stroomprijs', 'price', '€/kWh')}
          ${kv('Bewoners', 'resident')}
        </div>
      </div>
    </details>

    <details open>
      <summary>Meetwaarden</summary>
      <div class="sec-body">
        ${kv('Binnentemperatuur', 'inside', '°C')}
        ${kv('Comfortindex', 'comfort', '/100')}
        ${kv('CO₂ binnen', 'co2in', 'ppm')}
        ${kv('Verbruik', 'energy', 'kWh')}
        ${kv('Opbrengst zon', 'solar', 'kWh')}
        ${kv('Opbrengst wind', 'windKwh', 'kWh')}
        ${kv('SoC auto 1 / 2', 'cars', '%')}
        ${kv('Laadvermogen', 'evkw', 'kW')}
        ${kv('Batterij SoC', 'battery', '%')}
        ${kv('Netafname', 'net', 'kWh')}
        ${kv('Kosten', 'cost', '€')}
        ${kv('CO₂-uitstoot', 'co2', 'kg')}
        <div class="status-line" id="tip" role="status"></div>
      </div>
    </details>

    <details open>
      <summary>Vergelijking</summary>
      <div class="sec-body">
        <table>
          <tr><th></th><th>Woning</th><th>Referentie</th></tr>
          <tr><td>Netafname kWh</td><td id="cmpKwhA"></td><td id="cmpKwhB"></td></tr>
          <tr><td>Kosten €</td><td id="cmpCostA"></td><td id="cmpCostB"></td></tr>
          <tr><td>CO₂ kg</td><td id="cmpCo2A"></td><td id="cmpCo2B"></td></tr>
          <tr><td>Comfort gem.</td><td id="cmpComfA"></td><td id="cmpComfB"></td></tr>
        </table>
        ${kv('Kostenbesparing', 'saving')}
        <div class="note">Referentie: vast 21 °C, geen opwek, batterij of regeling.</div>
        <div style="margin-top:8px"><button id="reset" class="btn">Tellers resetten</button></div>
      </div>
    </details>
  `;
  document.getElementById('sidebar').appendChild(panel);

  const $ = (id) => panel.querySelector('#' + id);
  const text = (id, value) => ($(id).textContent = value);
  $('out').value = world.baseOutside;
  $('target').value = state.targetTemp;
  $('speed').value = world.hoursPerSec;
  $('weatherMode').value = world.weatherMode;

  $('out').oninput = (e) => (world.baseOutside = +e.target.value);
  $('target').oninput = (e) => (state.targetTemp = +e.target.value);
  $('speed').oninput = (e) => (world.hoursPerSec = +e.target.value);
  $('weatherMode').onchange = (e) => (world.weatherMode = e.target.value);
  $('heater').onclick = () => (state.heaterOn = !state.heaterOn);
  $('fan').onclick = () => (state.fanOn = !state.fanOn);
  $('shutters').onclick = () => (state.shuttersClosed = !state.shuttersClosed);
  $('evcharge').onclick = () => (state.evCharging = !state.evCharging);
  $('auto').onclick = () => (state.autoMode = !state.autoMode);
  $('reset').onclick = resetDay;

  // Klik op een raam (coördinaten ten opzichte van het canvas)
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downX = 0;
  let downY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    downX = e.clientX;
    downY = e.clientY;
  });
  canvas.addEventListener('pointerup', (e) => {
    if (state.autoMode) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 4) return; // was een orbit-drag
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(windows.map((w) => w.pane));
    if (hits.length) {
      const i = hits[0].object.userData.windowIndex;
      state.windowsOpen[i] = !state.windowsOpen[i];
    }
  });

  const setSwitch = (id, on) => {
    const el = $(id);
    el.setAttribute('aria-checked', String(on));
    el.textContent = on ? 'AAN' : 'UIT';
  };
  const color = (id, c) => ($(id).style.color = c);

  function update() {
    setSwitch('auto', state.autoMode);
    $('manual').classList.toggle('disabled', state.autoMode);
    setSwitch('heater', state.heaterOn);
    setSwitch('fan', state.fanOn);
    setSwitch('shutters', state.shuttersClosed);
    setSwitch('evcharge', state.evCharging);
    text('outLabel', world.baseOutside);
    text('speedLabel', fmt(world.hoursPerSec, 2));
    text('targetLabel', fmt(state.targetTemp, 1));
    if (state.autoMode) $('target').value = state.targetTemp;

    text('weatherNow', WEATHER_LABEL[world.weather]);
    text('wind', fmt(world.wind * 15, 1));
    text('outNow', fmt(world.outsideTemp, 1));
    const price = priceAt();
    text('price', fmt(price, 2));
    color('price', price > 0.4 ? 'var(--alarm)' : price < 0.2 ? 'var(--ok)' : 'var(--text)');
    text('resident', isHome() ? 'Thuis' : 'Afwezig');

    text('inside', fmt(state.insideTemp, 1));
    const score = comfortScore();
    text('comfort', fmt(score, 0));
    color('comfort', score > 75 ? 'var(--ok)' : score > 45 ? 'var(--warn)' : 'var(--alarm)');
    text('co2in', fmt(state.co2ppm, 0));
    color('co2in', state.co2ppm > 1200 ? 'var(--alarm)' : state.co2ppm > 1000 ? 'var(--warn)' : 'var(--text)');
    text('energy', fmt(state.energyKwh, 2));
    text('solar', fmt(state.solarKwh, 2));
    text('windKwh', fmt(state.windKwh, 2));
    const carLabel = (i) => (state.cars[i].away ? '-' : fmt(evPercent(state, i), 0) + (state.cars[i].charging ? '*' : ''));
    text('cars', carLabel(0) + ' / ' + carLabel(1));
    text('evkw', fmt(state.evKw, 1));
    text('battery', fmt(batteryPercent(), 0));
    text('net', fmt(netKwh(), 2));
    text('cost', fmt(costEuro(), 2));
    text('co2', fmt(co2Kg(), 2));
    text('tip', tip());

    text('cmpKwhA', fmt(netKwh(state), 1));
    text('cmpKwhB', fmt(netKwh(baseline), 1));
    text('cmpCostA', fmt(costEuro(state), 2));
    text('cmpCostB', fmt(costEuro(baseline), 2));
    text('cmpCo2A', fmt(co2Kg(state), 2));
    text('cmpCo2B', fmt(co2Kg(baseline), 2));
    text('cmpComfA', fmt(averageComfort(state), 0));
    text('cmpComfB', fmt(averageComfort(baseline), 0));
    const b = costEuro(baseline);
    const saving = b > 0.05 ? ((b - costEuro(state)) / b) * 100 : 0;
    text('saving', b > 0.05 ? fmt(saving, 0) + ' %' : '-');
    color('saving', b > 0.05 ? (saving > 0 ? 'var(--ok)' : 'var(--alarm)') : 'var(--text)');
  }

  return { update };
}
