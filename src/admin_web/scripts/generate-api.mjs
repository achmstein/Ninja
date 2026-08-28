// Generates typed API clients + TanStack Query helpers from the OpenAPI
// documents that the backend services emit at build time (see the
// OpenApiDocumentsDirectory property in each *.API.csproj).
//
// Usage: npm run generate:api
import { createClient } from '@hey-api/openapi-ts'

const services = [
  ['catalog', '../Catalog.API/Catalog.API.json'],
  ['ordering', '../Ordering.API/Ordering.API.json'],
  ['rooms', '../Rooms.API/Rooms.API.json'],
  ['accounts', '../Accounts.API/Accounts.API.json'],
  ['loyalty', '../Loyalty.API/Loyalty.API.json'],
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
