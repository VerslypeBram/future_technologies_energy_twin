import { state, world, priceAt } from './simulation.js';
import { PRESETS } from './camera.js';
import { SCENARIOS, goalText } from './scenarios.js';
import { fmt } from './ui.js';

const WEATHER_LABEL = { zon: 'Zonnig', bewolkt: 'Bewolkt', regen: 'Regen' };

function clockText(hour) {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
const stamp = (t) => `D${Math.floor(t / 24) + 1} ${clockText(t % 24)}`;

const LAYERS = [
  { id: 'labels', label: 'Waardelabels' },
  { id: 'pins', label: 'Sensorpunten' },
  { id: 'flows', label: 'Stroomdeeltjes' },
  { id: 'guides', label: 'Kompas en zonneboog' },
];
const LEVEL_TEXT = { info: 'Info', warn: 'Waarsch.', crit: 'Storing' };

// Besturing buiten het 3D-venster: topbar, onderbalk, meldingenlijst en de sectie "Weergave".
export function createHud({ history, actions }) {
  const view = document.getElementById('view');
  const topbar = document.getElementById('topbar');
  const bottombar = document.getElementById('bottombar');
  const aside = document.getElementById('aside');

  // Topbar
  topbar.innerHTML = `
    <span class="brand">Woning EMS</span>
    <span class="tb-sep"></span>
    <span class="tb-item"><span class="k">Tijd</span><span class="v" id="tbTime"></span></span>
    <span class="tb-item optional"><span class="k">Weer</span><span class="v" id="tbWeather"></span></span>
    <span class="tb-item optional"><span class="k">Buiten</span><span class="v" id="tbOut"></span></span>
    <span class="tb-item optional"><span class="k">Prijs</span><span class="v" id="tbPrice"></span></span>
    <span class="tb-spacer"></span>
    <span class="tb-item"><span class="led" id="ledGrid"></span><span class="k" id="tbGrid"></span></span>
    <span class="tb-item optional"><span class="led" id="ledAuto"></span><span class="k" id="tbAuto"></span></span>
    <button id="panelToggle" class="btn" aria-label="Paneel tonen of verbergen">Paneel</button>
    <button id="asideToggle" class="btn" aria-label="Grafieken tonen of verbergen">Grafieken</button>
  `;
  const t$ = (id) => topbar.querySelector('#' + id);
  t$('panelToggle').onclick = () => document.body.classList.toggle('panel-open');
  t$('asideToggle').onclick = () => document.body.classList.toggle('aside-open');

  // Aside: vaste plekken voor Sankey en grafiek; meldingenlijst
  aside.innerHTML = `
    <div class="section-title">Energiestroom</div><div id="sankeyHost"></div>
    <div class="section-title">Verloop</div><div id="chartHost"></div>
    <div class="section-title">Meldingen</div><div class="alarms" id="alarms" role="log" aria-live="polite"><div class="empty">Geen meldingen</div></div>
  `;
  const alarms = aside.querySelector('#alarms');

  // Meldingen: lijst met tijd en niveau; alleen succes en storingen ook als kort bericht in beeld
  const toasts = document.createElement('div');
  toasts.id = 'toasts';
  view.appendChild(toasts);

  function toast(message, level = 'info') {
    const lvl = level === 'ok' ? 'info' : level;
    alarms.querySelector('.empty')?.remove();
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span class="t">${stamp(world.simTime)}</span><span class="lv ${lvl}">${LEVEL_TEXT[lvl]}</span><span class="m"></span>`;
    row.querySelector('.m').textContent = message;
    alarms.prepend(row);
    while (alarms.children.length > 50) alarms.lastChild.remove();

    if (level === 'ok' || level === 'crit') {
      const div = document.createElement('div');
      div.className = 'toast ' + level;
      div.textContent = message;
      toasts.appendChild(div);
      while (toasts.children.length > 3) toasts.firstChild.remove();
      setTimeout(() => div.remove(), 7000);
    }
  }

  // Onderbalk: camera en tijdlijn
  bottombar.innerHTML = `
    <div class="presets" role="group" aria-label="Camera">
      <div class="seg">${Object.entries(PRESETS).map(([id, p]) => `<button data-preset="${id}">${p.label}</button>`).join('')}</div>
      <div class="seg"><button id="followBtn" aria-pressed="false">Volg auto</button></div>
    </div>
    <div class="timeline">
      <button id="tlPlay" class="btn" aria-label="Pauzeren of afspelen" style="min-width:38px"></button>
      <input id="tlSlider" type="range" min="0" max="0" value="0" aria-label="Tijdlijn">
      <span class="clock" id="tlLabel"></span>
      <button id="tlResume" class="btn" hidden>Hervat hier</button>
    </div>
  `;
  const b$ = (sel) => bottombar.querySelector(sel);
  bottombar.querySelectorAll('[data-preset]').forEach((b) => {
    b.onclick = () => {
      actions.flyTo(b.dataset.preset);
      b$('#followBtn').setAttribute('aria-pressed', 'false');
    };
  });
  b$('#followBtn').onclick = (e) => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', String(on));
    actions.follow(on ? 0 : null);
  };
  b$('#tlPlay').onclick = () => {
    if (history.scrubbing) history.resume();
    else world.paused = !world.paused;
  };
  b$('#tlSlider').oninput = (e) => history.scrub(+e.target.value);
  b$('#tlResume').onclick = () => history.resume();

  // Sectie Weergave in de zijbalk
  const panel = document.getElementById('panel');
  const section = document.createElement('details');
  section.open = true;
  section.innerHTML = `
    <summary>Weergave</summary>
    <div class="sec-body">
      <div class="ctl"><span class="k">Modus</span>
        <div class="seg" role="group" aria-label="Weergavemodus">
          <button data-mode="real" aria-pressed="true">Realistisch</button>
          <button data-mode="analyse" aria-pressed="false">Analyse</button>
        </div>
      </div>
      ${LAYERS.map((l) => `<div class="ctl"><span class="k">${l.label}</span><button data-layer="${l.id}" class="switch" role="switch" aria-checked="false" aria-label="${l.label}">UIT</button></div>`).join('')}
      <div class="ctl"><span class="k">Warmtecamera</span><button id="irBtn" class="switch" role="switch" aria-checked="false" aria-label="Warmtecamera">UIT</button></div>
      <div class="field">
        <label for="cut">Doorsnede <span class="v" id="cutLabel">dicht</span></label>
        <input id="cut" type="range" min="0" max="100" value="0">
      </div>
      <div class="field">
        <label for="scenario">Scenario</label>
        <select id="scenario">${Object.entries(SCENARIOS).map(([id, s]) => `<option value="${id}">${s.label}</option>`).join('')}</select>
        <div class="note" id="goal"></div>
      </div>
      <div class="field">
        <label for="quality">Rendering</label>
        <select id="quality"><option value="high">Hoog</option><option value="low">Laag (sneller)</option></select>
      </div>
      <div class="note">Sneltoetsen: A automaat, I warmtecamera, L labels, spatie pauze.</div>
    </div>
  `;
  panel.appendChild(section);
  const v$ = (sel) => section.querySelector(sel);

  const setSwitch = (el, on) => {
    el.setAttribute('aria-checked', String(on));
    el.textContent = on ? 'AAN' : 'UIT';
  };
  const layerState = Object.fromEntries(LAYERS.map((l) => [l.id, false]));

  function syncModeButtons() {
    const values = Object.values(layerState);
    v$('[data-mode="real"]').setAttribute('aria-pressed', String(values.every((v) => !v)));
    v$('[data-mode="analyse"]').setAttribute('aria-pressed', String(values.every(Boolean)));
  }
  function setLayer(id, on) {
    layerState[id] = on;
    setSwitch(v$(`[data-layer="${id}"]`), on);
    actions.setLayer(id, on);
    syncModeButtons();
  }
  section.querySelectorAll('[data-layer]').forEach((btn) => {
    btn.onclick = () => setLayer(btn.dataset.layer, !layerState[btn.dataset.layer]);
  });
  section.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.onclick = () => LAYERS.forEach((l) => setLayer(l.id, btn.dataset.mode === 'analyse'));
  });

  v$('#irBtn').onclick = () => {
    const on = v$('#irBtn').getAttribute('aria-checked') !== 'true';
    setSwitch(v$('#irBtn'), on);
    v$('#cut').disabled = on;
    actions.setThermal(on);
  };
  v$('#cut').oninput = (e) => {
    const v = +e.target.value / 100;
    v$('#cutLabel').textContent = v === 0 ? 'dicht' : v < 0.5 ? 'dak weg' : 'voorkant weg';
    actions.setCut(v);
  };
  v$('#scenario').onchange = (e) => {
    actions.setScenario(e.target.value);
    toast('Scenario gestart: ' + SCENARIOS[e.target.value].label, 'info');
  };
  v$('#quality').onchange = (e) => actions.setQuality(e.target.value);

  // Sneltoetsen
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    const key = e.key.toLowerCase();
    if (key === 'a') state.autoMode = !state.autoMode;
    else if (key === 'i') v$('#irBtn').click();
    else if (key === 'l') v$('[data-layer="labels"]').click();
    else if (key === ' ') {
      e.preventDefault();
      b$('#tlPlay').click();
    }
  });

  return {
    toast,
    update() {
      // Topbar
      t$('tbTime').textContent = `Dag ${Math.floor(world.simTime / 24) + 1}  ${clockText(world.hour)}`;
      t$('tbWeather').textContent = WEATHER_LABEL[world.weather];
      t$('tbOut').textContent = fmt(world.outsideTemp, 1) + ' °C';
      t$('tbPrice').textContent = '€ ' + fmt(priceAt(), 2);
      t$('ledGrid').className = 'led ' + (world.gridOnline ? 'ok' : 'alarm');
      t$('tbGrid').textContent = world.gridOnline ? 'Net online' : 'Net uitgevallen';
      t$('ledAuto').className = 'led ' + (state.autoMode ? 'ok' : '');
      t$('tbAuto').textContent = state.autoMode ? 'Regeling actief' : 'Handbediening';

      // Tijdlijn
      const slider = b$('#tlSlider');
      const len = history.length;
      if (!history.scrubbing) {
        slider.max = Math.max(0, len - 1);
        slider.value = len - 1;
      }
      const entry = history.entry(history.index);
      const t = entry ? entry.t : world.simTime;
      b$('#tlLabel').textContent = `Dag ${Math.floor(t / 24) + 1}  ${clockText(t % 24)}`;
      b$('#tlPlay').textContent = history.scrubbing || world.paused ? 'Start' : 'Pauze';
      b$('#tlResume').hidden = !history.scrubbing;
      v$('#goal').textContent = goalText();
    },
  };
}
