import { real, setLocation } from './realdata.js';
import { hasMapbox } from './satellite.js';

// Minikaart (Mapbox GL, pas geladen als het paneel open gaat): klik om een andere locatie te kiezen.
export function createMinimap(container) {
  if (!hasMapbox) {
    container.textContent = 'Geen Mapbox-token (VITE_MAPBOX_TOKEN in .env).';
    return;
  }
  let map = null;
  let marker = null;

  async function init() {
    const [{ default: mapboxgl }] = await Promise.all([import('mapbox-gl'), import('mapbox-gl/dist/mapbox-gl.css')]);
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
    const { lat, lon } = real.location;
    map = new mapboxgl.Map({ container, style: 'mapbox://styles/mapbox/satellite-streets-v12', center: [lon, lat], zoom: 9, attributionControl: true });
    marker = new mapboxgl.Marker({ color: '#e8a317' }).setLngLat([lon, lat]).addTo(map);
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('click', (e) => {
      marker.setLngLat(e.lngLat);
      setLocation(e.lngLat.lat, e.lngLat.lng, 'Gekozen op kaart');
    });
  }

  return {
    // Kaart pas bouwen als hij zichtbaar is (Mapbox heeft een zichtbare container nodig)
    show() {
      if (!map) init();
      else map.resize();
    },
    moveTo(lat, lon) {
      if (!map) return;
      marker.setLngLat([lon, lat]);
      map.easeTo({ center: [lon, lat] });
    },
  };
}
