# 10theGOAT — Beta

**10theGOAT** es una web de minijuegos de fútbol desarrollada con **Next.js 16, React 19, TypeScript, Supabase y Vercel**.

El objetivo de esta Beta es consolidar una base técnica estable, una base de datos futbolística reutilizable y varios juegos conectados a datos reales.

> Estado actual: **v0.11.2-beta.1**

---

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase
- Vercel
- API-Football / API-Sports

---

## Juegos

### Mayor o Menor

Juego basado en estadísticas reales de jugadores.

Características actuales:

- Datos obtenidos desde Supabase.
- Comparaciones entre jugadores y temporadas.
- La temporada actual queda excluida cuando corresponde.
- La partida termina al primer fallo.
- Sistema de puntuación y récord local.
- Opción de volver a jugar.
- Las imágenes de jugadores utilizan `players.photo_url`.
- Desde **v0.11.2-beta.1**, los **porteros quedan excluidos del pool de jugadores**.

---

### Adivina el Jugador

Juego estilo Wordle centrado en nombres de futbolistas.

Características actuales:

- 6 intentos.
- Teclado en pantalla.
- Ignora acentos para comparar nombres.
- `Ñ` y `Ç` se mantienen como caracteres distintos.
- Soporte para espacios, guiones y otros separadores.
- Sistema de pistas.
- Rendición.
- Puntuación integrada.
- Resultado final con ficha del jugador.
- Utiliza `players.game_name` como nombre canónico del juego.

---

### Adivina el Escudo

Juego de identificación de clubes mediante su escudo.

Características actuales:

- 6 intentos.
- Autocompletado de clubes.
- Escudo progresivamente menos pixelado.
- Puntuación según el número de intentos.
- Usa imágenes reales desde `clubs.badge_url`.
- Excluye selecciones nacionales.
- Filtrado adicional de reservas, juveniles y equipos secundarios.
- Desde **v0.11.1-beta.1**, solo aparecen clubes con:

```sql
is_game_eligible = true
```

Esto permite mantener una base de datos amplia sin que todos los clubes formen parte del juego.

---

### Football Grid

Estado: **placeholder / pendiente de desarrollo**.

---

### Modo Carrera

Estado: **placeholder / pendiente de desarrollo**.

Está previsto como uno de los modos principales de 10theGOAT.

---

### Mi XI

Estado: **placeholder / pendiente de desarrollo**.

---

# Historial de la Beta

## v0.11.0-beta.1

Primera Release Candidate de la Beta pública.

### Producción y despliegue

- Preparación completa para despliegue en Vercel.
- Build de producción validado.
- Dominio principal configurado:
  - `10thegoat.com`
  - `www.10thegoat.com`
- HTTPS / SSL activo.
- Configuración DNS realizada desde Arsys.
- Proyecto desplegado inicialmente también en Vercel.

### SEO

Añadidos:

- Metadata general.
- Open Graph.
- Imagen OG 1200×630.
- Favicon.
- `sitemap`.
- `robots`.

### Páginas de sistema

Añadidas:

- Página 404.
- Página de error.
- Página Beta.

### Legal

Añadidas páginas preliminares:

- Privacidad.
- Cookies.
- Aviso legal.

> Antes de una publicación comercial definitiva deben completarse con los datos legales reales correspondientes.

### Seguridad

- Headers de seguridad.
- Revisión para evitar secretos en código cliente.
- Comprobaciones de producción.

---

## v0.11.1-beta.1

### Sistema de clubes jugables

Se separó por completo:

- Clubes almacenados en la base de datos.
- Clubes habilitados para aparecer en juegos.

Nueva columna:

```sql
clubs.is_game_eligible
```

Migración:

```text
supabase/migrations/20260831_005_club_game_eligibility.sql
```

La migración:

- Añade `is_game_eligible boolean`.
- Valor por defecto: `false`.
- No elimina clubes existentes.
- Añade índice para clubes jugables.

### Importador de clubes por liga

Nuevo script:

```text
scripts/import-game-clubs.mjs
```

Objetivo:

Evitar importar todos los clubes de un país con `/teams?country=...`, ya que eso devolvía también clubes regionales, históricos o poco relevantes para el juego.

El nuevo sistema importa exclusivamente los participantes de ligas configuradas.

### Países configurados

Primera + Segunda División:

- España
- Inglaterra
- Alemania
- Italia
- Francia
- Portugal
- Países Bajos
- Bélgica
- Escocia
- Turquía
- Brasil
- Argentina

Solo Primera División:

- Uruguay
- Chile
- Polonia

Total configurado:

```text
27 ligas
```

El script utiliza aproximadamente una petición API-Football por liga.

### Comportamiento del importador

Orden de identificación de clubes:

1. `club_external_ids` mediante ID de API-Football.
2. Nombre normalizado + país.
3. Creación de un nuevo club.

Para los clubes encontrados:

- Actualiza nombre.
- Actualiza escudo.
- Actualiza año de fundación.
- Marca el club como activo.
- Marca `is_game_eligible = true`.
- Crea el mapping externo si falta.

Antes de reconstruir un país:

- Los clubes no nacionales del país pasan a `is_game_eligible = false`.
- Solo los participantes actuales de las ligas seleccionadas vuelven a `true`.

Esto evita tener que borrar clubes antiguos o de categorías inferiores.

### Protección de datos

El script no borra los clubes simplemente por no ser jugables.

Los clubes pueden seguir siendo útiles en el futuro para:

- Carreras de jugadores.
- Históricos.
- Traspasos.
- Football Grid.
- Modo Carrera.
- Estadísticas.

### Rate limit

El importador incorpora control de límite de API:

- Pausa entre peticiones.
- Detección de `429`.
- Detección del error `rateLimit`.
- Espera automática.
- Reintentos.

---

## v0.11.2-beta.1

### Mayor o Menor — exclusión de porteros

Cambio específico de gameplay.

Los porteros dejan de poder aparecer en **Mayor o Menor**.

El juego consulta la posición principal del jugador y excluye posiciones reconocidas como:

- Goalkeeper
- Keeper
- GK
- Portero
- Goalie

Los jugadores sin posición informada no se eliminan automáticamente para evitar perder futbolistas por registros incompletos.

Archivo afectado:

```text
components/games/HigherLowerGame.tsx
```

No requiere migración de base de datos.

---

# Base de datos

La base de datos principal de 10theGOAT utiliza IDs internos propios.

Los IDs de proveedores externos se mantienen únicamente como mappings.

Tablas principales:

- `countries`
- `clubs`
- `competitions`
- `players`
- `player_external_ids`
- `club_external_ids`
- `competition_external_ids`
- `player_club_seasons`
- `player_season_stats`
- `player_transfers`
- `player_honours`
- `media_assets`
- `sync_state`

---

## Campos relevantes

### Jugadores

Entre otros:

```text
players.game_name
players.photo_url
players.primary_position
```

### Clubes

Entre otros:

```text
clubs.badge_url
clubs.is_active
clubs.is_national_team
clubs.is_game_eligible
```

---

# Migraciones Beta

Migraciones relevantes hasta esta versión:

```text
20260830_001_core_schema.sql
20260830_002_career_views.sql
20260830_003_competition_participant_type.sql
20260830_004_player_game_name.sql
20260831_005_club_game_eligibility.sql
```

---

# Variables de entorno

El proyecto requiere un archivo local:

```text
.env.local
```

Variables utilizadas:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SECRET_KEY=
API_FOOTBALL_KEY=
```

> Nunca deben subirse las claves reales al repositorio.

`.env.local` debe permanecer en `.gitignore`.

---

# Importación de clubes

Importar todos los países configurados para la temporada 2026:

```powershell
node --env-file=.env.local scripts/import-game-clubs.mjs --season=2026
```

Importar únicamente países concretos:

```powershell
node --env-file=.env.local scripts/import-game-clubs.mjs --countries=Spain,England --season=2026
```

Ejemplo para Uruguay, Chile y Polonia:

```powershell
node --env-file=.env.local scripts/import-game-clubs.mjs --countries=Uruguay,Chile,Poland --season=2026
```

Dry run:

```powershell
node --env-file=.env.local scripts/import-game-clubs.mjs --season=2026 --dry-run
```

Mantener clubes previamente elegibles:

```powershell
node --env-file=.env.local scripts/import-game-clubs.mjs --season=2026 --preserve-eligible
```

---

# Sistema de puntuación

La Beta utiliza puntuación local mediante:

```text
lib/game-scores.ts
```

Storage:

```text
10tg-game-scores-v1
```

Actualmente:

- Se guardan puntuaciones por juego.
- Existe un total global.
- El sistema está preparado para evolucionar posteriormente hacia usuarios, rankings y persistencia online.

---

# Identidad visual

Estilo general:

- Fondo oscuro.
- Blanco.
- Verde lima/neón.

Paleta principal:

```text
#0D0D0D
#FFFFFF
#A8FF00
#76C900
```

La identidad utiliza un escudo con la marca **10theGOAT** y una estética deportiva/esports.

---

# Estado actual

### Funcional

- Mayor o Menor
- Adivina el Jugador
- Adivina el Escudo
- Base de datos central
- Importación de jugadores
- Importación curada de clubes
- Sistema local de puntuación
- SEO
- Dominio
- HTTPS
- Deploy en Vercel
- Responsive / mobile-first

### En desarrollo

- Football Grid
- Modo Carrera
- Mi XI
- Usuarios
- Ranking global
- Persistencia online de puntuaciones
- Mayor curación de datos
- Contenido legal definitivo

---

# Comprobación antes de commit

Ejecutar:

```powershell
npm run build
```

Si el build termina correctamente:

```powershell
git status
git add .
git commit -m "feat: update 10theGOAT beta to v0.11.2"
git push
```

---

# Versión

```text
10theGOAT
v0.11.2-beta.1
```

**Juegos de fútbol online.**
