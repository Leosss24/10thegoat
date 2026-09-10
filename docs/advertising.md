# Publicidad: primera fase de AdSense

Alcance acordado: banners manuales, CMP de Google y medición exclusiva en el panel de AdSense. Sin vídeo propio, anuncios flotantes, intersticiales, seguimiento de partidas ni refresco automático. La integración viene **apagada** y no contiene identificadores reales. No se ha solicitado aprobación, configurado una cuenta ni desplegado publicidad.

## Distribución

| Página | Espacios | Variables de unidad |
| --- | --- | --- |
| Portada ES/EN/FR | Antes y después de la arena | `ADS_SLOT_HOME_TOP`, `ADS_SLOT_HOME_BOTTOM` |
| Catálogo ES/EN/FR | Después del título y después del catálogo | `ADS_SLOT_CATALOG_TOP`, `ADS_SLOT_CATALOG_BOTTOM` |
| Nueve juegos ES/EN/FR | Después de la introducción y después del componente de juego | `ADS_SLOT_GAME_TOP`, `ADS_SLOT_GAME_BOTTOM` |
| Cuenta, páginas legales, Beta, juego pendiente y errores | Ninguno | — |

Las mismas seis unidades se comparten entre idiomas. La unidad inferior de juego está fuera del tablero y puede verse al desplazarse; no depende del resultado ni espera obligatoriamente al final de la partida. No se añaden eventos de juego para publicidad. El límite inicial es dos espacios por página. No se insertan dentro de respuestas, teclados, modales ni controles.

El tamaño se reserva desde el HTML, también si no hay consentimiento, inventario o el proveedor falla. Los tamaños CSS son 250×100 para pantallas estrechas, 320×100 a partir de 380 px y 468×60 desde 600 px. Portada y catálogo usan 728×90 desde 1050 px; los juegos conservan 468×60 para caber en sus paneles. No hay recorte de creatividades. Los espacios vacíos no se colapsan para evitar saltos de contenido. Estos tamaños siguen la modificación de código CSS documentada por Google; no se usa `data-ad-format="auto"` ni expansión a ancho completo.

## Configuración y publicación

Las variables se leen en el servidor. Las páginas estáticas capturan la configuración al compilar: **hay que reconstruir y desplegar después de cualquier cambio**, también para apagar anuncios.

| Variable | Valor inicial | Uso |
| --- | --- | --- |
| `ADS_MODE` | `off` | `off`: sin espacios ni script; `preview`: solo maquetas locales; `live`: candidato a publicidad real |
| `ADS_DEPLOYMENT` | `development` | Solo `production` permite modo real |
| `ADS_CMP_READY` | `false` | Cambiar a `true` únicamente después de completar la configuración externa y revisión descritas abajo |
| `ADSENSE_CLIENT_ID` | vacío | Identificador público real `ca-pub-` seguido de 16 dígitos; no es una contraseña |
| `ADS_VERIFICATION_ENABLED` | `false` | Publica la etiqueta de verificación y `/ads.txt`, incluso con anuncios apagados |
| `ADS_SLOT_*` | vacías | Seis IDs de unidad de 10 dígitos. Una unidad vacía o inválida no se renderiza en modo real |

Para publicidad real también se exige `NODE_ENV=production`, que `VERCEL_ENV` no sea preview/development, y que el navegador esté exactamente en `https://10thegoat.com` o `https://www.10thegoat.com`. No se acepta un subdominio de preview, otro puerto, HTTP, localhost o una URL de Vercel. El bloqueo del origen ocurre antes de insertar el script; no basta con ocultar anuncios con CSS.

### Pasos externos pendientes del propietario

1. Crear una cuenta de **AdSense para sitios web**, añadir `10thegoat.com` y completar las comprobaciones que Google solicite para titular, pagos y sitio. La aprobación no está garantizada. No hacen falta claves privadas en el repositorio.
2. Añadir el ID real y activar `ADS_VERIFICATION_ENABLED=true`, manteniendo `ADS_MODE=off`. Reconstruir y desplegar. Verificar la etiqueta `google-adsense-account` y que `/ads.txt` devuelve la línea exacta de vendedor directo. Compararla con la que muestra la cuenta. La ruta no redirige a un idioma; sin ID válido devuelve 404.
3. **Desactivar Auto ads y Auto optimize**, incluidos experimentos que puedan activarlos y optimización automática de unidades existentes. Desactivar anclas, viñetas, formatos que se superponen y ad intents. Esto se configura en Google: el script podría añadir esos formatos si se habilitan allí aunque nuestro código no los solicite.
4. Crear seis unidades de display responsivas con los nombres de la tabla y copiar sus IDs. La apariencia de cada creatividad pertenece a Google; no se puede inspeccionar ni silenciar desde el sitio un iframe de otro origen. Revisar los controles de creatividades disponibles y el centro de revisión de anuncios antes de activar. No habilitar inventario de vídeo ni audio; si la cuenta no puede garantizar la restricción de sonido solicitada, mantener la integración apagada hasta resolverlo con el proveedor.
5. En **Privacidad y mensajes**, crear y publicar el mensaje europeo para el sitio: aceptar, rechazar en la primera pantalla y gestionar opciones; configurar ES, EN y FR y las URLs de privacidad correspondientes. La CMP debe estar publicada antes de servir anuncios. El código AdSense despliega la CMP: no hace falta añadir otro SDK de consentimiento ni Google Analytics.
6. Revisar la cobertura del mensaje según los países reales de lanzamiento, incluidos Reino Unido, Suiza, países latinoamericanos y, si se sirve allí, los estados de EE. UU. Configurar los mensajes regionales necesarios, proveedores/finalidades y enlaces de exclusión de venta/compartición que ofrece Google. No se deduce la jurisdicción de ES/EN/FR. No se sobrescribe el enlace regional automático de Google. Valorar la segmentación global del mensaje según las obligaciones del titular.
7. Completar las páginas legales ES/EN/FR con identidad, domicilio/contacto del responsable, bases jurídicas, conservación, transferencias, ejercicio de derechos y el inventario real de cookies. El código actualiza cuentas, almacenamiento y publicidad, pero no inventa datos del titular ni sustituye esa revisión. Auditar también Supabase y el alojamiento. El público general puede incluir menores: revisar restricciones por edad y categorías sensibles, sin inferir edad o género de la navegación.
8. Solo con aprobación del sitio, CMP publicada y verificaciones externas resueltas, establecer `ADS_MODE=live`, `ADS_DEPLOYMENT=production`, `ADS_CMP_READY=true`, IDs reales y reconstruir/desplegar. La activación externa no forma parte de las pruebas automatizadas.

## Consentimiento y comportamiento

`AdsProvider` carga una sola vez el bootstrap oficial, después de hidratar y únicamente en los orígenes autorizados. Este script permite a Google mostrar su CMP y puede hacer peticiones técnicas antes de una decisión. No se promete ausencia total de contacto con Google en modo real antes del consentimiento.

Las solicitudes de **nuestras unidades** esperan a que la API TCF comunique un estado válido y terminado. Un error, ausencia de CMP o diálogo pendiente deja los espacios vacíos. Cuando aplica GDPR se requiere consentimiento para almacenamiento (finalidad 1) y Google (proveedor 755); Google sigue evaluando el resto de señales TCF/GPP y las condiciones para servir o personalizar cada anuncio. Estos dos permisos no se interpretan como consentimiento para todas las finalidades.

La opción «Preferencias de privacidad» del pie y de privacidad/cookies vuelve a abrir la CMP oficial. Al abrirla o revocar se retiran las unidades del DOM y se suspenden nuevas solicitudes. No se regeneran unidades ya solicitadas en esa ruta; después de cambiar la decisión se pueden servir unidades en la siguiente navegación. No se guarda un consentimiento paralelo en localStorage. Si el panel falla se muestra un mensaje accesible, sin bloquear juegos.

Cada espacio se solicita como máximo una vez por montaje de ruta, cuando entra en pantalla con la pestaña visible. Las actualizaciones de puntuaciones, rondas y temporizadores no recargan anuncios. Una navegación real entre rutas crea nuevas unidades y mantiene una sola carga del SDK. Google controla internamente sus creatividades; el código no añade mecanismos de refresco.

## Desarrollo y pruebas sin impresiones reales

Para ver la distribución, poner `ADS_MODE=preview` en `.env.local` y ejecutar `npm run dev`. Se muestran maquetas localizadas sin script, cookies o peticiones a Google. `off` restaura el diseño sin espacios publicitarios.

Comandos:

```sh
npm ci
npm run lint
npm test
npm run build
npm run test:ads:browser
```

La suite de navegador usa Microsoft Edge instalado y los puertos 3100/3101. Ejecutarla mediante `npm run test:ads:browser`, que prepara una compilación con identificadores ficticios, ejecuta Playwright y deja una compilación final con publicidad/verificación apagadas. No desplegar la compilación intermedia. La suite intercepta **todo** el tráfico del navegador: mapea `https://10thegoat.com` al servidor local y sustituye Google por un simulador; el resto de servicios externos se bloquea. No hay consultas al dominio de producción ni anuncios reales. Capturas y trazas quedan en `test-results/`.

Las pruebas cubren configuración segura, dominio, validación de IDs, ads.txt, consentimiento desconocido/rechazado/aceptado/retirado, carga diferida, fallo del proveedor, navegación y ausencia de refresco durante el juego. La matriz responsive usa 320, 390, 768 y 1440 px, los tres idiomas y los nueve juegos. Los juegos dependientes de Supabase se revisan en su estado sin configuración; Trivia permite ejercitar una ronda local. La CMP y las creatividades reales no pueden validarse hasta tener una cuenta configurada.

`next lint` fue retirado en Next.js 16. Se incorpora ESLint CLI con la configuración oficial. Los hallazgos existentes de React Compiler en juegos, selector de idioma y cuenta, y un `prefer-const` existente, permanecen visibles como avisos para no refactorizar otros puntos del roadmap. El código nuevo de publicidad conserva las reglas estrictas.

Para validar después la CMP real, usar primero su editor/vista previa de mensajes y una sesión con solicitudes de anuncios bloqueadas. No hacer clic en anuncios propios ni usar un entorno con inventario real como prueba de integración. Confirmar rechazo, retirada, idiomas, ausencia de superposiciones/sonido y mensajes regionales antes de abrir tráfico. La reserva de espacio reduce CLS; LCP/INP y la distribución real se deben comprobar con el proveedor configurado, no pueden certificarse con un simulador.

## Medición y operación

Usar exclusivamente los informes de AdSense. Exportar CSV/XLSX por fecha, país, dispositivo y unidad, con ingresos estimados, impresiones, RPM, cobertura y visibilidad cuando estén disponibles. Compartir esos informes para analizar ingresos y distribución. No permiten concluir por sí solos si un usuario abandonó una partida por un anuncio. No se añade un endpoint ni una base de datos de analítica.

Para apagar: `ADS_MODE=off`, reconstruir y desplegar. Si es necesario retirar inmediatamente la monetización antes del despliegue, usar los controles de la cuenta de Google; cambiar una variable sin reconstruir no retira el código de páginas estáticas ya publicadas.

## Referencias oficiales consultadas

- [Requisitos de AdSense](https://support.google.com/adsense/answer/9724)
- [Tamaños de unidades mediante CSS](https://support.google.com/adsense/answer/9183363)
- [Ajustes de Auto ads](https://support.google.com/adsense/answer/9305577)
- [Políticas de colocación y refresco](https://support.google.com/adsense/answer/1346295)
- [Crear el mensaje europeo](https://support.google.com/adsense/answer/10960768)
- [Requisitos de CMP](https://support.google.com/adsense/answer/13554116)
- [API de Privacidad y mensajes](https://developers.google.com/funding-choices/fc-api-docs)
- [Retirada del consentimiento](https://support.google.com/adsense/answer/10959060)
- [Exportar informes](https://support.google.com/adsense/answer/9830628)

## Resultado de la verificación de esta implementación

- `npm test`: 64 pruebas correctas.
- ESLint: 0 errores y 57 avisos del código previo; ninguno en la integración publicitaria.
- `npm run test:ads:browser`: 6 pruebas de navegador correctas, incluida la matriz ES/EN/FR a 320/390/768/1440 px y revisión de los nueve juegos.
- Build de producción: correcto, 57 páginas generadas; la compilación final queda con anuncios y verificación apagados.
- Capturas móvil/escritorio inspeccionadas. Se corrigieron las capas decorativas de los juegos para que no cubran ni bloqueen las preferencias del pie.
- No se validaron una cuenta real, creatividades reales, aprobación de AdSense ni métricas de campo de Core Web Vitals.
