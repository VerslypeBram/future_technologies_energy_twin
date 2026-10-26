import { state, world, netKwh, priceAt } from './simulation.js';
import { COLORS, MONO, SANS } from './theme.js';

const W = 316;
const H = 250;
const WINDOW_HOURS = 24;
const STEP_HOURS = 0.25;

// Twee vlakken met assen: temperaturen, en netafname met stroomprijs. X-as = gesimuleerde tijd (24 u).
export function createChart() {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Verloop van temperatuur, netafname en stroomprijs over de laatste 24 uur');
  (document.getElementById('chartHost') ?? document.body).appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const data = []; // { t, inside, outside, kwh, price }
  let lastT = -Infinity;
  let lastDraw = 0;

  function plot(box, { yMin, yMax, ticks, fmt, series, step, rightScale, title, legend }) {
    const { x, y, w, h } = box;
    const t1 = world.simTime;
    const t0 = t1 - WINDOW_HOURS;
    const px = (t) => x + ((t - t0) / WINDOW_HOURS) * w;
    const py = (v, lo = yMin, hi = yMax) => y + h - ((v - lo) / (hi - lo)) * h;

    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = COLORS.muted;
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ticks.forEach((v) => {
      const yy = Math.round(py(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + w, yy);
      ctx.stroke();
      ctx.fillText(fmt(v), x - 5, yy);
    });
    if (rightScale) {
      ctx.textAlign = 'left';
      rightScale.ticks.forEach((v) => ctx.fillText(rightScale.fmt(v), x + w + 5, py(v, rightScale.min, rightScale.max)));
    }

    // Tijdstippen elke 6 uur
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const first = Math.ceil(t0 / 6) * 6;
    for (let t = first; t <= t1; t += 6) {
      const xx = Math.round(px(t)) + 0.5;
      ctx.strokeStyle = COLORS.line;
      ctx.beginPath();
      ctx.moveTo(xx, y);
      ctx.lineTo(xx, y + h);
      ctx.stroke();
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(String(Math.floor(t % 24)).padStart(2, '0') + ':00', xx, y + h + 3);
    }

    ctx.strokeStyle = COLORS.muted;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    series.forEach((s) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      let prev = null;
      data.forEach((p) => {
        if (p.t < t0) return;
        const xx = px(p.t);
        const yy = py(p[s.key], s.min ?? yMin, s.max ?? yMax);
        if (!started) {
          ctx.moveTo(xx, yy);
          started = true;
        } else if (s.step && prev !== null) {
          ctx.lineTo(xx, prev);
          ctx.lineTo(xx, yy);
        } else {
          ctx.lineTo(xx, yy);
        }
        prev = yy;
      });
      ctx.stroke();
    });
    ctx.restore();

    // Titel en legenda
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `600 10px ${SANS}`;
    ctx.fillStyle = COLORS.text;
    ctx.fillText(title, x, y - 6);
    let lx = x + w;
    ctx.font = `10px ${SANS}`;
    ctx.textAlign = 'right';
    [...legend].reverse().forEach((l) => {
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(l.text, lx, y - 6);
      lx -= ctx.measureText(l.text).width + 4;
      ctx.fillStyle = l.color;
      ctx.fillRect(lx - 8, y - 14, 8, 3);
      lx -= 16;
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const maxKwh = Math.max(1, Math.ceil(Math.max(...data.map((p) => p.kwh), 0)));
    plot(
      { x: 36, y: 26, w: 240, h: 78 },
      {
        title: 'Temperatuur',
        yMin: -10,
        yMax: 35,
        ticks: [-10, 5, 20, 35],
        fmt: (v) => v + '°',
        series: [
          { key: 'outside', color: COLORS.outside },
          { key: 'inside', color: COLORS.inside },
        ],
        legend: [
          { text: 'Binnen', color: COLORS.inside },
          { text: 'Buiten', color: COLORS.outside },
        ],
      }
    );
    plot(
      { x: 36, y: 148, w: 240, h: 78 },
      {
        title: 'Netafname en prijs',
        yMin: 0,
        yMax: maxKwh,
        ticks: [0, maxKwh / 2, maxKwh],
        fmt: (v) => (v % 1 ? v.toFixed(1) : v) + '',
        series: [
          { key: 'kwh', color: COLORS.grid },
          { key: 'price', color: COLORS.price, min: 0, max: 0.6, step: true },
        ],
        rightScale: { min: 0, max: 0.5, ticks: [0, 0.25, 0.5], fmt: (v) => v.toFixed(2) },
        legend: [
          { text: 'kWh', color: COLORS.grid },
          { text: '€/kWh', color: COLORS.price },
        ],
      }
    );
  }

  return {
    update() {
      // Na terugspoelen: punten uit de toekomst verwijderen
      while (data.length && data[data.length - 1].t > world.simTime) data.pop();
      if (data.length) lastT = data[data.length - 1].t;
      else lastT = -Infinity;

      if (!world.paused && world.simTime - lastT >= STEP_HOURS) {
        data.push({ t: world.simTime, inside: state.insideTemp, outside: world.outsideTemp, kwh: netKwh(), price: priceAt() });
        while (data.length > (WINDOW_HOURS / STEP_HOURS) * 3) data.shift();
      }
      const now = performance.now();
      if (now - lastDraw > 250) {
        lastDraw = now;
        draw();
      }
    },
  };
}
