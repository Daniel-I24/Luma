# Datos simulados y estimaciones

Inventario de todo lo que la app muestra sin venir del backend. Cada entrada
indica dónde vive, cómo se calcula y qué hace falta para reemplazarla.

## Calificación y número de reseñas (mapa)

- **Dónde:** `src/app/shared/mock/business-rating.mock.ts` (`MockBusinessRatingProvider`).
- **Interfaz:** `BusinessRatingProvider` en `src/app/shared/business/data/business-rating.provider.ts`
  (`getRating(businessId): BusinessRating | null`).
- **Registro:** `src/app/app.config.ts` →
  `{ provide: BusinessRatingProvider, useClass: MockBusinessRatingProvider }`.
- **Cálculo:** valores deterministas derivados del `id` del negocio (hash FNV-1a):
  calificación entre 3,5 y 5,0 y entre 12 y 300 reseñas. El mismo negocio
  siempre muestra lo mismo.
- **Se usa en:** tarjetas "Cercanos a ti" y bottom sheet del negocio.
- **Para reemplazarlo:** crear la tabla de reseñas (con RLS) y un repositorio
  que implemente `BusinessRatingProvider`; cambiar solo el provider en
  `app.config.ts`. La interfaz es síncrona; si la fuente real es asíncrona,
  habrá que precargar las calificaciones junto con los negocios.

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

## Lo que sí es real

Negocios, categorías, horarios, estado (abierto, cierra pronto, cerrado, abre
pronto) y promociones vienen de Supabase. La búsqueda y el filtro por
categoría se hacen en el cliente sobre los negocios ya cargados.
