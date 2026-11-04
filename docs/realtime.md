# Tiempo real

Lo que cambia en la base se ve en los demás teléfonos sin actualizar, sin
cerrar la app y sin pulsar nada: negocios nuevos ya públicos, nombre,
ubicación, horario, pausa, productos, precios, agotados y promociones; los
pedidos nuevos para el dueño y los cambios de estado para el cliente; y la
lista de avisos.

## Diseño: solo ids por Realtime

Ninguna fila de negocios, pedidos ni avisos viaja por Realtime (sus columnas
privadas no deben salir). Migración 56 (`20261106000000_round9.sql`):

| Tabla | Columnas | Quién la lee | La llenan |
| --- | --- | --- | --- |
| `catalog_events` | `kind` (business, hours, menu, promotion), `business_id`, `at` | anon y authenticated | disparadores de `businesses` (si era o es público y algo cambió), `business_hours`, `menu_items` y `promotions` (solo de negocios públicos) |
| `order_events` | `order_id`, `user_id` **o** `business_id`, `at` | la fila con `user_id`, solo ese cliente; la fila con `business_id`, solo el dueño del negocio (RLS con `(select auth.uid())`). Desde la migración 57 cada cambio de un pedido escribe **dos filas**, una por público, y la restricción `order_events_one_audience` impide que una fila lleve los dos: el dueño nunca recibe el id del cliente | disparadores de `orders` (alta y cada cambio) y de `notifications` (con `order_id` nulo: "cambió tu lista de avisos") |

- Los clientes no pueden escribir en ellas (solo los disparadores, SECURITY
  DEFINER con `search_path` vacío).
- `private.prune_realtime_events()` borra lo de más de un día (pg_cron, cada
  hora).
- La publicación `supabase_realtime` lleva exactamente esas dos tablas.

La app (`core/realtime/`):

- `RealtimeService.watch(tabla, refrescar, relevante)`: se suscribe a los
  INSERT al entrar a una pantalla y se baja al salir; agrupa los eventos de
  500 ms y vuelve a pedir lo afectado con las consultas normales (RLS).
- Si el canal falla: reconexión con espera creciente (1 s, 2 s, 4 s… hasta
  30 s, con variación) y, mientras tanto, sondeo cada 30 s solo con la
  pantalla visible.
- Refresca también al volver al primer plano y al recuperar la red.
- "Tirar para refrescar" (`appPullToRefresh`) y la línea discreta
  `FreshnessNote`: "Sin conexión: mostrando datos guardados" o "Actualizado
  hace X", con el botón "Actualizar" (la alternativa de un toque al gesto).
- Sin parpadeos: los refrescos no muestran esqueletos, conservan lo visible
  si fallan y reemplazan la lista de una vez (las tarjetas mantienen su id).

| Pantalla | Escucha | Qué vuelve a pedir |
| --- | --- | --- |
| Mapa | `catalog_events` | los negocios de la zona (y el horario de los que cambiaron) |
| Descubrir | `catalog_events` | las publicaciones ya mostradas, en el mismo orden |
| Ficha, menú y promociones | `catalog_events` de ese negocio | el negocio y sus partes; si dejó de ser público, "no encontrado" |
| Pedidos (cliente) y detalle | `order_events` de sus pedidos | la lista o ese pedido |
| Pedidos del dueño y aviso de pedido nuevo | `order_events` del negocio mostrado | el tablero y el contador |
| Avisos y su contador | `order_events` sin pedido | la lista y el número sin leer |

## Límites del plan gratuito

Consultado el 2026-11-03 en la documentación de Supabase
([límites](https://supabase.com/docs/guides/realtime/limits),
[precios](https://supabase.com/docs/guides/realtime/pricing)):

- 200 conexiones simultáneas (un teléfono con la app abierta es una).
- 2 millones de mensajes al mes y 100 mensajes por segundo; **cada cambio
  cuenta una vez por cliente que lo escucha** (un precio cambiado con 50
  teléfonos mirando son 50 mensajes).
- 100 canales por conexión (Luma abre uno por pantalla abierta).
- Pasarse en el plan gratuito no cobra: Supabase avisa y da un periodo de
  gracia. Si se llega al límite, la app no se rompe: el canal falla y entra
  el sondeo de 30 s.

## Probarlo con dos teléfonos

1. Aplica la migración 56 y comprueba en Database → Publications que
   `supabase_realtime` lleva solo `catalog_events` y `order_events`.
2. Teléfono A: cuenta de cliente en Descubrir o en la ficha de un negocio.
   Teléfono B: el dueño de ese negocio.
3. En B cambia un precio, marca un producto agotado o pausa los pedidos: en
   A se actualiza en menos de un segundo, sin parpadeos.
4. En A haz un pedido: en B aparece en Pedidos y suena el aviso. En B
   acéptalo: en A cambia el estado.
5. Pon A en modo avión: dice "Sin conexión: mostrando datos guardados".
   Quítalo: se reconecta y refresca solo.
6. Un tercer teléfono con otra cuenta nunca recibe eventos de esos pedidos
   (`supabase/tests/realtime_events.sql` lo prueba con tres usuarios).

## Pruebas

- `src/app/core/realtime/realtime.service.spec.ts`: canal simulado (evento,
  agrupación, reconexión, respaldo, baja al salir, red y primer plano).
- `src/testing/fake-realtime.ts`: el resto de pruebas recibe eventos con
  `emit` (`src/test-providers.ts` lo da a todas).
- `supabase/tests/realtime_events.sql`: disparadores, RLS con tres usuarios,
  escritura prohibida, limpieza y publicación.
