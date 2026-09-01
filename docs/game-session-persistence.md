# Persistencia de partidas en sesión

Los tres juegos activos guardan su ronda en `sessionStorage` con claves separadas y un sobre versionado (`10tg-game-session-v1:<juego>`). El almacenamiento contiene solo identificadores de jugadores, cartas o clubes y el progreso imprescindible; los datos futbolísticos se vuelven a resolver contra Supabase al montar la ruta.

## Comportamiento

- Cambiar entre ES, EN y FR conserva la ronda y únicamente cambia ruta y textos.
- Adivina el jugador mantiene una ronda independiente para Fácil, Difícil e Imposible. Cambiar de dificultad restaura objetivo, fila, entrada, intentos, pista y resultado de esa dificultad.
- «Jugar otra» sustituye solo la ronda activa.
- Mayor o Menor conserva las dos cartas, revelación, racha, premio de ronda y fin de partida.
- Adivina el Escudo conserva objetivo, respuestas, entrada, pixelado y resultado.
- Los estados inválidos, corruptos o referidos a registros que ya no existen se descartan de forma segura y generan una ronda nueva.

La puntuación acumulada continúa en `localStorage`. Al leerla se normalizan a cero valores negativos o no numéricos, y cualquier resta aplica suelo cero. Los bloqueos de acción impiden liquidar dos veces una misma respuesta, victoria o rendición mediante pulsaciones rápidas.

## Integración

Esta rama parte de `origin/main` en `12d159c`, que ya incluye el responsive publicado mediante el PR #2. En el momento de crearla, `origin/develop` seguía en `7599b45`. La base segura para integrar es `origin/main` (o actualizar primero `develop` con `main`); no se debe rebasar esta rama sobre el `develop` atrasado si eso elimina el responsive.

## Validación manual recomendada

1. Fácil → Imposible → Fácil, comprobando objetivos y progreso independientes.
2. Rendición con otra dificultad en progreso y saldo menor de 20.
3. Victoria y «Jugar otra»; pista separada por dificultad.
4. ES → EN → FR → ES en los tres juegos, durante la ronda y tras terminar.
5. Recarga en la misma pestaña/sesión.
6. Vista móvil y escritorio, sin overflow ni errores de consola.
