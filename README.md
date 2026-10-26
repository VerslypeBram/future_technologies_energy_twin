# Woning EMS – digital twin van een slim gebouw

Interactieve 3D-simulatie (three.js) van een woning met zonnepanelen, windmolens, batterij(en), warmtepomp, regenton en twee elektrische auto's. Een energiebeheersysteem (EMS) stuurt de woning en wordt vergeleken met een standaardhuis zonder automatisering.

Fase 2 ("van maquette naar echt"): de scène wordt gestuurd door **echte data**.

## Echte data

| Wat | Bron | Gebruik |
| --- | --- | --- |
| Weer (wolken, temperatuur, wind, straling, neerslag) | [Open-Meteo](https://open-meteo.com/) | stuurt wolken, regen, wind, buitentemperatuur en zonne-opbrengst |
| Zonnestand | [SunCalc](https://github.com/mourner/suncalc) | zonneboog, schaduw, dag en nacht voor de gekozen locatie en datum |
| Stroomprijs (dag-vooruit, België) | [Energy-Charts](https://www.energy-charts.info/) | EMS-beslissingen (voorverwarmen, EV-laden, piek), kosten, grafiek |
| Kaart en satellietbeeld | [Mapbox](https://www.mapbox.com/) | locatie kiezen, satelliet als terrein rond het huis |

Alles valt terug op nepdata (mock-weer, vaste prijstabel) als een bron niet bereikbaar is. De simulatie start op de echte tijd en loopt standaard realtime; met de schuif kan je versnellen.

## Starten

```bash
npm install
npm run dev
```

Maak een `.env` in de projectmap voor de kaart (zonder token werkt de rest gewoon):

```
VITE_MAPBOX_TOKEN=pk.jouw_publieke_token
```

`.env` staat in `.gitignore`. Een Mapbox `pk.`-token is bedoeld voor gebruik in de browser; beperk het in je Mapbox-account tot je eigen domein.

### Scripts

| Commando | Wat het doet |
| --- | --- |
| `npm run dev` | dev-server (Vite) |
| `npm run build` | productiebuild in `dist/` |
| `npm test` | unit tests (Vitest) voor de rekenkern en de datalaag |

### Proxy voor Energy-Charts

Energy-Charts staat geen aanroepen vanuit andere origins toe (CORS). Daarom gaan prijzen via `/api/ec`:

- dev en `vite preview`: `vite.config.mjs`
- Vercel: `vercel.json` (rewrite)
- andere hosting: zelf een proxy of rewrite van `/api/ec/*` naar `https://api.energy-charts.info/*` voorzien

## Gebruik

- **Omgeving**: weer (live of mock), locatie via de minikaart, satelliet-ondergrond, simulatiesnelheid, "Naar echte tijd".
- **Installaties**: warmtepomp (rendement volgt de buitentemperatuur), extra batterij (+5 kWh) en een regenton met pomp.
- **Seizoenen en weer**: bladeren kleuren, vallen en groeien volgens de echte datum; sneeuw blijft liggen bij vorst, smelt bij dooi en bedekt de zonnepanelen (minder opbrengst).
- **Leven**: auto's op de straat, een voetganger op de stoep en vogels overdag.
- **Bediening**: automaatregeling aan/uit, verwarming, ventilatie, rolluiken, EV-laden. Een raam aanklikken opent of sluit het.
- **Scenario's**: hittegolf, storm, strenge winter, stroomstoring (met doelen).
- **Sneltoetsen**: A automaat, I warmtecamera, L labels, spatie pauze.

## Structuur

```
main.js            scène, render-lus, koppeling van alle onderdelen
src/simulation.js  rekenkern: wereld, huisstaat, EMS, prijs (zonder three.js)
src/realdata.js    Open-Meteo, Energy-Charts, SunCalc, locatie
src/satellite.js   Mapbox-satellietbeeld als terrein
src/minimap.js     Mapbox-minikaart (lazy geladen)
src/ui.js, hud.js  paneel en topbalk
src/house.js, environment.js, sky.js, weather.js   3D-scène
tests/             Vitest-tests met nepdata (offline)
```

## Bronnen en licenties

- Weerdata: Open-Meteo, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Stroomprijzen: Energy-Charts, CC BY 4.0, bron Bundesnetzagentur | SMARD.de. De getoonde eindprijs is een schatting (spot + 0,12 €/kWh voor nettarief en taksen + 6% btw)
- Zonnestand: SunCalc (BSD-2-Clause)
- Kaart en satellietbeeld: © Mapbox, © OpenStreetMap, © Maxar
- three.js (MIT), IBM Plex (OFL)
