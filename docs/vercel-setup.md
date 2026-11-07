# Vercel: la web y las páginas legales públicas

La web de Luma (la misma app del APK) y sus páginas legales públicas se
pueden publicar en Vercel desde este repositorio. Es opcional: para las
páginas legales basta GitHub Pages (docs/pages-setup.md). Paso a paso:

## 1. Crear el proyecto

1. Entra a https://vercel.com con tu cuenta de GitHub.
2. "Add New… → Project" → elige el repositorio `Luma` → "Import".
3. Framework: "Other". No cambies nada más: `vercel.json` ya trae
   `buildCommand: npm run build:prod` y `outputDirectory: dist/luma/browser`.

## 2. Variables de entorno (Settings → Environment Variables)

| Variable | Valor | Para qué |
| --- | --- | --- |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | La base de datos (pública) |
| `SUPABASE_ANON_KEY` | la clave anon/publishable | Nunca la `service_role` (el build falla si la pones) |
| `AI_MODE` | `remote` o `rules` | Luma IA (docs/ai.md) |
| `SUPPORT_WHATSAPP` | `57` + 10 dígitos | Verificación de contactos (docs/whatsapp-setup.md) |
| `LEGAL_CONTACT_EMAIL` | p. ej. `privacidad@tudominio.co` | El correo de las páginas legales y de eliminación de datos |

## 3. Desplegar

"Deploy". Cada push a `main` vuelve a publicar. El build hace, en orden:
`generate-env` (claves públicas) → `build-legal` (páginas legales con
`LEGAL_CONTACT_EMAIL`) → `ng build` con los indicadores de
`scripts/build-flags.mjs`.

## 4. Las páginas públicas

Sin sesión y sin JavaScript, desde el mismo texto que muestra la app
(`public/i18n/es.json`):

| Página | URL corta | Archivo |
| --- | --- | --- |
| Términos | `https://<tu-dominio>/terminos` | `/legal/terminos.html` |
| Privacidad | `https://<tu-dominio>/privacidad` | `/legal/privacidad.html` |
| Reembolsos | `https://<tu-dominio>/reembolsos` | `/legal/reembolsos.html` |
| Eliminación de datos | `https://<tu-dominio>/eliminacion-datos` | `/legal/eliminacion-datos.html` |

Si cambias un texto legal en la app, corre `npm run build:legal` y haz
commit: CI falla si las páginas no coinciden con la app.

## Un clon limpio compila solo

`environment.ts` no está en git (tiene tus claves locales). `npm run build:prod` lo crea desde
`environment.example.ts` si no existe y nunca toca uno existente. El sitio usa solo las variables
de Vercel: `SUPABASE_URL` y `SUPABASE_ANON_KEY` (obligatorias), `AI_MODE`, `SUPPORT_WHATSAPP` y
`LEGAL_CONTACT_EMAIL`. `PUSH_ENABLED` no afecta a la web: el push nativo solo existe en el APK.
El trabajo `clean-build` de CI compila así en cada push.

## 5. Seguridad

`vercel.json` envía a todas las rutas: CSP estricta (sin scripts en línea),
HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` y
`Permissions-Policy`. Las rutas de la app (el SPA) caen en `index.html`
después de las páginas legales.

## 6. Dominio propio (opcional)

Settings → Domains → añade tu dominio y copia los registros DNS que pide
Vercel en tu proveedor. Después añade `https://<tu-dominio>` a
`ALLOWED_ORIGINS` de las Edge Functions (docs/deploy.md).
