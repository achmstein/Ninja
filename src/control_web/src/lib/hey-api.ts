import { apiClient } from './api-client'

// Runtime configuration for the generated API client (see
// scripts/generate-api.mjs): it reuses the shared axios instance, which
// attaches the bearer token.
export const createClientConfig = <T extends object>(config: T): T => ({
  ...config,
  baseURL: '',
  axios: apiClient,
})
