import * as THREE from 'three';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Seizoen uit de echte datum en breedtegraad (zuidelijk halfrond: half jaar verschoven).
// leaf: 0 kaal .. 1 vol blad, autumn: 0 groen .. 1 herfstkleuren, spring: 1 fris jong blad .. 0
export function seasonAt(date, lat = 50) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  let doy = Math.floor((date.getTime() - start) / 864e5);
  if (lat < 0) doy = (doy + 182) % 365;
  const grow = smooth(80, 130, doy); // 21 mrt - 10 mei
  const fall = 1 - smooth(300, 335, doy); // 27 okt - 1 dec
  return {
    doy,
    leaf: Math.min(grow, fall),
    autumn: smooth(260, 300, doy) * (doy > 150 ? 1 : 0),
    spring: (1 - smooth(110, 150, doy)) * (doy < 200 ? 1 : 0),
    winter: doy < 80 || doy > 335,
  };
}

const col = (hex) => new THREE.Color(hex);
const GREEN_A = col(0x4a7d3b);
const GREEN_B = col(0x3b6a33);
const AUTUMN_A = col(0xc9742a);
const AUTUMN_B = col(0xa8531e);
const SPRING_A = col(0x7fb069);
const SPRING_B = col(0x6aa55a);
const GRASS_SUMMER = col(0xffffff);
const GRASS_AUTUMN = col(0xe2cf9a);
const GRASS_WINTER = col(0xc9d2d6);
const TERRAIN_BASE = col(0xd8e4d0);
const TERRAIN_AUTUMN = col(0xd6c79a);
const TERRAIN_WINTER = col(0xc5ccd0);
const HEDGE_AUTUMN = col(0xd0a66b);

// Bladeren, gras en haag volgen het seizoen. terrain: grondmateriaal (alleen getint zonder satellietbeeld).
export function createSeasons(env) {
  const { canopyA, canopyB, hedgeMat, tuftMat, treeBlobs } = env.foliage;
  const tmp = new THREE.Color();
  const tmp2 = new THREE.Color();
  let lastKey = '';

  function tint(target, summer, autumnC, winterC, s) {
    tmp.copy(summer).lerp(autumnC, s.autumn);
    if (s.leaf < 1 || s.winter) tmp.lerp(winterC, 1 - Math.max(s.leaf, 0.25));
    return target.copy(tmp);
  }

  return {
    update(date, lat, satelliteOn) {
      const s = seasonAt(date, lat);
      const key = `${s.doy}|${satelliteOn}`;
      if (key === lastKey) return s;
      lastKey = key;

      canopyA.color.copy(GREEN_A).lerp(SPRING_A, s.spring * 0.8).lerp(AUTUMN_A, s.autumn);
      canopyB.color.copy(GREEN_B).lerp(SPRING_B, s.spring * 0.8).lerp(AUTUMN_B, s.autumn);
      treeBlobs.forEach(({ mesh, base }) => {
        mesh.visible = s.leaf > 0.06;
        mesh.scale.setScalar(base * (0.35 + 0.65 * s.leaf));
      });

      hedgeMat.color.copy(col(0xffffff)).lerp(HEDGE_AUTUMN, s.autumn * 0.6).lerp(col(0xbfa888), (1 - s.leaf) * 0.6);
      tuftMat.color.copy(tint(tmp2, GRASS_SUMMER, GRASS_AUTUMN, GRASS_WINTER, s));
      env.yard.material.color.copy(tint(tmp2, GRASS_SUMMER, GRASS_AUTUMN, GRASS_WINTER, s));
      if (!satelliteOn) env.terrain.material.color.copy(tint(tmp2, TERRAIN_BASE, TERRAIN_AUTUMN, TERRAIN_WINTER, s));
      return s;
    },
  };
}
