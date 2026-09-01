# 10theGOAT — v0.11.6-beta.1

- Normaliza GK/keeper/goalie/portero a `Goalkeeper`.
- El importador normaliza posiciones futuras.
- Mayor o Menor usa solo `Attacker`.
- Jugadores activos: solo entran si generan una carta desde `player_season_stats` con `appearances > 0`.
- Jugadores retirados: además deben tener `is_legend = true`.
- Como el juego compara goles por temporada, una leyenda sin estadísticas no puede aparecer hasta que tenga estadísticas cargadas.

Primero ejecuta la migración 008 en Supabase y luego prueba localmente.
