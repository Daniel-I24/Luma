# Luma Design System

**Color primario:** `#14174A` &nbsp;·&nbsp; **Versión:** 2.0 &nbsp;·&nbsp; **Stack:** HTML · CSS Custom Properties · JavaScript ES6+

Un design system mobile-first completo para **Luma**, plataforma de descubrimiento gastronómico local. Incluye tokens, componentes, 4 temas y 7 pantallas interactivas — sin frameworks ni dependencias de build.

> Ver la presentación de la app → [`APP.md`](./APP.md)

---

## Inicio rápido

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/luma-design-system.git

# Abrir en el navegador — no requiere servidor
open index.html
```

No hay pasos de instalación. Todo funciona directamente en el navegador.

---

## Estructura del proyecto

```
luma-design-system/
│
├── index.html          # App completa — 7 pantallas interactivas
├── APP.md              # Presentación del producto
├── README.md           # Este archivo
│
├── css/
│   ├── tokens.css      # Design tokens: color, tipo, spacing, motion
│   ├── components.css  # Atoms → Molecules → Organisms
│   └── layout.css      # Dispositivo, status bar, navegación
│
└── js/
    ├── theme.js        # Motor de temas con persistencia
    ├── components.js   # Datos, bottom sheet, feed, IA, checkout
    └── app.js          # Navegación, microinteracciones, ajustes
```

---

## Pantallas

| # | Pantalla | Descripción |
|---|----------|-------------|
| 1 | **Mapa / Home** | Mapa compacto con marcadores, panel de negocios cercanos, búsqueda, filtros y bottom sheet |
| 2 | **Feed** | Tarjetas verticales swipeables de promociones |
| 3 | **Luma IA** | Selector de momento, combos IA personalizados, recomendados |
| 4 | **Restaurante** | Hero, stats, tabs Menú · Promos · Reseñas · Info |
| 5 | **Checkout** | Artículos, precios, pago, horario de recogida |
| 6 | **Order Tracking** | Progreso animado, ETA en tiempo real, mini mapa de ruta |
| 7 | **Perfil** | Stats, ajustes, selector de tema y de idioma |

---

## Temas

Cambia el tema desde los botones externos o desde **Perfil → Apariencia**.

| Tema | Color base | Carácter |
|------|-----------|----------|
| **Indigo** | `#14174A` | Predeterminado, elegante |
| **Midnight** | `#0c0d18` | Oscuro premium |
| **Pearl** | `#fafafa` | Limpio, minimalista |
| **Sunset** | `#fff8f2` | Energético, cálido |

---

## Tokens de referencia

### Color

```css
/* Marca */
--brand-primary-800: #14174A;   /* Color principal */
--brand-accent:      #5C6EFC;   /* Acento / IA */

/* Acción (varía por tema) */
--color-action-primary
--color-action-primary-hover
--color-action-primary-pressed
--color-action-text

/* Texto */
--color-text-primary / secondary / tertiary / disabled / brand / accent

/* Superficie */
--color-surface-default / elevated / selected

/* Feedback */
--color-success / warning / error / info

/* Estado de negocio */
--status-open / closing-soon / closed / opening-soon
```

### Espaciado

```css
--space-1: 4px   --space-2: 8px   --space-3: 12px  --space-4: 16px
--space-5: 20px  --space-6: 24px  --space-8: 32px  --space-10: 40px
```

### Motion

```css
--motion-fast:   150ms cubic-bezier(0.4, 0, 0.2, 1)
--motion-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1)
--motion-slow:   400ms cubic-bezier(0.2, 0, 0, 1)
--motion-spring: 350ms cubic-bezier(0.34, 1.56, 0.64, 1)
```

---

## Componentes destacados

### Atoms
`btn` · `btn-primary` · `btn-ghost` · `btn-accent` · `btn-destructive`
`chip` · `chip-selected` · `badge` · `status-badge` · `avatar` · `toggle` · `checkbox`

### Molecules
`search-input` · `ai-banner` · `promo-banner` · `rating` · `distance-indicator`

### Organisms
`business-card` · `business-card.ai-recommended` · `promo-card` · `menu-item`
`bottom-sheet` · `map-marker` · `ai-combo-card` · `order-card` · `tracking-step-row`
`checkout-section` · `payment-option` · `settings-item` · `profile-hero`

### Utilitarios
`skeleton` · `toast` · `state-screen` · `animate-in`

---

## Escalabilidad a Angular + Tailwind

Los tokens CSS se mapean directamente:

```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      'brand':  'var(--color-action-primary)',
      'accent': 'var(--brand-accent)',
    },
    borderRadius: {
      'app': 'var(--radius-xl)',
    }
  }
}
```

Cada componente está pensado como un Angular standalone component con `@Input()` para sus variantes.

---

## Nomenclatura

Los componentes siguen la convención `Componente / Variante / Tamaño / Estado`:

```
Button / Primary / Medium / Pressed
Business Card / AI Recommended
Map Marker / Closing Soon
Input / Search / Focus
Order Tracker / Preparing
```

---

## Dependencias externas

| Recurso | Uso |
|---------|-----|
| [Inter](https://fonts.google.com/specimen/Inter) | Tipografía principal |
| [Font Awesome 6](https://fontawesome.com/) | Iconografía |

Sin frameworks, sin bundler, sin Node.js requerido.

---

## Licencia

Proyecto académico — Diseño de Interfaces · 2026
