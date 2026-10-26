import * as THREE from 'three';

// Satellietbeeld (Mapbox Static Images) als ondergrond van het terrein rond het huis.
// Beeld: noorden boven, dus -z in de scène; past bij de kompasrichting van de woning.
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const ZOOM = 17;
const IMG = 1024;
const TERRAIN_SIZE = 600;

export const hasMapbox = Boolean(TOKEN);

function metersPerPixel(lat) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** ZOOM;
}

export function createSatellite(terrain) {
  const mat = terrain.material;
  const grass = { map: mat.map, bump: mat.bumpMap, color: mat.color.clone() };
  let satTex = null;
  let wanted = false;
  let loadId = 0;

  function apply() {
    if (wanted && satTex) {
      mat.map = satTex;
      mat.bumpMap = null;
      mat.color.set(0xffffff);
    } else {
      mat.map = grass.map;
      mat.bumpMap = grass.bump;
      mat.color.copy(grass.color);
    }
    mat.needsUpdate = true;
  }

  return {
    get on() {
      return wanted;
    },
    set(on) {
      wanted = on && hasMapbox;
      apply();
    },
    // Haalt het beeld voor een locatie op (herhaalde aanroepen: de laatste wint)
    load(lat, lon) {
      if (!hasMapbox) return Promise.resolve(false);
      const id = ++loadId;
      const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lon.toFixed(5)},${lat.toFixed(5)},${ZOOM},0/${IMG}x${IMG}?attribution=false&logo=false&access_token=${TOKEN}`;
      return new Promise((resolve) => {
        new THREE.TextureLoader().setCrossOrigin('anonymous').load(
          url,
          (t) => {
            if (id !== loadId) return t.dispose();
            const span = IMG * metersPerPixel(lat); // meters die het beeld beslaat
            const k = TERRAIN_SIZE / span;
            t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = 8;
            t.repeat.set(k, k);
            t.offset.set((1 - k) / 2, (1 - k) / 2);
            satTex?.dispose();
            satTex = t;
            apply();
            resolve(true);
          },
          undefined,
          () => resolve(false),
        );
      });
    },
  };
}
