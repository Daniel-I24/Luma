# Fase: roles, verificación de negocios y APK

Plan acordado con el propietario del proyecto. Copia del encargo original (las
PARTES 0 a 10) más las decisiones posteriores. El estado de avance vive en
`docs/WORKLOG.md`.

## Reglas generales

- Seguir `CLAUDE.md` y `.kiro/steering/`. Sin `git push`, `git push --force` ni
  `reset --hard`; no leer ni tocar `src/environments/environment.ts`. Trabajar
  en `main`. La única reescritura de historial permitida fue la de la PARTE 0.
- Commits pequeños (Conventional Commits) con build, lint, tests y
  `npm audit --omit=dev` sin vulnerabilidades altas ni críticas. `git status`
  antes de cada commit; nunca `git add -A` a ciegas.
- Si una parte rompe algo que no se resuelve en un intento razonable: revertir
  solo esa parte, anotarlo y seguir con la siguiente que no dependa de ella.
- Migraciones aplicadas en Supabase (20240001000000, 20240002000000,
  20261014000000, 20261015000000) NO se editan; los cambios sobre ellas van en
  migraciones nuevas. Las demás siguen sin aplicar y se pueden editar. Toda
  migración nueva: sin aplicar, GRANT explícitos, REVOKE EXECUTE de funciones a
  PUBLIC y anon, SECURITY DEFINER con search_path fijo, `notify pgrst, 'reload
  schema'`, comentarios SQL en ASCII y pruebas de seguridad en Postgres local
  con los roles anon, authenticated y un admin, incluidos casos de abuso. El
  arnés restablece rol y JWT entre comprobaciones.
- Código en inglés; textos de usuario en es y en con las mismas claves; Tailwind
  con tokens; máximo 150 líneas por archivo de código; sin `any` ni
  `console.log`; sin imports entre features; solo rutas existentes; texto de
  usuario solo por interpolación (nada de innerHTML); nunca mostrar correos,
  teléfonos ni ids de usuario a terceros; `prefers-reduced-motion`.
- Cada pieza nueva con sus tests; probar lo visual y la navegación en el
  navegador headless.

## Principios de diseño

- Capas: componentes (presentación) → stores/facades por feature (signals, una
  responsabilidad) → servicios de dominio (reglas) → repositorios (datos). Los
  repositorios exponen contratos (clases abstractas con InjectionToken);
  Supabase es una implementación intercambiable.
- Objetos de valor inmutables y validados: Nit, Phone, Money (COP entero),
  OpeningHours. Reglas puras y testeables; Strategy para reglas intercambiables;
  ningún servicio "dios".
- Composición sobre herencia, `inject()`, estado privado con señales de solo
  lectura, errores tipados. Lo configurable (límites, listas, textos de estado)
  en archivos de datos tipados.
- Código compartido entre Edge Functions en `supabase/functions/_shared`.

## Decisión: una sola regla de horarios

Una fila del día D (`opens_at`, `closes_at`, `is_closed = false`) significa
abierto el día D desde `opens_at` hasta `closes_at`; si `closes_at < opens_at`
cruza medianoche y llega hasta `closes_at` del día D+1. La madrugada de D+1 solo
cuenta si la fila de D cruza medianoche y no está cerrada. La fila de hoy nunca
hace que la madrugada de hoy cuente como abierta. Un día con `is_closed = true`
no abre ni arrastra madrugada. `opens_at = closes_at` es inválido (CHECK y
validación en el panel). Implementada una vez en `OpeningHours` (TypeScript) y
en `business_open_at` (SQL); el mapa, el checkout y el servidor dependen de
ella, y "abre pronto" / "cierra pronto" se derivan de la misma regla. Casos
compartidos en `supabase/tests/fixtures/opening_hours_cases.json`, ejecutados
por Vitest y por el arnés SQL.

## Prioridad

Orden: terminar PARTE 1, luego 2, 3, 4, 5, 6, 7, la 8 SIN rendimiento (solo APK
y scripts) y la 10. La PARTE 9 y la sección de rendimiento no se empiezan sin
autorización expresa.

## PARTE 0 — Estado y limpieza del historial (hecha)

Rama `backup-before-temp-cleanup`, `supabase/.temp` fuera del historial local,
`auth-form-submission-proposal` rebasada y fusionada (los formularios nuevos
usan `AuthFormSubmission`), listado de migraciones.

## PARTE 1 — Ajustes de pedidos y notificaciones

- Anonimizar, no borrar: `orders.user_id` anulable con `on delete set null`; un
  trigger vacía `notes` cuando `user_id` queda en NULL. El negocio conserva su
  historial y las vistas muestran "Cliente". Políticas, `docs/orders.md` y
  pruebas.
- `create_order` valida el horario en el servidor con la regla única, en
  America/Bogota (definida en una sola función). "Ahora" usa `now()`; con hora
  programada se evalúa esa hora. Pruebas en los bordes.
- Aviso al negocio cuando el cliente cancela su pedido.
- `docs/migrations.md` con los comandos para validar las restricciones NOT VALID.

## PARTE 2 — Verificación por código (registro y recuperación)

Sustituir los enlaces del correo por un código de 6 dígitos: pantalla "Escribe
tu código" (inputmode numeric, autocomplete one-time-code, pegar, envío al
completar, "Reenviar código" con espera de 60 s, errores traducidos para código
incorrecto o caducado; `verifyOtp` con el tipo correcto de la versión instalada
de supabase-js). Iniciar sesión sin confirmar lleva a esa pantalla. Recuperar
contraseña con código (mínimo 8, letras y números) y sesión iniciada. Mensajes
que no revelan si un correo existe. Sin `emailRedirectTo` ni rutas de callback;
`detectSessionInUrl` desactivado. `docs/auth-emails.md` con las plantillas con
`{{ .Token }}` y la nota de SMTP propio. Tests con el cliente simulado.

## PARTE 3 — Tipos de cuenta y datos de perfil

Migración nueva: `profiles.account_type` ('customer' | 'business_owner'),
`full_name` (≤80, privado), `phone` (móvil colombiano, opcional, privado),
`consented_at` y `terms_version` (servidor), `onboarding_seen_version`.
`handle_new_user` copia y valida desde `raw_user_meta_data` sin bloquear nunca
el registro. UPDATE por columna solo en display_name, full_name, phone y
onboarding_seen_version. RPC `become_business_owner()` (solo customer →
business_owner). Dueños actuales pasan a business_owner. INSERT en businesses
solo para business_owner, máximo 3. Ningún dato privado en vistas públicas ni
del negocio. App: accountType y profile en el store de sesión; objetos de valor
Phone y AccountType; `ownerGuard` y redirección por tipo de cuenta.

## PARTE 4 — Verificación de negocios

Migración nueva: `verification_status` (draft, pending, approved, rejected,
suspended), `verification_note`, `verified_at`; existentes 'approved' y
`seed.sql` aprobado. Visibilidad pública = is_active y approved, centralizada en
`is_business_public(uuid)` y usada en todas las políticas públicas, vistas,
Storage y `create_order`. Clientes sin escritura en verification_*. Tabla
`admins`, `is_admin()`, `am_i_admin()`. `business_legal` privada (dueño y
admins). `business_verification_docs` y bucket privado `verification-docs` (5 MB;
jpeg, png, webp, pdf). RPC `submit_business_for_review` → { ok, missing[] } y
`review_business` (solo admin, nota obligatoria al rechazar o suspender).
Trigger de nueva revisión si el dueño cambia nombre, dirección o ubicación.
Tabla `reports`. Notificación `business_review`. Nit con dígito de verificación
DIAN (validación de formato, no de autenticidad). App `/admin` (cola de
pendientes con documentos por URL firmada de 60 s y enlace a rues.org.co, cola
de reportes), "Reportar" y etiqueta "Verificado" en el perfil del restaurante.
Pruebas con anon, customer, owner y admin. `docs/verification.md`,
`docs/admin.md`, `docs/roles.md`.

## PARTE 5 — Interfaz "Luma Negocios"

Shell `/owner` con barra inferior propia (TabBar generalizado): Resumen, Pedidos,
Menú, Promociones, Mi negocio; el panel `/business` se muda a `/owner`.
Aterrizaje por tipo de cuenta; "Ver como cliente". En el Perfil del cliente
"¿Tienes un negocio? Regístralo" con `become_business_owner`. Selector de
negocio y límite. Resumen con tarjeta de verificación, Publicado/Pausado y
cifras del día. Mi negocio con datos, horario, imágenes, legales, documentos,
tutorial, cerrar sesión y eliminar cuenta.

## PARTE 6 — Registro en pasos, páginas legales y tutorial

Registro en 4 pasos (tipo de cuenta; nombre y móvil +57; correo y contraseña con
fortaleza y lista de contraseñas comunes; términos, privacidad y mayoría de
edad) y luego el código. Sin dirección para clientes (Ley 1581).
`/legal/terms` y `/legal/privacy` (borradores con aviso). Tutorial de 4
pantallas por tipo de cuenta con `onboarding_seen_version`.

## PARTE 7 — delete-account integral

Limpieza de `business-images` y `verification-docs` antes de `deleteUser`; 500
si falla. CORS común en `_shared`. `reauth_required` si el último inicio de
sesión tiene más de 10 minutos. Tests con cliente inyectable y README.

## PARTE 8 — APK de Android (sin la sección de rendimiento)

Scripts `apk:debug` y `apk:release` (keystore por variables, nunca en git,
detección de JAVA_HOME y JBR de Android Studio). `capacitor.config.ts` sin
server.url ni cleartext; manifest mínimo, allowBackup off, sin tráfico en claro;
versión desde package.json. Botón atrás con `@capacitor/app`, teclado.
Geolocalización en WebView o `@capacitor/geolocation` tras una capa. Icono y
splash con `@capacitor/assets`. Evaluar CSP en meta para el APK.
`assembleDebug` si hay SDK y JDK. `docs/android.md`.

## PARTE 9 — IA con Claude y pagos (solo diseño) — EN ESPERA

No empezar sin autorización.

## PARTE 10 — Documentación

README, ARCHITECTURE, deploy, mocks, orders, migrations; `docs/legal-notes.md`.
