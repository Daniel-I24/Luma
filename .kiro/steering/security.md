---
inclusion: always
---
# Seguridad (obligatoria en todo código)

Luma maneja datos personales reales y pagos. Estas reglas no son negociables.

## Datos y privacidad
- Cumplir la Ley 1581 de 2012 (habeas data, Colombia): consentimiento explícito, política de privacidad, finalidad clara, derecho a consultar/corregir/eliminar datos. Recolectar solo lo necesario.
- Cifrado en tránsito (HTTPS/TLS siempre) y en reposo (Supabase). Datos sensibles nunca en logs, URLs ni analytics.
- Función de eliminación de cuenta y exportación de datos del usuario.

## Pagos
- **La app NUNCA recibe, procesa ni almacena datos de tarjeta.** Usar checkout alojado o tokenización de Wompi.
- Solo guardar tokens/IDs de transacción y estado. La confirmación de pago se valida en servidor vía webhook con verificación de firma e idempotencia.
- El precio final siempre se calcula en el servidor, jamás se confía en el monto que envía el cliente.

## Autenticación y autorización
- Supabase Auth: verificación de correo, contraseñas robustas, rate limiting, sesiones con refresh tokens; almacenamiento seguro en móvil (Capacitor secure storage).
- **Row Level Security (RLS) activo en TODAS las tablas**, con políticas por usuario y por rol (`user`, `business_owner`, `admin`). Sin política = sin acceso.
- La `service_role` key jamás sale del backend. En el cliente solo la `anon` key.
- Roles verificados en servidor (RLS/Edge Functions), nunca solo con guards de Angular.

## Aplicación
- Validar toda entrada con Zod en cliente y servidor; consultas parametrizadas (nunca SQL concatenado).
- Sanitizar contenido de usuario (reseñas, publicaciones); nada de `innerHTML` sin sanitizar.
- CSP estricta, cabeceras de seguridad (HSTS, X-Content-Type-Options, frame-ancestors) y CORS con lista blanca.
- Rate limiting en Edge Functions críticas (login, pedidos, IA). Límite de tamaño y tipo en subida de archivos.
- IA: la API key de Claude vive solo en secretos del backend; limitar longitud y frecuencia de prompts; tratar la salida del modelo como no confiable (validar el esquema antes de usarla, sobre todo al armar combos y precios).

## Proceso
- Secretos solo en variables de entorno/secret manager; escaneo de secretos y `npm audit` en CI; Dependabot activo.
- Revisión de seguridad como criterio de aceptación de cada spec; pruebas de autorización (un usuario no debe poder leer datos de otro).
- Registro de auditoría para acciones sensibles (pagos, cambios de rol, borrado de datos).
