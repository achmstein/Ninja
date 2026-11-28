import { createStaffBrand, useBrand, type Brand, type FeatureKey } from '@ninja/web-core/brand'
import { useCurrency } from '@/lib/currency'
import { useLanguage } from '@/lib/i18n'
import { setPhoneCountry } from '@/lib/phone'
import { applyBrandTheme } from './brand-theme'

export {
  ALL_FEATURES,
  brandDisplayName,
  brandQueryKey,
  brandQueryOptions,
  useBrand,
  useBrandName,
  useFeatures,
  type Brand,
  type FeatureKey,
} from '@ninja/web-core/brand'
export { PLATFORM_NAME } from '@ninja/web-core/platform'

// The back office: the business's name, mark and icons; prices and phone numbers in its currency and country
export const { applyBrand, bootBrand, useBrandEffects } = createStaffBrand({
  useLanguage,
  app: 'admin',
  onApply: (brand) => {
    // Prices are the business's whatever the surface wears
    useCurrency.getState().set(brand.locale.currency)
    // And its phone numbers are read and shown its country's way
    setPhoneCountry(brand.locale.country)
    applyBrandTheme(null)
  },
})

/**
 * Bought (in the plan or as an add-on), or already on: an add-on's setup
 * page shows from then, before the owner switches it on.
 */
export function entitledTo(brand: Brand, key: FeatureKey): boolean {
  return brand.entitlements?.[key] === true || brand.features[key] === true
}

/**
 * A cloud kitchen cooks for pickup only: it has no tables, so nothing about
 * places (the floor, QR codes, a waiter call) is offered. The kind of place
 * is the business's, chosen when it was created; false until the brand is known.
 */
export function useIsCloudKitchen(): boolean {
  return useBrand()?.businessType === 'cloud_kitchen'
}

/** Where customers open the menu: the brand's customerUrl, else the platform's default for this host. */
export function useCustomerOrigin(): string {
  return useBrand()?.customerUrl ?? defaultCustomerOrigin()
}

/**
 * Where the customer app lives when the brand does not say. A build may be
 * told (VITE_CUSTOMER_URL: the dev AppHost points it at client-web); otherwise
 * it is this host without its `admin.` label, which is the platform's rule —
 * the business's admin is always admin.{customer host}, and the customer app
 * lets exactly that host frame it.
 */
export function defaultCustomerOrigin(): string {
  const configured = import.meta.env.VITE_CUSTOMER_URL as string | undefined
  if (configured) return configured.replace(/\/+$/, '')
  const { protocol, host } = window.location
  return `${protocol}//${host.replace(/^admin\./, '')}`
}

/** The business's API host: the brand's apiUrl, else the platform's default for this host. */
export function useApiOrigin(): string {
  return (useBrand()?.apiUrl ?? defaultApiOrigin()).replace(/\/+$/, '')
}

/**
 * The API host when the brand does not say: on the platform the business's API
 * is this host with `api.` for its `admin.` label. A dev server has no such
 * host; the AppHost's BFF stands in.
 */
export function defaultApiOrigin(): string {
  const { protocol, host } = window.location
  if (host.startsWith('admin.')) return `${protocol}//${host.replace(/^admin\./, 'api.')}`
  return 'http://localhost:5000'
}
