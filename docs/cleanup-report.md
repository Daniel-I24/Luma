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
