# @ninja/config

The lint and format rules the six web apps share (step 0 of
`docs/frontend-architecture-plan.md`), a package of the npm workspace rooted
at `src/`. Each app lists `"@ninja/config": "*"` and keeps the ESLint and
Prettier plugins in its own `devDependencies`.

- `eslint.js`: `ninjaEslint(import.meta.url, options)`. Rules an app already
  passed are errors; the plan's new rules (files over 400 lines, shared code
  importing a feature, a feature or route naming a generated client outside its
  `api/` folder, console, type-only imports) are warnings.
- `prettier.js`: single quotes, no semicolons, 120 columns, sorted imports and
  Tailwind classes. Generated code (`src/api`, `*.gen.ts`) and the shadcn
  primitives (`src/components/ui`) are left alone (each app's
  `.prettierignore`).

## The warning cap

Each app's `npm run lint` is `eslint . --max-warnings N`, N being the count on
the day the cap was set. A change that adds a warning fails the pull request.
When a clean-up lowers the count, lower N in that app's `package.json` in the
same commit.

The data-layer rule came later the same day and raised the caps once to the new
count (it found 109 imports in the back office, 56 in the till, 26 in the console,
11 in the customer app, none in the kitchen); from there they only fall.

| App | Cap (2026-11-28) |
|---|---|
| admin_web | 182 |
| pos_web | 140 |
| client_web | 59 |
| control_web | 72 |
| kds_web | 8 |
| site_web | 0 |

`npm run format` formats an app; `npm run format:check` is what the pull
request runs.
