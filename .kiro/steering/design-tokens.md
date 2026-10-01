---
inclusion: always
---
# Diseño y design tokens

Luma debe sentirse moderna, elegante, limpia y profesional; mobile-first, poco ruido visual.

## Identidad
- Color de marca: `#2A1F8C` (azul índigo). Acento: `#7C5CFC`. Tipografía: Inter.
- Temas (todos con la misma estructura de tokens): **Indigo** (por defecto), **Midnight**, **Pearl**, **Sunset**. El usuario elige en Configuración; se persiste por usuario.

## Tokens (CSS variables, mapeadas en Tailwind v4 con `@theme` dentro de `styles.css`)
- Semánticos, no literales: `--color-bg`, `--color-surface`, `--color-surface-elevated`, `--color-text`, `--color-text-muted`, `--color-primary`, `--color-accent`, `--color-border`, `--color-success/warning/danger`.
- Estado de negocio: `--status-open`, `--status-closed`, `--status-opening-soon`, `--status-closing-soon`.
- Escalas de espaciado (base 4px), radios, sombras, tipografía y duraciones de animación como tokens.
- Prohibido usar colores hexadecimales directos en componentes: solo tokens.

## Componentes base (design-system/)
Button, IconButton, Card, BottomSheet, Chip/StatusBadge, Input, Modal, Toast, Skeleton, Avatar, RatingStars, TabBar, EmptyState.

## Principios de UX
- Jerarquía visual clara, una acción principal por pantalla; el mapa abre primero un bottom sheet, no el perfil.
- Microinteracciones y transiciones suaves (150–300 ms), respetar `prefers-reduced-motion`.
- Skeletons en lugar de spinners; estados vacíos, de error y offline siempre diseñados.
- Zonas táctiles ≥ 44px, contraste AA en todos los temas, soporte de lectores de pantalla, safe areas del dispositivo.
- Iconografía consistente (un solo set), sin sobrecargar pantallas con información.
