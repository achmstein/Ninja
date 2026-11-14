import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getStoredUser } from '@/config/oidc-config'
import { isConnectionError, networkStatus, useNetworkStatus } from '@/lib/network-status'
import { trackOwnOrders } from '@/lib/own-orders'
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

/**
 * How an expired sign-in is renewed (context/session.ts), handed in at start
 * so this file does not reach into the session's own.
 */
let renewSession: (() => Promise<unknown>) | null = null
export const setSessionRenewer = (renew: () => Promise<unknown>) => {
  renewSession = renew
}

/** How long a call waits for the renewal before it goes with what it has */
const RENEWAL_WAIT_MS = 8_000

/**
 * A till opened after a night shut has a sign-in whose token ran out. Its
 * pages come up at once on the stored sign-in, and their first calls used to
 * go out with the dead token: every one was refused together (the bills, the
 * stays, the orders, the shift), a refusal is not tried again, and the floor
 * sat with places taken and no bills until a reload. A call now waits for the
 * renewal first. Offline there is nothing to renew against, so it does not wait.
 */
async function freshToken(): Promise<string | undefined> {
  const user = getStoredUser()
  if (!user?.expired || !renewSession || !useNetworkStatus.getState().online) return user?.access_token
  await Promise.race([
    renewSession().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, RENEWAL_WAIT_MS)),
  ])
  return getStoredUser()?.access_token
}

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await freshToken()
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

// The sales this till sends are remembered, so it does not alert its own cashier about them (lib/own-orders.ts)
trackOwnOrders(apiClient)
