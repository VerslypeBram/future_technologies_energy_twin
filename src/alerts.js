import { state, world, priceIsPeak, batteryPercent, isHome } from './simulation.js';

const COOLDOWN_HOURS = 2; // gesimuleerde uren tussen herhalingen

const RULES = [
  {
    id: 'windowHeat',
    level: 'warn',
    test: () => state.windowsOpen.some(Boolean) && state.heaterActive && world.outsideTemp < state.insideTemp - 5,
    text: 'Raam open terwijl de verwarming in bedrijf is.',
  },
  {
    id: 'batteryLow',
    level: 'warn',
    test: () => batteryPercent() < 10 && priceIsPeak(),
    text: 'Batterij SoC onder 10 % tijdens piekprijs.',
  },
  {
    id: 'co2',
    level: 'warn',
    test: () => state.co2ppm > 1200,
    text: 'CO₂ binnen boven 1200 ppm.',
  },
  {
    id: 'hot',
    level: 'warn',
    test: () => state.insideTemp > 26,
    text: 'Binnentemperatuur boven 26 °C.',
  },
  {
    id: 'carLow',
    level: 'warn',
    test: () => world.hour >= 5 && world.hour < 8.5 && state.cars.some((c) => !c.away && c.soc < 6),
    text: 'Auto SoC onder 20 % kort voor vertrek.',
  },
  {
    id: 'surplus',
    level: 'info',
    test: () => {
      const f = state.flows;
      return f.solar + f.wind - f.home - f.ev > 2 && batteryPercent() > 98 && isHome() && state.cars.some((c) => !c.away && !c.charging && c.soc < 29);
    },
    text: 'Overschot aan eigen opwek, batterij vol: auto laden mogelijk.',
  },
  {
    id: 'outage',
    level: 'crit',
    cooldown: 24,
    test: () => !world.gridOnline,
    text: 'Netstoring: woning draait op opwek en batterij.',
  },
];

// Meldingen als toasts; elke regel heeft een cooldown in gesimuleerde uren.
export function createAlerts(toast) {
  const last = new Map();
  let lastCheck = 0;

  return {
    update() {
      const now = performance.now();
      if (now - lastCheck < 500 || world.paused) return;
      lastCheck = now;
      RULES.forEach((rule) => {
        const prev = last.get(rule.id);
        if (prev !== undefined && world.simTime - prev < (rule.cooldown ?? COOLDOWN_HOURS)) return;
        if (rule.test()) {
          last.set(rule.id, world.simTime);
          toast(rule.text, rule.level);
        }
      });
    },
    reset() {
      last.clear();
    },
  };
}
