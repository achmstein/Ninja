# @ninja/config

The lint and format rules the six web apps share (step 0 of
`docs/frontend-architecture-plan.md`), a package of the npm workspace rooted
at `src/`. Each app lists `"@ninja/config": "*"` and keeps the ESLint and
Prettier plugins in its own `devDependencies`.

- `eslint.js`: `ninjaEslint(import.meta.url, options)`. Rules an app already
  passed are errors; the plan's new rules (files over 400 lines, shared code
  importing a feature, console, type-only imports) are warnings.
- `prettier.js`: single quotes, no semicolons, 120 columns, sorted imports and
  Tailwind classes. Generated code (`src/api`, `*.gen.ts`) and the shadcn
  primitives (`src/components/ui`) are left alone (each app's
  `.prettierignore`).

## The warning cap

Each app's `npm run lint` is `eslint . --max-warnings N`, N being the count on
the day the cap was set. A change that adds a warning fails the pull request.
When a clean-up lowers the count, lower N in that app's `package.json` in the
same commit.

| App | Cap (2026-11-28) |
|---|---|
| admin_web | 75 |
| pos_web | 88 |
| client_web | 48 |
| control_web | 47 |
| kds_web | 12 |
| site_web | 0 |

`npm run format` formats an app; `npm run format:check` is what the pull
request runs.
