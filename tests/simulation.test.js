process.env.TZ = 'Europe/Brussels';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { stubFetch } from './helpers.js';

const HOUR = 3600e3;
const startMs = Math.floor(Date.now() / HOUR) * HOUR - 48 * HOUR;
stubFetch(startMs);

const sim = await import('../src/simulation.js');
const rd = await import('../src/realdata.js');
const { world, state, baseline, step, priceAt, priceIsCheap, priceIsPeak, sunFactor, outdoorLevel, OUTDOOR_POWER_KW, copAt, batteryCapacity, batteryPercent } = sim;

function setHour(h) {
  world.simTime = Math.floor(world.simTime / 24) * 24 + h;
  world.hour = h;
}

beforeEach(() => {
  world.paused = false;
  world.weatherMode = 'zon';
  world.gridOnline = true;
  world.hoursPerSec = 0.25;
  world.windBoost = 0;
});

describe('zonnestand (SunCalc)', () => {
  it('is nul midden in de nacht en positief rond de middag', () => {
    expect(sunFactor(0)).toBe(0);
    expect(sunFactor(13)).toBeGreaterThan(0.2);
  });
});

describe('energiebalans', () => {
  it('opwek + net + batterij dekt elke stap het verbruik', () => {
    state.autoMode = true;
    for (const [hour, cloud] of [[3, 0], [10, 0.1], [13, 0.5], [19, 0.9]]) {
      setHour(hour);
      for (let i = 0; i < 20; i++) {
        step(0.1);
        const f = state.flows;
        const need = f.home + f.ev;
        // batteryKw: + laden, - ontladen
        expect(f.solar + f.wind + f.grid - f.batteryKw).toBeCloseTo(need, 6);
      }
    }
  });

  it('zonder net (stroomstoring) wordt er niets afgenomen', () => {
    world.gridOnline = false;
    setHour(20);
    for (let i = 0; i < 20; i++) step(0.1);
    expect(state.flows.grid).toBe(0);
  });

  it('het referentiehuis heeft geen opwek en geen batterij', () => {
    setHour(13);
    for (let i = 0; i < 20; i++) step(0.1);
    expect(baseline.flows.solar).toBe(0);
    expect(baseline.battery).toBe(0);
  });
});

describe('prijs: vaste tabel (mock)', () => {
  it('geeft de bekende tariefblokken', () => {
    world.weatherMode = 'zon';
    expect(priceAt(3)).toBe(0.18);
    expect(priceAt(19)).toBe(0.45);
    expect(priceIsPeak(19)).toBe(true);
    expect(priceIsCheap(3)).toBe(true);
  });
});

describe('prijs: live (Energy-Charts)', () => {
  beforeAll(async () => {
    await rd.loadPrices();
  });

  it('laadt de prijzen en rekent om naar een eindprijs', () => {
    expect(rd.real.pricesReady).toBe(true);
    // spot 0 €/MWh -> (0 + 0.12) * 1.06
    expect(rd.samplePrice(startMs)).toBeCloseTo(0.12 * 1.06, 6);
  });

  it('geeft null buiten het bereik van de data', () => {
    expect(rd.samplePrice(startMs - 10 * HOUR)).toBeNull();
    expect(rd.samplePrice(startMs + 1000 * HOUR)).toBeNull();
  });

  it('bepaalt goedkoop en duur relatief aan de eigen prijsverdeling', () => {
    world.weatherMode = 'live';
    rd.real.ready = true;
    expect(priceIsCheap(world.hour - 40)).toBe(true);
    expect(priceIsPeak(world.hour - 40)).toBe(false);
    expect(priceIsPeak(world.hour + 40)).toBe(true);
    expect(priceIsCheap(world.hour + 40)).toBe(false);
  });

  it('valt terug op de vaste tabel buiten de data', () => {
    world.weatherMode = 'live';
    expect(priceAt(world.hour + 24 * 30)).toBeGreaterThan(0); // geen crash, terugval op tabel
  });
});

describe('buitenverlichting', () => {
  it('is overdag uit en snachts aan', () => {
    state.autoMode = false;
    state.outdoorOn = true;
    setHour(13);
    expect(outdoorLevel(state)).toBe(0);
    setHour(21);
    expect(outdoorLevel(state)).toBe(1);
  });

  it('het slimme huis dimt na 23:00, het referentiehuis niet', () => {
    state.autoMode = true;
    setHour(21);
    expect(outdoorLevel(state)).toBe(1);
    setHour(23.5);
    expect(outdoorLevel(state)).toBe(0.4);
    expect(outdoorLevel(baseline)).toBe(1);
  });

  it('de handschakelaar zet de verlichting uit', () => {
    state.autoMode = false;
    state.outdoorOn = false;
    setHour(22);
    expect(outdoorLevel(state)).toBe(0);
    state.outdoorOn = true;
  });

  it('telt mee in het huisverbruik', () => {
    state.autoMode = false;
    state.heaterOn = false;
    state.fanOn = false;
    setHour(22);
    for (let i = 0; i < 5; i++) step(0.1);
    expect(state.outdoorKw).toBeCloseTo(OUTDOOR_POWER_KW, 6);
    expect(state.flows.home).toBeGreaterThanOrEqual(OUTDOOR_POWER_KW - 1e-9);
    state.heaterOn = true;
  });
});

describe('warmtepomp', () => {
  it('heeft een rendement dat met de buitentemperatuur meegroeit en begrensd is', () => {
    expect(copAt(-10)).toBeCloseTo(2.0, 6);
    expect(copAt(5)).toBeCloseTo(3.5, 6);
    expect(copAt(40)).toBe(4.5);
    expect(copAt(-40)).toBe(1.8);
    expect(copAt(5, false)).toBe(1); // elektrische verwarming
  });

  it('verbruikt minder stroom dan elektrisch verwarmen bij dezelfde warmte', () => {
    state.heatPump = true;
    state.insideTemp = baseline.insideTemp = 14;
    state.heaterOn = baseline.heaterOn = true;
    setHour(13);
    step(0.01);
    expect(state.heaterActive).toBe(true);
    expect(baseline.heaterActive).toBe(true);
    expect(state.heaterKw).toBeLessThan(baseline.heaterKw);
    expect(baseline.heaterKw).toBeCloseTo(2, 6);
  });
});

describe('extra batterij', () => {
  it('verdubbelt de capaciteit en halveert het percentage bij gelijke lading', () => {
    state.extraBattery = false;
    state.battery = 2.5;
    expect(batteryCapacity(state)).toBe(5);
    expect(batteryPercent(state)).toBeCloseTo(50, 6);
    state.extraBattery = true;
    expect(batteryCapacity(state)).toBe(10);
    expect(batteryPercent(state)).toBeCloseTo(25, 6);
    state.extraBattery = false;
  });
});

describe('sneeuw', () => {
  it('hoopt zich op bij vorst en bewolking en smelt bij dooi', () => {
    world.snow = 0;
    world.panelSnow = 0;
    world.weatherMode = 'bewolkt';
    world.baseOutside = -8;
    for (let i = 0; i < 8; i++) step(1);
    expect(world.snowing).toBe(true);
    expect(world.snow).toBeGreaterThan(0.5);
    expect(world.panelSnow).toBeGreaterThan(0);

    world.weatherMode = 'zon';
    world.baseOutside = 20;
    for (let i = 0; i < 40; i++) step(1);
    expect(world.snowing).toBe(false);
    expect(world.snow).toBe(0);
    expect(world.panelSnow).toBe(0);
    world.baseOutside = 5;
  });

  it('sneeuw op de panelen kost bijna alle zonne-opbrengst', () => {
    setHour(13);
    world.baseOutside = -10;
    world.snow = world.panelSnow = 0;
    step(0.001);
    const clear = state.solarKw;
    world.snow = world.panelSnow = 1;
    step(0.001);
    expect(clear).toBeGreaterThan(0);
    expect(state.solarKw / clear).toBeCloseTo(0.1, 1);
    world.snow = world.panelSnow = 0;
    world.baseOutside = 5;
  });
});

describe('regenton', () => {
  it('vult met dakwater bij regen, alleen in het slimme huis', () => {
    state.tankL = baseline.tankL = 0;
    world.weatherMode = 'regen';
    world.baseOutside = 10;
    for (let i = 0; i < 4; i++) step(1);
    expect(state.tankL).toBeGreaterThan(40);
    expect(state.tankL).toBeLessThanOrEqual(300);
    expect(baseline.tankL).toBe(0);
  });
});
