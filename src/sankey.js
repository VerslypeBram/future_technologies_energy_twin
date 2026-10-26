import { state } from './simulation.js';
import { COLORS, MONO } from './theme.js';
import { fmt } from './ui.js';

const W = 316;
const H = 176;
const KEY_COLORS = { zon: COLORS.solar, wind: COLORS.wind, batterij: COLORS.battery, net: COLORS.grid, huis: COLORS.home, auto: COLORS.ev, laden: COLORS.battery };

// Live energiebalans: bronnen links, afnemers rechts, banden met breedte evenredig aan kW.
export function createSankey() {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Energiestromen van bronnen naar afnemers');
  (document.getElementById('sankeyHost') ?? document.body).appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  let last = 0;

  function draw() {
    const f = state.flows;
    const sources = [
      { key: 'zon', label: 'Zon', kw: f.solar },
      { key: 'wind', label: 'Wind', kw: f.wind },
      { key: 'batterij', label: 'Batterij', kw: Math.max(0, -f.batteryKw) },
      { key: 'net', label: 'Net', kw: f.grid },
    ].filter((s) => s.kw > 0.02);
    const sinks = [
      { key: 'huis', label: 'Huis', kw: f.home },
      { key: 'auto', label: "Auto's", kw: f.ev },
      { key: 'laden', label: 'Laden', kw: Math.max(0, f.batteryKw) },
    ].filter((s) => s.kw > 0.02);

    ctx.clearRect(0, 0, W, H);
    ctx.font = `11px ${MONO}`;
    ctx.textBaseline = 'middle';

    const total = Math.max(sources.reduce((a, s) => a + s.kw, 0), sinks.reduce((a, s) => a + s.kw, 0));
    if (total < 0.05) {
      ctx.fillStyle = COLORS.muted;
      ctx.textAlign = 'center';
      ctx.fillText('Geen energiestroom', W / 2, H / 2);
      ctx.textAlign = 'left';
      return;
    }

    const top = 10;
    const bottom = H - 10;
    const gap = 6;
    const nodeW = 8;
    const leftX = 96;
    const rightX = W - 80 - nodeW;

    function layout(list) {
      const sum = list.reduce((a, s) => a + s.kw, 0);
      const avail = bottom - top - gap * (list.length - 1);
      let y = top + (avail - (sum / total) * avail) / 2;
      list.forEach((s) => {
        s.h = Math.max(3, (s.kw / total) * avail);
        s.y = y;
        s.cursor = y;
        y += s.h + gap;
      });
    }
    layout(sources);
    layout(sinks);

    const sinkTotal = sinks.reduce((a, s) => a + s.kw, 0) || 1;
    const sourceTotal = sources.reduce((a, s) => a + s.kw, 0) || 1;
    sources.forEach((src) => {
      sinks.forEach((snk) => {
        const h = src.h * (snk.kw / sinkTotal);
        const hs = snk.h * (src.kw / sourceTotal);
        const y0 = src.cursor;
        const y1 = snk.cursor;
        src.cursor += h;
        snk.cursor += hs;
        ctx.fillStyle = KEY_COLORS[src.key] + '59';
        ctx.beginPath();
        const x0 = leftX + nodeW;
        const mid = (x0 + rightX) / 2;
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(mid, y0, mid, y1, rightX, y1);
        ctx.lineTo(rightX, y1 + hs);
        ctx.bezierCurveTo(mid, y1 + hs, mid, y0 + h, x0, y0 + h);
        ctx.closePath();
        ctx.fill();
      });
    });

    sources.forEach((s) => {
      ctx.fillStyle = KEY_COLORS[s.key];
      ctx.fillRect(leftX, s.y, nodeW, s.h);
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = 'right';
      ctx.fillText(`${s.label} ${fmt(s.kw, 1)}`, leftX - 6, s.y + s.h / 2);
    });
    sinks.forEach((s) => {
      ctx.fillStyle = KEY_COLORS[s.key];
      ctx.fillRect(rightX, s.y, nodeW, s.h);
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = 'left';
      ctx.fillText(`${s.label} ${fmt(s.kw, 1)}`, rightX + nodeW + 6, s.y + s.h / 2);
    });
    ctx.textAlign = 'left';
  }

  return {
    update() {
      const now = performance.now();
      if (now - last < 250) return;
      last = now;
      draw();
    },
  };
}
