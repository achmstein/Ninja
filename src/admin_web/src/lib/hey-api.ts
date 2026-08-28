import { apiClient } from './api-client'

// Runtime configuration for the generated API clients (see
// scripts/generate-api.mjs). Every generated client reuses the shared axios
// instance, which routes through the BFF and attaches the bearer token and
// api-version parameter.
export const createClientConfig = <T extends object>(config: T): T => ({
  ...config,
  baseURL: '',
  axios: apiClient,
})
