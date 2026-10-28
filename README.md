# Woning EMS – digital twin van een slim gebouw

Interactieve 3D-simulatie (three.js) van een woning met zonnepanelen, windmolens, batterij(en), warmtepomp, regenton en twee elektrische auto's. Een energiebeheersysteem (EMS) stuurt de woning en wordt vergeleken met een standaardhuis zonder automatisering.

Fase 2 ("van maquette naar echt"): de scène wordt gestuurd door **echte data**.

## Echte data

| Wat                                                  | Bron                                             | Gebruik                                                           |
| ---------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| Weer (wolken, temperatuur, wind, straling, neerslag) | [Open-Meteo](https://open-meteo.com/)            | stuurt wolken, regen, wind, buitentemperatuur en zonne-opbrengst  |
| Zonnestand                                           | [SunCalc](https://github.com/mourner/suncalc)    | zonneboog, schaduw, dag en nacht voor de gekozen locatie en datum |
| Stroomprijs (dag-vooruit, België)                    | [Energy-Charts](https://www.energy-charts.info/) | EMS-beslissingen (voorverwarmen, EV-laden, piek), kosten, grafiek |
| Kaart en satellietbeeld                              | [Mapbox](https://www.mapbox.com/)                | locatie kiezen, satelliet als terrein rond het huis               |

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

| Commando        | Wat het doet                                         |
| --------------- | ---------------------------------------------------- |
| `npm run dev`   | dev-server (Vite)                                    |
| `npm run build` | productiebuild in `dist/`                            |
| `npm test`      | unit tests (Vitest) voor de rekenkern en de datalaag |

### Proxy voor Energy-Charts

Energy-Charts staat geen aanroepen vanuit andere origins toe (CORS). Daarom gaan prijzen via `/api/ec`:

- dev en `vite preview`: `vite.config.mjs`
- Vercel: `vercel.json` (rewrite)
- andere hosting: zelf een proxy of rewrite van `/api/ec/*` naar `https://api.energy-charts.info/*` voorzien

## Modellen en formules

De rekenkern staat in `src/simulation.js` (zonder three.js, getest met Vitest). Eén tick is `dt` seconden echte tijd, `dtH = dt · hoursPerSec` simulatie-uren.

| Onderdeel         | Formule                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Zonfactor         | `min(1, 2·sin(hoogte))` uit SunCalc, 0 onder de horizon                                                          |
| Effectieve zon    | live: `min(1, straling / 800 W/m²)`; mock: `zonfactor · (1 − 0,75·bewolking)`                                    |
| Zonne-opbrengst   | `zon · 1,5 kW · (1 − 0,9·sneeuw op panelen)`                                                                     |
| Wind              | `wind (0..1) · 2 kW` voor twee molens                                                                            |
| Warmtepomp (COP)  | `clamp(3 + 0,1·T_buiten, 1,8 … 4,5)`; vermogen = `2 kW / COP` (referentiehuis: COP 1)                            |
| Binnentemperatuur | `dT = (T_buiten − T_binnen)·verlies·dt + verwarming·dt + zonwinst·dt`; verlies = basis + open ramen + ventilator |
| Thermostaat       | hysterese ±0,3 °C rond de doeltemperatuur                                                                        |
| Energiebalans     | opwek ≥ behoefte: overschot eerst naar batterij (max 2 kW), rest naar het net; anders batterij, dan net          |
| Batterij          | 5 kWh (+5 optioneel), 20% reserve voor stroomstoring, bijladen van het net bij goedkope prijs en weinig zon      |
| Regenton          | `+ neerslag(mm/u) · 25 m² · dtH` liter, max 300 L; pomp sproeit 60 L/u op droge, warme momenten                  |
| Kosten            | `afname · prijs − teruglevering · terugleverprijs`; CO₂ = `afname · 0,25 kg/kWh`                                 |

Het EMS (automaat) vergelijkt telkens met een standaardhuis zonder zonnepanelen, batterij of sturing.

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

## Inlevering

| Item                             | Waar                                                                   |
| -------------------------------- | ---------------------------------------------------------------------- |
| Repository + README              | dit bestand                                                            |
| Git-historiek met `fase-1-klaar` | tag `fase-1-klaar` op commit `f218599` ("Add phase 1 three.js scene…") |
| Reflectie                        | hieronder                                                              |
| AI-verantwoording fase 2 en 3    | hieronder                                                              |

### Reflectie

Fase 1 bouwde ik zonder AI, met alleen de three.js-voorbeelden en de documentatie. Die documentatie was heel slecht en onduidelijk, dus het ging trager en ik moest veel uitzoeken door te proberen.

Met AI ging het veel sneller, vooral bij het koppelen van echte data en het uitwerken van ideeën. Maar niet alles werkte meteen. Spraak voelde in het begin onbetrouwbaar: Nederlandse commando's werden vaak verkeerd verstaan en soms gebeurde er iets anders dan ik zei. Ik moest dus veel testen en bijsturen voor het aanvoelde als iets dat echt werkt. Ook koppelingen met externe bronnen liepen niet altijd soepel, en ik moest regelmatig zoeken waarom iets niet doorkwam.

Het maken voelde met AI heel anders dan in fase 1. Ik stond minder vast en kon sneller dingen uitproberen, maar ik moest wel blijven opletten. Wat AI maakte zag er vaak goed uit, ook als het niet klopte. Ik leerde dus om alles zelf te testen in plaats van het te geloven. Dat kostte soms meer tijd dan ik had verwacht, maar zo hield ik het gevoel dat het mijn project bleef.

### AI-verantwoording fase 2 en 3

**Tool:** Claude Code (Claude Sonnet) in de Claude-desktopapp. Fase 1 is zonder AI gemaakt (commit `f218599`).

**Prompts:** ik gaf per onderdeel een korte opdracht in gewone taal (bijvoorbeeld "voeg echte weerdata toe" of "voeg spraakbesturing toe") en stuurde bij op basis van wat ik in de scène zag. De volledige reeks staat niet uitgeschreven.

| Onderdeel                                               | Commit               | Wat AI deed                                                 | Wat ik aanpaste / controleerde                             |
| ------------------------------------------------------- | -------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| EMS-simulatie en dashboard                              | `f9f78ab`            | schreef de rekenkern, het paneel en de scène                | testte het gedrag en vergeleek met het standaardhuis       |
| Echte data (Open-Meteo, SunCalc, Energy-Charts, Mapbox) | `826c422`            | schreef de koppelingen met de bronnen                       | proxy voor CORS, fallback op nepdata, tokens in `.env`     |
| README, Vitest-tests, optimalisaties                    | `c9ccbd7`            | schreef documentatie en tests                               | liep de tests en de uitleg na                              |
| Maan en buitenverlichting                               | `076e532`            | maan, nachtverlichting                                      | controleerde dag/nacht-gedrag in de scène                  |
| Seizoenen, sneeuw, leven, extra installaties            | `9fd18b5`            | seizoenen, sneeuw, voetganger, auto's, vogels, installaties | koos welke installaties erbij kwamen                       |
| Zon zichtbaar, Volg zon, tijdlapse                      | `94d5f88`            | zonneschijf, camera die de zon volgt                        | controleerde de zonnestand tegenover SunCalc               |
| Spraakbesturing (Web Speech, 25+ commando's)            | `b532867`, `98a6a08` | spraakherkenning en commando's                              | zinvarianten bijgesteld, knoppen en tekstveld als terugval |
| Batterij bijladen/terugleveren, hover-data              | `d2ebf95`, `1be96ba` | batterijlogica, hover-info                                  | controleerde de energiebalans                              |

Controle: `npm test` draait de rekenkern en spraakcommando's offline met nepdata.
