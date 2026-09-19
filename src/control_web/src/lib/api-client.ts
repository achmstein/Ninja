import axios, { type InternalAxiosRequestConfig } from 'axios'
import { getStoredUser } from '@/config/oidc-config'

// Single axios instance. Every request goes through the same origin:
// proxied to Control.API by the Vite dev server in development (see
// vite.config.ts), served next to the app in production.
// No default Content-Type: axios sets application/json for object bodies on
// its own, and a global default would override the multipart boundary on
// the logo upload (FormData puts then fail with 415).
export const apiClient = axios.create()

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredUser()?.access_token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)
