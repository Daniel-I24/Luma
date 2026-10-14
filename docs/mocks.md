# Datos simulados y estimaciones

Inventario de todo lo que la app muestra sin venir del backend. Cada entrada
indica dónde vive, cómo se calcula y qué hace falta para reemplazarla.

Hoy no queda ningún dato inventado en `src/app/shared/mock/`: lo que sigue
son estimaciones calculadas en el cliente.

## Tiempo a pie (bottom sheet)

- **Dónde:** `src/app/features/map/utils/distance.util.ts` (`walkingMinutes`).
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
  con sus repositorios en `src/app/shared/business/data/`. El seed incluye
  menús de prueba pero **ninguna reseña**, así que todos los negocios
  muestran "Sin reseñas" hasta que alguien escriba una.
