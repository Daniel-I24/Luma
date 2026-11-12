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

### minimatch 10.2.x y glob 13.0.x (moderadas, solo desarrollo)

| Campo | Detalle |
|---|---|
| Avisos | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) (`minimatch`, denegación de servicio con patrones) y [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) (`glob`, cancelación con `AbortSignal`) |
| Cadena | `eslint`, `@eslint/*` y `typescript-eslint` → `minimatch@10.2.6`; `@capacitor/cli@8.5.3` → `rimraf@6.1.3` → `glob@13.0.6` |
| Severidad | Moderada (12 de las 15 entradas de `npm audit`; las otras 3 son `uuid`, arriba) |
| Alcance | Solo herramientas de desarrollo (lint y la CLI de Capacitor) sobre los archivos del propio repositorio; nada llega al bundle ni a la app. `npm audit --omit=dev` da 0. |
| Por qué no se corrige ya | El arreglo que propone `npm audit` baja `eslint` a 9.x (cambio mayor). |
| Revisión | Con las próximas versiones de eslint, typescript-eslint y Capacitor (Dependabot). |
| Aceptado | 2026-11-12 (ya estaban antes de esa fecha; se documentan ahora) |

### vite 8.3.0 dentro de @angular/build 22.2.4 (alta, solo desarrollo)

| Campo | Detalle |
|---|---|
| Avisos | GHSA-9jrq-w75r-8gcw, GHSA-rq7h-c2jc-7f22, GHSA-vfpm-58rq-9qcg (servidor de desarrollo de Vite) y GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw, GHSA-587h-7wmj-h5pm (`launch-editor`) |
| Cadena | `@angular/build@22.2.4` (la última estable) fija `vite@8.3.0` |
| Alcance | Solo `ng serve` en la máquina del desarrollador. El build de producción no incluye Vite y `npm audit --omit=dev` da 0. |
| Por qué no se corrige ya | `npm audit fix --force` bajaría `@angular/build` a 22.1.9 (cambio mayor, desalinea con Angular 22.2). |
| Mitigación | `ng serve` solo en `localhost` (sin `--host 0.0.0.0`), no abrir enlaces de terceros mientras corre. |
| Revisión | Con la próxima versión de `@angular/build` (Dependabot). |
| Aceptado | 2026-10-26 |

## Historial

- 2026-11-12 — `npm audit` ya no reporta vite: `@angular/build@22.2.5` trae
  `vite@8.3.5`. La entrada de vite 8.3.0 de arriba queda como historia.

- 2026-10-26 — `npm audit fix` (sin `--force`) actualiza `fast-uri` y
  `undici` (dependencias de desarrollo).

- 2026-10-14 — `maplibre-gl` actualizado de 5.x a 6.14.0 por
  [GHSA-jrc7-96c5-q579](https://github.com/advisories/GHSA-jrc7-96c5-q579)
  (XSS crítico en el saneador del control de atribución, sin parche en 5.x).
