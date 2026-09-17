# Retos semanales de Trivia

## Entrega

Página de catálogo: `/es/juegos/trivia/retos` (también `/en` y `/fr`). Entrada desde Trivia, incluso con una partida clásica en curso.

El único origen de contenido es `data/trivia/challenges.json`. Contiene cinco retos de 25 preguntas (125 en total): Mundiales, Champions League, Premier League, La Liga y Eurocopa. Incluye título, descripción, orden semanal, versión, dificultad por pregunta, opciones, solución, explicación y fuente. Todo está traducido al español, inglés y francés.

Las preguntas son de dificultad editorial media/alta; ese nivel no está calibrado aún con resultados de jugadores. Se refieren a hechos históricos y temporadas concretas para evitar récords que caduquen.

## Lanzamiento: solo Mundiales

`launchDate` es `2026-09-17` en el JSON, fecha del lanzamiento autorizado. El día de salida solo está disponible Mundiales.

La variable opcional `TRIVIA_CHALLENGES_LAUNCH_DATE=YYYY-MM-DD` tiene prioridad sobre el JSON. Sin esa variable se usa la fecha del catálogo. Si ambas fechas faltan o son inválidas, los cuatro retos futuros permanecen cerrados.

- Semana 0: Mundiales, disponible desde el inicio.
- Semana 1: Champions, el primer lunes estrictamente posterior al lanzamiento.
- Semana 2: Premier League, el lunes siguiente.
- Semana 3: La Liga.
- Semana 4: Eurocopa.

Las aperturas se producen a las 00:00 de Europe/Madrid, considerando horario de verano e invierno. Si se lanza un lunes, Champions se abre siete días después. Las fechas aparecen en las tarjetas cuando se ha configurado el lanzamiento. Los retos ya abiertos siguen disponibles.

No hay cron ni base de datos. Las dos rutas nuevas se renderizan dinámicamente en cada petición: no dependen de una compilación semanal. Una página que permaneciese abierta desde el domingo necesita recargarse para actualizar su estado.

## Aislamiento del contenido

`challenge-catalog.server.ts` usa `server-only`. El JSON completo no se importa desde componentes cliente ni se coloca en `public`. El catálogo envía solo las tarjetas renderizadas; un reto bloqueado no envía preguntas ni respuestas, ni siquiera entrando por su URL. Solo las preguntas del reto desbloqueado seleccionado llegan a su componente interactivo.

Los resultados son locales, no una clasificación competitiva verificada. Las soluciones de un reto abierto pueden inspeccionarse en el navegador. El resultado compartido no otorga puntos al ranking general.

## Partidas y compatibilidad

Cada reto tiene URL permanente y una clave de progreso distinta por identificador y versión. Se conserva el avance entre idiomas, además de mejor marca local, mejor racha, intento, resultado sobre 25 y distintivo de pleno. Repetir conserva preguntas y opciones.

Mundiales pasa a versión 2: el prototipo de diez preguntas no se carga como partida de 25. No se borra la clave antigua del navegador. Tras publicar una edición, conservar sus preguntas o incrementar su versión si hay correcciones incompatibles.

Compartir abre el diálogo nativo si está disponible, copia texto y enlace como alternativa y ofrece texto seleccionable si el portapapeles falla. Cancelar el diálogo nativo no copia nada. En local, los enlaces compartidos apuntan a localhost.

## Validación

- `npm test`: incluye esquema y traducciones de las 125 preguntas, reglas de partida, fechas inválidas, primer lunes, cambio de año y cambios de hora de Madrid.
- `npm run build`: las rutas de retos deben figurar como dinámicas.
- `npm run start -- --port 3210` y `node scripts/test-trivia-challenge.mjs`: Edge, catálogo con un reto abierto, URLs bloqueadas, caché privada, partida 25/25, recarga, repetición, idiomas, compartir y ancho móvil.
- Comprobar que las preguntas futuras no están en `.next/static`.

Lanzamiento autorizado para el 17/09/2026. Aperturas previstas: Champions 21/09, Premier League 28/09, La Liga 05/10 y Eurocopa 12/10, a las 00:00 de Europe/Madrid.
