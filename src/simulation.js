// Vereenvoudigd model: geen three.js, alleen getallen.

// Gedeelde wereld: klok en weer gelden voor alle huizen
export const world = {
  hour: 12,
  hoursPerSec: 0.25, // snelheid van de dag
  baseOutside: 5, // slider: gemiddelde buitentemp
  outsideTemp: 5, // berekend: basis + dagcurve + weer
  weatherMode: 'auto', // auto | zon | bewolkt | regen
  weather: 'zon',
  weatherTimer: 3, // gesimuleerde uren tot volgend weer
  cloud: 0,
  wind: 0.3, // 0 (windstil) tot 1 (storm), levert stroom via de windmolens
  windBoost: 0, // scenario: extra wind
  gridOnline: true, // scenario: stroomstoring
  scenario: null,
  scenarioHours: 0, // gesimuleerde uren sinds het scenario begon
  simTime: 12, // totaal gesimuleerde uren (voor de tijdlijn)
  paused: false,
};

const WIND_BASE = { zon: 0.25, bewolkt: 0.5, regen: 0.8 };
const WIND_PEAK_KW = 2; // twee molens samen
const EV_CAPACITY_KWH = 30;
const EV_CHARGE_KW = 3.7; // per laadpaal

const CLOUD = { zon: 0.05, bewolkt: 0.7, regen: 0.95 };

const BASE_LOSS = 0.02; // per seconde, dichte woning
const WINDOW_LOSS = 0.06; // extra per open raam
const FAN_LOSS = 0.03;
const HEATER_POWER_KW = 2;
const HEATER_GAIN = 0.35; // °C per seconde
const FAN_POWER_KW = 0.1;
const SOLAR_PEAK_KW = 1.5;
const SOLAR_HEAT = 0.05; // °C per seconde bij volle zon door de ramen
const BATTERY_CAPACITY_KWH = 5;
const BATTERY_MAX_KW = 2;
const CO2_PER_KWH = 0.25; // kg
const CO2_SOURCE_PPM_PER_H = 400; // bewoners ademen CO2 uit

export function createHouseState({ dumb = false } = {}) {
  return {
    dumb, // standaardhuis: geen automatisering, panelen of batterij
    insideTemp: 20,
    targetTemp: 21,
    heaterOn: true,
    fanOn: false,
    fanCo2: false, // auto: ventileren op CO2 (met hysterese)
    autoMode: false,
    windowsOpen: [false, false],
    shuttersClosed: false,
    heaterActive: false,
    co2ppm: 600,
    solarKw: 0,
    windKw: 0,
    windKwh: 0,
    evKw: 0,
    evCharging: true, // handmatig: laden aan bij thuiskomst
    cars: [
      { soc: 20, away: false, charging: false, trip: 6 }, // kWh per dag onderweg
      { soc: 15, away: false, charging: false, trip: 4 },
    ],
    battery: 0, // kWh
    energyKwh: 0, // totaal verbruik
    solarKwh: 0, // totale opbrengst
    gridKwh: 0, // afname van het net
    cost: 0, // euro
    comfortSum: 0,
    comfortTime: 0,
    // Stromen in kW voor visualisaties (batteryKw: + laden, - ontladen)
    flows: { solar: 0, wind: 0, batteryKw: 0, grid: 0, home: 0, ev: 0 },
  };
}

export const state = createHouseState();
export const baseline = createHouseState({ dumb: true });

// 0 's nachts, 1 rond het middaguur
export function sunFactor(hour = world.hour) {
  if (hour < 6 || hour > 18) return 0;
  return Math.sin(((hour - 6) / 12) * Math.PI);
}

// zon na aftrek van bewolking
export function sunEff() {
  return sunFactor() * (1 - 0.75 * world.cloud);
}

export function isHome(hour = world.hour) {
  return hour >= 17.5 || hour < 8.5;
}

function isSleeping(hour = world.hour) {
  return hour >= 23 || hour < 6;
}

export function priceAt(hour = world.hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h < 6) return 0.18;
  if (h < 7) return 0.25;
  if (h < 9) return 0.35;
  if (h < 11) return 0.25;
  if (h < 15) return 0.15;
  if (h < 17) return 0.25;
  if (h < 21) return 0.45;
  return 0.22;
}

// Temperatuur per kamer: woonkamer (oost, radiator, raam 2) en slaapkamer (west, raam 1)
export function roomTemps(h = state) {
  return {
    woonkamer: h.insideTemp + (h.heaterActive ? 0.8 : -0.2) - (h.windowsOpen[1] ? 1.5 : 0),
    slaapkamer: h.insideTemp - 0.8 - (h.windowsOpen[0] ? 1.5 : 0),
  };
}

function autoControl(h) {
  const hour = world.hour;
  const home = isHome();

  let target = home ? (isSleeping() ? 17 : 21) : 16;
  if (!home && hour >= 16 && hour < 17.5) target = 21; // voorverwarmen voor thuiskomst
  if (priceAt(hour + 2) >= priceAt(hour) * 1.3) target += 1; // stook vooruit voor de dure piek
  if (priceAt(hour) > 0.4) target -= 1; // tijdens de piek iets zuiniger
  h.targetTemp = target;
  h.heaterOn = true;

  if (h.co2ppm > 1000) h.fanCo2 = true;
  else if (h.co2ppm < 750) h.fanCo2 = false;

  const tooWarm = h.insideTemp > 24;
  h.fanOn = (tooWarm || h.fanCo2) && home;
  const open = tooWarm && home && world.outsideTemp < h.insideTemp && world.weather !== 'regen';
  h.windowsOpen = [open, open];

  h.shuttersClosed = sunFactor() === 0 || (sunEff() > 0.5 && h.insideTemp > 22);
}

export function comfortScoreFor(h) {
  const ideal = isSleeping() ? 18 : 21;
  const tempPenalty = Math.min(1, Math.abs(h.insideTemp - ideal) / 6);
  let score = 100 * (1 - tempPenalty);
  const fresh = h.fanOn || h.windowsOpen.some(Boolean);
  if (fresh) score = Math.min(100, score + 8);
  score -= Math.min(15, Math.max(0, (h.co2ppm - 1000) / 40)); // bedompte lucht
  return Math.max(0, Math.round(score));
}

export function comfortScore() {
  return comfortScoreFor(state);
}

export function averageComfort(h) {
  return h.comfortTime > 0 ? h.comfortSum / h.comfortTime : 0;
}

function stepWorld(dt) {
  const w = world;
  const dtH = dt * w.hoursPerSec;
  w.hour = (w.hour + dtH) % 24;
  w.simTime += dtH;
  if (w.scenario) w.scenarioHours += dtH;

  if (w.weatherMode === 'auto') {
    w.weatherTimer -= dtH;
    if (w.weatherTimer <= 0) {
      const r = Math.random();
      w.weather = r < 0.5 ? 'zon' : r < 0.8 ? 'bewolkt' : 'regen';
      w.weatherTimer = 2 + Math.random() * 2;
    }
  } else {
    w.weather = w.weatherMode;
  }
  w.cloud += (CLOUD[w.weather] - w.cloud) * Math.min(1, dt * 1.5);
  // Wind golft rond een basis die bij het weer past
  const windTarget = WIND_BASE[w.weather] + 0.2 * Math.sin(w.hour * 1.7) * Math.cos(w.hour * 0.6) + w.windBoost;
  w.wind += (Math.min(1, Math.max(0, windTarget)) - w.wind) * Math.min(1, dt * 1.5);
  w.outsideTemp = w.baseOutside + 4 * Math.sin(((w.hour - 9) / 24) * 2 * Math.PI) - 2 * w.cloud;
}

function stepHouse(h, dt) {
  if (h.dumb) {
    h.targetTemp = 21;
    h.heaterOn = true;
    h.fanOn = false;
    h.windowsOpen = [false, false];
    h.shuttersClosed = false;
  } else if (h.autoMode) {
    autoControl(h);
  }

  // Opwek en beschikbaar vermogen (bij stroomstoring: alleen opwek + batterij)
  const dtH = dt * world.hoursPerSec;
  const dtSafe = Math.max(dtH, 1 / 3600);
  h.solarKw = h.dumb ? 0 : sunEff() * SOLAR_PEAK_KW;
  h.windKw = h.dumb ? 0 : world.wind * WIND_PEAK_KW;
  const genKw = h.solarKw + h.windKw;
  const batteryAvailKw = h.dumb ? 0 : Math.min(BATTERY_MAX_KW, h.battery / dtSafe);
  let capLeft = world.gridOnline ? Infinity : genKw + batteryAvailKw;

  const openCount = h.windowsOpen.filter(Boolean).length;
  const night = sunFactor() === 0;
  const base = BASE_LOSS * (night && h.shuttersClosed ? 0.8 : 1);
  const loss = base + openCount * WINDOW_LOSS + (h.fanOn ? FAN_LOSS : 0);

  // Thermostaat met hysterese
  if (h.heaterOn) {
    if (h.insideTemp < h.targetTemp - 0.3) h.heaterActive = true;
    else if (h.insideTemp > h.targetTemp + 0.3) h.heaterActive = false;
  } else {
    h.heaterActive = false;
  }
  if (h.heaterActive && capLeft < HEATER_POWER_KW) h.heaterActive = false; // stroomstoring
  if (h.heaterActive) capLeft -= HEATER_POWER_KW;

  let dT = (world.outsideTemp - h.insideTemp) * loss * dt;
  if (h.heaterActive) dT += HEATER_GAIN * dt;
  dT += SOLAR_HEAT * sunEff() * (h.shuttersClosed ? 0.1 : 1) * dt;
  h.insideTemp += dT;

  const home = isHome();

  // CO2 binnen: stijgt met bewoners, daalt door ventilatie en open ramen
  const airChange = 0.5 + 2 * openCount + (h.fanOn ? 1.5 : 0);
  h.co2ppm += dtH * ((home ? CO2_SOURCE_PPM_PER_H : 0) - (h.co2ppm - 420) * airChange);

  const homeNeedKw = (h.heaterActive ? HEATER_POWER_KW : 0) + (h.fanOn ? FAN_POWER_KW : 0);

  // Elektrische auto's: vertrekken en komen terug met de bewoners, laden aan de paal
  let evKw = 0;
  h.cars.forEach((car) => {
    if (!home && !car.away) {
      car.away = true;
      car.soc = Math.max(0, car.soc - car.trip); // rit verbruikt stroom
    }
    if (home) car.away = false;
    car.charging = false;
    if (car.away || car.soc >= EV_CAPACITY_KWH) return;

    let charge;
    if (h.dumb) charge = true; // standaard: direct vol laden bij thuiskomst
    else if (h.autoMode) {
      const surplus = genKw - homeNeedKw;
      const hour = world.hour;
      const needsSoon = hour >= 5 && hour < 8.5 && car.soc < EV_CAPACITY_KWH * 0.8; // klaar voor vertrek
      charge = priceAt() <= 0.22 || surplus > 1 || car.soc < EV_CAPACITY_KWH * 0.25 || needsSoon;
    } else charge = h.evCharging;

    if (charge && capLeft >= EV_CHARGE_KW) {
      capLeft -= EV_CHARGE_KW;
      car.charging = true;
      evKw += EV_CHARGE_KW;
      if (dtH > 0) car.soc = Math.min(EV_CAPACITY_KWH, car.soc + EV_CHARGE_KW * dtH);
    }
  });
  h.evKw = evKw;
  const needKw = homeNeedKw + evKw;

  let gridKw = 0;
  let batteryKw = 0;

  if (genKw >= needKw) {
    const surplus = genKw - needKw;
    if (!h.dumb) {
      const room = (BATTERY_CAPACITY_KWH - h.battery) / dtSafe;
      batteryKw = Math.min(surplus, BATTERY_MAX_KW, room);
      if (dtH > 0) h.battery += batteryKw * dtH;
    }
  } else {
    const deficit = needKw - genKw;
    let discharge = 0;
    if (!h.dumb) discharge = Math.min(deficit, BATTERY_MAX_KW, h.battery / dtSafe);
    if (dtH > 0) h.battery -= discharge * dtH;
    batteryKw = -discharge;
    gridKw = world.gridOnline ? deficit - discharge : 0;
  }
  h.flows = { solar: h.solarKw, wind: h.windKw, batteryKw, grid: gridKw, home: homeNeedKw, ev: evKw };

  h.energyKwh += needKw * dtH;
  h.solarKwh += h.solarKw * dtH;
  h.windKwh += h.windKw * dtH;
  h.gridKwh += gridKw * dtH;
  h.cost += gridKw * dtH * priceAt();

  if (home) {
    h.comfortSum += comfortScoreFor(h) * dt;
    h.comfortTime += dt;
  }
}

export function step(dt) {
  if (world.paused) return;
  stepWorld(dt);
  stepHouse(state, dt);
  stepHouse(baseline, dt);
}

export function resetDay() {
  [state, baseline].forEach((h) => {
    h.energyKwh = h.solarKwh = h.windKwh = h.gridKwh = h.cost = h.comfortSum = h.comfortTime = 0;
  });
  world.scenarioHours = 0;
}

// Momentopname voor de tijdlijn (diepe kopie) en terugzetten
const clone = (o) => JSON.parse(JSON.stringify(o));
export function snapshot() {
  return { world: clone(world), state: clone(state), baseline: clone(baseline) };
}
export function restore(s) {
  const paused = world.paused;
  Object.assign(world, clone(s.world));
  world.paused = paused;
  Object.assign(state, clone(s.state));
  Object.assign(baseline, clone(s.baseline));
}

export const evPercent = (h, i) => (h.cars[i].soc / EV_CAPACITY_KWH) * 100;
export const batteryPercent = (h = state) => (h.battery / BATTERY_CAPACITY_KWH) * 100;
export const netKwh = (h = state) => h.gridKwh;
export const costEuro = (h = state) => h.cost;
export const co2Kg = (h = state) => h.gridKwh * CO2_PER_KWH;

export function tip() {
  const s = state;
  const open = s.windowsOpen.some(Boolean);
  if (!world.gridOnline) return 'Netstoring. Woning draait op opwek en batterij.';
  if (s.autoMode) {
    if (!isHome()) return 'Afwezig: setpoint verlaagd naar 16 °C.';
    if (s.cars.some((c) => c.charging)) return 'Laadpaal actief op goedkope of eigen stroom.';
    if (priceAt() > 0.4) return 'Piekprijs: setpoint verlaagd.';
    return 'Automaatregeling actief.';
  }
  if (open && s.heaterActive && world.outsideTemp < s.insideTemp - 5) return 'Raam open, verwarming in bedrijf.';
  if (s.insideTemp < 18) return 'Binnentemperatuur onder 18 °C.';
  if (s.insideTemp > 25) return 'Binnentemperatuur boven 25 °C.';
  if (s.co2ppm > 1200) return 'CO₂ binnen boven 1200 ppm.';
  if (!isHome() && s.heaterActive) return 'Afwezig, verwarming in bedrijf.';
  return 'Handbediening. Geen afwijkingen.';
}
