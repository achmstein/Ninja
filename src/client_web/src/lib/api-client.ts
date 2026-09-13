import axios, { type InternalAxiosRequestConfig } from "axios";
import { getActiveBranchId } from "@/stores/branch-store";
import { getGuestId } from "@/stores/guest-store";
import { getStoredUser } from "./oidc";

export const API_VERSION = "1.0";

// Single axios instance for all services. Every request goes through the BFF:
// same-origin in production, proxied to it by the Vite dev server. The BFF
// matches most routes on an explicit api-version query parameter.
// Branch-scoped endpoints resolve the branch from the X-Branch-Id header.
// No default Content-Type: axios sets application/json for object bodies on
// its own, and a global default would override the multipart boundary on
// file uploads (FormData posts then fail with 415).
export const apiClient = axios.create({
  params: { "api-version": API_VERSION },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // The same test as auth.isAuthenticated: an expired session left in
    // storage is not a sign-in. Sending its token would make the API treat
    // the call as anonymous while the guest header stays off.
    const user = getStoredUser();
    const token = user && !user.expired ? user.access_token : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // Only meaningful with no token: it is how a guest is recognised as the
      // one who placed their orders. A signed-in customer is their token.
      const guestId = getGuestId();
      if (guestId) {
        config.headers["X-Guest-Id"] = guestId;
      }
    }
    config.headers["X-Branch-Id"] = String(getActiveBranchId());
    return config;
  },
  (error) => Promise.reject(error),
);
