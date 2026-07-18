# Rekenkrak

Rekenen oefenen voor de lagere school: **plus, min, keer, gedeeld en splitsen** — als installeerbare web-app (PWA) voor op iPads, met een aparte leerkracht-tool om oefeningen op maat te maken en te delen via QR-code of link.

## Twee toepassingen in één map

| Bestand | Voor wie | Wat |
|---|---|---|
| `index.html` | Leerlingen | Zelf oefenen óf een QR-code van de juf/meester scannen. Installeerbaar als app-icoon, werkt offline. |
| `leerkracht.html` | Leerkracht | Oefeningen op maat samenstellen, QR-codes/links genereren, en klassikaal "samen oefenen" op het (touch)bord. |

De QR-codes en links uit de leerkracht-tool openen automatisch de leerlingapp met de juiste oefening — alle instellingen zitten in de link zelf, er is geen server of login nodig.

## Mogelijkheden

- Bewerkingen: **+ − × ÷** en **splitsingen** (splitshuisje, kies uit 10, 20, … 100)
- Getallenbereik tot 20 / 100 / 1000 voor plus en min
- Maaltafels en deeltafels 1–10, **delen met rest**
- Drie somtypes: antwoord zoeken, eerste getal zoeken, tweede getal zoeken
- Tempo-oefenen: **3** / 5 / 10 / 15 / 20 seconden per som (3 sec voor automatisatie-eindtermen)
- Antwoorden via cijferpad of kiezen-uit-4
- **Automatische invoer**: geen ✓ nodig — na een kwartseconde controleert de app zelf en springt ze door naar het rest-vakje
- Klassikale modus met extra grote knoppen voor touch-whiteboards
- Sterren, confetti, geluid en een eindscherm met medaille

## Zelf hosten

Zet alle bestanden samen in één map op GitHub Pages (of eender welke https-host). De volledige stap-voor-stap uitleg staat in [LEESMIJ.md](LEESMIJ.md).

> Camera-scannen vereist **https**; GitHub Pages levert dat automatisch.

## Technisch

Puur statisch: HTML/CSS/JavaScript zonder build-stap of afhankelijkheden op een server. Gedeelde rekenmotor (`engine.js`) voor beide pagina's, [qrcode-generator](https://www.npmjs.com/package/qrcode-generator) voor het maken en [jsQR](https://www.npmjs.com/package/jsqr) voor het scannen van QR-codes. Service worker + manifest maken er een offline werkende, installeerbare PWA van.

## Licentie

[MIT](LICENSE)
