# Matriz de funciones

Estado al 2026-11-07 (ronda 14), con la opción 8 de `scripts\luma.ps1` en OK y la prueba en el teléfono. **Funciona**: probado de punta a punta en
la app. **Necesita configuración**: el código está y probado; falta un paso
del dueño del proyecto (cuál). **Pendiente**: no existe todavía.

En todas las pantallas: carga con esqueletos (nunca un spinner), vacío con
un mensaje y una acción, error con mensaje traducido y "Reintentar", y sin
conexión el aviso global "Sin conexión" (`connection-notice`) más, en las
listas en vivo, "Sin conexión: mostrando datos guardados" (docs/realtime.md).

| Función | Recorrido | Estado | Carga / vacío / error / sin conexión | Pruebas |
| --- | --- | --- | --- | --- |
| Registro | `/auth/register`: tipo de cuenta → datos → residencia (DANE) → foto (opcional) → correo y contraseña → consentimientos → código de 6 dígitos (se envía solo) → la app | Funciona (correo de Supabase con plantilla de código) | botón ocupado; error por campo; código vencido o incorrecto con mensaje; sin conexión: error de red traducido | `e2e/signup.e2e.mjs`, `register.page.spec.ts`, `signup-*.spec.ts`, `verify-code` |
| Inicio de sesión | `/auth/login`: correo (en minúsculas) y contraseña, mostrar/ocultar | Funciona | botón ocupado; credenciales, correo sin confirmar y red con mensajes distintos | `login.page.spec.ts`, `auth.service*.spec.ts` |
| Recuperar contraseña | `/auth/forgot-password`: correo → código → contraseña nueva | Funciona | mensaje neutro (no revela si la cuenta existe); código vencido | `forgot-password.page.spec.ts`, `auth-code.service.spec.ts` |
| Perfil | Perfil → Datos de la cuenta, nombre visible, foto, residencia, contraseña | Funciona | esqueleto; error al guardar con "Reintentar" | `account-details.store.spec.ts`, `features/profile/**/*.spec.ts` |
| Pedidos (cliente) | Ficha → Agregar → carrito → Confirmar pedido → detalle con estado en vivo y método de pago real; Cancelar hasta que el negocio empieza a prepararlo | Funciona | esqueletos; vacío "Aún no tienes pedidos"; error con Reintentar; estados en vivo | `e2e/order.e2e.mjs`, `orders-pages.spec.ts`, `checkout*.spec.ts`, SQL `create_order_final.sql` |
| Pedidos (dueño) | Luma Negocios → Pedidos: Nuevos / En preparación / Listos / Historial; Aceptar, Rechazar con motivo, Listo, Recogido, No llegó; aviso de pedido nuevo | Funciona | esqueleto; vacío por pestaña; error con Reintentar; pedidos nuevos en vivo | `e2e/owner.e2e.mjs`, `business-orders.page.spec.ts`, `order-alerts.store.spec.ts` |
| Pagos en línea (sandbox) | Pagar en línea → Wompi (página alojada) → vuelve a la app (APK: página `https://…/pago-listo.html` → `luma://`; web: `/payments/return`) → "Pagado en línea". Intentos abandonados se cierran solos; "Conciliar ahora" en Operaciones | Funciona en sandbox (tarjeta, Nequi y PSE probados en el teléfono el 2026-11-07); producción: llaves de producción y decisión de cuenta (docs/payments.md) | sin configurar no se ofrece; intentos, vencimiento y rechazo con mensaje | `e2e/payment.e2e.mjs`, `payments.spec.ts`, Deno `create-payment`, `wompi-webhook`, SQL `payments_*.sql` |
| Notificaciones | Lista de avisos (en vivo) y su contador; push en el teléfono | Funciona: lista en vivo y push en la barra de Android (probado en el teléfono) | esqueleto; vacío; error con Reintentar | `notifications.page.spec.ts`, `push-registration.spec.ts`, Deno `push-dispatch` |
| Luma IA: escanear menú | Mi negocio → Menú → Escanear menú: fotos → revisión → agregar; o pegar el menú como texto | Funciona (Gemini, opción 1); pegar texto funciona sin IA | "Leyendo…"; mensaje por causa (saturado + Reintentar, cupo, clave, modelo, tiempo); sin conexión: pegar texto | `menu-scan.*.spec.ts`, Deno `extract-menu`, `_shared/llm` |
| Luma IA: recomendaciones e ideas de promoción | Luma IA (cliente) y Resumen → Ideas (dueño) | Funciona (Gemini; si la IA falla responden las reglas) | si la IA falla, responden las reglas sin error visible | `ai.*.spec.ts`, `promotion-advisor.spec.ts`, Deno `recommend`, `suggest-promotions` |
| Rutas | Ficha / pedido → Cómo llegar: a pie, bici, moto, carro; abre Google Maps | Funciona (OpenRouteService, opción 4); la línea recta solo si no hay ruta | estimación cuando el servicio falla | `route*.spec.ts`, Deno `route` |
| Verificación de contactos | Mi negocio → Verificación: teléfono y WhatsApp por mensaje, web por archivo, redes por el equipo | Funciona (WhatsApp, opción 5; web por archivo; redes por la cola del admin) | cada bloqueo explicado (sin soporte, modo automático apagado, tiempo de espera) | `contact-verification.spec.ts`, Deno `whatsapp-webhook`, `verify-website`, SQL `round6.sql` |
| Verificación del negocio y publicación | 3 pasos → enviar a revisión → el equipo aprueba → publicado (o "aprobado pero aún no se ve" con lo que falta y "Publicar ahora") | Funciona | pasos con lo que falta; nota del equipo si se rechaza | `owner-summary.page.spec.ts`, SQL `round9.sql`, `verification_*.sql` |
| WhatsApp (webhook) | Meta → `whatsapp-webhook` (firma HMAC) | Funciona en modo de prueba de Meta; en vivo: docs/meta-live.md | — | Deno `whatsapp-webhook` |
| Panel de admin con MFA | `/admin`: segundo factor (aal2) → revisión, reportes, contactos, operaciones, probar dispositivo | Funciona (el admin se agrega en `public.admins`) | sin aal2 pide el factor; colas vacías con mensaje | `admin*.spec.ts`, SQL `admin_mfa_audit.sql` |
| Eliminar cuenta | Perfil → Eliminar cuenta: consecuencias → código al correo → borrado | Funciona (función `delete-account` desplegada) | código vencido; error con mensaje | `delete-account-sheet.spec.ts`, Deno `delete-account` |
| Exportar mis datos | Perfil → Descargar mis datos: archivo JSON (web), compartir (teléfono) o copiar | Funciona (nuevo en la ronda 9) | "Preparando tus datos…"; límite de 3 al día con mensaje | `data-export.service.spec.ts`, `account-actions.spec.ts`, SQL `export_my_data.sql` |
| Tutoriales | Guías por pantalla (primera visita, "Saltar") y Ayuda → Tutoriales (repetir, reiniciar) | Funciona | — | `guided-tour.spec.ts`, `tutorials-panel.spec.ts` |
| Tema e idioma | Perfil → Apariencia: Ciruela sobria (oscuro, por defecto) y Crema clara; español / inglés | Funciona | — | `theme.service.spec.ts`, `language.service.spec.ts`, `npm run check:contrast` |
| Tiempo real | Mapa, Descubrir, ficha, pedidos, avisos al instante sin actualizar | Funciona (migración 56 aplicada) | "Actualizado hace X", "Sin conexión: mostrando datos guardados", sondeo de 30 s si el canal falla | `realtime.service.spec.ts`, `e2e/order.e2e.mjs`, `e2e/owner.e2e.mjs`, SQL `realtime_events.sql` |

## Huecos cerrados en la ronda 9 (fase 3)

- El pago en línea desde la web dejaba al cliente en la página de Wompi
  (volvía a `luma://`, que un navegador no abre): ahora vuelve a
  `/payments/return` de la web y abre el pedido.
- "Descargar mis datos" no existía en la app aunque la base lo ofrecía.
- Textos como "1 pedido(s) nuevo(s)", "1 reseñas" o "Te quedan 1 intentos":
  ahora dicen "1 pedido nuevo", "1 reseña", "Te queda 1 intento".
- Mensajes con nombres técnicos ("AI_MODE=rules", "extract-menu", "por
  API") reescritos en español sencillo.
- La segunda opción del tipo de cuenta tenía `id="null"`.

## Pruebas de punta a punta

`npm run test:e2e` (también en CI) recorre registro, pedido al recoger,
panel del dueño y pago de sandbox simulado sobre la build web con servicios
simulados (Supabase, Realtime y Wompi), sin red y sin errores en la consola:
cualquier petición sin simular hace fallar la prueba (`e2e/support/`).
