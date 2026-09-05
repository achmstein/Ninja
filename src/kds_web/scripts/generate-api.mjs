// Generates typed API clients + TanStack Query helpers from the OpenAPI
// documents that the backend services emit at build time (see the
// OpenApiDocumentsDirectory property in each *.API.csproj).
//
// Same pattern as pos_web, but only what the kitchen display talks to: the
// orders it prepares, and the branch list for the switcher.
//
// Usage: npm run generate:api
import { createClient } from '@hey-api/openapi-ts'

const services = [
  ['ordering', '../Ordering.API/Ordering.API.json'],
  ['branch', '../Branch.API/Branch.API.json'],
]

for (const [name, input] of services) {
  console.log(`Generating ${name} client from ${input}`)
  await createClient({
    input,
    output: `src/api/${name}`,
    plugins: [
      {
        name: '@hey-api/client-axios',
        runtimeConfigPath: './src/lib/hey-api',
      },
      '@tanstack/react-query',
    ],
  })
}
