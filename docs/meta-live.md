# Meta: pasar la app de WhatsApp a "En vivo"

Para que el webhook de WhatsApp (docs/whatsapp-setup.md) reciba mensajes de
cualquier persona, la app de Meta debe estar "En vivo". Meta pide, en
Configuración → Básica de la app:

| Campo de Meta | Valor para Luma |
| --- | --- |
| Nombre visible | Luma |
| Correo de contacto de la app | el mismo de `LEGAL_CONTACT_EMAIL` (docs/vercel-setup.md) |
| URL de la política de privacidad | `https://<tu-dominio>/privacidad` |
| URL de las condiciones del servicio | `https://<tu-dominio>/terminos` |
| URL de instrucciones para la eliminación de datos | `https://<tu-dominio>/eliminacion-datos` (explica Perfil → Eliminar cuenta y el correo de contacto) |
| Icono de la app (1024 × 1024) | `docs/brand/store/app-icon-1024.png` |
| Categoría | "Comida y bebida" (Food & Drink) |
| Uso de la app | Negocios (verificación de contactos de los negocios en Luma) |

Pasos:

1. Publica la web en Vercel y abre las tres URL sin iniciar sesión: deben
   verse (no la app).
2. Rellena los campos de la tabla y guarda.
3. Arriba del panel cambia "Desarrollo" a **"En vivo"**. Si Meta marca un
   campo, corrígelo con los valores de la tabla.
4. Si Meta pide "Verificación de la empresa", usa los datos legales reales
   (los textos legales todavía son borradores: revísalos con un abogado
   antes del lanzamiento).
