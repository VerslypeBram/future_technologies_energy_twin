// Vereenvoudigd model: geen three.js, alleen getallen.
import { real, sampleWeather, sunAt, samplePrice, priceQuantile } from './realdata.js';

const startDate = new Date();
const startHour = startDate.getHours() + startDate.getMinutes() / 60;
const dayStartMs = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();

export const REALTIME = 1 / 3600; // u/s: 1 simulatie-uur = 1 echt uur

// Gedeelde wereld: klok en weer gelden voor alle huizen
export const world = {
  hour: startHour, // start op de echte tijd
  hoursPerSec: REALTIME, // start op realtime; versnellen kan met de schuif
  baseOutside: 5, // slider: gemiddelde buitentemp
  outsideTemp: 5, // berekend: basis + dagcurve + weer
  weatherMode: 'live', // live (Open-Meteo) | auto | zon | bewolkt | regen
  weather: 'zon',
  weatherTimer: 3, // gesimuleerde uren tot volgend weer
  cloud: 0,
  wind: 0.3, // 0 (windstil) tot 1 (storm), levert stroom via de windmolens
  windBoost: 0, // scenario: extra wind
  gridOnline: true, // scenario: stroomstoring
  scenario: null,
  scenarioHours: 0, // gesimuleerde uren sinds het scenario begon
  radiation: 0, // W/m² (live)
  precip: 0, // neerslag in mm/u
  snowing: false,
  snow: 0, // sneeuwlaag op de grond en het dak, 0..1
  panelSnow: 0, // sneeuw op de zonnepanelen, 0..1 (smelt sneller in de zon)
  simTime: startHour, // totaal gesimuleerde uren (voor de tijdlijn)
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
export const OUTDOOR_POWER_KW = 0.1; // straat-, gevel- en tuinverlichting samen op vol vermogen
const HEATER_GAIN = 0.35; // °C per seconde
const FAN_POWER_KW = 0.1;
const SOLAR_PEAK_KW = 1.5;
const SOLAR_HEAT = 0.05; // °C per seconde bij volle zon door de ramen
const BATTERY_CAPACITY_KWH = 5;
const EXTRA_BATTERY_KWH = 5; // extra batterij naast de eerste
const BATTERY_MAX_KW = 2;
const BATTERY_RESERVE = 0.2; // aandeel dat de automaat bewaart voor een stroomstoring
const GRID_CHARGE_MAX_SUN = 0.2; // bijladen van het net alleen als er weinig zon is
const ROOF_M2 = 25; // dakoppervlak dat regenwater opvangt
const TANK_CAPACITY_L = 300;
const PUMP_KW = 0.06; // regenwaterpomp tijdens het tuin sproeien
const WATER_L_PER_H = 60;
const CO2_PER_KWH = 0.25; // kg
const CO2_SOURCE_PPM_PER_H = 400; // bewoners ademen CO2 uit

export function createHouseState({ dumb = false } = {}) {
  return {
    dumb, // standaardhuis: geen automatisering, panelen of batterij
    insideTemp: 20,
    targetTemp: 21,
    heaterOn: true,
    fanOn: false,
    heatPump: !dumb, // warmtepomp (COP volgt de buitentemperatuur); het referentiehuis stookt elektrisch
    extraBattery: false,
    tankL: 0, // regenton (liter)
    pumpKw: 0,
    heaterKw: 0,
    outdoorOn: true, // handbediening: buitenverlichting aan (brandt alleen als het donker is)
    outdoorKw: 0,
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
    cost: 0, // euro, netto (afname min teruglevering)
    exportKwh: 0, // teruggeleverd aan het net
    revenue: 0, // euro opbrengst teruglevering
    comfortSum: 0,
    comfortTime: 0,
    // Stromen in kW voor visualisaties (batteryKw: + laden, - ontladen)
    flows: { solar: 0, wind: 0, batteryKw: 0, grid: 0, home: 0, ev: 0, export: 0 },
  };
}

export const state = createHouseState();
export const baseline = createHouseState({ dumb: true });

// Tijdstip in de simulatie (ms): echte datum van vandaag + gesimuleerde uren
export function dateAt(hour = world.hour) {
  return new Date(dayStartMs + (world.simTime + (hour - world.hour)) * 3600e3);
}

// Live weer actief (data geladen en gekozen)
export const isLive = () => world.weatherMode === 'live' && real.ready;

// 0 als de zon onder is, 1 bij hoge zon (30° of meer), volgens SunCalc
export function sunFactor(hour = world.hour) {
  const alt = sunAt(dateAt(hour)).altitude;
  return alt > 0 ? Math.min(1, 2 * Math.sin(alt)) : 0;
}

// zon na aftrek van bewolking (live: gemeten straling)
export function sunEff() {
  if (isLive()) return Math.min(1, world.radiation / 800);
  return sunFactor() * (1 - 0.75 * world.cloud);
}

export function isHome(hour = world.hour) {
  return hour >= 17.5 || hour < 8.5;
}

function isSleeping(hour = world.hour) {
  return hour >= 23 || hour < 6;
}

export function priceAt(hour = world.hour) {
  if (world.weatherMode === 'live' && real.pricesReady) {
    const live = samplePrice(dateAt(hour).getTime());
    if (live !== null) return live;
  }
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

// Terugleververgoeding: de afnameprijs min nettarief, taksen en btw, dus ongeveer de spotprijs (nooit negatief)
export function feedInPrice(hour = world.hour) {
  return Math.max(0, priceAt(hour) / 1.06 - 0.12);
}

// Temperatuur per kamer: woonkamer (oost, radiator, raam 2) en slaapkamer (west, raam 1)
// Goedkoop/duur: echte prijzen vergelijken met de eigen verdeling (onderste/bovenste kwart); anders vaste grenzen
export function priceIsCheap(hour = world.hour) {
  const q = world.weatherMode === 'live' && real.pricesReady ? priceQuantile(0.25) : null;
  return priceAt(hour) <= (q ?? 0.22);
}
export function priceIsPeak(hour = world.hour) {
  const q = world.weatherMode === 'live' && real.pricesReady ? priceQuantile(0.8) : null;
  return priceAt(hour) > (q ?? 0.4);
}

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
  if (priceIsPeak(hour)) target -= 1; // tijdens de piek iets zuiniger
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

// Rendement van de warmtepomp: beter bij zacht weer (COP 1 = gewone elektrische verwarming)
export function copAt(temp, heatPump = true) {
  if (!heatPump) return 1;
  return Math.min(4.5, Math.max(1.8, 3 + 0.1 * temp));
}
export const batteryCapacity = (h = state) => BATTERY_CAPACITY_KWH + (h.extraBattery ? EXTRA_BATTERY_KWH : 0);
const batteryMaxKw = (h) => BATTERY_MAX_KW * (h.extraBattery ? 1.5 : 1);

// 0 (uit) .. 1 (vol): brandt als de zon (bijna) onder is; het slimme huis dimt 's nachts
export function outdoorLevel(h = state) {
  const dark = 1 - Math.min(1, sunFactor() / 0.3);
  if (dark <= 0) return 0;
  if (h.dumb) return dark;
  if (h.autoMode) return dark * (isSleeping() ? 0.4 : 1);
  return h.outdoorOn ? dark : 0;
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

  if (isLive()) {
    const m = sampleWeather(dateAt().getTime());
    w.radiation = m.rad;
    // hysterese: wisselen pas ruim over de drempel, zodat het label niet flippert
    const wasRain = w.weather === 'regen';
    const wasCloudy = w.weather === 'bewolkt' || wasRain;
    const rain = m.precip > (wasRain ? 0.05 : 0.15);
    const cloudy = m.cloud > (wasCloudy ? 0.5 : 0.65);
    w.weather = rain ? 'regen' : cloudy ? 'bewolkt' : 'zon';
    w.cloud += (m.cloud - w.cloud) * Math.min(1, dt * 1.5);
    const windTarget = Math.min(1, Math.max(0, m.wind / 15 + w.windBoost));
    w.wind += (windTarget - w.wind) * Math.min(1, dt * 1.5);
    w.baseOutside = Math.round(m.temp);
    w.outsideTemp = m.temp;
    w.precip = m.precip;
    w.snowing = m.precip > 0.1 && m.temp < 1.5;
    stepSnow(w, dtH);
    return;
  }
  w.radiation = 0;

  if (w.weatherMode === 'auto' || w.weatherMode === 'live') {
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
  w.precip = w.weather === 'regen' ? 3 : 0;
  w.snowing = w.weather !== 'zon' && w.outsideTemp < 0.5 && w.cloud > 0.5;
  stepSnow(w, dtH);
}

// Sneeuw hoopt zich op bij vorst en neerslag en smelt bij dooi; op de panelen sneller, vooral in de zon
function stepSnow(w, dtH) {
  if (w.snowing) {
    w.snow = Math.min(1, w.snow + 0.35 * dtH);
    w.panelSnow = Math.min(w.snow, w.panelSnow + 0.5 * dtH);
  } else {
    const melt = Math.max(0, w.outsideTemp - 0.5) * 0.03 + (w.outsideTemp > -8 ? 0.01 : 0);
    w.snow = Math.max(0, w.snow - melt * dtH);
    w.panelSnow = Math.max(0, Math.min(w.snow, w.panelSnow - (melt + 0.04 + 0.5 * sunEff()) * dtH));
  }
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
  h.solarKw = h.dumb ? 0 : sunEff() * SOLAR_PEAK_KW * (1 - 0.9 * world.panelSnow);
  h.windKw = h.dumb ? 0 : world.wind * WIND_PEAK_KW;
  const genKw = h.solarKw + h.windKw;
  const batteryAvailKw = h.dumb ? 0 : Math.min(batteryMaxKw(h), h.battery / dtSafe);
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
  const heaterKw = HEATER_POWER_KW / copAt(world.outsideTemp, h.heatPump);
  if (h.heaterActive && capLeft < heaterKw) h.heaterActive = false; // stroomstoring
  if (h.heaterActive) capLeft -= heaterKw;
  h.heaterKw = h.heaterActive ? heaterKw : 0;

  let dT = (world.outsideTemp - h.insideTemp) * loss * dt;
  if (h.heaterActive) dT += HEATER_GAIN * dt;
  dT += SOLAR_HEAT * sunEff() * (h.shuttersClosed ? 0.1 : 1) * dt;
  h.insideTemp += dT;

  const home = isHome();

  // CO2 binnen: stijgt met bewoners, daalt door ventilatie en open ramen
  const airChange = 0.5 + 2 * openCount + (h.fanOn ? 1.5 : 0);
  h.co2ppm += dtH * ((home ? CO2_SOURCE_PPM_PER_H : 0) - (h.co2ppm - 420) * airChange);

  h.outdoorKw = outdoorLevel(h) * OUTDOOR_POWER_KW;

  // Regenton: vult met dakwater, de pomp sproeit de tuin op droge, warme avonden en ochtenden
  h.pumpKw = 0;
  if (!h.dumb) {
    h.tankL = Math.min(TANK_CAPACITY_L, h.tankL + world.precip * ROOF_M2 * dtH);
    const wateringTime = (world.hour >= 19 && world.hour < 21) || (world.hour >= 6 && world.hour < 8);
    if (wateringTime && world.precip === 0 && world.outsideTemp > 16 && h.tankL > 0) {
      h.pumpKw = PUMP_KW;
      h.tankL = Math.max(0, h.tankL - WATER_L_PER_H * dtH);
    }
  }
  const homeNeedKw = h.heaterKw + (h.fanOn ? FAN_POWER_KW : 0) + h.outdoorKw + h.pumpKw;

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
      charge = priceIsCheap() || surplus > 1 || car.soc < EV_CAPACITY_KWH * 0.25 || needsSoon;
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
  let exportKw = 0;

  // Slim batterijbeheer (automaat): goedkope nacht-/daluren bijladen van het net en dan niet ontladen;
  // anders een reserve bewaren voor een stroomstoring, behalve tijdens de piekprijs.
  const smart = !h.dumb && h.autoMode && world.gridOnline;
  const gridCharge = smart && priceIsCheap() && sunEff() < GRID_CHARGE_MAX_SUN;
  const reserveKwh = smart && !priceIsPeak() ? BATTERY_RESERVE * batteryCapacity(h) : 0;
  const room = h.dumb ? 0 : Math.max(0, batteryCapacity(h) - h.battery) / dtSafe;

  if (genKw >= needKw) {
    const surplus = genKw - needKw;
    if (!h.dumb) batteryKw = Math.min(surplus, batteryMaxKw(h), room);
    exportKw = world.gridOnline ? surplus - batteryKw : 0; // bij een storing kan het overschot niet naar het net
  } else {
    const deficit = needKw - genKw;
    let discharge = 0;
    if (!h.dumb && !gridCharge) {
      discharge = Math.min(deficit, batteryMaxKw(h), Math.max(0, h.battery - reserveKwh) / dtSafe);
    }
    batteryKw = -discharge;
    gridKw = world.gridOnline ? deficit - discharge : 0;
  }
  if (gridCharge) {
    const extra = Math.min(batteryMaxKw(h) - batteryKw, room - batteryKw);
    if (extra > 0) {
      batteryKw += extra;
      gridKw += extra;
    }
  }
  if (dtH > 0) h.battery = Math.min(batteryCapacity(h), Math.max(0, h.battery + batteryKw * dtH));
  h.flows = { solar: h.solarKw, wind: h.windKw, batteryKw, grid: gridKw, home: homeNeedKw, ev: evKw, export: exportKw };

  h.energyKwh += needKw * dtH;
  h.solarKwh += h.solarKw * dtH;
  h.windKwh += h.windKw * dtH;
  h.gridKwh += gridKw * dtH;
  h.exportKwh += exportKw * dtH;
  h.revenue += exportKw * dtH * feedInPrice();
  h.cost += gridKw * dtH * priceAt() - exportKw * dtH * feedInPrice(); // netto: afname min teruglevering

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
    h.energyKwh = h.solarKwh = h.windKwh = h.gridKwh = h.exportKwh = h.revenue = h.cost = h.comfortSum = h.comfortTime = 0;
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

export const tankPercent = (h = state) => (h.tankL / TANK_CAPACITY_L) * 100;
export const evPercent = (h, i) => (h.cars[i].soc / EV_CAPACITY_KWH) * 100;
export const batteryPercent = (h = state) => (h.battery / batteryCapacity(h)) * 100;
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
    if (priceIsPeak()) return 'Piekprijs: setpoint verlaagd.';
    return 'Automaatregeling actief.';
  }
  if (open && s.heaterActive && world.outsideTemp < s.insideTemp - 5) return 'Raam open, verwarming in bedrijf.';
  if (s.insideTemp < 18) return 'Binnentemperatuur onder 18 °C.';
  if (s.insideTemp > 25) return 'Binnentemperatuur boven 25 °C.';
  if (s.co2ppm > 1200) return 'CO₂ binnen boven 1200 ppm.';
  if (!isHome() && s.heaterActive) return 'Afwezig, verwarming in bedrijf.';
  return 'Handbediening. Geen afwijkingen.';
}
