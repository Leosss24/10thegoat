# 10 The GOAT · v0.6.5

Corrección del fallback de jugadores históricos.

## Qué cambia

- `/players?search=...&season=...` ya no se usa sin `team`/`league`.
- Ronaldo Nazário se resuelve usando Real Madrid 2006 como ancla histórica.
- Luís Figo se resuelve usando Inter 2008 como ancla histórica.
- El ID del club se obtiene dinámicamente con `/teams?search=...`; no se hardcodean IDs de jugador.
- Después de localizar al candidato se sigue validando fecha de nacimiento + nacionalidad.
- El comando de reparación sigue procesando solo Ronaldo y Figo.

## Ejecutar

```bash
npm run repair:players:batch1
```

No requiere SQL ni reimportar los jugadores que ya están completos.


## v0.6.5 — fallback histórico por plantilla completa

Para jugadores retirados que `/players/profiles?search=...` no indexa correctamente, el importador ya no añade `search` al fallback histórico. Resuelve el club ancla y consulta `/players?team=<id>&season=<year>&page=<n>`, recorre todas las páginas y localiza al jugador localmente mediante fecha de nacimiento + nacionalidad. Esto elimina la dependencia del buscador de nombres para Ronaldo Nazário y Luís Figo.

## v0.7.0 · Población BBDD · Lote 02 (200 jugadores)

Nuevo comando:

```bash
npm run import:players:batch2
```

El Lote 02 importa **200 jugadores**:

- 35 retirados adicionales, definidos explícitamente y validados por fecha de nacimiento + nacionalidad.
- 165 jugadores activos descubiertos desde API-Football en las grandes ligas europeas:
  - 42 · La Liga (España)
  - 41 · Premier League (Inglaterra)
  - 41 · Bundesliga (Alemania)
  - 41 · Serie A (Italia)

El descubrimiento activo usa por defecto la temporada 2026. Si una liga aún no ofrece cobertura suficiente, cae automáticamente a 2025. Los jugadores ya existentes en 10TG se excluyen de la selección.

Antes de empezar las importaciones, el script genera `.import-state/batch02-active-manifest.json`. Ese manifest fija los 165 IDs seleccionados, de modo que si el proceso se interrumpe y vuelves a ejecutar el comando, no seleccionará otros 165 jugadores distintos.

### Protección frente a rate limit

`apiGet()` incluye ahora:

- separación mínima entre peticiones (320 ms por defecto),
- detección de HTTP 429 / `errors.rateLimit`,
- espera y reintentos automáticos,
- reintentos progresivos para fallos temporales.

Se puede ajustar sin tocar código:

```env
API_FOOTBALL_REQUEST_INTERVAL_MS=320
API_FOOTBALL_MAX_RETRIES=5
```

También se añadió soporte opcional de `apiFootballId` directo en `findExactPlayer()`, para poder resolver en el futuro jugadores históricos problemáticos como Ronaldo Nazário o Luís Figo sin depender del buscador por nombre.

No requiere migraciones SQL nuevas.

## v0.7.1 · Reparación de históricos por API ID

El importador general funciona bien con activos, pero algunos retirados no aparecen de forma fiable en las búsquedas de API-Football. Esta versión añade una vía manual y segura por `player_id` del proveedor.

Históricos pendientes incluidos:

- Ronaldo Nazário
- Luís Figo
- Cafu
- Paolo Maldini
- Gennaro Gattuso
- Ruud van Nistelrooy
- Dennis Bergkamp
- Didier Drogba

Los IDs de API-Football no son secretos. Cuando localices uno en API-Football, puedes comprobarlo antes de importar:

```bash
npm run inspect:player-id -- 12345
```

El comando muestra nombre, fecha de nacimiento, nacionalidad y foto.

Después añade el ID a `.env.local` con la variable correspondiente:

```env
API_FOOTBALL_ID_RONALDO_NAZARIO=
API_FOOTBALL_ID_LUIS_FIGO=
API_FOOTBALL_ID_CAFU=
API_FOOTBALL_ID_PAOLO_MALDINI=
API_FOOTBALL_ID_GENNARO_GATTUSO=
API_FOOTBALL_ID_RUUD_VAN_NISTELROOY=
API_FOOTBALL_ID_DENNIS_BERGKAMP=
API_FOOTBALL_ID_DIDIER_DROGBA=
```

No es necesario rellenarlas todas a la vez. El reparador procesa solo las que tengan un ID configurado:

```bash
npm run repair:historicals
```

Antes de guardar un jugador, `findExactPlayer()` vuelve a validar la fecha de nacimiento y la nacionalidad esperadas. Si el ID pertenece a otra persona, el importador lo rechaza y continúa con el siguiente.

No hay migraciones SQL nuevas en esta versión.

## v0.7.2 · Autodetección de históricos

Nuevo comando:

```bash
npm run repair:historicals:auto
```

Para los 8 históricos pendientes intenta primero detectar el `player.id` escaneando una liga/temporada conocida y comparando fecha de nacimiento + nacionalidad. Si no aparece, usa partidos del club histórico y sus alineaciones para obtener candidatos por nombre y valida después cada ID contra `/players/profiles?player=ID`.

Los IDs detectados se guardan en `.import-state/historical-api-ids.json`, de modo que si el proceso se interrumpe no hay que redescubrirlos. Los valores `API_FOOTBALL_ID_*` de `.env.local` siguen teniendo prioridad si se quieren fijar manualmente.

No requiere migraciones SQL.

## v0.8.0 · Lote 03 — 100 jugadores actuales

Añade un nuevo importador masivo exclusivamente para jugadores actuales de las cuatro grandes ligas que estamos usando en 10TG:

- 25 · La Liga (España)
- 25 · Premier League (Inglaterra)
- 25 · Bundesliga (Alemania)
- 25 · Serie A (Italia)

El descubrimiento consulta API-Football, ordena candidatos por participación/rendimiento y **excluye cualquier `api_football` player ID que ya exista en `player_external_ids`**, de modo que el Lote 03 selecciona otros 100 jugadores y no repite el Lote 02.

El manifiesto se congela en `.import-state/batch03-active-manifest.json`, por lo que si el proceso se interrumpe se puede relanzar sin cambiar los 100 seleccionados. Si la temporada 2026 todavía no ofrece cobertura suficiente en alguna liga, usa 2025 únicamente como fallback de descubrimiento.

Ejecutar:

```bash
npm run import:players:batch3
```

No requiere migraciones SQL nuevas. Mantiene el throttle, reintentos de rate limit, importación tolerante a bloques incompletos y comportamiento idempotente del importador principal.


## v0.9.0 · Jugador Misterioso
- Wordle futbolero conectado a Supabase.
- 8 intentos; país, club, posición, pie y edad.
- Verde exacto, amarillo cercano, flechas de edad.
- Sin migraciones SQL nuevas.


## v0.9.1 · Adivina el jugador + Adivina el escudo
- Renombrado Jugador Misterioso a Adivina el jugador.
- Adivina el jugador rehecho como Wordle: 6 intentos, tablero por letras, teclado físico y en pantalla, verdes/amarillos/grises con control correcto de letras repetidas.
- Juego en mayúsculas; las tildes se normalizan y no cuentan.
- Los guiones se conservan como casillas fijas.
- La palabra jugable usa last_name cuando está disponible y fallback al último término de display_name.
- Nuevo Adivina el escudo: 6 intentos, autocompletado de clubes y escudo progresivamente menos pixelado tras cada fallo.
- Ambos juegos consumen solo datos públicos ya existentes en Supabase. No hay migraciones SQL nuevas.

## v0.9.2 · Auditoría segura de nombres para Adivina el jugador

Esta versión no borra ni reemplaza datos existentes.

### 1. Migración aditiva
Ejecuta en Supabase SQL Editor:

`supabase/migrations/20260830_004_player_game_name.sql`

Solo añade `players.game_name` como columna nullable y un índice parcial. No actualiza filas.

### 2. Auditoría (solo lectura)

```bash
npm run audit:game-names
```

Genera:
- `.import-state/game-name-audit.csv`
- `.import-state/game-name-audit.json`

Clasificación:
- `SAFE`: propuesta automática razonable.
- `REVIEW`: requiere revisión humana.
- `EXCLUDE`: no es apto para Wordle con las reglas actuales (4–11 letras, guiones permitidos).

El script NO ejecuta inserts, updates ni deletes en Supabase. La aplicación de `game_name` se hará en una versión posterior después de revisar el informe.

## v0.9.3 · Auditoría game_name v2
- Sigue siendo 100% lectura: no hace UPDATE/DELETE/INSERT en Supabase.
- `N. Apellido` se considera propuesta segura de `APELLIDO` salvo duplicados/longitud.
- Apellidos compuestos conservan espacios: `DEL PIERO`, `VAN DIJK`, `DE BRUYNE`.
- Tildes/diacríticos se normalizan solo en la propuesta para el juego.
- Duplicados siguen marcándose REVIEW.
- Casos ambiguos nombre/apellido siguen en REVIEW para decisión humana.


## v0.9.5 · Auditoría game_name v4
- PAVLOVIC, RAMOS y FERNANDEZ se permiten como respuestas duplicadas, igual que BELLINGHAM.
- DIAZ se desambigua con `first_name + DIAZ`, igual que GARCIA.
- `Jon Ander Olasagasti` propone `OLASAGASTI`.
- `Í. Bergmann Jóhannesson` propone `BERGMANN`.
- Sigue siendo solo lectura: no escribe ni borra datos de Supabase.


## v0.9.6 — Auditoría game_name v5
- HERNANDEZ duplicado se desambigua como nombre + HERNANDEZ.
- Excepción futbolística: Xavi Hernandez → XAVI.
- Sigue siendo una auditoría de solo lectura; no escribe ni borra registros en Supabase.


### v0.9.7 · Adivina el jugador · Full HD y ficha final

- Interfaz Wordle compactada para ventanas Full HD (especialmente viewport <= 1000 px de alto).
- Al terminar, ganando o perdiendo, se muestra foto, nombre de visualización, club actual y respuesta.
- Para jugadores retirados se muestra `Retirado` en vez de un club histórico.
- El club se obtiene de la relación de club más reciente, priorizando `is_current`.
- Preparado para incorporar retirados cuando tengan `game_name` curado.
- Ñ y Ç siguen siendo letras propias; espacios y guiones son separadores fijos.


## v0.9.9 · Normalización de game_name
Ejecuta primero `npm run audit:game-names`. El comando `npm run normalize:game-names` solo continúa si los 320 registros están SAFE y únicamente actualiza `players.game_name`.

## v0.10.0 · puntuación de Adivina el jugador
- Puntuación por intento: 100 / 80 / 60 / 40 / 30 / 20.
- Una pista por partida: revela una letra en posición correcta todavía no descubierta y resta 10 puntos si se gana.
- Fallar los seis intentos: 0 puntos.
- Rendirse: -20 puntos.
- Puntos acumulados por juego en `localStorage` mediante `lib/game-scores.ts`, preparado para sustituirse más adelante por usuarios + Supabase.
- La puntuación general futura se obtiene sumando los totales de cada juego, no mediante un contador global duplicado.


## v0.10.2

- Corrige la pista de Adivina el jugador: la letra revelada se muestra solo en la fila activa, no en todas las filas futuras.
- Adivina el Escudo excluye equipos filiales, reservas y juveniles mediante sufijos/patrones habituales y una lista de filiales con nombre propio.
- Sin cambios de esquema ni migraciones SQL.

## v0.10.3 · Puntuaciones en Mayor o Menor y Adivina el Escudo

- Mayor o Menor suma puntos únicamente al superar el récord personal de racha: nueva racha récord 1 = +10, 2 = +20, 3 = +30, etc. Repetir una racha ya alcanzada no suma.
- Adivina el Escudo usa 100 / 80 / 60 / 40 / 30 / 20 puntos según el intento en el que se acierte; seis fallos = 0.
- Ambos juegos usan la misma capa local de `lib/game-scores.ts`, preparada para migrar más adelante a usuarios y rankings en Supabase.


## v0.10.4 · Wordle fix + identidad visual
- Corrige `isCurrent is not defined` en `PlayerWordleGame`.
- La pista se pinta únicamente en la fila activa.
- Paleta global alineada con la marca 10theGOAT: `#0D0D0D`, `#FFFFFF`, `#A8FF00`.
- Ajustes de fondos, bordes, tarjetas, botones, estados y juegos para una identidad más coherente.
- Sin cambios de base de datos ni migraciones SQL.


## v0.10.5
- Corrige la pista de Adivina el jugador usando posiciones absolutas del tablero.
- La casilla de pista queda fija en todos los intentos restantes y se omite al escribir.
- Evita que la letra revelada aparezca accidentalmente en la primera casilla.
- Añade el escudo 10theGOAT al header, portada, footer y favicon/app icon.
- Assets de marca en `public/brand/`.


## v0.10.6

- Corrige `app/globals.css`: elimina secuencias literales `\\n` introducidas en v0.10.5 que rompían el parser de PostCSS.
- Mantiene la corrección de pista bloqueada y la integración del logo de v0.10.5.
- Sin cambios de base de datos ni migraciones.


## v0.10.7
- Mayor o Menor: foto al 75%.
- Escudos: visual al 80%.
- Home: banner con fundido lateral.

## v0.11.0-beta.1 · Release Candidate

Preparación para primera Beta pública:
- Metadata SEO, Open Graph, Twitter card, sitemap y robots.
- Favicon/logo de marca y tema oscuro + verde eléctrico.
- 404 y error boundary.
- Página `/beta` con feedback y estado del producto.
- Páginas `/privacidad`, `/cookies` y `/aviso-legal` en modo Beta.
- Cabeceras de seguridad básicas desde `next.config.ts`.
- Estados públicos corregidos: Mayor o Menor, Adivina el jugador y Adivina el Escudo disponibles; Football Grid, Modo Carrera y Mi XI próximamente.
- `npm run check:production` revisa que no haya referencias a `SUPABASE_SECRET_KEY` ni `API_FOOTBALL_KEY` en código cliente/runtime público.

### Checklist antes de conectar 10thegoat.com
1. Ejecutar `npm run check:production`.
2. Ejecutar `npm run build` y resolver cualquier error.
3. En Vercel, configurar únicamente las variables necesarias de producción. Las públicas son `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Las claves de importación/administración no son necesarias para jugar.
4. Revisar RLS de Supabase: tablas de juego en solo lectura pública; IDs externos y tablas internas sin acceso público.
5. Hacer backup/export de Supabase antes de abrir la Beta.
6. Completar los datos legales reales del titular y contacto antes de publicación pública definitiva/monetización.
7. Probar escritorio + móvil desde la URL temporal de Vercel antes de apuntar el dominio.
