// Generates the typed API clients and TanStack Query helpers once, for every web
// app, from the OpenAPI documents the services emit at build time (the
// OpenApiDocumentsDirectory property in each *.API.csproj).
//
// Usage (from this folder): npm run generate
import { createClient } from '@hey-api/openapi-ts'

const services = [
  ['accounts', '../../Accounts.API/Accounts.API.json'],
  ['catalog', '../../Catalog.API/Catalog.API.json'],
  ['control', '../../Control.API/Control.API.json'],
  ['finance', '../../Finance.API/Finance.API.json'],
  ['inventory', '../../Inventory.API/Inventory.API.json'],
  ['loyalty', '../../Loyalty.API/Loyalty.API.json'],
  ['ordering', '../../Ordering.API/Ordering.API.json'],
  ['payroll', '../../Payroll.API/Payroll.API.json'],
  ['sales', '../../Sales.API/Sales.API.json'],
  ['spaces', '../../Spaces.API/Spaces.API.json'],
  ['tenant', '../../Tenant.API/Tenant.API.json'],
]

for (const [name, input] of services) {
  console.log(`Generating ${name} client from ${input}`)
  await createClient({
    input,
    output: `src/gen/${name}`,
    plugins: [
      {
        name: '@hey-api/client-axios',
        // Every client sends through the axios instance the app registers (runtime.ts)
        runtimeConfigPath: './src/runtime',
      },
      '@tanstack/react-query',
    ],
  })
}
