process.env.TZ = 'Europe/Brussels';
import { describe, it, expect, beforeEach } from 'vitest';
import { stubFetch } from './helpers.js';

const HOUR = 3600e3;
stubFetch(Math.floor(Date.now() / HOUR) * HOUR - 48 * HOUR);

const { parseCommand, runCommand } = await import('../src/voice-commands.js');
const { world, state } = await import('../src/simulation.js');

beforeEach(() => {
  world.windBoost = 0;
  world.paused = false;
  world.hoursPerSec = 0.25;
});

describe('parseCommand', () => {
  it('herkent een tijd in cijfers en woorden', () => {
    expect(parseCommand('Zet de zon op 15 uur')).toEqual({ intent: 'setTime', hour: 15 });
    expect(parseCommand('zet de zon op vijftien uur')).toEqual({ intent: 'setTime', hour: 15 });
    expect(parseCommand("zet de tijd op drie uur 's middags")).toEqual({ intent: 'setTime', hour: 15 });
    expect(parseCommand('zet de klok op 15:30')).toEqual({ intent: 'setTime', hour: 15.5 });
    expect(parseCommand('zet de zon op half vier')).toEqual({ intent: 'setTime', hour: 3.5 });
    expect(parseCommand('zet de zon op 24 uur')).toEqual({ intent: 'setTime', hour: 0 });
  });

  it('herkent de overige commando\'s', () => {
    expect(parseCommand('Hoeveel energie produceren we?').intent).toBe('askProduction');
    expect(parseCommand('meer wind')).toEqual({ intent: 'wind', dir: 1 });
    expect(parseCommand('minder wind')).toEqual({ intent: 'wind', dir: -1 });
    expect(parseCommand('leeg de regenput').intent).toBe('emptyTank');
    expect(parseCommand('dag in 24 seconden')).toEqual({ intent: 'speed', fast: true });
    expect(parseCommand('realtime')).toEqual({ intent: 'speed', fast: false });
    expect(parseCommand('zet de automaat aan')).toEqual({ intent: 'auto', on: true });
    expect(parseCommand('automaat uit')).toEqual({ intent: 'auto', on: false });
    expect(parseCommand('pauze')).toEqual({ intent: 'pause', paused: true });
    expect(parseCommand('hervat')).toEqual({ intent: 'pause', paused: false });
    expect(parseCommand('volg de zon').intent).toBe('followSun');
    expect(parseCommand('hoe warm is het').intent).toBe('askStatus');
  });

  it('herkent vragen, weer, bediening, camera en weergave', () => {
    const cases = [
      ['wat kan ik zeggen', { intent: 'help' }],
      ['zet de temperatuur op 22 graden', { intent: 'setpoint', deg: 22 }],
      ['stel de thermostaat in op 21,5 graden', { intent: 'setpoint', deg: 21.5 }],
      ['hoe vol is de batterij', { intent: 'askBattery' }],
      ['hoe vol is de regenput', { intent: 'askTank' }],
      ['hoe warm is het buiten', { intent: 'askOutside' }],
      ['hoe hard waait het', { intent: 'askWind' }],
      ['wat is de stroomprijs nu', { intent: 'askPrice' }],
      ['hoe vol zijn de auto\'s', { intent: 'askCars' }],
      ['maak het bewolkt', { intent: 'weather', mode: 'bewolkt' }],
      ['laat het regenen', { intent: 'weather', mode: 'regen' }],
      ['maak het zonnig', { intent: 'weather', mode: 'zon' }],
      ['echt weer', { intent: 'weather', mode: 'live' }],
      ['start de hittegolf', { intent: 'scenario', name: 'hittegolf' }],
      ['scenario stroomstoring', { intent: 'scenario', name: 'stroomstoring' }],
      ['naar echte tijd', { intent: 'now' }],
      ['toon de windmolens', { intent: 'camera', name: 'wind' }],
      ['ga naar het dak', { intent: 'camera', name: 'dak' }],
      ['reset de tellers', { intent: 'reset' }],
      ['verwarming uit', { intent: 'toggle', key: 'heaterOn', on: false }],
      ['zet de ventilatie aan', { intent: 'toggle', key: 'fanOn', on: true }],
      ['buitenverlichting uit', { intent: 'toggle', key: 'outdoorOn', on: false }],
      ['warmtepomp aan', { intent: 'toggle', key: 'heatPump', on: true }],
      ['warmte pomp aan', { intent: 'toggle', key: 'heatPump', on: true }],
      ['schakel de warmtepomp in', { intent: 'toggle', key: 'heatPump', on: true }],
      ['warmtepomp', { intent: 'toggle', key: 'heatPump', on: null }],
      ['extra batterij aan', { intent: 'toggle', key: 'extraBattery', on: true }],
      ['auto laden uit', { intent: 'toggle', key: 'evCharging', on: false }],
      ['rolluiken dicht', { intent: 'toggle', key: 'shuttersClosed', on: true }],
      ['rolluiken open', { intent: 'toggle', key: 'shuttersClosed', on: false }],
      ['ramen open', { intent: 'windows', open: true }],
      ['sluit de ramen', { intent: 'windows', open: false }],
      ['warmtecamera aan', { intent: 'layer', name: 'thermal', on: true }],
      ['labels uit', { intent: 'layer', name: 'labels', on: false }],
    ];
    for (const [phrase, expected] of cases) expect(parseCommand(phrase), phrase).toEqual(expected);
  });

  it('geeft null bij onbekende of ongeldige zinnen', () => {
    expect(parseCommand('')).toBeNull();
    expect(parseCommand('vertel een mop')).toBeNull();
    expect(parseCommand('zet de zon op 30 uur')).toBeNull();
  });
});

describe('runCommand', () => {
  it('zet de tijd', () => {
    const reply = runCommand({ intent: 'setTime', hour: 15 });
    expect(world.hour).toBe(15);
    expect(world.simTime % 24).toBeCloseTo(15);
    expect(reply).toContain('15:00');
  });

  it('stuurt de wind bij binnen de grenzen', () => {
    runCommand({ intent: 'wind', dir: 1 });
    expect(world.windBoost).toBeCloseTo(0.2);
    for (let i = 0; i < 10; i++) runCommand({ intent: 'wind', dir: 1 });
    expect(world.windBoost).toBeLessThanOrEqual(0.6);
    for (let i = 0; i < 20; i++) runCommand({ intent: 'wind', dir: -1 });
    expect(world.windBoost).toBeGreaterThanOrEqual(-0.5);
  });

  it('maakt de regenton leeg', () => {
    state.tankL = 120;
    const reply = runCommand({ intent: 'emptyTank' });
    expect(state.tankL).toBe(0);
    expect(reply).toContain('120');
  });

  it('wisselt snelheid, automaat en pauze', () => {
    runCommand({ intent: 'speed', fast: true });
    expect(world.hoursPerSec).toBe(1);
    runCommand({ intent: 'auto', on: true });
    expect(state.autoMode).toBe(true);
    runCommand({ intent: 'pause', paused: true });
    expect(world.paused).toBe(true);
  });

  it('bedient setpoint, weer, ramen en schakelaars', () => {
    runCommand({ intent: 'setpoint', deg: 23 });
    expect(state.targetTemp).toBe(23);
    runCommand({ intent: 'weather', mode: 'regen' });
    expect(world.weatherMode).toBe('regen');
    runCommand({ intent: 'windows', open: true });
    expect(state.windowsOpen).toEqual([true, true]);
    runCommand({ intent: 'toggle', key: 'heatPump', on: false });
    expect(state.heatPump).toBe(false);
  });

  it('geeft antwoorden op vragen', () => {
    state.battery = 2.5;
    expect(runCommand({ intent: 'askBattery' })).toContain('%');
    expect(runCommand({ intent: 'askTank' })).toContain('L');
    expect(runCommand({ intent: 'askPrice' })).toContain('€');
  });

  it('roept camera, scenario en weergave aan', () => {
    const seen = [];
    const actions = { flyTo: (n) => seen.push(['fly', n]), setScenario: (n) => seen.push(['sc', n]), setLayer: (n, o) => seen.push(['layer', n, o]) };
    runCommand({ intent: 'camera', name: 'dak' }, actions);
    runCommand({ intent: 'scenario', name: 'storm' }, actions);
    runCommand({ intent: 'layer', name: 'labels', on: true }, actions);
    expect(seen).toEqual([['fly', 'dak'], ['sc', 'storm'], ['layer', 'labels', true]]);
  });

  it('roept followSun aan', () => {
    let on = null;
    runCommand({ intent: 'followSun' }, { followSun: (v) => (on = v) });
    expect(on).toBe(true);
  });
});
