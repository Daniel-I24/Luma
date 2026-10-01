---
inclusion: always
---
# Arquitectura y estructura de carpetas

Arquitectura modular por feature, con dependencias en una sola dirección:
`features → shared → core` (nunca al revés, y ningún feature importa de otro feature).

```
src/app/
  core/          # singleton: auth, interceptors, guards, config, error handling, supabase client
  shared/        # UI reutilizable (ui/), pipes, directives, utils, modelos comunes
  features/
    auth/  profile/  map/  feed/  businesses/  orders/  payments/
    ai-recommender/  favorites/  reviews/  notifications/  settings/
    business-panel/            # sección para negocios (lazy, protegida por rol)
    <feature>/{pages,components,services,state,models,data}
  design-system/ # tokens, temas, componentes base (button, card, bottom-sheet, chip…)
supabase/
  migrations/  functions/  seed.sql  tests/
```

## Reglas
- Un feature = una carpeta autocontenida y con su propia ruta lazy.
- Los modelos de BD se generan desde Supabase (types) y se mapean a modelos de dominio.
- Estado: Signals + servicios por feature; sin estado global salvo sesión y tema.
- Cada spec de Kiro corresponde a un feature y termina con tests y documentación en `docs/`.
- Decisiones de arquitectura importantes se registran en `docs/adr/NNN-titulo.md`.
