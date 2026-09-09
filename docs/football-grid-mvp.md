# Football Grid · reglas y activación

## Puntuación proporcional

Ejecutar en el SQL Editor de Supabase, después de la migración 014 ya aplicada:

**supabase/migrations/20260909_015_football_grid_scoring.sql**

La migración 015 fue ejecutada por el usuario y sus columnas se verificaron en Supabase el 9 de septiembre de 2026. No volver a ejecutar 014. La migración 015 es transaccional y admite repetición; no modifica los puntos ni las victorias ya obtenidos. Las rondas anteriores conservan su duración y premio originales mediante rules_version=1. Las nuevas usan rules_version=2. La interfaz impide iniciar rondas nuevas si la actualización del servidor no está disponible.

## Reglas

- Cuadrícula 4×4: 16 futbolistas diferentes, buscador con autocompletado y sin límite de respuestas incorrectas.
- Fácil: nacionalidad × club o nacionalidad × posición. Empieza con **5.000 puntos disponibles**.
- Difícil: club × club. Empieza con **10.000 puntos disponibles**.
- Ambos modos tienen un máximo de **10 minutos**. La interfaz muestra puntos disponibles en lugar de una cuenta atrás.
- Premio al completar: **suelo(puntos iniciales × tiempo restante / 600 segundos)**. El reloj de PostgreSQL calcula el premio; no se aceptan tiempos ni puntuaciones enviados por el cliente.
- Ejemplos a los 2 / 5 / 9 minutos: fácil 4.000 / 2.500 / 500 puntos; difícil 8.000 / 5.000 / 1.000.
- A los 10 minutos termina la partida con 0 puntos. No hay puntos parciales. El redondeo hacia abajo puede dejar 0 puntos en las últimas fracciones de segundo.
- Rendirse resta **20 en fácil o 50 en difícil**, con saldo mínimo cero por modo. Rendirse antes de expirar no consume el cupo diario; hacerlo tras el vencimiento cuenta como timeout.
- Tres partidas diarias por cuenta y dificultad. Completar o agotar el tiempo consume una. El día se fija al empezar, zona Europe/Madrid, con reinicio a medianoche. Salir, recargar o cambiar de idioma no detiene la pérdida de puntos.
- Se puede cambiar una respuesta ya colocada para resolver cruces con jugadores compartidos, sin repetir un jugador simultáneamente.
- País significa nacionalidad; club exige al menos un partido oficial del primer equipo. Ni fichajes, ni cantera, ni amistosos bastan. Posiciones: portero, defensa, centrocampista y delantero.

## Rachas, récords e historial

Se guardan por dificultad en user_game_stats: racha actual, mejor racha y mejor tiempo de resolución en milisegundos. Una victoria suma uno a la racha; rendirse o expirar la rompe. Las respuestas incorrectas y el cambio de día no la rompen. El mejor tiempo solo procede de victorias. La migración reconstruye estos datos desde los resultados históricos sin recalcular sus premios.

Cada ronda conserva duración, puntuación, resultado y racha posterior. El RPC devuelve las diez últimas rondas terminadas de esa cuenta y dificultad. Los récords y logros aparecen en el juego y Mi zona. Se mantienen los logros de primera victoria por modo, ambos modos y diez grids; se añaden tres victorias consecutivas y resolver un grid en cinco minutos o menos.

RLS impide escrituras directas y cada acción toma un bloqueo transaccional por cuenta. Las respuestas repetidas no vuelven a premiar ni cambiar rachas. La sincronización antigua de otros juegos no puede sobrescribir resultados del Grid.

## Catálogo y auditoría de trayectorias

El conjunto elegible son las 43 leyendas de Supabase más Messi (excepción solo para Grid), y jugadores de las plantillas consultadas de los 26 clubes europeos Premium Internacional y Élite Internacional de Carrera. No se añaden plantillas actuales no europeas. Fácil usa clubes europeos; difícil permite los 45 clubes mundiales de ambas categorías si existe un tablero resoluble.

La revisión del 9 de septiembre de 2026 recorrió los **789 jugadores** mediante Players/Teams de API-Football y contrastó cada club permitido omitido con estadísticas por temporada. Confirmó **234 relaciones omitidas en 175 jugadores**. Cucurella–Barcelona se añadió además mediante el informe oficial del Barça de su debut en Copa. Se guardan fuentes, temporadas y apariciones en api-appearances.json y verified-appearances.json; history-audit.json conserva la revisión completa y los casos no acreditados por la API.

No acreditar un club en el proveedor no demuestra que el jugador nunca disputara un partido allí. La revisión distingue estos casos de la cantera y los amistosos, y admite evidencia editorial con fuente. Los 134 casos no acreditados por API incluyen estas relaciones y Cucurella, resuelto documentalmente. No se afirma cobertura histórica absoluta.

Resultado: **789 jugadores, 44 leyendas y 300 tableros** (100 por variante). 702 jugadores tienen al menos un club permitido acreditado; los otros 87 sirven para nacionalidad × posición. Hay 16 tableros difíciles con clubes no europeos. River conserva trayectorias válidas pero no aparece aún en este banco de tableros completos.

Catálogo corregido **309abc085804a7fa**, ya publicado y verificado en Supabase. Las rondas iniciadas con versiones anteriores conservan sus respuestas originales.

El cliente carga data/football-grid/catalog.json y Supabase conserva la misma versión en JSONB para validar. No hay llamadas a API-Football durante una partida. Fotos y escudos se cargan desde URLs. Conservar catálogos anteriores permite terminar rondas existentes.

Fuentes de los casos documentales: [Cucurella](https://www.fcbarcelona.com/en/football/first-team/news/1702077), [Dembélé](https://players.fcbarcelona.com/en/player/2664-dembele-ousmane-dembele). La auditoría utiliza los [endpoints de historial del proveedor](https://www.api-football.com/news/post/api-football-new-release-available).

## Regeneración

1. scripts/export-football-grid.mjs lee Supabase y exporta la instantánea.
2. scripts/prepare-football-grid-pool.mjs consulta plantillas/perfiles y genera SQL de datos y vista previa. Las nuevas identidades se reservan con protección contra conflictos; si un ID ya fue ocupado, reexportar y regenerar, sin saltarse la comprobación.
3. scripts/audit-football-grid-history.mjs revisa trayectorias, reutiliza caché y guarda evidencias. Una auditoría incompleta bloquea el constructor.
4. scripts/build-football-grid.mjs --snapshot=tmp/football-grid-enriched.json genera el catálogo y prueba que cada tablero admite 16 respuestas distintas.
5. scripts/seed-football-grid.mjs genera el seed de catálogo.

Usar node --experimental-strip-types; los scripts que acceden a proveedores admiten --env=RUTA. La configuración y las respuestas privadas permanecen fuera de Git. La auditoría conserva las evidencias previas al repetirse. scripts/publish-football-grid-catalog.mjs permite publicar un catálogo validado con --expected=VERSION y --apply; verifica el JSONB antes de activar y restaura el catálogo anterior si falla la activación. No sustituye una migración SQL.

## Verificación local

- npm test: 54 pruebas de juegos, catálogo, ejemplos positivos/negativos y fórmula proporcional.
- scripts/test-football-grid-db.mjs: 23 comprobaciones SQL de RLS, aislamiento, reloj, cuota, idempotencia, puntuación y sincronización antigua.
- scripts/test-football-grid-scoring.mjs: 24 comprobaciones SQL de fórmula exacta, límites, rachas, historial, récords y migración compatible con rondas anteriores.
- Build de producción con TypeScript y rutas ES/EN/FR.
- scripts/test-football-grid-ui.mjs: interfaz real contra PostgreSQL local, escritorio/390/320 px, tres idiomas, autocompletado, puntos decrecientes sin contador de tiempo, recarga, dos pestañas, rendición, expiración, quota y recuperación de red. No juega partidas ni altera cuentas reales.

La base de pruebas usa PGlite en tmp/grid-test. Las capturas locales están en tmp/grid-*.png. Las nuevas columnas y el catálogo están verificados en producción. Las partidas autenticadas se probaron con PostgreSQL local; la comprobación con una cuenta real queda para el usuario.
