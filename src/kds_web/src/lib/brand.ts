import { useCafeTheme } from '@/context/theme-provider'
import { useEffect } from 'react'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { type TenantFeatures, type TenantResponse } from '@/api/tenant'
import { getTenantOptions } from '@/api/tenant/@tanstack/react-query.gen'
import { useLanguage, type Language } from '@/lib/i18n'
import { applyBrandTheme } from './brand-theme'

/**
 * The tenant this stack runs for: name, color, logo, feature switches.
 * Read once at boot (anonymous endpoint), kept in the query cache for the
 * session and mirrored to localStorage so the next boot paints the brand
 * before the network answers.
 */
export type Brand = TenantResponse
export type FeatureKey = keyof TenantFeatures

const CACHE_KEY = 'ninja-brand'
/** A staff surface carries the café's name, mark and icons and keeps the neutral theme; the café's colours are for what customers see (ninja-plan.md). The platform is the vendor line. */
const STAFF = true
export const PLATFORM_NAME = 'ninja'
const APP = 'kds'
const BOOT_TIMEOUT_MS = 2500

export const ALL_FEATURES: TenantFeatures = {
  reservations: true,
  timeBilling: true,
  loyalty: true,
  tabs: true,
  inventory: true,
  finance: true,
  payroll: true,
  kds: true,
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

/**
 * Before the first render: the cached brand goes straight into the cache and
 * onto the page, and the network copy replaces it when it arrives. With no
 * cache we wait for the network, briefly, so the first paint is not unbranded.
 */
export async function bootBrand(queryClient: QueryClient) {
  const cached = readCachedBrand()
  const language = useLanguage.getState().language
  if (cached) {
    queryClient.setQueryData(brandQueryKey(), cached)
    applyBrand(cached, language)
  }

  // Mirrored to localStorage the moment it lands, not only from
  // useBrandEffects after the first render: the OIDC config reads the
  // tenant's authority from there before anything mounts, so a first visit
  // must not fall back to the build's realm.
  const fetching = queryClient
    .prefetchQuery({ ...brandQueryOptions(), staleTime: 0 })
    .then(() => {
      const fresh = queryClient.getQueryData<Brand>(brandQueryKey())
      if (fresh) writeCachedBrand(fresh)
    })
  if (!cached) {
    await Promise.race([
      fetching,
      new Promise((resolve) => setTimeout(resolve, BOOT_TIMEOUT_MS)),
    ])
  }
}

/** Head tags and theme tokens: the café's icons everywhere; its theme only on the customer's surface. */
export function applyBrand(brand: Brand, language: Language) {
  useCafeTheme.getState().set(brand.theme?.mode)
  if (STAFF) {
    setLink('icon', brand.icons.favicon, 'image/png')
    setLink('apple-touch-icon', brand.icons.appleTouch)
    setLink('manifest', `/api/tenant/manifest?app=${APP}&lang=${language}`)
    applyBrandTheme(null)
    return
  }
  setLink('icon', brand.icons.favicon, 'image/png')
  setLink('apple-touch-icon', brand.icons.appleTouch)
  setLink('manifest', `/api/tenant/manifest?app=${APP}&lang=${language}`)
  applyBrandTheme(brand)
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

/** Keeps the page's head and theme in step with the brand and the language. Mount once. */
export function useBrandEffects() {
  const brand = useBrand()
  const language = useLanguage((s) => s.language)
  useEffect(() => {
    if (!brand) return
    applyBrand(brand, language)
    writeCachedBrand(brand)
  }, [brand, language])
}

/** The tenant's name in the current language. */
export function useBrandName(): string {
  const brand = useBrand()
  const language = useLanguage((s) => s.language)
  return brandDisplayName(brand, language)
}

export function brandDisplayName(brand: Brand | undefined, language: Language): string {
  if (!brand) return ''
  return (language === 'ar' ? brand.name.ar : brand.name.en) || brand.name.en || brand.name.ar || ''
}

/** Every switch on until the brand is known, so nothing flashes off and back. */
export function useFeatures(): TenantFeatures {
  return useBrand()?.features ?? ALL_FEATURES
}

/** Where customers open the menu; this origin when provisioning has not said. */
export function useCustomerOrigin(): string {
  return useBrand()?.customerUrl ?? window.location.origin
}
