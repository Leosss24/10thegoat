# Game artwork and typography

The catalog uses nine original generated images in `public/brand/games/`. They are decorative, text-free WebP backgrounds (1200 x 800), shared with each game header. Titles, full descriptions and availability labels remain real HTML from the existing ES/EN/FR dictionaries. No game rules, scoring, persistence or routes changed.

Art direction: dark navy sports photography, one subject and accent per game. Wordle uses a different number 7 player from Career Mode's number 10. Odd One Out uses three matching outfield shirts numbered 4, 8, 11 and a different team's number 9. Grid, Trivia and Connections use association football imagery (not American football).

`app/game-art.css` contains the shared artwork mapping, typography and responsive treatment. Headers are quieter on mobile; descriptions remain visible. Focus, reduced motion and forced colors have explicit styles. The badge scoreboard stays inside the game surface.

Typography: locally hosted Barlow (400, 600, 700) for body/interface text; Barlow Condensed Bold and Bold Italic for display text. The generated mockup did not use an identifiable font; this pair implements its appearance with real selectable text. Existing brand artwork, numerical monospace treatments and provider sign-in branding are retained. Fonts include Latin accented characters for Spanish and French.

Font source: https://github.com/google/fonts/tree/main/ofl/barlow and https://github.com/google/fonts/tree/main/ofl/barlowcondensed. SIL Open Font License files are included in `app/fonts/`. Next's local font loader serves them from the application without third-party font requests or build-time downloads.

Validation: production build and 64 existing unit tests pass. Responsive browser sweep covers catalog, nine game pages, homepage and unauthenticated account in ES/EN/FR at 320, 390, 768 and 1440 px (144 combinations), with no horizontal overflow or missing artwork. Additional checks cover live-data game surfaces, keyboard catalog navigation, Wordle input and Connections selection. Football Grid is checked in its unauthenticated sign-in state; authenticated rounds/account were not exercised. QA captures and scripts are local under ignored `tmp/design-qa/`.

Repository lint currently reports one existing `react-hooks/set-state-in-effect` error in unchanged `components/CookieNotice.tsx`, plus existing warnings. This design change does not modify that component.


## Paletas de Conexiones y Ordena la historia

Paletas aprobadas para tarjetas, navegación, cabeceras, controles y futuros badges:

| Juego | Principal | Fondo oscuro / símbolo del badge | Tono claro |
| --- | --- | --- | --- |
| Conexiones | `#2DD4BF` | `#0B302B` | `#99F6E4` |
| Ordena la historia | `#F472B6` | `#3B1630` | `#FBCFE8` |

Los badges usarán la misma base de escudo sencillo, con toda la superficie en la paleta del juego. Adivina el escudo conserva el violeta `#B76CFF` y Football Grid el azul `#32A7FF`. Los colores que distinguen los grupos de Conexiones y los avisos de éxito o advertencia mantienen su función.
