// One ESLint config for the six web apps (docs/frontend-architecture-plan.md,
// step 0). Each app's eslint.config.js is two lines:
//
//   import { ninjaEslint } from '@ninja/config/eslint'
//   export default ninjaEslint(import.meta.url, { ... })
//
// The plugins are loaded as the calling app resolves them (its devDependencies).
//
// Severity: rules an app already passed stay errors. Everything new is a
// warning, and each app's lint script caps warnings with --max-warnings at
// today's count, so the count can only go down. Lower the cap as it falls.
import { createRequire } from 'node:module'

const SHARED_IGNORES = [
  'dist',
  'dist-ssr',
  'coverage',
  'src/api/**',
  'src/routeTree.gen.ts',
  'src/components/ui/**',
]

// Code no single feature owns. It must never reach into a feature (rule 1).
const SHARED_DIRS = [
  'src/components/**',
  'src/lib/**',
  'src/stores/**',
  'src/hooks/**',
  'src/utils/**',
  'src/context/**',
  'src/shared/**',
  'src/config/**',
]

const UNUSED = [
  'error',
  {
    args: 'all',
    argsIgnorePattern: '^_',
    caughtErrors: 'all',
    caughtErrorsIgnorePattern: '^_',
    destructuredArrayIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    ignoreRestSiblings: true,
  },
]

/**
 * @param {string} appUrl the app's import.meta.url
 * @param {object} [options]
 * @param {boolean} [options.adopting] the app had no lint before: every rule
 *   is a warning until its count is down
 * @param {string[]} [options.errors] rules this app already passes: errors
 * @param {string[]} [options.ignores] more paths not linted
 * @param {boolean} [options.query] lint TanStack Query use (default: when the
 *   app depends on it)
 * @param {object} [options.rules] rule overrides, applied last
 */
export function ninjaEslint(appUrl, options = {}) {
  const load = createRequire(appUrl)
  const pkg = load('./package.json')
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }

  const js = load('@eslint/js')
  const tseslint = load('typescript-eslint')
  const globals = load('globals')
  const reactHooks = load('eslint-plugin-react-hooks')
  const reactRefresh = load('eslint-plugin-react-refresh')
  const useQuery = options.query ?? Boolean(deps['@tanstack/react-query'])
  const pluginQuery = useQuery ? load('@tanstack/eslint-plugin-query') : null

  const files = ['**/*.{ts,tsx}']
  const promoted = new Set(options.errors ?? [])

  // The rule sets every app is held to.
  const base = [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...(pluginQuery ? pluginQuery.configs['flat/recommended'] : []),
    {
      plugins: {
        'react-hooks': reactHooks,
        'react-refresh': reactRefresh,
      },
      languageOptions: { ecmaVersion: 2022, globals: globals.browser },
      rules: {
        ...reactHooks.configs.recommended.rules,
        'react-refresh/only-export-components': [
          'warn',
          { allowConstantExport: true },
        ],
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': UNUSED,
      },
    },
  ]

  // The plan's rules, new to most apps: warnings unless promoted.
  const plan = [
    {
      rules: {
        // Rule 6: small files. 300 is the aim, 400 the warning.
        'max-lines': ['warn', { max: 400 }],
        'no-console': 'warn',
        'no-duplicate-imports': 'warn',
        '@typescript-eslint/consistent-type-imports': [
          'warn',
          {
            prefer: 'type-imports',
            fixStyle: 'inline-type-imports',
            disallowTypeAnnotations: false,
          },
        ],
      },
    },
    {
      // Rule 2 (the data layer): a feature talks to the server only through its
      // api/ folder (queries.ts, mutations.ts); screens, hooks and routes never
      // name a generated function
      files: ['src/features/**/*.{ts,tsx}', 'src/routes/**/*.{ts,tsx}'],
      ignores: ['src/features/*/api/**'],
      rules: {
        'no-restricted-imports': [
          'warn',
          {
            patterns: [
              {
                group: ['@ninja/api/*/sdk.gen', '@ninja/api/*/@tanstack/react-query.gen'],
                message:
                  "Talk to the server from the feature's api/ folder (queries.ts, mutations.ts), and use those here.",
              },
            ],
          },
        ],
      },
    },
    {
      // Rule 1: shared code never imports a feature.
      files: SHARED_DIRS.map((d) => `${d}/*.{ts,tsx}`),
      rules: {
        'no-restricted-imports': [
          'warn',
          {
            patterns: [
              {
                group: ['@/features/*', '@/features/*/**', '**/features/**'],
                message:
                  'Shared code must not import a feature: move what both need into shared code, or pass it in.',
              },
            ],
          },
        ],
      },
    },
  ]

  const configs = [...base, ...plan].map((c) => ({
    ...c,
    files: c.files ?? files,
    ...(c.rules && { rules: retune(c.rules, options.adopting, promoted) }),
  }))

  return [
    { ignores: [...SHARED_IGNORES, ...(options.ignores ?? [])] },
    ...configs,
    ...(options.rules ? [{ files, rules: options.rules }] : []),
  ]
}

// Warnings while adopting; errors for the rules an app already passes.
function retune(rules, adopting, promoted) {
  const out = {}
  for (const [name, value] of Object.entries(rules)) {
    let v = value
    if (adopting) v = setSeverity(v, 'warn')
    if (promoted.has(name)) v = setSeverity(v, 'error')
    out[name] = v
  }
  return out
}

function setSeverity(value, level) {
  const sev = Array.isArray(value) ? value[0] : value
  if (sev === 'off' || sev === 0) return value
  return Array.isArray(value) ? [level, ...value.slice(1)] : level
}
