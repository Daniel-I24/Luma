---
inclusion: always
---
# Arquitectura y estructura de carpetas

Arquitectura modular por feature, con dependencias en una sola dirección:
`features → shared → core` (nunca al revés, y ningún feature importa de otro feature).

```
src/app/
  core/          # singleton: auth, interceptors, guards, config, error handling, supabase client
  shared/        # cuenta, negocio, pedidos, pagos, promociones, avisos, mapa, formularios, errores…
  features/
    auth/  account-*/  onboarding/  profile/  map/  feed/  promotions/  ai/  cart/  checkout/
    orders/  notifications/  favorites/  business-profile/  legal/  help/  download/  not-found/
    owner/   # Luma Negocios (lazy, protegida por tipo de cuenta)
    admin/   # equipo de revisión (lazy, verificada con admin_access y MFA)
    <feature>/{pages,components,services,state,utils}
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
