---
inclusion: always
---
# Stack y estándares técnicos de Luma

## Stack (versiones fijas, sin `latest`)
- Frontend: Angular (última LTS estable), standalone components, Signals, control flow `@if/@for`, TypeScript `strict`.
- Estilos: Tailwind CSS con design tokens como CSS variables (ver `design-tokens.md`).
- Móvil: Capacitor (Android/iOS) sobre la misma base de código; PWA como respaldo.
- Backend: Supabase (Postgres, Auth, Storage, Realtime, Edge Functions en TypeScript/Deno).
- Mapa: MapLibre GL JS. Pagos: Wompi (checkout/tokenización alojada). IA: Claude API, solo desde Edge Functions.
- Tests: Vitest/Jest (unitarios), Playwright (E2E). Calidad: ESLint, Prettier, Husky + lint-staged.
- CI/CD: GitHub Actions (lint → test → build → audit). Web en Vercel.

## Reglas de código
- Prohibido `any`; usar tipos estrictos, `unknown` + validación con Zod en bordes del sistema.
- Componentes pequeños, `ChangeDetectionStrategy.OnPush`, sin lógica de negocio en templates.
- Lógica de negocio en servicios/facades por feature; acceso a datos solo a través de repositorios.
- Nada de `console.log` ni secretos en el código. Variables por entorno (`.env` fuera de Git).
- Toda función pública con manejo explícito de errores; nunca tragar excepciones.
- Código y nombres en inglés; textos de UI en español (i18n con archivos de traducción, no strings sueltos).
- Commits con Conventional Commits; PRs pequeños; ningún merge con CI en rojo.

## Rendimiento
- Lazy loading por feature (rutas), `@defer` para bloques pesados, imágenes WebP/AVIF con `loading="lazy"`.
- Paginación por cursor en feed y listados; nunca cargar colecciones completas.
- Presupuestos de bundle en `angular.json`; Lighthouse móvil ≥ 90 como meta.

## Definition of Done
Lint sin errores, tests del feature pasando, cobertura mínima 80% en lógica de negocio, build de producción limpio, sin vulnerabilidades altas/críticas en `npm audit`, accesibilidad revisada (contraste AA, foco, labels).
