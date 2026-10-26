// Echte data: zonnestand (SunCalc) en weer (Open-Meteo, https://open-meteo.com, CC BY 4.0).
import * as SunCalc from 'suncalc';

const FALLBACK = { lat: 50.85, lon: 4.35, label: 'Brussel (standaard)' };
const CACHE_KEY = 'energy-twin:open-meteo-v2';
const CACHE_MAX_AGE_MS = 60 * 60 * 1000;

export const real = {
  pricesReady: false,
  priceStatus: 'Laden…',
  location: { ...FALLBACK },
  ready: false, // weerdata geladen
  status: 'Laden…',
  updated: null, // Date van laatste succesvolle fetch
};

let hours = null;
let prices = null; // { t: [ms], p: [€/kWh incl. schatting nettarief en taksen] } // { t: [ms], temp, cloud, rad, wind, precip }

function getLocation() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve({ ...FALLBACK });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, label: 'Jouw locatie' }),
      () => resolve({ ...FALLBACK }),
      { timeout: 5000, maximumAge: 3600e3 },
    );
  });
}

function parse(json) {
  const h = json.hourly;
  return {
    t: h.time.map((s) => Date.parse(s + 'Z')), // timezone=GMT: tijden zijn UTC
    temp: h.temperature_2m,
    cloud: h.cloud_cover,
    rad: h.shortwave_radiation,
    wind: h.wind_speed_10m,
    precip: h.precipitation,
  };
}

function readCache(loc) {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (c && Math.abs(c.lat - loc.lat) < 0.1 && Math.abs(c.lon - loc.lon) < 0.1 && Date.now() - c.at < CACHE_MAX_AGE_MS) return c;
  } catch {
    /* geen cache */
  }
  return null;
}

async function loadWeather(loc) {
  const cached = readCache(loc);
  if (cached) return { json: cached.json, at: cached.at };
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat.toFixed(3)}&longitude=${loc.lon.toFixed(3)}` +
    '&hourly=temperature_2m,cloud_cover,shortwave_radiation,wind_speed_10m,precipitation' +
    '&wind_speed_unit=ms&past_days=1&forecast_days=3&timezone=GMT';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();
  const at = Date.now();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ lat: loc.lat, lon: loc.lon, at, json }));
  } catch {
    /* opslag vol of geblokkeerd */
  }
  return { json, at };
}

const listeners = new Set();
export const onLocationChange = (fn) => listeners.add(fn);

// Zet de locatie en laadt het weer daar. Bij een fout blijft de simulatie op mock-weer draaien.
export async function setLocation(lat, lon, label = 'Gekozen locatie') {
  real.location = { lat, lon, label };
  real.status = 'Laden…';
  try {
    const { json, at } = await loadWeather(real.location);
    hours = parse(json);
    real.updated = new Date(at);
    real.ready = true;
    real.status = 'Live';
  } catch (e) {
    console.warn('Open-Meteo niet beschikbaar, mock-weer gebruikt', e);
    real.ready = false;
    real.status = 'Offline (mock-weer)';
  }
  listeners.forEach((fn) => fn(real.location));
  return real;
}

export async function initRealData() {
  loadPrices();
  const loc = await getLocation();
  return setLocation(loc.lat, loc.lon, loc.label);
}


// Dag-vooruitprijs België (Energy-Charts, CC BY 4.0, bron: Bundesnetzagentur | SMARD.de), per kwartier, in €/MWh.
// Omgerekend naar een schatting van de eindprijs: spot + vast deel voor nettarief en taksen, plus btw.
const PRICE_CACHE_KEY = 'energy-twin:prices-v1';
const RETAIL_FIXED = 0.12; // €/kWh, schatting
const VAT = 1.06;
const toRetail = (mwh) => Math.max(0, (mwh / 1000 + RETAIL_FIXED) * VAT);

export async function loadPrices() {
  try {
    let json;
    try {
      const c = JSON.parse(localStorage.getItem(PRICE_CACHE_KEY));
      if (c && Date.now() - c.at < 30 * 60 * 1000) json = c.json;
    } catch {
      /* geen cache */
    }
    if (!json) {
      const day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
      const res = await fetch(`/api/ec/price?bzn=BE&start=${day(-2)}&end=${day(2)}`);
      if (!res.ok) throw new Error(`Energy-Charts ${res.status}`);
      json = await res.json();
      try {
        localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify({ at: Date.now(), json }));
      } catch {
        /* opslag vol of geblokkeerd */
      }
    }
    const t = [];
    const p = [];
    json.unix_seconds.forEach((sec, i) => {
      if (json.price[i] != null) {
        t.push(sec * 1000);
        p.push(toRetail(json.price[i]));
      }
    });
    if (!t.length) throw new Error('geen prijzen');
    prices = { t, p, sorted: [...p].sort((a, b) => a - b) };
    real.pricesReady = true;
    real.priceStatus = 'Live (Energy-Charts)';
  } catch (e) {
    console.warn('Stroomprijzen niet beschikbaar, vaste tabel gebruikt', e);
    real.pricesReady = false;
    real.priceStatus = 'Vaste tabel';
  }
}

// Prijs op een tijdstip (kwartierwaarde); null als er geen data voor dat moment is
export function samplePrice(ms) {
  if (!prices) return null;
  const { t, p } = prices;
  if (ms < t[0] || ms > t[t.length - 1] + 900e3) return null;
  let lo = 0;
  let hi = t.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (t[mid] <= ms) lo = mid;
    else hi = mid - 1;
  }
  return p[lo];
}

// Prijsgrens op een percentiel van alle geladen prijzen (bijv. 0.25 = goedkoopste kwart)
export function priceQuantile(q) {
  return prices ? prices.sorted[Math.min(prices.sorted.length - 1, Math.floor(q * prices.sorted.length))] : null;
}

// Lineair geïnterpoleerde weerwaarden op een tijdstip (ms)
export function sampleWeather(ms) {
  if (!hours) return null;
  const { t } = hours;
  let i = Math.floor((ms - t[0]) / 3600e3);
  i = Math.max(0, Math.min(t.length - 2, i));
  const k = Math.max(0, Math.min(1, (ms - t[i]) / 3600e3));
  const mix = (a) => a[i] + (a[i + 1] - a[i]) * k;
  return { temp: mix(hours.temp), cloud: mix(hours.cloud) / 100, rad: mix(hours.rad), wind: mix(hours.wind), precip: mix(hours.precip) };
}

// Zonnestand als richting in de scène: huis kijkt naar het zuiden (+z), oost is +x.
// SunCalc 2.x geeft graden: azimut vanaf het noorden (kloksgewijs), hoogte boven de horizon.
export function sunAt(date) {
  return toScene(SunCalc.getPosition(date, real.location.lat, real.location.lon));
}

// Maanstand (zelfde conventie) plus belichte fractie (0 nieuwe maan, 1 volle maan)
export function moonAt(date) {
  const pos = toScene(SunCalc.getMoonPosition(date, real.location.lat, real.location.lon));
  const { fraction, phase } = SunCalc.getMoonIllumination(date);
  return { ...pos, fraction, phase };
}

function toScene(pos) {
  const az = (pos.azimuth * Math.PI) / 180;
  const altitude = (pos.altitude * Math.PI) / 180;
  const c = Math.cos(altitude);
  return { x: Math.sin(az) * c, y: Math.sin(altitude), z: -Math.cos(az) * c, altitude };
}
