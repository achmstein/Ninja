// Generates the typed API clients and TanStack Query helpers once, for every web
// app, from the OpenAPI documents the services emit at build time (the
// OpenApiDocumentsDirectory property in each *.API.csproj).
//
// Usage (from this folder): npm run generate
import { createClient } from '@hey-api/openapi-ts'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Every request carries api-version from the app's axios instance (its default
// params), so the parameter is taken out of the documents: call sites never name it
const scratch = join(tmpdir(), 'ninja-api-specs')
mkdirSync(scratch, { recursive: true })
function withoutApiVersion(name, input) {
  const spec = JSON.parse(readFileSync(input, 'utf8'))
  const drop = (params) => params?.filter((p) => p?.name !== 'api-version')
  for (const path of Object.values(spec.paths ?? {})) {
    if (path.parameters) path.parameters = drop(path.parameters)
    for (const op of Object.values(path)) {
      if (op && typeof op === 'object' && Array.isArray(op.parameters)) op.parameters = drop(op.parameters)
    }
  }
  const out = join(scratch, `${name}.json`)
  writeFileSync(out, JSON.stringify(spec))
  return out
}

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
    input: withoutApiVersion(name, input),
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
