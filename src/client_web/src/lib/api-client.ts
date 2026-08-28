import axios, { type InternalAxiosRequestConfig } from 'axios'
import { getActiveBranchId } from '@/stores/branch-store'
import { getStoredUser } from './oidc'

export const API_VERSION = '1.0'

// Single axios instance for all services. Every request goes through the BFF:
// same-origin in production, proxied to it by the Vite dev server. The BFF
// matches most routes on an explicit api-version query parameter.
// Branch-scoped endpoints resolve the branch from the X-Branch-Id header.
// No default Content-Type: axios sets application/json for object bodies on
// its own, and a global default would override the multipart boundary on
// file uploads (FormData posts then fail with 415).
export const apiClient = axios.create({
  params: { 'api-version': API_VERSION },
})

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredUser()?.access_token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    config.headers['X-Branch-Id'] = String(getActiveBranchId())
    return config
  },
  (error) => Promise.reject(error)
)
