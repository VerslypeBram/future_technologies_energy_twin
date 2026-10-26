import { world, snapshot, restore } from './simulation.js';

const STEP_HOURS = 0.25;
const MAX_ENTRIES = 288; // 3 gesimuleerde dagen

// Tijdlijn: elke kwartier gesimuleerde tijd een momentopname; terugspoelen zet alles terug.
export function createHistory() {
  const entries = [];
  let lastT = -Infinity;
  let scrubIndex = null; // null = live

  return {
    get length() {
      return entries.length;
    },
    get scrubbing() {
      return scrubIndex !== null;
    },
    get index() {
      return scrubIndex ?? entries.length - 1;
    },
    entry(i) {
      return entries[i];
    },
    update() {
      if (scrubIndex !== null || world.paused) return;
      // klok teruggezet (bijv. 'Naar echte tijd'): momentopnames uit de toekomst vervallen
      while (entries.length && entries[entries.length - 1].t > world.simTime) entries.pop();
      if (entries.length) lastT = entries[entries.length - 1].t;
      else lastT = -Infinity;
      if (world.simTime - lastT >= STEP_HOURS) {
        entries.push({ t: world.simTime, snap: snapshot() });
        lastT = world.simTime;
        if (entries.length > MAX_ENTRIES) entries.shift();
      }
    },
    scrub(i) {
      const entry = entries[Math.max(0, Math.min(entries.length - 1, i))];
      if (!entry) return;
      scrubIndex = entries.indexOf(entry);
      world.paused = true;
      restore(entry.snap);
    },
    // Hervat vanaf het gekozen moment (de toekomst vanaf dat punt vervalt)
    resume() {
      if (scrubIndex !== null) {
        entries.length = scrubIndex + 1;
        lastT = entries[entries.length - 1].t;
        scrubIndex = null;
      }
      world.paused = false;
    },
  };
}
