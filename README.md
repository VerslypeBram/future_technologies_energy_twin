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

- **Omgeving**: weer (live of mock), locatie via de minikaart, satelliet-ondergrond, simulatiesnelheid ("Realtime" of "Dag in 24 s"), "Naar echte tijd".
- **Zon volgen**: de knop "Volg zon" onderaan houdt de camera op de zon gericht; met "Dag in 24 s" trekt hij in 24 seconden over de lucht en schuiven de schaduwen mee.
- **Installaties**: warmtepomp (rendement volgt de buitentemperatuur), extra batterij (+5 kWh) en een regenton met pomp.
- **Seizoenen en weer**: bladeren kleuren, vallen en groeien volgens de echte datum; sneeuw blijft liggen bij vorst, smelt bij dooi en bedekt de zonnepanelen (minder opbrengst).
- **Leven**: auto's op de straat, een voetganger op de stoep en vogels overdag.
- **Spraak** (sectie bovenaan het paneel): klik op "Spreek" en zeg een commando. Het paneel toont wat verstaan werd en wat het gevolg was. Werkt met de Web Speech API in Chrome en Edge; in andere browsers kan je de knoppen of het tekstveld gebruiken. Commando's (volledige lijst onder "Alle commando's" in het paneel): tijd ("zet de zon op 15 uur", "naar echte tijd", "dag in 24 seconden", "pauze"), vragen ("hoeveel energie produceren we", "hoe vol is de batterij", "hoe vol is de regenput", "hoe warm is het buiten", "hoe hard waait het", "wat is de stroomprijs", "hoe warm is het" voor comfort, kosten en CO₂), weer ("meer wind", "minder wind", "maak het bewolkt", "laat het regenen", "start de hittegolf"), bediening ("leeg de regenput", "zet de temperatuur op 22 graden", "verwarming uit", "ramen open", "rolluiken dicht", "warmtepomp aan", "automaat aan") en camera en weergave ("toon de windmolens", "ga naar het dak", "volg de zon", "warmtecamera aan"). Optioneel leest de app het antwoord voor.
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
