import type { AxiosInstance } from 'axios'

let registered: AxiosInstance | null = null

/**
 * The app's axios instance: its interceptors attach the bearer token, the branch
 * header and the api-version parameter, and route through the BFF. Every
 * generated client sends through it. Called once, where the app creates it
 * (lib/api-client.ts), before any request.
 */
export function registerApiClient(instance: AxiosInstance) {
  registered = instance
}

// A stand-in the generated clients hold from the start: it sends each request
// through the instance registered by then
const forward = ((config: Parameters<AxiosInstance['request']>[0]) => {
  if (!registered) throw new Error('No API client registered: the app calls registerApiClient in lib/api-client.ts')
  return registered(config)
}) as AxiosInstance

/** Read by the generated clients when they are created (runtimeConfigPath) */
export const createClientConfig = <T extends object>(config: T): T => ({
  ...config,
  baseURL: '',
  axios: forward,
})
