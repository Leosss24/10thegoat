# Banco de preguntas de TRIVIA

`questions.json` es un fichero independiente del código del juego. Contiene 400 preguntas: 200 fáciles y 200 difíciles, con cuatro opciones y una respuesta correcta por pregunta.

Cada pregunta incluye un ID estable, dificultad, categoría, enunciado, opciones, respuesta correcta, explicación y enlace a una fuente. Los textos están disponibles en español, inglés y francés dentro del mismo registro; cambiar de idioma no cambia la pregunta ni el orden de las opciones.

Se puede editar este JSON directamente. No es necesario modificar SQL, crear tablas en Supabase ni mantener un YAML adicional. Después de editarlo, ejecutar `npm test` y `npm run build` y desplegar los cambios. Ver `docs/trivia-mvp.md` para las reglas de compatibilidad de partidas guardadas.
