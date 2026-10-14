# Luma — Descubre lo que tienes cerca

> Plataforma de descubrimiento gastronómico local, pensada para conectar personas con los mejores restaurantes y comercios de su ciudad.

---

## ¿Qué es Luma?

**Luma** es una aplicación móvil diseñada para que descubrir restaurantes y comercios locales sea tan fácil como abrir el teléfono. Combina un mapa interactivo en tiempo real con un feed visual de contenido, inteligencia artificial y un sistema de pedidos integrado — todo desde una interfaz moderna, limpia y rápida.

El nombre *Luma* evoca luz, descubrimiento y cercanía: iluminar lo que está cerca pero aún no conoces.

---

## El problema que resuelve

Millones de pequeños y medianos comercios tienen poca visibilidad digital. Los usuarios, por su parte, suelen recurrir a plataformas genéricas que priorizan grandes cadenas, muestran información desactualizada o abruman con demasiado contenido.

Luma apuesta por una experiencia diferente: **cercana, visual, personalizada y honesta**.

---

## Cómo funciona

### 🗺 Mapa interactivo
La pantalla principal es un mapa donde los negocios aparecen como marcadores con código de color según su estado: abierto, cierra pronto, cerrado o abre pronto. Al tocar un marcador no se abre una pantalla nueva inmediatamente — primero aparece un **card flotante** con la información esencial: logo, nombre, categoría, rating, estado, horario, promoción activa y distancia. Desde ahí el usuario decide si quiere ver más o hacer un pedido.

### 📱 Feed vertical de descubrimiento
Un feed de desplazamiento vertical — similar al funcionamiento de TikTok — muestra promociones, platos, combos y novedades de los negocios cercanos. Cada publicación es altamente visual y muestra solo lo necesario: producto, precio, vigencia, negocio y acciones directas. El usuario puede guardar, compartir o pedir sin salir del feed.

### ✨ Luma IA — Recomendador inteligente
La inteligencia artificial de Luma analiza el momento del día, las preferencias del usuario, el historial de pedidos, las promociones activas, las calificaciones y la distancia para recomendar lugares y crear **combos personalizados**.

El usuario elige su momento — desayuno, media mañana, almuerzo, media tarde, cena o salida nocturna — y Luma construye automáticamente un combo con plato, acompañamiento y bebida, mostrando el precio total, el ahorro y el tiempo de preparación estimado.

### 🛒 Pedidos y checkout
Una vez decidido, el usuario puede hacer su pedido directamente desde la app. El checkout es limpio: resumen de artículos, desglose de precios, método de pago (tarjeta, efectivo, Nequi/Daviplata) y elección del momento de recogida (ahora, más tarde o mañana).

### 📦 Seguimiento en tiempo real
Tras confirmar el pedido, Luma muestra el progreso paso a paso: confirmado → preparando → listo → en camino → completado. Se indica el tiempo estimado restante, la información del negocio, el número de pedido y un mini mapa de ruta para llegar a recoger.

---

## Funcionalidades principales

| Función | Descripción |
|---------|-------------|
| **Mapa interactivo** | Negocios cercanos con estado en tiempo real |
| **Feed vertical** | Promociones y contenido visual swipeable |
| **Luma IA** | Combos y recomendaciones según momento del día |
| **Perfil de restaurante** | Menú, promos, reseñas, horarios y contacto |
| **Checkout integrado** | Pago, selección de método y horario de recogida |
| **Order Tracking** | Seguimiento animado del pedido con ETA |
| **Favoritos** | Guardar negocios y promociones |
| **Historial** | Registro de pedidos anteriores |
| **Reseñas y ratings** | Calificaciones verificadas por pedido |
| **Múltiples temas** | Indigo, Midnight, Pearl, Sunset |
| **Idioma** | Español, English, Português, Français |
| **Panel de negocios** | Gestión de productos, promos, horarios y pedidos |

---

## Para quién es Luma

**Usuarios finales** — personas que quieren descubrir restaurantes y comercios cercanos de forma visual, recibir recomendaciones personalizadas y hacer pedidos de manera sencilla.

**Negocios locales** — restaurantes, cafeterías y comercios que necesitan mayor visibilidad digital, gestionar su información, publicar promociones y administrar pedidos desde un panel propio.

---

## Identidad visual

El color primario de Luma es **`#14174A`** — un azul profundo que comunica confianza, tecnología y elegancia, sin caer en el azul corporativo genérico. Se complementa con un acento en **`#5C6EFC`** para los elementos interactivos y de IA.

La tipografía es **Inter**, elegida por su legibilidad en pantallas pequeñas y su personalidad moderna y neutral.

Los temas visuales permiten personalizar la experiencia sin romper la identidad de la marca:

| Tema | Carácter |
|------|---------|
| **Indigo** | Elegante, equilibrado, predeterminado |
| **Midnight** | Oscuro premium, ideal para la noche |
| **Pearl** | Limpio, minimalista, muy legible |
| **Sunset** | Energético, cálido, festivo |

---

## Tecnología prevista

- **Frontend**: Angular + Tailwind CSS con design tokens
- **Mapa**: Google Maps Platform / Mapbox
- **IA**: modelo propio de recomendación + LLM para combos
- **Backend**: API REST / GraphQL
- **Pagos**: Stripe / PSE / Nequi API
- **Tiempo real**: WebSockets para estado de pedidos

---

## Estado actual

Este repositorio contiene el **design system interactivo** de Luma: una simulación completa de la app en HTML/CSS/JS que valida los componentes, flujos, tokens y temas antes de la implementación en Angular.

---

*Luma*
