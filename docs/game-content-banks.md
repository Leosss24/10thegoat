# Bancos de juegos (septiembre de 2026)

Los bancos se distribuyen como JSON estático. Jugar a Conexiones, Intruso, Ordena la historia y Adivina el escudo no consulta la BBDD para obtener retos o catálogos. Las imágenes siguen cargándose desde sus proveedores. La autenticación y las puntuaciones conservan su funcionamiento anterior.

| Banco | Antes | Ahora |
| --- | ---: | ---: |
| Conexiones | 1 tablero / 4 grupos | 20 tableros / 80 grupos distintos |
| Intruso | 14 retos | 100 retos (50 por dificultad) |
| Ordena la historia | 4 historias | 100 historias |
| Escudos | Catálogo de clubes elegibles de BBDD | 1.680 clubes, 83 ligas y 90 países/asociaciones |

## Contenido y fuentes

- `data/players/catalog.json`: 3.567 identidades públicas, con el `display_name` exacto y `photo_url` de la tabla `players`. El nombre se presenta en mayúsculas. Los nombres completos se conservan únicamente como alias de búsqueda; el `game_name` continúa siendo la respuesta del Wordle.
- Conexiones: nacionalidades y trayectorias de clubes a partir del catálogo verificado de Football Grid (versión guardada en cada relación). Cada jugador cumple únicamente una de las cuatro relaciones seleccionadas dentro de su tablero. Se excluyen 44 fotos genéricas detectadas entre 789 candidatos. Esto comprueba las relaciones seleccionadas; no pretende descartar cualquier conexión alternativa imaginable.
- Intruso: conserva los 14 retos originales y añade 86 basados en nacionalidad o nacionalidad más trayectoria. La nacionalidad diferente permite excluir al intruso sin deducir que nunca jugó en un club a partir de datos incompletos.
- Historia: conserva las cuatro historias originales y añade 96 campañas de clubes en Champions League (ocho por temporada, 2013/14–2024/25). Cada campaña reúne cinco partidos reales, con resultado y fecha del proveedor. Son 100 conjuntos diferentes; la ampliación se centra en Champions, no en 100 temas históricos generales. La solución ordena por fecha completa y enlaza el archivo de UEFA.
- Escudos: `leagues.json` especifica 54 primeras divisiones de asociaciones UEFA y 29 ligas americanas, con la temporada disponible por competición. Liechtenstein no tiene liga propia. Los países americanos sin cobertura de liga usan el catálogo de clubes por país; Bahamas aporta Western Warriors desde su web oficial. `coverage.json` documenta estos casos y temporadas. Los antiguos clubes elegibles se conservan, junto con las nuevas incorporaciones; se eliminan filiales, juveniles, equipos femeninos, escudos duplicados y respuestas con imagen genérica (`excluded.json`). La cobertura depende del catálogo del proveedor, no de una verificación manual exhaustiva de cada plantilla de liga.

Cada JSON guarda fuentes o metadatos de procedencia. Los datos públicos proceden de la BBDD existente, API-Football, UEFA y, para Western Warriors, https://westernwarriorsbahamas.com/.

## Renovación explícita del contenido

Ningún comando siguiente escribe en la BBDD. Ejecutarlos desde la raíz del repositorio con Node 24. Las exportaciones requieren las variables públicas de Supabase o `API_FOOTBALL_KEY` en un archivo de entorno local ignorado por Git; no incluir credenciales en los JSON.

```powershell
node --env-file=.env.local scripts/export-game-catalogs.mjs
node scripts/audit-player-photos.mjs
node --experimental-strip-types scripts/build-puzzle-banks.mjs
node --env-file=.env.local scripts/export-history-fixtures.mjs
node scripts/build-history-bank.mjs
node --env-file=.env.local scripts/export-badge-teams.mjs
node --experimental-strip-types scripts/build-badge-bank.mjs
node scripts/check-content-images.mjs
npm test
npm run build
```

Las exportaciones del proveedor reutilizan los ficheros de `tmp/content-audit/`; para renovar una temporada, actualizar el plan y retirar únicamente su fichero de caché correspondiente. Revisar siempre el diff del contenido antes de publicarlo. El generador usa una semilla fija, pero actualizar la fuente puede cambiar tableros existentes: para una ampliación posterior, preservar los IDs y el contenido de los retos publicados o crear una nueva versión del banco.

## Partidas y comprobaciones

Conexiones conserva el tablero original solo para terminar sesiones antiguas y después rota por los 20 nuevos. Historia añade los nuevos retos a las colas guardadas. Intruso amplía la cola al completar el ciclo anterior. Las nuevas colas no repiten retos hasta agotarse y evitan repetir el último al comenzar otro ciclo. Las comprobaciones de puntuación son idempotentes.

Las pruebas cubren tamaños, identidades, fotografías genéricas, cobertura, rotación, migración de sesiones y puntuación. La comprobación de navegador recorre ES/EN/FR a 320, 390, 768 y 1440 px; los resultados y capturas de la sesión están en `tmp/content-audit/`, que no se publica.
