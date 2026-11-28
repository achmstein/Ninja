import { createStaffBrand, useBrand } from '@ninja/web-core/brand'
import { useLanguage } from '@/lib/i18n'
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

// The kitchen display: the business's name, mark and icons
export const { applyBrand, bootBrand, useBrandEffects } = createStaffBrand({
  useLanguage,
  app: 'kds',
  onApply: () => applyBrandTheme(null),
})

/** Where customers open the menu; this origin when provisioning has not said. */
export function useCustomerOrigin(): string {
  return useBrand()?.customerUrl ?? window.location.origin
}
