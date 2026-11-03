# Meta: pasar la app de WhatsApp a "En vivo"

Para que el webhook de WhatsApp (docs/whatsapp-setup.md) reciba mensajes de
cualquier persona, la app de Meta debe estar "En vivo". Meta pide, en
Configuración → Básica de la app:

| Campo de Meta | Valor para Luma |
| --- | --- |
| Nombre visible | Luma |
| Correo de contacto de la app | el mismo de `LEGAL_CONTACT_EMAIL` (docs/pages-setup.md) |
| URL de la política de privacidad | `https://daniel-i24.github.io/Luma/privacidad.html` |
| URL de las condiciones del servicio | `https://daniel-i24.github.io/Luma/terminos.html` |
| URL de instrucciones para la eliminación de datos | `https://daniel-i24.github.io/Luma/eliminacion-datos.html` (explica Perfil → Eliminar cuenta y el correo de contacto) |
| Icono de la app (1024 × 1024) | `docs/brand/store/app-icon-1024.png` |
| Categoría | "Comida y bebida" (Food & Drink) |
| Uso de la app | Negocios (verificación de contactos de los negocios en Luma) |

Pasos:

1. Publica las páginas en GitHub Pages (docs/pages-setup.md) y abre las tres
   URL sin iniciar sesión: deben verse. Con Vercel (docs/vercel-setup.md)
   valen también `https://<tu-dominio>/privacidad`, `/terminos` y
   `/eliminacion-datos`.
2. Rellena los campos de la tabla y guarda.
3. Arriba del panel cambia "Desarrollo" a **"En vivo"**. Si Meta marca un
   campo, corrígelo con los valores de la tabla.
4. Si Meta pide "Verificación de la empresa", usa los datos legales reales
   (los textos legales todavía son borradores: revísalos con un abogado
   antes del lanzamiento).
