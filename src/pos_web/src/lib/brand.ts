import { createStaffBrand, useBrand } from '@ninja/web-core/brand'
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

// The till: like the back office, and it asks for the brand again every five minutes and on
// coming back to it, so a change the owner saves reaches a till left open without a reload
export const { applyBrand, bootBrand, useBrandEffects } = createStaffBrand({
  useLanguage,
  app: 'pos',
  recheckMs: 5 * 60_000,
  onApply: (brand) => {
    // Prices are the business's whatever the surface wears
    useCurrency.getState().set(brand.locale.currency)
    // And its phone numbers are read and shown its country's way
    setPhoneCountry(brand.locale.country)
    applyBrandTheme(null)
  },
})

/**
 * A cloud kitchen has no tables: its till works from counter bills and
 * away orders only, never a floor. Said by the kind of place the business was
 * created as ("cloud_kitchen").
 */
export function useIsCloudKitchen(): boolean {
  return useBrand()?.businessType === 'cloud_kitchen'
}

/**
 * How the sale pad shows the items, as the owner chose in admin: "photos",
 * a tile with each item's picture, or "compact", text tiles for a long menu.
 * Photos until the brand says otherwise (none yet, an older stack).
 */
export function useTillItems(): 'photos' | 'compact' {
  return useBrand()?.tillItems === 'compact' ? 'compact' : 'photos'
}

/** Where customers open the menu; this origin when provisioning has not said. */
export function useCustomerOrigin(): string {
  return useBrand()?.customerUrl ?? window.location.origin
}
