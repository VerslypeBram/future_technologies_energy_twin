import { describe, it, expect } from 'vitest';
import { stubFetch } from './helpers.js';

const HOUR = 3600e3;
const startMs = Date.UTC(2026, 9, 24, 0, 0);
stubFetch(startMs);

const rd = await import('../src/realdata.js');

describe('Open-Meteo', () => {
  it('interpoleert lineair tussen uurwaarden', async () => {
    await rd.setLocation(50.85, 4.35, 'test');
    expect(rd.real.ready).toBe(true);
    const half = rd.sampleWeather(startMs + 5.5 * HOUR);
    expect(half.temp).toBeCloseTo(5.5, 6);
    expect(half.rad).toBeCloseTo(55, 6);
    expect(half.cloud).toBeCloseTo(0.5, 6);
  });

  it('klemt op de randen van de data', () => {
    expect(rd.sampleWeather(startMs - 100 * HOUR).temp).toBe(0);
  });

  it('meldt een fout netjes en valt terug', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 500 });
    await rd.setLocation(10, 10, 'ver weg');
    expect(rd.real.ready).toBe(false);
    expect(rd.real.status).toMatch(/Offline/);
  });
});

describe('zonnestand', () => {
  it('staat in de winter laag in het zuiden en komt op in het oosten', () => {
    rd.real.location = { lat: 50.85, lon: 4.35, label: 'Brussel' }; // eerdere test zette een andere plek
    const noon = rd.sunAt(new Date('2026-12-21T11:00:00Z'));
    expect(noon.altitude).toBeGreaterThan(0);
    expect(noon.altitude).toBeLessThan(0.35); // < 20° (radialen)
    expect(noon.z).toBeGreaterThan(0); // zuid = +z (huis kijkt naar het zuiden)
    const morning = rd.sunAt(new Date('2026-06-21T05:00:00Z'));
    expect(morning.x).toBeGreaterThan(0); // oost = +x
    const evening = rd.sunAt(new Date('2026-06-21T17:00:00Z'));
    expect(evening.x).toBeLessThan(0); // west = -x
    const night = rd.sunAt(new Date('2026-12-21T23:00:00Z'));
    expect(night.y).toBeLessThan(0); // onder de horizon
  });
});
