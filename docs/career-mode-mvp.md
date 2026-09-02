# Modo Carrera y logros — primera aproximación

## Alcance jugable

La carrera comienza siempre a los 15 años. El usuario elige nombre, dorsal, nacionalidad europea o sudamericana, posición específica y club formador de su país. Cada acción simula una temporada completa y permite priorizar desarrollo, minutos, visibilidad, recuperación o familia. Después pueden aparecer traspasos, cesiones y regresos al país. La retirada es voluntaria desde los 32 años y obligatoria al cumplir 40.

El motor genera rol, minutos, estadísticas por posición, progresión y declive por edad, lesiones, situaciones familiares, convocatorias, títulos, ofertas y legado. Una condición latente normal/alta/crack/generacional se sortea con una semilla estable. No se revela al usuario: se manifiesta mediante minutos y rendimiento juvenil.

## Prestigio, ligas y formación

Prestigio (`premium_europe`, `elite_europe`, `premium_south_america`, `elite_south_america`, `standard`), fuerza de liga y academia son dimensiones independientes. Benfica, Sporting CP, Porto, Ajax y PSV son Élite Europa. Peñarol y Nacional son Premium Sudamérica pero compiten en el segundo grupo sudamericano; Danubio y Defensor Sporting son estándar con formación excelente.

Europa usa tres bandas manuales (Inglaterra/España; Alemania/Italia/Francia; Portugal/Países Bajos/Bélgica) y un cuarto grupo extensible mediante instantáneas UEFA versionadas. Sudamérica separa Argentina/Brasil del resto. Esta versión no extrae ni escribe rankings automáticamente: los perfiles son una instantánea local revisable y solo se cruzan con Supabase para recuperar ID, nombre y escudo.

La progresión combina edad, potencial latente, formación, minutos, rendimiento y estado físico. Por debajo de 500–1000 minutos un joven puede estancarse. Las academias Premium aceleran el techo, pero su competencia reduce los minutos salvo que el jugador irrumpa de forma excepcional.

## Datos y simulación

El cliente lee clubes, países y escudos existentes de Supabase. No llama API-Football ni escribe datos simulados en Supabase. Si la configuración o los datos no están disponibles, utiliza un pequeño catálogo ficticio incluido en la aplicación. Partidos, ofertas, clasificaciones, lesiones, títulos y convocatorias son simulados localmente.

## Arquitectura

- `lib/career/engine.ts`: reglas puras, sin React, navegador ni Supabase.
- `lib/career/storage.ts`: adaptador local versionado. Puede sustituirse por un repositorio Supabase en los puntos 6/7.
- `lib/achievements.ts`: definiciones y evaluación idempotente por identificador estable.
- `lib/career/clubs.ts`: frontera de lectura de datos reales y fallback local.
- `components/games/CareerModeGame.tsx`: presentación y traducciones ES/EN/FR.

El sobre `10tg-career-v2` contiene `schemaVersion`, fecha de guardado y estado. JSON corrupto, versiones desconocidas o estados fuera de los límites se rechazan sin impedir iniciar otra partida. Los nombres y perfiles de club se guardan como snapshots para que una carrera sobreviva a cambios del catálogo.

## Futuras iteraciones

El balance, eventos narrativos, generación de nivel de clubes, competiciones reales, múltiples guardados y detalle contractual quedan aislados para revisión. Autenticación, sincronización y persistencia por usuario no forman parte de este MVP.
