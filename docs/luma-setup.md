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

`npx` usa la CLI de Supabase del proyecto: no hace falta instalarla. Los
despliegues usan `--use-api`, así que tampoco hace falta Docker.

## La carpeta de secretos

Todo lo privado vive en `%USERPROFILE%\luma-secrets` (fuera del
repositorio; se puede cambiar con la variable `LUMA_SECRETS_DIR`).

| Archivo | Lo escribe | Contiene |
| --- | --- | --- |
| `ai.env` | opción 1 | `LLM_API_KEY`, `LLM_MODEL`, `LLM_FALLBACK_MODEL` |
| `firebase-service-account.json` | tú (Firebase) | la cuenta de servicio de push |
| `push-settings.sql` | opción 2 | el SQL de push para pegar una vez |
| `wompi-sandbox.txt` | tú (Wompi) | las 4 llaves de sandbox, en cualquier orden y con cualquier texto alrededor |
| `payments-settings.sql` | opción 3 | el SQL del cron de pagos para pegar una vez |
| `routes.env` | opción 4 | `ROUTE_API_KEY` |
| `whatsapp.env` | tú y la opción 5 | `WHATSAPP_VERIFY_TOKEN` (se genera si falta), `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID` |
| `app.env` | tú | las variables de compilación (docs/release.md) |
| `supabase-access-token.txt` | opción 7 | el token de acceso para el diagnóstico |

## Las opciones

1. **Luma IA**: pide la clave de Gemini, el modelo (`gemini-3.8-flash`) y el
   de respaldo (`gemini-3.1-flash-lite`); prueba la clave con cada modelo,
   carga los secretos `LLM_*` y despliega `recommend`, `suggest-promotions`
   y `extract-menu`.
2. **Notificaciones**: carga `FCM_SERVICE_ACCOUNT` y `PUSH_DISPATCH_SECRET`,
   despliega `push-dispatch` y escribe `push-settings.sql`
   (docs/push-setup.md).
3. **Pagos de Wompi en sandbox**: reconoce cada llave por su prefijo
   (`pub_test_`, `prv_test_`, `test_events_`, `test_integrity_`), genera
   `PAYMENTS_CRON_SECRET`, carga los secretos, despliega `create-payment`,
   `wompi-webhook`, `reconcile-payments` y `void-payment` y escribe
   `payments-settings.sql`. Te recuerda la URL de eventos para Wompi. Los
   pagos en línea siguen **apagados** hasta que quites el `--` de la última
   línea de ese SQL.
4. **Rutas**: la clave de OpenRouteService, probada con una ruta corta;
   despliega `route`.
5. **WhatsApp**: carga los secretos de `whatsapp.env`, despliega
   `whatsapp-webhook` y prueba el reto de Meta.
6. **APK**: compila con todas las variables de `app.env` (firmado si están
   las cuatro `LUMA_KEY*`, de prueba si no) y lo instala con `adb`; si hay
   varios teléfonos conectados, pregunta cuál.
7. **Diagnóstico** (`npm run doctor`): migraciones aplicadas, banderas de
   `app_settings`, nombres de los secretos, funciones desplegadas, el reto de
   WhatsApp, la clave de Gemini y el estado de push y pagos. Necesita un
   token de acceso de Supabase (créalo con fecha de vencimiento en
   supabase.com/dashboard/account/tokens); se guarda en la carpeta de
   secretos y nunca se muestra.

Cada opción termina con un resumen: **OK** (listo), **FALTA** (hay que
hacer algo: la línea siguiente dice qué) o **APAGADO** (opcional o apagado a
propósito).

## Pruebas

`node --test scripts/luma.test.mjs scripts/doctor.test.mjs` ejecuta cada
opción con la CLI, la web, las preguntas, npm y adb simulados.
