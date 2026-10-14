---
inclusion: always
---
# Diseño y design tokens

Luma debe sentirse moderna, elegante, limpia y profesional; mobile-first, poco ruido visual.
Referencia visual: `docs/design-prototype/` (prototipo HTML; solo referencia, no código para copiar).

## Identidad
- Color de marca: `#14174A` (azul profundo). Acento: `#5C6EFC` (IA y elementos interactivos). Tipografía: Inter (autoalojada con `@fontsource-variable/inter`).
- Temas (todos con la misma estructura de tokens): **Indigo** (por defecto), **Midnight**, **Pearl**, **Sunset**. El usuario elige en Perfil → Apariencia; se persiste.

## Tokens (CSS variables en `src/styles/tokens.css` dentro de `@theme`; temas en `src/styles/themes/*.css`)
Tailwind v4 genera utilidades a partir de ellos (`bg-surface`, `text-fg-muted`, `border-border`, `rounded-lg`, `shadow-card`, `text-h3`). La paleta por defecto de Tailwind está desactivada (`--color-*: initial`): solo existen colores semánticos.
- Fondo y superficie: `--color-canvas`, `-canvas-subtle`, `-canvas-muted`, `--color-surface`, `-surface-elevated`, `-surface-selected`, `--color-overlay`, `--color-map-canvas`.
- Texto: `--color-fg`, `-fg-muted`, `-fg-subtle`, `-fg-disabled`, `-fg-brand`, `-fg-accent`, `-fg-inverse`.
- Bordes: `--color-border`, `-border-strong`, `-border-subtle`, `-border-focus`.
- Acciones: `--color-primary` (`-hover`, `-pressed`, `-fg`), `--color-secondary` (`-fg`), `--color-accent` (`-hover`, `-fg`), `--color-rating`.
- Navegación: `--color-nav`, `-nav-active`, `-nav-active-bg`, `-nav-inactive`.
- Feedback: `--color-success|warning|danger|info` con `-bg` (fondo translúcido) y `-fg` (texto AA sobre ese fondo); `--color-danger-hover`, `--color-danger-fg-on`.
- Estado de negocio: `--color-status-open|closing-soon|closed|opening-soon` con `-bg` y `-fg`. Cerrado = rojo, abre pronto = azul, cierra pronto = ámbar, abierto = verde.
- Tipografía: `--text-display|h1|h2|h3|h4|title|body-lg|body|body-sm|label-lg|label|caption|price` (con line-height, letter-spacing y peso).
- Espaciado base 4px (`--spacing-*`, incluye `--spacing-11` = 44px de zona táctil), radios `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · full`, sombras `xs…xl`, `card`, `sheet`, `float`, `brand`.
- Movimiento: `--duration-fast 150ms · normal 250ms · slow 400ms`, `--ease-standard|emphasized|decelerate|spring`, animaciones `shimmer` y `fade-in-up`.
- Prohibido usar colores hexadecimales o tamaños literales en componentes: solo tokens.
- Contraste AA verificado en los 4 temas; donde el prototipo no lo cumplía se oscureció o aclaró el tono lo mínimo.

## Componentes base (design-system/)
Button, IconButton, Icon, Card, BottomSheet, Chip, StatusBadge, Input, SearchInput, Avatar, RatingStars, SectionHeader, BusinessCard, EmptyState, Toast, Skeleton, TabBar, Disclosure.

## Principios de UX
- Jerarquía visual clara, una acción principal por pantalla; el mapa abre primero un bottom sheet, no el perfil.
- Microinteracciones y transiciones suaves (150–400 ms), respetar `prefers-reduced-motion`.
- Skeletons en lugar de spinners; estados vacíos, de error y offline siempre diseñados.
- Zonas táctiles ≥ 44px, contraste AA en todos los temas, soporte de lectores de pantalla, safe areas del dispositivo.
- Iconografía consistente (un solo set SVG en `LumaIcon`), sin emojis como iconos, sin sobrecargar pantallas con información.
