// Nepdata voor Open-Meteo en Energy-Charts, zodat de tests offline en deterministisch zijn.
const HOUR = 3600e3;

export function fakeWeatherJson(startMs, n = 96) {
  const iso = (ms) => new Date(ms).toISOString().slice(0, 16);
  const t = Array.from({ length: n }, (_, i) => startMs + i * HOUR);
  return {
    hourly: {
      time: t.map(iso),
      temperature_2m: t.map((_, i) => i), // 0, 1, 2, ... (lineair, handig voor interpolatie)
      cloud_cover: t.map(() => 50),
      shortwave_radiation: t.map((_, i) => i * 10),
      wind_speed_10m: t.map(() => 6),
      precipitation: t.map(() => 0),
    },
  };
}

// Prijs stijgt lineair met de tijd: €/MWh = uren sinds start (zo zijn percentielen voorspelbaar)
export function fakePriceJson(startMs, n = 96 * 4) {
  const sec = Array.from({ length: n }, (_, i) => Math.floor(startMs / 1000) + i * 900);
  return { unix_seconds: sec, price: sec.map((_, i) => i / 4) };
}

export function stubFetch(startMs) {
  globalThis.fetch = async (url) => {
    const body = String(url).includes('open-meteo') ? fakeWeatherJson(startMs) : fakePriceJson(startMs);
    return { ok: true, status: 200, json: async () => body };
  };
}
