# Guion de la demo

Unos 15 minutos. La demo es en español, como la interfaz; los nombres técnicos están en
`README.md`.

## Antes de la presentación (el día anterior)

1. **Tres cuentas de prueba**, creadas desde la app. Sus correos y contraseñas se guardan en
   `%USERPROFILE%\luma-secrets\demo-cuentas.txt`, **nunca en el repositorio**.

   | Cuenta | Para qué | Cómo se prepara |
   | --- | --- | --- |
   | Cliente | Pedir y pagar | Registro normal, con el perfil completo (nombre, celular, residencia) |
   | Negocio | Recibir el pedido | Registro como negocio, verificado y publicado, con menú y horario abierto a la hora de la demo |
   | Admin | Revisar, conciliar y reembolsar | Una cuenta en `public.admins`, con MFA (app de autenticación en tu teléfono) |

2. **Pagos de prueba:** `payments_enabled = 1` y `scripts\luma.ps1`, opción 8, todo en OK.
3. **APK:** genera uno nuevo (opción 6) e instálalo en el teléfono. Abre la app y acepta los
   permisos de ubicación y avisos.
4. **Web:** abre `https://luma-ten-henna.vercel.app` en el portátil e inicia sesión con el
   negocio.
5. **Tema:** deja el teléfono en Ciruela sobria y ten Crema clara a mano para mostrarlo.
6. **Repaso:** haz la demo completa una vez. Cancela o recoge los pedidos de prueba para que
   la lista del negocio empiece vacía.

## 1. Qué es Luma (1 minuto)

Luma ayuda a encontrar restaurantes y tiendas de Pasto, ver si están abiertos y pedir para
recoger: el cliente paga en el local o en línea, y el negocio recibe el pedido al instante.

## 2. El cliente (5 minutos, en el teléfono)

1. **Mapa:** los negocios cercanos con su estado (abierto, cierra pronto, cerrado), el buscador
   de barrios y direcciones y los filtros.
2. **Descubrir:** el feed vertical y las promociones con descuento real.
3. **Luma IA:** pide algo como "algo para el almuerzo cerca". Las recomendaciones salen de lo
   que está abierto y cerca; si la IA falla, responden las reglas y no se ve ningún error.
4. **Ficha del negocio:** menú, promociones, reseñas e información. Agrega un producto.
5. **Checkout:** hora de recogida y notas. Explica la regla: se puede cancelar hasta que el
   negocio empiece a prepararlo.

## 3. El pago en línea (3 minutos)

1. Elige **Pagar en línea** y confirma. Se abre la página segura de Wompi: Luma nunca ve los
   datos del pago.
2. Paga con la tarjeta de prueba `4242 4242 4242 4242` (cualquier fecha futura, cualquier CVC).
3. La app vuelve sola al pedido: "Pagado en línea" y el aviso "Tu pago fue aprobado" en la barra
   de Android.
4. Si hay tiempo, muestra un rechazo con `4111 1111 1111 1111`: aparece "Reintentar pago" y el
   pedido sigue esperando.

Otros datos de sandbox: Nequi `3991111111` (aprueba) y `3992222222` (rechaza); en PSE, "Banco
que aprueba" o "Banco que rechaza".

## 4. El negocio (3 minutos, en la web)

1. **Pedidos:** el pedido pagado aparece sin recargar, con "Pagado en línea".
2. Pulsa **Aceptar**, **Preparando**, **Listo** y **Entregado**. En el teléfono, la línea de
   tiempo del cliente avanza en vivo y llega un aviso por cada paso.
3. **Menú → Escanear menú con Luma IA:** la IA lee la foto de una carta y propone los platos para revisar.
4. **Resumen → Ideas de Luma IA:** promociones sugeridas a partir de las ventas.

## 5. El equipo de Luma (2 minutos)

1. Entra en `/admin` con el segundo factor (MFA).
2. **Revisión de negocios:** un negocio pendiente con sus señales de alerta (NIT repetido, ubicación).
3. **Operaciones:** pagos con problemas, **Conciliar ahora** y **Anular en Wompi** para
   reembolsar una tarjeta.
4. **Información técnica → Servidor de avisos:** la última respuesta del servidor de avisos.

## 6. Cierre (1 minuto)

- **Seguridad:** RLS en todas las tablas, precios calculados en el servidor, solo la clave
  pública en la app y los pagos verificados con firma.
- **Calidad:** unas 1.050 pruebas de la app, suites SQL, pruebas de las funciones, e2e en
  navegador y CI en cada cambio.
- **Siguiente paso:** las llaves de producción de Wompi y la revisión legal
  (`docs/launch-checklist.md`).

## Si algo falla

| Síntoma | Qué hacer |
| --- | --- |
| Wompi no carga o tarda | Cambia a **Pagar al recoger** y sigue; el flujo del negocio es el mismo |
| No vuelve a la app tras pagar | Toca "Volver a Luma" en la página, o abre el pedido: al volver a la app se relee el estado |
| El pago quedó "en proceso" | Admin → Operaciones → **Conciliar ahora** |
| No llega el aviso al teléfono | El estado cambia igual en la app; Admin → Operaciones → Notificaciones en mi teléfono envía uno de prueba |
| Sin internet en la sala | Activa los datos del teléfono y comparte la conexión con el portátil |
| La IA responde lento o falla | Responden las reglas; en el escaneo de menú, usa **Pegar mi menú como texto** |
| El negocio aparece cerrado | Ajusta el horario en Mi negocio → Horario para la hora de la demo |
| No llega el código de correo | Usa las cuentas ya confirmadas; no registres una cuenta nueva en vivo |
