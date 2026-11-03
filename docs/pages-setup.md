# Páginas legales públicas en GitHub Pages (sin Vercel)

Meta y la Play Store piden tres URL públicas (privacidad, términos y
eliminación de datos). El flujo `.github/workflows/legal-pages.yml` publica
**solo** la carpeta `public/legal` en GitHub Pages: ni la app ni ningún otro
archivo del repositorio. Vercel sigue siendo una opción para la web completa
(docs/vercel-setup.md).

## Una sola vez

1. En GitHub, el repositorio → **Settings → Pages** → "Build and deployment"
   → Source: **GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables** → "New
   repository variable": `LEGAL_CONTACT_EMAIL` con el correo de contacto
   (no es un secreto: aparece en las páginas).
3. **Actions → Legal pages → Run workflow** (o cualquier cambio en
   `public/legal`, `public/i18n` o `scripts/build-legal.mjs` que llegue a
   `main`).

## Las URL

Con el repositorio `Daniel-I24/Luma`:

| Página | URL |
| --- | --- |
| Política de privacidad | `https://daniel-i24.github.io/Luma/privacidad.html` |
| Condiciones del servicio | `https://daniel-i24.github.io/Luma/terminos.html` |
| Eliminación de datos | `https://daniel-i24.github.io/Luma/eliminacion-datos.html` |
| Reembolsos | `https://daniel-i24.github.io/Luma/reembolsos.html` |

Ábrelas sin iniciar sesión: deben verse las páginas, no un 404. Si el
repositorio es privado, GitHub Pages necesita un plan de pago; con el plan
gratuito el repositorio debe ser público (o usa Vercel).

## Seguridad del flujo

- Acciones fijadas por SHA de commit (con la versión en un comentario).
- Permisos mínimos: el trabajo que construye solo lee el repositorio; solo
  el de despliegue puede escribir en Pages (`pages: write`, `id-token:
  write`).
- `persist-credentials: false`: el token no queda en la copia del código.
- El paso de construcción solo usa Node (sin `npm install`).
