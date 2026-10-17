# Datos simulados y estimaciones

Inventario de todo lo que la app muestra sin venir del backend. Cada entrada
indica dónde vive, cómo se calcula y qué hace falta para reemplazarla.

Hoy no queda ningún dato inventado en `src/app/shared/mock/` (la carpeta no
existe): lo que sigue son estimaciones o reglas calculadas en el cliente.

## Tiempo a pie (bottom sheet)

- **Dónde:** `src/app/shared/geo/distance.util.ts` (`walkingMinutes`).
- **Cálculo:** distancia en línea recta (Haversine) a 5 km/h. No es una ruta
  real; solo se muestra cuando el usuario compartió su ubicación.
- **Para reemplazarlo:** un servicio de rutas (p. ej. OSRM/Valhalla o el
  proveedor de mapas elegido).

## Indicador de zona (mapa)

- **Dónde:** `src/app/features/map/utils/zone-label.util.ts`.
- **Cálculo:** no hay geocodificación inversa; el indicador dice "Centro de
  Pasto" (centro por defecto) o "Cerca de ti" cuando hay ubicación real, en
  lugar del nombre del barrio que muestra el prototipo.
- **Para reemplazarlo:** geocodificación inversa del centro del mapa.

## Luma IA (recomendaciones y combos)

- **Dónde:** `src/app/shared/recommendations/` (motor y reglas tipadas) y
  `src/app/features/ai/`.
- **Cálculo:** reglas deterministas en el cliente, sin modelo de lenguaje:
  categorías por momento del día, solo negocios abiertos o que abren pronto,
  puntuación por distancia, calificación real, promoción activa y favoritos.
  El combo (plato + acompañamiento + bebida) sale de un diccionario de
  secciones del menú. Detalle en `docs/ai.md`.
- **Para reemplazarlo:** `ClaudeRecommendationEngine` detrás de la misma
  interfaz, llamando a una Edge Function (clave solo en el servidor).

## Orden del feed (Descubrir)

- **Dónde:** `src/app/features/feed/utils/feed-cards.util.ts`.
- **Cálculo:** promociones activas y platos disponibles (máx. 3 por negocio)
  de los negocios cercanos, intercalados de forma determinista por distancia.
  No hay ranking por popularidad ni personalización.
- **Para reemplazarlo:** un orden calculado en el servidor (o por el
  recomendador) con señales de interacción.

## Carrito

- **Dónde:** `src/app/shared/cart/` y `src/app/features/cart/`.
- **Cálculo:** vive solo en el cliente (localStorage por usuario, validado
  con Zod al leerlo). Sus precios son **informativos**: al abrir `/cart` se
  vuelven a consultar los ítems y se avisan los cambios; el servidor
  recalcula todos los precios al crear el pedido.

## Lo que es real

- Negocios, categorías, horarios, estado (abierto, cierra pronto, cerrado,
  abre pronto) y promociones vienen de Supabase. La búsqueda y el filtro por
  categoría se hacen en el cliente sobre los negocios ya cargados.
- **Calificaciones (desde 2026-10-14):** vista `public.business_ratings`
  (promedio con un decimal y número de reseñas), leída con
  `BusinessHighlightsRepository.getRatings` en una sola consulta para todos
  los negocios cercanos. Un negocio sin reseñas muestra "Sin reseñas"; si la
  consulta falla no se muestra nada (no se confunde con "sin reseñas").
  Antes era un mock (`MockBusinessRatingProvider`), ya eliminado.
- **Promociones de las tarjetas:** `BusinessHighlightsRepository.getActivePromotions`,
  también una sola consulta para todos los negocios cercanos.
- **Menú, favoritos y reseñas:** tablas `menu_items`, `favorites` y `reviews`
  con sus repositorios en `src/app/shared/business/data/`. Los menús de prueba
  están en `supabase/seed_menu_items.sql` (repetible, vincula por nombre de
  negocio). No se siembra **ninguna reseña**, así que todos los negocios
  muestran "Sin reseñas" hasta que alguien escriba una.
- **Feed, Luma IA y Mis favoritos** leen esas mismas tablas por lotes (una
  consulta con `in` por tabla), sin datos inventados.
