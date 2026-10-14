import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getStoredUser } from '@/config/oidc-config'
import { isConnectionError, networkStatus } from '@/lib/network-status'
import { getActiveBranchId } from '@/stores/branch-store'

// Version sent with every API call; generated clients require it explicitly.
export const API_VERSION = '1.0'

// Single axios instance for all services. Every request goes through the BFF:
// same-origin in production, proxied to it by the Vite dev server in
// development (see vite.config.ts). The BFF matches most routes on an
// explicit api-version query parameter, so it is sent by default.
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
    // Branch-scoped endpoints resolve the branch from this header; the
    // header branch switcher controls it. A call that names its own branch
    // (an offline sale replayed where it was rung up) keeps it.
    const branchId = getActiveBranchId()
    if (branchId !== null && !config.headers.has('X-Branch-Id')) {
      config.headers['X-Branch-Id'] = String(branchId)
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Every call says whether the server is there (lib/network-status.ts): any
// answer, refusals included, means it is; no answer at all means it is not
apiClient.interceptors.response.use(
  (response) => {
    networkStatus.reportSuccess()
    return response
  },
  (error) => {
    if (isConnectionError(error)) {
      networkStatus.reportFailure()
    } else if (error instanceof AxiosError && error.response) {
      networkStatus.reportSuccess()
    }
    return Promise.reject(error)
  }
)
