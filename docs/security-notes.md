# Notas de seguridad

## Auditoría de dependencias

- El CI ejecuta `npm audit --omit=dev --audit-level=high`: falla si alguna
  dependencia que llega a la app tiene una vulnerabilidad alta o crítica.
- Dependabot (`.github/dependabot.yml`) revisa cada semana npm y las GitHub
  Actions y abre PRs de actualización.

## Riesgos aceptados

### uuid < 11.1.1 vía xcode y @capacitor/cli (moderada)

| Campo | Detalle |
|---|---|
| Aviso | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) — falta de comprobación de límites en `uuid` v3/v5/v6 cuando se pasa `buf` |
| Cadena | `@capacitor/cli@8.5.x` → `xcode@3.0.1` → `uuid@7.0.3` |
| Severidad | Moderada (3 entradas en `npm audit`: `@capacitor/cli`, `xcode`, `uuid`) |
| Alcance | Solo herramientas de desarrollo: `@capacitor/cli` es devDependency y `xcode` se usa al generar o sincronizar el proyecto iOS en la máquina del desarrollador. Nada de esto llega al bundle web ni a la app instalada. `npm audit --omit=dev` no lo reporta. |
| Por qué no se corrige ya | `npm audit fix --force` propone cambiar `@capacitor/cli` a 8.4.3, marcado como cambio mayor (es una bajada de versión). No se fuerza para no desalinear la CLI con `@capacitor/core` y `@capacitor/android`. |
| Mitigación | No llamar a funciones de `uuid` con buffers no confiables (Luma no lo hace) y ejecutar la CLI solo sobre el proyecto propio. |
| Revisión | Cuando Capacitor publique una CLI con `xcode`/`uuid` actualizados (Dependabot abrirá el PR), o antes de configurar el build de iOS. |
| Aceptado | 2026-10-14 |

## Historial

- 2026-10-14 — `maplibre-gl` actualizado de 5.x a 6.14.0 por
  [GHSA-jrc7-96c5-q579](https://github.com/advisories/GHSA-jrc7-96c5-q579)
  (XSS crítico en el saneador del control de atribución, sin parche en 5.x).
