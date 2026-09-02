// Generates typed API clients + TanStack Query helpers from the OpenAPI
// documents that the backend services emit at build time (see the
// OpenApiDocumentsDirectory property in each *.API.csproj).
//
// Same pattern as admin_web, but only the services the POS talks to.
//
// Usage: npm run generate:api
import { createClient } from '@hey-api/openapi-ts'

const services = [
  ['sales', '../Sales.API/Sales.API.json'],
  ['spaces', '../Spaces.API/Spaces.API.json'],
  ['ordering', '../Ordering.API/Ordering.API.json'],
  ['catalog', '../Catalog.API/Catalog.API.json'],
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
