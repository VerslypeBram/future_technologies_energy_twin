import { defineConfig } from 'vite';

// Energy-Charts staat geen CORS toe voor andere origins; proxy via dezelfde origin
const energyCharts = { '/api/ec': { target: 'https://api.energy-charts.info', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/ec/, '') } };

export default defineConfig({
  server: { proxy: energyCharts },
  preview: { proxy: energyCharts },
});
