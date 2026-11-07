# Configurar Luma con `scripts\luma.ps1`

Un menú para dejar listo cada servicio sin pegar comandos largos. Cada
opción se puede repetir: lo que ya está guardado se reutiliza (pulsa Enter).
Ninguna opción muestra un secreto.

## Antes, una sola vez

En PowerShell, dentro de la carpeta del repositorio:

```powershell
npx supabase login
npx supabase link
powershell -ExecutionPolicy Bypass -File scripts\luma.ps1
```

`npx` usa la CLI de Supabase en una versión fija (`supabase@3.0.0`, en
`scripts/luma/remote.ps1` y `scripts/doctor.mjs`): no hace falta instalarla.
Los despliegues usan `--use-api`, así que tampoco hace falta Docker. Todo
cambio va con `--remote=<proyecto>` y `--yes`: elegir la opción es la
confirmación, y cada opción muestra antes el proyecto destino.

## Cuándo una opción dice OK

Solo cuando el proyecto lo confirma: al terminar, cada opción lee
`secrets list` y `functions list` y exige cada secreto y cada función con
fecha de esta ejecución (o la CLI dijo que el código no cambió, o el resumen
del secreto coincide). El código de salida de la CLI no basta.

Si un comando falla, la opción se detiene ahí y muestra el mensaje de la CLI.

> **No llames a `npx` ni a `npm` desde una función de PowerShell con `@args`.**
> Sus envoltorios `npx.ps1` y `npm.ps1` releen el texto de la línea que los
> llama, así que `@args` no llega: la CLI muestra la ayuda y sale con 0. Por eso
> estas opciones dijeron OK sin cambiar nada hasta la ronda 13. Se llama a
> `npx.cmd` y `npm.cmd`, y `scripts/luma-remote.test.mjs` lo comprueba.

## La carpeta de secretos

Todo lo privado vive en `%USERPROFILE%\luma-secrets` (fuera del
repositorio; se puede cambiar con la variable `LUMA_SECRETS_DIR`).

**Ningún archivo de `luma-secrets` contiene tokens de cuenta** (ni de
Supabase ni de otra cuenta personal): las opciones usan la sesión de la CLI
(`npx supabase login`), y el único token que el diagnóstico puede pedir vive
solo en memoria.

| Archivo | Lo escribe | Contiene |
| --- | --- | --- |
| `ai.env` | opción 1 | `LLM_API_KEY`, `LLM_MODEL`, `LLM_FALLBACK_MODEL` |
| `firebase-service-account.json` | tú (Firebase) | la cuenta de servicio de push |
| `push-settings.sql` | opción 2 | el SQL de push para pegar una vez |
| `wompi-sandbox.txt` | tú (Wompi) | las 4 llaves de sandbox, en cualquier orden y con cualquier texto alrededor. Las llaves `*_prod_` nunca se cargan |
| `payments-settings.sql` | opción 3 | el SQL del cron de pagos para pegar una vez |
| `routes.env` | opción 4 | `ROUTE_API_KEY` |
| `whatsapp.env` | tú y la opción 5 | `WHATSAPP_VERIFY_TOKEN` (se genera si falta), `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID` |
| `app.env` | tú | las variables de compilación (docs/release.md) |

## Las opciones

1. **Luma IA**: pide la clave de Gemini, el modelo (`gemini-3.6-flash`) y el
   de respaldo (`gemini-3.5-flash-lite`); hace una llamada real y mínima de
   `generateContent` con cada uno (503 o 429: APAGADO, "saturado ahora, el
   respaldo lo cubrirá"),
   carga los secretos `LLM_*` y despliega `recommend`, `suggest-promotions`
   y `extract-menu`.
2. **Notificaciones**: carga `FCM_SERVICE_ACCOUNT` y `PUSH_DISPATCH_SECRET`,
   despliega `push-dispatch` y escribe `push-settings.sql`
   (docs/push-setup.md).
3. **Pagos de Wompi en sandbox**: reconoce cada llave por su prefijo
   (`pub_test_`, `prv_test_`, `test_events_`, `test_integrity_`) en
   `wompi-sandbox.txt` y, para lo que falte, en `functions.env`. Si encuentra
   llaves de producción no las carga y lo dice. Genera
   `PAYMENTS_CRON_SECRET`, carga los secretos, despliega `create-payment`,
   `wompi-webhook`, `reconcile-payments` y `void-payment` y escribe
   `payments-settings.sql`. Te recuerda la URL de eventos para Wompi. Los
   pagos en línea siguen **apagados** hasta que quites el `--` de la última
   línea de ese SQL.
4. **Rutas**: la clave de OpenRouteService, probada con una ruta corta;
   despliega `route`.
5. **WhatsApp**: carga los secretos de `whatsapp.env`, despliega
   `whatsapp-webhook` y prueba el reto de Meta.
6. **APK**: si `app.env` no existe lo crea (pregunta `SUPABASE_ANON_KEY`;
   `AI_MODE=remote` si existe `ai.env`, `PUSH_ENABLED=1` si existe
   `google-services.json`); compila con todas sus variables (firmado si están
   las cuatro `LUMA_KEY*`, de prueba si no) y lo instala con `adb` (del PATH,
   de `ANDROID_HOME` o de `%LOCALAPPDATA%\Android\Sdk\platform-tools`); si el
   teléfono dice "unauthorized" explica cómo autorizarlo; si hay varios
   conectados, pregunta cuál.
7. **Diagnóstico** (`npm run doctor`): nombres de los secretos y funciones
   desplegadas con la sesión de la CLI (`npx supabase secrets list` y
   `functions list`), el reto de WhatsApp, la clave de Gemini y el estado de
   push y pagos. Las migraciones aplicadas y las banderas de `app_settings`
   solo las responde la API de gestión: para verlas, la opción pide un token
   personal **opcional**, como texto oculto y solo en memoria (nunca se
   escribe a disco; se borra al terminar). Sin él, esas líneas salen
   APAGADO. Si creaste el token solo para esto, revócalo después en
   supabase.com/dashboard/account/tokens.

8. **Desplegar y verificar todo**: sin preguntas, con lo guardado en la
   carpeta de secretos: las opciones 1 a 5 y `delete-account`, `geocode` y
   `verify-website`. Si un servicio no puede, sigue con los demás. Termina con
   una tabla leída del proyecto. También:
   `powershell -ExecutionPolicy Bypass -File scripts\luma.ps1 -Option 8`.

Cada opción termina con un resumen: **OK** (listo), **FALTA** (hay que
hacer algo: la línea siguiente dice qué) o **APAGADO** (opcional o apagado a
propósito).

## Pruebas

`node --test scripts/luma.test.mjs scripts/luma-remote.test.mjs scripts/doctor.test.mjs` ejecuta cada
opción con la CLI, la web, las preguntas, npm y adb simulados.
