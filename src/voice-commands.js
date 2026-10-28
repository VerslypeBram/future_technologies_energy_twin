// Spraakcommando's: tekst naar commando (parseCommand) en commando naar effect (runCommand). Geen DOM.
import { sunAt } from './realdata.js';
import {
  state, world, REALTIME, dateAt, costEuro, co2Kg, comfortScore, batteryPercent, tankPercent, evPercent, priceAt, resetDay,
} from './simulation.js';

const WIND_STEP = 0.2;
const WIND_BOOST_MIN = -0.5;
const WIND_BOOST_MAX = 0.6;

const NUMBER_WORDS = {
  nul: 0, een: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10, elf: 11, twaalf: 12,
  dertien: 13, veertien: 14, vijftien: 15, zestien: 16, zeventien: 17, achttien: 18, negentien: 19, twintig: 20,
  eenentwintig: 21, tweeentwintig: 22, drieentwintig: 23, vierentwintig: 24,
};
const WORDS = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|');
const NUM = `(\\d{1,2}|${WORDS})`;
const toNumber = (s) => (/^\d+$/.test(s) ? +s : NUMBER_WORDS[s]);

// Kleine letters, geen accenten, leestekens weg (":" en cijfer.cijfer blijven voor tijden en kommagetallen)
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[^a-z0-9:. ]/g, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Uur uit tekst: "15 uur", "15:30", "15.30 uur", "drie uur 's middags", "half vier", "kwart over drie"
function parseHour(t) {
  let h = null;
  let m;
  if ((m = t.match(/\b(\d{1,2})[:.](\d{2})\b/))) h = +m[1] + +m[2] / 60;
  else if ((m = t.match(new RegExp(`\\bhalf ${NUM}\\b`)))) h = toNumber(m[1]) - 0.5;
  else if ((m = t.match(new RegExp(`\\bkwart over ${NUM}\\b`)))) h = toNumber(m[1]) + 0.25;
  else if ((m = t.match(new RegExp(`\\bkwart voor ${NUM}\\b`)))) h = toNumber(m[1]) - 0.25;
  else if ((m = t.match(new RegExp(`\\b${NUM} uur(?: ${NUM}\\b)?`)))) h = toNumber(m[1]) + (m[2] ? toNumber(m[2]) / 60 : 0);
  if (h === null || h < 0 || h > 24) return null;
  if (h < 12 && /\b(middags|avonds)\b/.test(t) && h >= 1) h += 12;
  return h % 24;
}

const SCENARIO_WORDS = [
  [/hittegolf/, 'hittegolf'],
  [/stroomstoring|stroomuitval|blackout/, 'stroomstoring'],
  [/strenge winter|winter/, 'winter'],
  [/\bstorm\b/, 'storm'],
  [/\bnormaal\b/, 'normaal'],
];
const CAMERA_WORDS = [
  [/windmolen|molens|wind/, 'wind'],
  [/laadpa|laadpunt|auto/, 'palen'],
  [/batterij/, 'batterij'],
  [/\bdak\b|zonnepanelen|panelen/, 'dak'],
  [/overzicht|huis/, 'overzicht'],
];
const WEATHER_WORDS = [
  [/zonnig|zonneschijn|zon\b/, 'zon'],
  [/bewolkt|wolken/, 'bewolkt'],
  [/regen\b|regenachtig|regenen|nat/, 'regen'],
  [/live|echt weer|echte weer/, 'live'],
];

export function parseCommand(text) {
  const t = normalize(text || '');
  if (!t) return null;
  const has = (re) => re.test(t);
  const isOn = has(/\b(aan|start|activeer\w*)\b|\b(schakel|zet|doe)\b.*\bin\b/);
  const isOff = has(/\b(uit|stop|deactiveer\w*|af)\b/);
  const onOff = isOn ? true : isOff ? false : null;

  if (has(/wat kan ik|help|commando s|commandos|opdrachten/)) return { intent: 'help' };

  // Setpoint: "zet de temperatuur op 22 graden"
  let m;
  if (has(/temperatuur|thermostaat|setpoint|verwarming/) && !has(/buiten/) && (m = t.match(/\b(\d{2}(?:\.\d)?)\b/))) {
    const deg = +m[1];
    if (deg >= 16 && deg <= 26) return { intent: 'setpoint', deg };
  }

  if (has(/\b(zon|tijd|klok|uur)\b/)) {
    const hour = parseHour(t);
    if (hour !== null) return { intent: 'setTime', hour };
  }
  if (has(/echte tijd|werkelijke tijd|huidige tijd/)) return { intent: 'now' };
  if (has(/volg\w* (de )?zon/)) return { intent: 'followSun' };

  // Scenario's en camera
  if (has(/scenario|start|activeer|simuleer/) || has(/hittegolf|stroomstoring|strenge winter/)) {
    const hit = SCENARIO_WORDS.find(([re]) => re.test(t));
    if (hit && !has(/windmolen/)) return { intent: 'scenario', name: hit[1] };
  }
  if (has(/\b(toon|laat|ga|vlieg|kijk|camera|breng)\b/)) {
    const hit = CAMERA_WORDS.find(([re]) => re.test(t));
    if (hit) return { intent: 'camera', name: hit[1] };
  }

  // Vragen
  if (has(/hoe (vol|veel).*(auto|wagen)|(auto|wagen).*(vol|niveau|percent|geladen|opgeladen)/)) return { intent: 'askCars' };
  if (has(/(regenput|regenton|put|ton|tank|water)/) && has(/hoe vol|hoeveel|niveau|zit er|staat/) && !has(/leeg|ledig/)) return { intent: 'askTank' };
  if (has(/batterij|accu/) && has(/hoe vol|hoeveel|niveau|percent|opgeladen|status|staat/) && !has(/extra/)) return { intent: 'askBattery' };
  if (has(/buiten/) && has(/temperatuur|warm|koud|graden/)) return { intent: 'askOutside' };
  if (has(/hoe hard|hoe sterk|windsnelheid|waait/)) return { intent: 'askWind' };
  if (has(/prijs|tarief|duur/) && has(/stroom|elektriciteit|energie|kost|prijs|nu/)) return { intent: 'askPrice' };
  if (has(/(hoeveel|wat).*(energie|stroom|opwek|produc|opbrengst)|productie|opbrengst/)) return { intent: 'askProduction' };
  if (has(/hoe warm|hoe koud|binnentemperatuur|comfort|besp|kosten|uitstoot|co2/)) return { intent: 'askStatus' };

  // Wind bijsturen
  if (has(/wind/)) {
    if (has(/meer|harder|hoger|sterker|opzwepen/)) return { intent: 'wind', dir: 1 };
    if (has(/minder|zachter|lager|stil|kalm/)) return { intent: 'wind', dir: -1 };
  }

  // Weer
  if (has(/\b(weer|maak|zet|laat|wordt|het regent)\b/) || has(/zonnig|bewolkt|regenachtig/)) {
    if (!has(/\b(regenput|regenton)\b/) && !has(/leeg|ledig/)) {
      const hit = WEATHER_WORDS.find(([re]) => re.test(t));
      if (hit && (has(/weer|maak|laat|wordt|regent|zonnig|bewolkt|regenachtig/) || hit[1] === 'live')) return { intent: 'weather', mode: hit[1] };
    }
  }

  if (has(/\b(leeg|ledig)\w*\b.*\b(regen\w*|put|ton|tank|water)\b/)) return { intent: 'emptyTank' };
  if (has(/reset|nul ?stellen|begin opnieuw|tellers/)) return { intent: 'reset' };

  // Snelheid en pauze
  if (has(/dag in 24|versnel|tijdlapse|time ?lapse|sneller/)) return { intent: 'speed', fast: true };
  if (has(/realtime|real time|normale snelheid|vertraag/)) return { intent: 'speed', fast: false };
  if (has(/pauze|pauzeer|stop de tijd/)) return { intent: 'pause', paused: true };
  if (has(/hervat|ga verder|speel af|start de tijd/)) return { intent: 'pause', paused: false };

  // Schakelaars
  if (has(/extra batterij|tweede batterij/) && onOff !== null) return { intent: 'toggle', key: 'extraBattery', on: onOff };
  if (has(/warmte ?pomp/)) return { intent: 'toggle', key: 'heatPump', on: onOff }; // zonder aan/uit: omschakelen
  if (has(/buitenverlichting|tuinverlichting|straatverlichting|buitenlicht/) && onOff !== null) return { intent: 'toggle', key: 'outdoorOn', on: onOff };
  if (has(/ventilat|ventilator/) && onOff !== null) return { intent: 'toggle', key: 'fanOn', on: onOff };
  if (has(/verwarming|radiator/) && onOff !== null) return { intent: 'toggle', key: 'heaterOn', on: onOff };
  if (has(/laden|laad|oplad/) && onOff !== null) return { intent: 'toggle', key: 'evCharging', on: onOff };
  if (has(/rolluik|rolluiken|luiken/)) {
    if (has(/dicht|sluit|omlaag|neer/)) return { intent: 'toggle', key: 'shuttersClosed', on: true };
    if (has(/open|omhoog|op\b/)) return { intent: 'toggle', key: 'shuttersClosed', on: false };
  }
  if (has(/\b(raam|ramen|venster)\b/)) {
    if (has(/open|lucht/)) return { intent: 'windows', open: true };
    if (has(/dicht|sluit/)) return { intent: 'windows', open: false };
  }
  if (has(/automa|regeling/) && onOff !== null) return { intent: 'auto', on: onOff };

  // Weergave
  if (has(/warmtecamera|infrarood/)) return { intent: 'layer', name: 'thermal', on: onOff ?? true };
  if (has(/labels|waardelabels/)) return { intent: 'layer', name: 'labels', on: onOff ?? true };
  if (has(/stroomdeeltjes|stroom deeltjes/)) return { intent: 'layer', name: 'flows', on: onOff ?? true };
  if (has(/zonneboog|kompas/)) return { intent: 'layer', name: 'guides', on: onOff ?? true };
  return null;
}

const nl = (n, d = 1) => n.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d });
const clock = (h) => {
  const m = Math.round((h % 1) * 60);
  const hh = (Math.floor(h) + Math.floor(m / 60)) % 24;
  return String(hh).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
};
const aan = (on) => (on ? 'aan' : 'uit');

const TOGGLE_LABEL = {
  extraBattery: 'Extra batterij',
  heatPump: 'Warmtepomp',
  outdoorOn: 'Buitenverlichting',
  fanOn: 'Ventilatie',
  heaterOn: 'Verwarming',
  evCharging: 'Auto laden',
};
const WEATHER_TEXT = { zon: 'zonnig', bewolkt: 'bewolkt', regen: 'regenachtig', live: 'live weer' };
const CAMERA_TEXT = { wind: 'windmolens', palen: 'laadpalen', batterij: 'batterij', dak: 'dak', overzicht: 'overzicht' };

export const EXAMPLES = ['zet de zon op 15 uur', 'hoeveel energie produceren we', 'meer wind', 'leeg de regenput'];
export const HELP = [
  'tijd: "zet de zon op 15 uur", "naar echte tijd", "dag in 24 seconden", "pauze"',
  'vragen: "hoeveel energie produceren we", "hoe vol is de batterij", "hoe vol is de regenput", "hoe warm is het buiten", "hoe hard waait het", "wat kost stroom nu"',
  'weer: "meer wind", "minder wind", "maak het bewolkt", "laat het regenen", "storm", "hittegolf"',
  'bediening: "leeg de regenput", "zet de temperatuur op 22 graden", "verwarming uit", "ramen open", "rolluiken dicht", "automaat aan"',
  'camera: "toon de windmolens", "ga naar het dak", "volg de zon", "warmtecamera aan"',
].join('\n');

// Voert het commando uit en geeft een zin terug die toont wat er gebeurde.
// actions (optioneel): followSun(on), flyTo(naam), setScenario(naam), setLayer(naam, aan)
export function runCommand(cmd, actions = {}) {
  switch (cmd.intent) {
    case 'help':
      return 'Voorbeelden: ' + EXAMPLES.map((e) => `"${e}"`).join(', ') + '. Meer onder het paneel Spraak.';
    case 'setTime': {
      world.hour = cmd.hour;
      world.simTime = Math.floor(world.simTime / 24) * 24 + cmd.hour;
      const alt = (sunAt(dateAt(cmd.hour)).altitude * 180) / Math.PI;
      return alt > 0 ? `Tijd gezet op ${clock(cmd.hour)}. De zon staat ${nl(alt, 0)}° boven de horizon.` : `Tijd gezet op ${clock(cmd.hour)}. De zon is onder.`;
    }
    case 'now': {
      const d = new Date();
      world.hour = d.getHours() + d.getMinutes() / 60;
      world.simTime = Math.floor(world.simTime / 24) * 24 + world.hour;
      world.weatherMode = 'live';
      return `Terug naar de echte tijd (${clock(world.hour)}) met live weer.`;
    }
    case 'askProduction': {
      const now = state.solarKw + state.windKw;
      const total = state.solarKwh + state.windKwh;
      return `Nu ${nl(now, 2)} kW (zon ${nl(state.solarKw, 2)}, wind ${nl(state.windKw, 2)}). Tot nu ${nl(total, 2)} kWh opgewekt.`;
    }
    case 'askStatus':
      return `Binnen ${nl(state.insideTemp)} °C, comfort ${nl(comfortScore(), 0)}/100, batterij ${nl(batteryPercent(), 0)} %. Kosten € ${nl(costEuro(), 2)}, CO₂ ${nl(co2Kg(), 2)} kg.`;
    case 'askBattery':
      return `Batterij ${nl(batteryPercent(), 0)} % (${nl(state.battery, 1)} kWh).`;
    case 'askTank':
      return `Regenton ${nl(state.tankL, 0)} L (${nl(tankPercent(), 0)} % vol).`;
    case 'askOutside':
      return `Buiten ${nl(world.outsideTemp, 1)} °C, ${WEATHER_TEXT[world.weather] ?? world.weather}.`;
    case 'askWind':
      return `Wind ${nl(world.wind * 15, 1)} m/s. De windmolens leveren ${nl(state.windKw, 2)} kW.`;
    case 'askPrice':
      return `Stroomprijs nu € ${nl(priceAt(), 2)} per kWh.`;
    case 'askCars':
      return `Auto 1: ${state.cars[0].away ? 'weg' : nl(evPercent(state, 0), 0) + ' %'}, auto 2: ${state.cars[1].away ? 'weg' : nl(evPercent(state, 1), 0) + ' %'}.`;
    case 'setpoint':
      state.targetTemp = cmd.deg;
      state.heaterOn = true;
      return state.autoMode ? `Setpoint ${nl(cmd.deg)} °C. Let op: de automaatregeling kan dit weer aanpassen.` : `Setpoint gezet op ${nl(cmd.deg)} °C.`;
    case 'wind': {
      world.windBoost = Math.min(WIND_BOOST_MAX, Math.max(WIND_BOOST_MIN, world.windBoost + cmd.dir * WIND_STEP));
      const pct = Math.round(world.windBoost * 100);
      return `${cmd.dir > 0 ? 'Meer' : 'Minder'} wind: bijsturing ${pct > 0 ? '+' : ''}${pct} %. De windmolens passen zich aan.`;
    }
    case 'weather':
      world.weatherMode = cmd.mode;
      return `Weer: ${WEATHER_TEXT[cmd.mode]}.`;
    case 'scenario':
      actions.setScenario?.(cmd.name);
      return `Scenario gestart: ${cmd.name}.`;
    case 'camera':
      actions.flyTo?.(cmd.name);
      return `Camera naar ${CAMERA_TEXT[cmd.name]}.`;
    case 'emptyTank': {
      const l = state.tankL;
      state.tankL = 0;
      return `Regenton leeggemaakt (${nl(l, 0)} L).`;
    }
    case 'reset':
      resetDay();
      return 'Tellers op nul gezet.';
    case 'speed':
      world.hoursPerSec = cmd.fast ? 1 : REALTIME;
      return cmd.fast ? 'Dag in 24 seconden.' : 'Realtime.';
    case 'auto':
      state.autoMode = cmd.on;
      return `Automaatregeling ${aan(cmd.on)}.`;
    case 'pause':
      world.paused = cmd.paused;
      return cmd.paused ? 'Simulatie gepauzeerd.' : 'Simulatie hervat.';
    case 'toggle': {
      const on = cmd.on ?? !state[cmd.key];
      state[cmd.key] = on;
      const label = cmd.key === 'shuttersClosed' ? `Rolluiken ${on ? 'dicht' : 'open'}` : `${TOGGLE_LABEL[cmd.key]} ${aan(on)}`;
      return state.autoMode && ['fanOn', 'heaterOn', 'shuttersClosed', 'evCharging'].includes(cmd.key) ? `${label}. Let op: de automaat is actief en kan dit overschrijven.` : `${label}.`;
    }
    case 'windows':
      state.windowsOpen = [cmd.open, cmd.open];
      return state.autoMode ? `Ramen ${cmd.open ? 'open' : 'dicht'}. Let op: de automaat kan dit overschrijven.` : `Ramen ${cmd.open ? 'open' : 'dicht'}.`;
    case 'layer':
      actions.setLayer?.(cmd.name, cmd.on);
      return `${{ thermal: 'Warmtecamera', labels: 'Waardelabels', flows: 'Stroomdeeltjes', guides: 'Kompas en zonneboog' }[cmd.name]} ${aan(cmd.on)}.`;
    case 'followSun':
      actions.followSun?.(true);
      return 'Camera volgt de zon.';
  }
  return 'Onbekend commando.';
}
