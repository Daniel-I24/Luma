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
