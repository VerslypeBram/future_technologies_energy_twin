import { defineConfig } from 'vite';

// Energy-Charts staat geen CORS toe voor andere origins; proxy via dezelfde origin
const energyCharts = { '/api/ec': { target: 'https://api.energy-charts.info', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/ec/, '') } };

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 2000, // three (~650 kB) en de lazy geladen Mapbox-kaart (~1,9 MB) zijn bewust groot
    rolldownOptions: {
      // three.js apart houden: de app-code verandert vaker, three.js blijft in de browsercache
      output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules[\/]three[\/]/ }] } },
    },
  },
  server: { proxy: energyCharts },
  preview: { proxy: energyCharts },
});
