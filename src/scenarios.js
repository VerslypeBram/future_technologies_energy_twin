import { world, state, baseline, resetDay, costEuro, averageComfort } from './simulation.js';

export const SCENARIOS = {
  normaal: { label: 'Normaal', hour: 12, baseOutside: 5, weatherMode: 'auto', windBoost: 0, gridOnline: true },
  hittegolf: { label: 'Hittegolf', hour: 10, baseOutside: 32, weatherMode: 'zon', windBoost: 0, gridOnline: true, goal: 'saving', hours: 24, goalText: 'Bespaar 40% op kosten met gelijk comfort' },
  storm: { label: 'Storm', hour: 6, baseOutside: 7, weatherMode: 'regen', windBoost: 0.5, gridOnline: true, goal: 'saving', hours: 24, goalText: 'Bespaar 40% op kosten met gelijk comfort' },
  winter: { label: 'Strenge winter', hour: 6, baseOutside: -8, weatherMode: 'bewolkt', windBoost: 0, gridOnline: true, goal: 'saving', hours: 24, goalText: 'Bespaar 40% op kosten met gelijk comfort' },
  stroomstoring: { label: 'Stroomstoring', hour: 16, baseOutside: 2, weatherMode: 'bewolkt', windBoost: 0, gridOnline: false, goal: 'warm', hours: 12, goalText: 'Houd het 12 uur boven 16 °C zonder net' },
};

let done = false;
let failed = false;

export function applyScenario(name) {
  const s = SCENARIOS[name];
  if (!s) return;
  world.hour = s.hour;
  world.simTime = Math.floor(world.simTime / 24) * 24 + s.hour;
  world.baseOutside = s.baseOutside;
  world.weatherMode = s.weatherMode;
  world.windBoost = s.windBoost;
  world.gridOnline = s.gridOnline;
  world.scenario = name === 'normaal' ? null : name;
  world.scenarioHours = 0;
  state.insideTemp = baseline.insideTemp = name === 'hittegolf' ? 24 : 20;
  state.autoMode = name !== 'normaal';
  resetDay();
  done = false;
  failed = false;
}

function savingPct() {
  const b = costEuro(baseline);
  return b > 0.05 ? ((b - costEuro(state)) / b) * 100 : 0;
}

export function goalText() {
  const s = SCENARIOS[world.scenario];
  if (!s || !s.goal) return '';
  if (done) return 'Doel bereikt: ' + s.goalText;
  if (failed) return 'Doel niet gehaald: ' + s.goalText;
  const left = Math.max(0, s.hours - world.scenarioHours).toFixed(0);
  const now = s.goal === 'saving' ? `nu ${savingPct().toFixed(0)}%` : `nu ${state.insideTemp.toFixed(1)} °C`;
  return `Doel: ${s.goalText} (${now}, nog ${left} u)`;
}

// Controleert het doel zodra de tijd om is; meldt het resultaat één keer.
export function updateScenario(toast) {
  const s = SCENARIOS[world.scenario];
  if (!s || !s.goal || done || failed || world.scenarioHours < s.hours) return;

  const ok =
    s.goal === 'saving'
      ? savingPct() >= 40 && averageComfort(state) >= averageComfort(baseline) - 10
      : state.insideTemp >= 16;
  if (ok) {
    done = true;
    toast('Doel bereikt: ' + s.goalText, 'ok');
  } else {
    failed = true;
    toast('Doel niet gehaald: ' + s.goalText, 'warn');
  }
}
