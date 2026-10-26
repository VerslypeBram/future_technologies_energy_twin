import * as THREE from 'three';

// Procedurele texturen op canvas (geen externe bestanden). Elke functie geeft { map, bump }.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  return c;
}

function toTexture(canvas, { srgb = true, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const shade = (r, g, b, k) => `rgb(${Math.max(0, Math.min(255, r * k)) | 0},${Math.max(0, Math.min(255, g * k)) | 0},${Math.max(0, Math.min(255, b * k)) | 0})`;

// Fijne ruis over een vlak (korrel)
function speckle(ctx, size, rand, count, minA, maxA, dark = true) {
  for (let i = 0; i < count; i++) {
    const v = dark ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${minA + rand() * (maxA - minA)})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
  }
}

// Gepleisterde gevel
export function plaster(base = [212, 198, 172]) {
  const rand = rng(11);
  const map = makeCanvas(512, (ctx, s) => {
    ctx.fillStyle = shade(...base, 1);
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) {
      const k = 0.94 + rand() * 0.1;
      ctx.fillStyle = shade(...base, k) + '';
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(rand() * s, rand() * s, 20 + rand() * 60, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    speckle(ctx, s, rand, 5000, 0.03, 0.12);
    speckle(ctx, s, rand, 2500, 0.03, 0.1, false);
  });
  const bump = makeCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rng(12), 6000, 0.2, 0.7);
    speckle(ctx, s, rng(13), 4000, 0.2, 0.7, false);
  });
  return { map: toTexture(map, { repeat: [3, 2] }), bump: toTexture(bump, { srgb: false, repeat: [3, 2] }) };
}

// Baksteen in halfsteens verband
export function brick(base = [150, 74, 56], repeat = [2, 1]) {
  const rand = rng(21);
  const draw = (gray) => (ctx, s) => {
    ctx.fillStyle = gray ? '#202020' : '#b8b0a4';
    ctx.fillRect(0, 0, s, s);
    const bw = 64;
    const bh = 28;
    const mortar = 4;
    for (let row = 0; row * bh < s; row++) {
      const offset = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < s + bw; x += bw) {
        const k = 0.82 + rand() * 0.3;
        const v = (150 + rand() * 80) | 0;
        ctx.fillStyle = gray ? `rgb(${v},${v},${v})` : shade(...base, k);
        ctx.fillRect(x + offset + mortar / 2, row * bh + mortar / 2, bw - mortar, bh - mortar);
      }
    }
    if (!gray) speckle(ctx, s, rand, 3000, 0.05, 0.18);
  };
  return {
    map: toTexture(makeCanvas(512, draw(false)), { repeat }),
    bump: toTexture(makeCanvas(512, draw(true)), { srgb: false, repeat }),
  };
}

// Dakpannen: overlappende rijen met kleurvariatie
export function roofTiles(base = [120, 52, 40]) {
  const rand = rng(31);
  const draw = (gray) => (ctx, s) => {
    ctx.fillStyle = gray ? '#303030' : '#241a17';
    ctx.fillRect(0, 0, s, s);
    const rows = 14;
    const cols = 12;
    const rh = s / rows;
    const cw = s / cols;
    for (let r = 0; r < rows; r++) {
      for (let c = -1; c <= cols; c++) {
        const x = c * cw + (r % 2 ? cw / 2 : 0);
        const k = 0.8 + rand() * 0.4;
        if (gray) {
          const v = (150 + rand() * 90) | 0;
          ctx.fillStyle = `rgb(${v},${v},${v})`;
        } else ctx.fillStyle = shade(...base, k);
        ctx.fillRect(x + 1, r * rh, cw - 2, rh - 1);
        // schaduwrand onderaan elke pan
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x + 1, r * rh + rh - 4, cw - 2, 3);
      }
    }
    if (!gray) speckle(ctx, s, rand, 3500, 0.04, 0.14);
  };
  return {
    map: toTexture(makeCanvas(512, draw(false)), { repeat: [3, 2] }),
    bump: toTexture(makeCanvas(512, draw(true)), { srgb: false, repeat: [3, 2] }),
  };
}

// Gras met kleurvariatie en grassprieten
export function grass(repeat = [10, 10]) {
  const rand = rng(41);
  const map = makeCanvas(512, (ctx, s) => {
    ctx.fillStyle = '#4b7a36';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(${(60 + rand() * 40) | 0},${(105 + rand() * 40) | 0},${(40 + rand() * 25) | 0},0.25)`;
      ctx.beginPath();
      ctx.arc(rand() * s, rand() * s, 25 + rand() * 70, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 9000; i++) {
      const g = (80 + rand() * 90) | 0;
      ctx.strokeStyle = `rgba(${(g * 0.55) | 0},${g},${(g * 0.3) | 0},${0.25 + rand() * 0.35})`;
      ctx.lineWidth = 1;
      const x = rand() * s;
      const y = rand() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 4, y - 3 - rand() * 6);
      ctx.stroke();
    }
  });
  const bump = makeCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rng(42), 9000, 0.2, 0.8);
    speckle(ctx, s, rng(43), 9000, 0.2, 0.8, false);
  });
  return { map: toTexture(map, { repeat }), bump: toTexture(bump, { srgb: false, repeat }) };
}

// Klinkers (oprit en pad), halfsteens verband
export function pavers(repeat = [3, 6]) {
  const rand = rng(51);
  const draw = (gray) => (ctx, s) => {
    ctx.fillStyle = gray ? '#202020' : '#8a857d';
    ctx.fillRect(0, 0, s, s);
    const bw = 64;
    const bh = 32;
    for (let row = 0; row * bh < s; row++) {
      const offset = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < s + bw; x += bw) {
        if (gray) {
          const v = (150 + rand() * 80) | 0;
          ctx.fillStyle = `rgb(${v},${v},${v})`;
        } else {
          const k = 0.8 + rand() * 0.3;
          ctx.fillStyle = shade(158, 118, 100, k);
        }
        ctx.fillRect(x + offset + 1.5, row * bh + 1.5, bw - 3, bh - 3);
      }
    }
    if (!gray) speckle(ctx, s, rand, 3000, 0.05, 0.16);
  };
  return {
    map: toTexture(makeCanvas(512, draw(false)), { repeat }),
    bump: toTexture(makeCanvas(512, draw(true)), { srgb: false, repeat }),
  };
}

// Houten planken (deur, schutting)
export function wood(base = [120, 82, 52], repeat = [1, 1], planks = 6) {
  const rand = rng(61);
  const map = makeCanvas(256, (ctx, s) => {
    const pw = s / planks;
    for (let i = 0; i < planks; i++) {
      const k = 0.85 + rand() * 0.3;
      ctx.fillStyle = shade(...base, k);
      ctx.fillRect(i * pw, 0, pw, s);
      for (let j = 0; j < 40; j++) {
        ctx.strokeStyle = `rgba(0,0,0,${0.04 + rand() * 0.1})`;
        ctx.lineWidth = 1;
        const x = i * pw + rand() * pw;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (rand() - 0.5) * 3, s);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(i * pw, 0, 1.5, s);
    }
  });
  return { map: toTexture(map, { repeat }) };
}

// Bladeren (haag, struiken): donkergroen met lichte spikkels
export function leaves(repeat = [4, 1]) {
  const rand = rng(81);
  const map = makeCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#2f5a2b';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const g = (70 + rand() * 90) | 0;
      ctx.fillStyle = `rgba(${(g * 0.5) | 0},${g},${(g * 0.3) | 0},${0.3 + rand() * 0.4})`;
      ctx.beginPath();
      ctx.arc(rand() * s, rand() * s, 2 + rand() * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  return { map: toTexture(map, { repeat }) };
}

// Asfalt met korrel
export function asphalt(repeat = [40, 1]) {
  const rand = rng(91);
  const map = makeCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#44474a';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, 6000, 0.08, 0.3);
    speckle(ctx, s, rand, 3000, 0.06, 0.2, false);
  });
  return { map: toTexture(map, { repeat }) };
}

// Zonnepaneel met cellen
export function solarCells() {
  const map = makeCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#0f1f3d';
    ctx.fillRect(0, 0, s, s);
    const cols = 6;
    const rows = 10;
    const cw = s / cols;
    const rh = s / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = '#183262';
        ctx.fillRect(c * cw + 2, r * rh + 2, cw - 4, rh - 4);
        ctx.strokeStyle = 'rgba(160,180,220,0.25)';
        ctx.lineWidth = 1;
        for (let k = 1; k < 3; k++) {
          const x = c * cw + (cw / 3) * k;
          ctx.beginPath();
          ctx.moveTo(x, r * rh + 2);
          ctx.lineTo(x, r * rh + rh - 2);
          ctx.stroke();
        }
      }
    }
  });
  return { map: toTexture(map) };
}

// Zachte wolk (witte vlek met ruis aan de randen)
export function cloudPuff() {
  const rand = rng(71);
  const c = makeCanvas(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    for (let i = 0; i < 28; i++) {
      const x = s / 2 + (rand() - 0.5) * s * 0.55;
      const y = s / 2 + (rand() - 0.5) * s * 0.3;
      const r = 30 + rand() * 50;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
  });
  return toTexture(c);
}
