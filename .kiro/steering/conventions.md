---
inclusion: always
---
# Convenciones de código, idioma y reutilización

## Idioma
- **Todo el código en inglés**: nombres de archivos, clases, funciones, variables, comentarios, commits, tests y documentación técnica.
- **Toda la interfaz de usuario en español** por defecto, con inglés como segundo idioma.
- Prohibido escribir texto visible al usuario dentro de templates o TS. Todo texto va en archivos de traducción y se lee por clave.
- i18n con Transloco (cambio de idioma en tiempo de ejecución, sin recompilar): `src/assets/i18n/es.json` y `en.json`, organizados por feature (`auth.login.title`, `map.sheet.openNow`).
- Al agregar una clave se agrega en ambos idiomas en el mismo cambio.

## Ajustes de la app (feature `settings`)
Idioma, tema visual (Indigo, Midnight, Pearl, Sunset), notificaciones, métodos de pago, cuenta y privacidad. Idioma y tema se guardan por usuario y se aplican al iniciar sin parpadeo.

## Tamaño y organización
- Un archivo = una responsabilidad. Un componente por archivo, con `.ts`, `.html` y `.css` separados.
- Límite blando: 150 líneas por archivo. Límite duro: 300. Si se pasa, se divide en componentes, servicios o utilidades.
- Funciones cortas (idealmente < 30 líneas), sin anidamiento profundo, sin código duplicado (regla de tres: a la tercera repetición se extrae).
- Sin código muerto, sin comentarios que expliquen lo obvio, sin `TODO` sin issue asociado.
- Imports ordenados y con alias de rutas (`@core`, `@shared`, `@features`, `@design-system`).

## Reutilización de UI (cambiar un color en un solo lugar)
- Cada elemento visual base vive en un único componente en `design-system/` (por ejemplo `LumaButton`, `LumaCard`, `LumaBottomSheet`). Los features **nunca** replican estilos de estos elementos.
- Los componentes solo consumen tokens (`bg-primary`, `text-muted`), nunca colores ni tamaños literales.
- Cambiar un color global = editar el token en el archivo del tema. Cambiar la apariencia de un botón = editar `LumaButton`.
- Variantes por `input()` tipado (`variant`, `size`), no por copiar componentes.

## Respeto al caso de estudio
Cada spec debe trazarse a una sección del documento `product.md`. No se agregan funcionalidades que no estén en el caso de estudio sin aprobación explícita.
