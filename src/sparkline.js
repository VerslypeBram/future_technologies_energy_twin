// Kleine lijngrafiek op een canvas (voor sensor-pins).
export function drawSparkline(canvas, values, { color = '#5fd38d', min, max } = {}) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  if (values.length < 2) return;

  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const range = hi - lo || 1;

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height - 0.5);
  ctx.lineTo(width, height - 0.5);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((value, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - 4 - ((value - lo) / range) * (height - 8);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}
