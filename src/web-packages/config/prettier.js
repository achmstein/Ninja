// One Prettier config for the six web apps. Each app's prettier.config.js:
//
//   export { default } from '@ninja/config/prettier'
//
// Plugins are resolved from the folder Prettier runs in, so each app lists
// prettier, @trivago/prettier-plugin-sort-imports and
// prettier-plugin-tailwindcss in its devDependencies.

/** @type {import('prettier').Config} */
export default {
  arrowParens: 'always',
  semi: false,
  tabWidth: 2,
  printWidth: 120,
  singleQuote: true,
  jsxSingleQuote: true,
  trailingComma: 'es5',
  bracketSpacing: true,
  endOfLine: 'lf',
  plugins: [
    '@trivago/prettier-plugin-sort-imports',
    'prettier-plugin-tailwindcss',
  ],
  importOrder: [
    '^path$',
    '^vite$',
    '^@vitejs/(.*)$',
    '^react$',
    '^react-dom/client$',
    '^react/(.*)$',
    '^globals$',
    '^zod$',
    '^axios$',
    '^date-fns$',
    '^react-hook-form$',
    '^use-intl$',
    '^@radix-ui/(.*)$',
    '^@hookform/resolvers/zod$',
    '^@tanstack/react-query$',
    '^@tanstack/react-router$',
    '^@tanstack/react-table$',
    '<THIRD_PARTY_MODULES>',
    '^@ninja/(.*)$',
    '^@/assets/(.*)',
    '^@/api/(.*)$',
    '^@/stores/(.*)$',
    '^@/lib/(.*)$',
    '^@/utils/(.*)$',
    '^@/constants/(.*)$',
    '^@/context/(.*)$',
    '^@/hooks/(.*)$',
    '^@/components/layouts/(.*)$',
    '^@/components/ui/(.*)$',
    '^@/components/errors/(.*)$',
    '^@/components/(.*)$',
    '^@/features/(.*)$',
    '^[./]',
  ],
  // Side-effect imports (CSS, polyfills) keep their order
  importOrderSideEffects: false,
}
