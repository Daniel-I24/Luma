# Cleanup report

What the Definition of Done cleanup (CLAUDE.md) found and removed at the end
of each phase. Tools: `npx knip` (config in `knip.json`) and `npx depcheck`.
Nothing is removed without proof that it is unused (no references, every
check green).

## Round 2, phase 0 (2026-10-24)

Removed: nothing.

Findings kept, with the reason:

| Finding | Tool | Why it stays |
| --- | --- | --- |
| `@fontsource-variable/inter` unused | knip, depcheck | imported from `src/styles.css` (CSS, not seen by the tools); replaced in phase 4 |
| `prettier` unused | knip, depcheck | CLI tool named in `.kiro/steering/tech.md` |
| `@angular/build`, `@angular/compiler-cli`, `tslib`, `postcss`, `tailwindcss`, `@tailwindcss/postcss` unused | depcheck | used by the Angular builder and the PostCSS pipeline, not imported |
| `@capacitor/android` unused | depcheck | native platform package loaded by the Capacitor CLI |
| `@std/assert`, `@core/*`, `@shared/*` missing | depcheck | Deno import map (`deno.json`) and TypeScript path aliases |
| 69 unused exports, 94 unused exported types | knip | mostly constants and types exported for specs; cleaned when phase 6 turns `.util.ts` files into classes (docs/DECISIONS.md) |

## Round 2, phase 1 (2026-10-24)

Removed: nothing. knip reports no unused files or dependencies; the unused
exports list is unchanged in kind (phase 6). No migration of round 1 was
touched; redefinitions live in new files.

## Round 2, phase 2 (2026-10-24)

Removed: nothing. Hard-coded provider URLs moved into named constants
(`_shared/config/provider-urls.ts`, `core/config/external-urls.ts`); no
file became unused.

## Round 2, phase 3 (2026-10-26)

Removed: the translation keys `auth.signup.personal.phoneHintOwner` and
`phoneHintCustomer` (the mobile is required for every account now; no
reference left). The app-side `Money` draft was not added (docs/DECISIONS.md).
knip: no unused files or dependencies.

## Round 2, phase 4 (2026-10-26)

Removed: the old splash PNGs and launcher template layers (vector icons
replace them), the `pulse`, `spring`, `bounce` and `fade-in-up` motion
tokens and the `pulse-ring` keyframes (no reference left), the Inter font
package. knip: no unused files or dependencies.

## Round 2, phase 5 (2026-10-26)

Removed: nothing. The design preview is no longer bundled in production
(dev-routes.ts replaced), the code stays for development.

## Round 2, phase 6 (2026-10-27)

- Renamed every `*.util.ts` (and its spec) when its functions became
  classes: e.g. `pickup-slots.util.ts` → `pickup-slots.ts`,
  `sheet-drag.util.ts` → `sheet-drag-math.ts`, `combo.util.ts` →
  `combo-builder.ts`, `normalize-text.util.ts` → `text-normalizer.ts`.
- `export` removed from 48 symbols used only inside their own file
  (knip "unused exports"); the constant `HOURS_PER_DAY` deleted (unused).
- `LumaToastHost` removed from the design-system barrel (imported by path
  so it stays out of the barrel's eager graph).
- Kept on purpose: the design-system barrel's type re-exports (its public
  API) and the Edge Function exports (Deno modules, outside this pass).
