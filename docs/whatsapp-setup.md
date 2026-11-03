# Verificación automática por WhatsApp y sitio web (guía para ti)

Con esto, el teléfono y el WhatsApp de un negocio se verifican solos: el
dueño envía su código `LUMA-XXXXXX` por WhatsApp **desde ese número** al
número de soporte de Luma, y Luma lo comprueba en segundos. El sitio web se
verifica con un archivo. Instagram y Facebook siguen en la cola del
administrador (/admin).

Mientras no hagas estos pasos no pasa nada malo: todo cae a la cola manual.

## 1. Cuenta de desarrollador de Meta

1. Entra a https://developers.facebook.com con tu cuenta de Facebook y
   acepta ser desarrollador.
2. Crea (o elige) una **cuenta comercial** de Meta (Business Manager).

## 2. La aplicación y el caso de uso de WhatsApp

1. "Mis apps" → **Crear app**.
2. Caso de uso: **"Conectarte con clientes a través de WhatsApp"**.
3. Asóciala a tu cuenta comercial.

## 3. Un número dedicado

- Usa un número **solo para Luma**: un número que ya está en la app normal
  de WhatsApp no se puede usar a la vez (hay que borrar esa cuenta antes).
- En la app → WhatsApp → **Configuración de la API** → "Añadir número":
  verifica el número con el código que te llega por SMS o llamada.
- Copia el **Identificador del número de teléfono** (Phone number ID): es
  `WHATSAPP_PHONE_NUMBER_ID`.
- Meta da un número de prueba para empezar; para recibir mensajes de
  cualquier persona necesitas tu número real.

## 4. El webhook

1. Inventa una frase larga y secreta (por ejemplo con
   `openssl rand -hex 32`): es `WHATSAPP_VERIFY_TOKEN`.
2. En la app → **Configuración → Básica** copia la **Clave secreta de la
   app** (App Secret): es `WHATSAPP_APP_SECRET`.
3. Guarda los secretos y despliega la función:

   ```sh
   supabase secrets set WHATSAPP_VERIFY_TOKEN=<tu frase> WHATSAPP_APP_SECRET=<clave secreta> WHATSAPP_PHONE_NUMBER_ID=<id del número>
   supabase functions deploy whatsapp-webhook --no-verify-jwt
   ```

4. En la app → WhatsApp → **Configuración** → Webhook → "Editar":
   - URL de devolución de llamada:
     `https://<ref>.supabase.co/functions/v1/whatsapp-webhook`
   - Token de verificación: tu `WHATSAPP_VERIFY_TOKEN`.
   - Meta llama a la función; si responde, queda "Verificado".
5. En "Campos del webhook", **suscríbete a `messages`**.
6. Pon la app en **modo En vivo** (arriba en el panel): en modo Desarrollo
   Meta no envía algunos webhooks.

## 5. SUPPORT_WHATSAPP en la app

Compila la web y el APK con la variable de entorno `SUPPORT_WHATSAPP`
(57 y los 10 dígitos, sin "+"), por ejemplo en PowerShell:

```powershell
$env:SUPPORT_WHATSAPP = '573001234567'; npm run apk:release
```

En Vercel: Settings → Environment Variables → `SUPPORT_WHATSAPP`. Sin ella,
la app explica que el WhatsApp de soporte no está configurado y la
solicitud queda pendiente de revisión por el equipo.

## 6. Encender la verificación automática

Después de aplicar la migración 53 (`20261103000000_round6.sql`), en el
editor SQL:

```sql
update public.app_settings set int_value = 1 where key = 'contact_auto_whatsapp';
-- sitio web (necesita verify-website desplegada):
update public.app_settings set int_value = 1 where key = 'contact_auto_website';
```

Y despliega `supabase functions deploy verify-website`.

Para apagarlas, pon `0`: esos contactos vuelven a la cola del administrador.

## 7. Probar de punta a punta

1. Con un negocio tuyo, pon como WhatsApp tu celular y guarda.
2. Mi negocio → Contacto → "Verificar este contacto" → **"Verificar con
   WhatsApp"**. Se abre WhatsApp con el código ya escrito.
3. Envíalo tal cual desde ese mismo celular. En la app aparece "Esperando tu
   mensaje…" y en pocos segundos **Verificado**; te llega una notificación.
4. Prueba también: enviar el código desde otro número (no verifica), enviar
   un código inventado (no verifica) y un número fijo (la app explica que no
   se puede).
5. Sitio web: publica `https://<tu dominio>/.well-known/luma-verification.txt`
   con una línea igual al código y toca "Comprobar ahora".

## Costos y límites esperados

- **Recibir mensajes es gratis**: Meta no cobra los mensajes que los
  usuarios envían al negocio. Luma **nunca responde**, así que no hay
  mensajes de salida que pagar.
- Si algún día respondes desde ese número: desde el 1 de octubre de 2026
  cada número tiene 1.000 mensajes de servicio entregados gratis al mes;
  sin método de pago, Meta deja de entregarlos al pasar ese límite.
- Límites de Luma: un código dura 24 horas; un mismo remitente puede probar
  10 códigos al día (`whatsapp_sender_max_daily`); el sitio web se comprueba
  3 veces al día por negocio.

## Qué guarda Luma

- Del mensaje: solo su identificador (para no procesarlo dos veces), y se
  borra a los 7 días.
- Del remitente: solo un hash con sal (para el límite de intentos), nunca
  el número. El texto del mensaje no se guarda ni se registra.

## verify-website: riesgo residual

El sitio web debe guardarse con `https://` (la app ya no lo añade sola): sin
https la función lo trata como bloqueado.

La función solo descarga `https://<dominio>:443/.well-known/luma-verification.txt`,
resuelve el DNS y rechaza IPs privadas, de loopback, link-local y de
metadatos (también tras cada redirección, máximo 2 y al mismo dominio), con
5 s de espera, 4 KB máximo y sin cookies ni cabeceras del usuario. Queda un
riesgo de **DNS rebinding**: el dominio podría responder con una IP pública
al resolverlo y con otra privada en la conexión real, que hace el propio
`fetch`. Lo limitan el tiempo corto, que solo se lee un archivo de texto de
4 KB y que la respuesta nunca se muestra (solo "coincide" o "no coincide").

Desde la ronda 7, las direcciones IPv6 se leen como sus 16 bytes: solo se
aceptan direcciones globales (2000::/3) y cualquier IPv4 escondida dentro de
una IPv6 (::ffff:7f00:1, ::7f00:1, 64:ff9b::…, 2002::/16) pasa por la misma
lista de bloqueo. Si el servidor de funciones no trae `Deno.resolveDns`, la
función pregunta al DNS sobre HTTPS de Cloudflare
(`cloudflare-dns.com/dns-query`, solo registros A y AAAA, 3 segundos); ese
servicio ve el dominio consultado, nada más.
