// Generates the typed API client + TanStack Query helpers from the OpenAPI
// document that Control.API emits at build time (see the
// OpenApiDocumentsDirectory property in Control.API.csproj).
//
// Same pattern as the other web apps, but the control panel talks to one
// service only.
//
// Usage: npm run generate:api
import { createClient } from '@hey-api/openapi-ts'

const services = [['control', '../Control.API/Control.API.json']]

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
