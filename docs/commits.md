# Commit conventions

[Conventional Commits](https://www.conventionalcommits.org/), in English:

```
<type>(<scope>): <summary in the imperative, no final dot>

<why and what, wrapped at 72; lists welcome>
```

- **type**: `feat` (user-visible), `fix`, `refactor` (no behaviour change),
  `perf`, `test`, `docs`, `build` (dependencies, tooling), `ci`, `chore`.
- **scope** (optional): the area — `auth`, `owner`, `route`, `ai`,
  `design-system`, `functions`, `db`, `scripts`, `round10`…
- One phase or one folder per commit when a prompt asks for phases; each
  commit leaves the Definition of Done green (CLAUDE.md).
- Migrations: the commit that adds one names it (`migration 57`).
- Never commit `src/environments/environment.ts`, keystores or anything from
  `%USERPROFILE%\luma-secrets`.
