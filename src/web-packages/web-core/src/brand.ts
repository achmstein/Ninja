import { useEffect } from 'react'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { type TenantFeatures, type TenantResponse } from '@ninja/api/tenant'
import { getTenantOptions } from '@ninja/api/tenant/@tanstack/react-query.gen'
import { useAppLanguage, type Language, type LanguageStore } from './i18n'
import { useBusinessTheme } from './theme'

/**
 * The tenant this stack runs for: name, colour, logo, feature switches. Read
 * once at boot (anonymous endpoint), kept in the query cache for the session and
 * mirrored to localStorage so the next boot paints the brand before the network
 * answers, and so the sign-in settings know the tenant's realm (oidc.ts).
 */
export type Brand = TenantResponse
export type FeatureKey = keyof TenantFeatures

const CACHE_KEY = 'ninja-brand'
const BOOT_TIMEOUT_MS = 2500

/** Every switch on until the brand is known, so nothing flashes off and back. */
export const ALL_FEATURES: TenantFeatures = {
  reservations: true,
  timeBilling: true,
  loyalty: true,
  tabs: true,
  inventory: true,
  finance: true,
  payroll: true,
  kds: true,
  onlinePayments: true,
  delivery: true,
  payAhead: true,
  ai: true,
  // A call centre waits to be bought: branch tills keep offering the nearer branch
  callCentre: false,
}

export const brandQueryOptions = () => ({
  ...getTenantOptions(),
  staleTime: Infinity,
  gcTime: Infinity,
})

export const brandQueryKey = () => getTenantOptions().queryKey

function readCachedBrand(): Brand | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Brand) : null
  } catch {
    return null
  }
}

function writeCachedBrand(brand: Brand) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(brand))
  } catch {
    // Private mode or a full quota: the next boot just waits for the network
  }
}

function setLink(rel: string, href: string, type?: string) {
  let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    document.head.appendChild(link)
  }
  if (type) link.type = type
  if (link.getAttribute('href') !== href) link.setAttribute('href', href)
}

export function useBrand(): Brand | undefined {
  return useQuery(brandQueryOptions()).data
}

export function brandDisplayName(brand: Brand | undefined, language: Language): string {
  if (!brand) return ''
  return (language === 'ar' ? brand.name.ar : brand.name.en) || brand.name.en || brand.name.ar || ''
}

/** The tenant's name in the current language. */
export function useBrandName(): string {
  return brandDisplayName(useBrand(), useAppLanguage())
}

/** Every switch on until the brand is known, so nothing flashes off and back. */
export function useFeatures(): TenantFeatures {
  return useBrand()?.features ?? ALL_FEATURES
}

export type StaffBrandOptions = {
  /** The app the manifest is for: admin, pos, kds */
  app: string
  /** The app's language store (lib/i18n.ts): the manifest is asked for in its language */
  useLanguage: LanguageStore
  /**
   * What else follows the brand in this app: its currency and phone country,
   * and the theme (a staff surface keeps the neutral one: applyBrandTheme(null)).
   */
  onApply: (brand: Brand) => void
  /**
   * Ask for the brand again this often and on coming back to the tab, so a change
   * the owner saves reaches a screen left open all day (the till)
   */
  recheckMs?: number
}

/**
 * A staff app's brand: it carries the business's name, mark and icons and keeps
 * the neutral theme; the business's colours are for what customers see. The
 * platform is the vendor line.
 */
export function createStaffBrand({ app, useLanguage, onApply, recheckMs }: StaffBrandOptions) {
  /** Head tags and what follows the brand in this app */
  function applyBrand(brand: Brand, language: Language) {
    useBusinessTheme.getState().set(brand.theme?.mode)
    setLink('icon', brand.icons.favicon, 'image/png')
    setLink('apple-touch-icon', brand.icons.appleTouch)
    setLink('manifest', `/api/tenant/manifest?app=${app}&lang=${language}`)
    onApply(brand)
  }

  /**
   * Before the first render: the cached brand goes straight into the cache and
   * onto the page, and the network copy replaces it when it arrives. With no
   * cache we wait for the network, briefly, so the first paint is not unbranded.
   */
  async function bootBrand(queryClient: QueryClient) {
    const cached = readCachedBrand()
    if (cached) {
      queryClient.setQueryData(brandQueryKey(), cached)
      applyBrand(cached, useLanguage.getState().language)
    }

    // Mirrored to localStorage the moment it lands, not only from
    // useBrandEffects after the first render: the OIDC config reads the
    // tenant's authority from there before anything mounts, so a first visit
    // must not fall back to the build's realm.
    const fetching = queryClient.prefetchQuery({ ...brandQueryOptions(), staleTime: 0 }).then(() => {
      const fresh = queryClient.getQueryData<Brand>(brandQueryKey())
      if (fresh) writeCachedBrand(fresh)
    })
    if (!cached) {
      await Promise.race([fetching, new Promise((resolve) => setTimeout(resolve, BOOT_TIMEOUT_MS))])
    }
  }

  /** Keeps the page's head and theme in step with the brand and the language. Mount once. */
  function useBrandEffects() {
    const brand = useQuery({
      ...brandQueryOptions(),
      ...(recheckMs && { refetchInterval: recheckMs, refetchOnWindowFocus: 'always' as const }),
    }).data
    const language = useLanguage((s) => s.language)
    useEffect(() => {
      if (!brand) return
      applyBrand(brand, language)
      writeCachedBrand(brand)
    }, [brand, language])
  }

  return { applyBrand, bootBrand, useBrandEffects }
}
