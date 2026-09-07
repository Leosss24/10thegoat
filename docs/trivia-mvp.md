# TRIVIA

Implementado sobre `dc31d40e6d55b317ac181740b70fb3395b72ff05` (referencia local `origin/main` al iniciar el trabajo).

## Reglas

- Fácil y difícil: 200 preguntas distintas por modo (400 en total), cuatro opciones y una respuesta correcta.
- Sin cronómetro. El primer fallo termina la partida; el resumen muestra racha, puntos ganados, preguntas respondidas, precisión y solución de la última pregunta.
- Preguntas y opciones barajadas. Se conserva el orden al recargar o cambiar de idioma. Después de completar el banco de la partida se baraja otra vuelta sin repetir inmediatamente la última pregunta: completar el banco no termina la partida.
- Misma fórmula que `HigherLowerGame`: superar el récord personal otorga `nueva racha × 10`. Igualar un récord anterior no da puntos. Fácil y difícil tienen récords independientes.
- Ejemplo: con récord 3, los tres primeros aciertos no suman; el cuarto suma 40 y el quinto 50. Fallar después conserva los 90 puntos.
- Se reutilizan `addGamePoints` y `recordGameResult`: cada récord incrementa el contador de éxitos existente y cada fallo registra una partida. No se modifica la semántica de otros juegos.

## Integración y persistencia

TRIVIA sustituye a Mi XI en el segundo portal, el menú móvil y el catálogo. Se añade `/[locale]/juegos/trivia`, metadatos localizados y sitemap. La antigua ruta de Mi XI permanece como placeholder para no romper enlaces existentes.

La sesión usa `10tg-game-session-v1:trivia`, con un sobre de versión 1, versión del banco y rondas independientes. Se guardan IDs, orden, respuesta, racha y premios, nunca textos localizados. Los estados corruptos o incompatibles se descartan. Las acciones se bloquean para impedir dobles respuestas o saltos por doble clic. Si el almacenamiento está bloqueado, se informa y se permite seguir jugando en memoria.

Las estadísticas utilizan `trivia-easy` y `trivia-hard` dentro del almacén local compartido `10tg-game-scores-v1`. El panel de usuario ya sincroniza todas las claves mediante `sync_own_game_stats` y ahora muestra nombres localizados para ambos modos. Contribuyen a los logros generales de partidas, éxitos y puntos. No hay tablas nuevas, migraciones ni cambios en autenticación.

Se mantiene el comportamiento existente: la sincronización se realiza al cargar el panel de usuario; no se añade una clasificación pública ni validación competitiva de respuestas en servidor. El banco es visible en el cliente, apropiado para el modelo local del MVP.

## Banco editorial

`data/trivia/questions.json` es la fuente de verdad. Cada entrada tiene `id`, `difficulty`, `category`, `prompt`, cuatro `options`, `correctOptionId`, `explanation` y `source`. Los textos son objetos ES/EN/FR; los nombres propios pueden coincidir entre idiomas. Las opciones se identifican por ID, no por su posición visual.

Los enunciados son originales y se basan en hechos históricos fechados. Incluyen palmarés, finales, sedes, goleadores, entrenadores, fichajes y selecciones. Las referencias incluyen los archivos de UEFA, Premier League, clubes y tablas históricas/biografías de Wikipedia; cada pregunta enlaza su fuente. Las preguntas de selecciones se anclan a torneos concretos para evitar ambigüedades con jugadores retirados o que cambiaron de selección.

Para editar: conservar IDs y revisar las tres traducciones, una única respuesta válida y tres distractores distintos. Al retirar IDs o cambiar el significado de una respuesta, incrementar `bankVersion` en motor y componente, y actualizar las pruebas de versión. Una ampliación que solo añade preguntas conserva las partidas anteriores: siguen con su banco original hasta terminar, y las nuevas partidas incluyen todo el banco ampliado. Los cambios del JSON requieren desplegar la aplicación.

## Validación

- `npm test`: 38 pruebas, incluidas ocho de TRIVIA que verifican el banco completo, puntuación, primer fallo, respuestas duplicadas, ciclo de 200, persistencia, ampliación del banco y datos corruptos.
- `npm run build`: build de producción con rutas ES/EN/FR generado correctamente. Requiere acceso a Google Fonts por la fuente Geist preexistente.
- `scripts/test-trivia-ui.cjs`: prueba real de navegador con Playwright; cubre 1440 px, 390 px y 320 px, cambios de idioma, recarga, cambio de dificultad, dobles clics, resumen, récords, navegación, teclado y almacenamiento bloqueado. Capturas en `tmp/trivia-*.png`.
- Revisión visual de inicio, pregunta y resumen en escritorio y móvil, sin desbordamiento horizontal.

Para ejecutar la prueba de navegador, arrancar la aplicación y disponer de Playwright/Chromium. `TRIVIA_BASE_URL` permite cambiar la URL (por defecto `http://localhost:3100`), `TRIVIA_PLAYWRIGHT_MODULE` permite usar un paquete externo y `TRIVIA_BROWSER_CHANNEL=msedge` permite utilizar Edge instalado. Ejecutar `node scripts/test-trivia-ui.cjs` desde la raíz del repositorio.

El worktree no dispone de credenciales de Supabase: se ha comprobado la compatibilidad con su contrato SQL y el panel existente, pero no se ha realizado una sesión OAuth ni una escritura contra una cuenta real.
