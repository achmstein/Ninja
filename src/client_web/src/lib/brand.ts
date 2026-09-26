import { useCafeTheme } from '@/context/theme-provider'
import { useEffect } from 'react'
import { create } from 'zustand'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { type TenantFeatures, type TenantResponse, type TenantWordmark } from '@/api/tenant'
import { getTenantOptions } from '@/api/tenant/@tanstack/react-query.gen'
import { useTheme, type ResolvedTheme } from '@/context/theme-provider'
import { useCurrency } from '@/lib/currency'
import { useArabicStyle, useLanguage, type Language } from '@/lib/i18n'
import { applyBrandTheme, type BrandThemeInput } from './brand-theme'
import { applyBrandLayout } from './brand-layout'
import { draftedTheme, onDraftedTheme } from './preview'

/**
 * The tenant this stack runs for: name, color, logo, feature switches.
 * Read once at boot (anonymous endpoint), kept in the query cache for the
 * session and mirrored to localStorage so the next boot paints the brand
 * before the network answers.
 */
export type Brand = TenantResponse
export type FeatureKey = keyof TenantFeatures

const CACHE_KEY = 'ninja-brand'
const APP = 'client'
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
  onlinePayments: true,
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
    const brand = raw ? (JSON.parse(raw) as Partial<Brand>) : null
    // A cache written by an older build lacks fields this one reads
    return brand?.wordmarks ? (brand as Brand) : null
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
/**
 * Whether the edge said the café is paused: its stack is off and every API
 * call answers 503 { code: "paused" }. Set from the boot fetch, whenever it
 * lands; the app then shows a notice instead of a menu that cannot load.
 */
/**
 * What a phone number looks like where this café is. The tenant sends the
 * rule with the rest of its locale, so the apps never carry one market's
 * shape of their own; until it lands, anything a phone could be.
 */
export const usePhoneRule = create<{
  pattern: RegExp
  placeholder: string
  set: (pattern?: string | null, placeholder?: string | null) => void
}>((set) => ({
  pattern: /^\+?[0-9]{7,15}$/,
  placeholder: '',
  set: (pattern, placeholder) =>
    set({
      pattern: pattern ? new RegExp(pattern) : /^\+?[0-9]{7,15}$/,
      placeholder: placeholder ?? '',
    }),
}))

export const usePaused = create<{ paused: boolean; set: (paused: boolean) => void }>((set) => ({
  paused: false,
  set: (paused) => set({ paused }),
}))

function pausedBy(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { code?: string } } } | null)?.response
  return response?.status === 503 && response.data?.code === 'paused'
}

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
      // prefetchQuery never throws: a failure sits on the query's state
      const error = queryClient.getQueryState(brandQueryKey())?.error
      if (error) {
        if (pausedBy(error)) usePaused.getState().set(true)
        return
      }
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

/** Head tags and theme tokens for this brand. */
export function applyBrand(brand: Brand, language: Language) {
  // Which Arabic the café speaks, and the light or dark a person who never chose starts in
  useArabicStyle.getState().set(brand.locale?.arabicStyle)
  useCafeTheme.getState().set(brand.theme?.mode)
  setLink('icon', brand.icons.favicon, 'image/png')
  setLink('apple-touch-icon', brand.icons.appleTouch)
  setLink('manifest', `/api/tenant/manifest?app=${APP}&lang=${language}`)
  // Under a preview, the panel's unsaved seeds paint over the saved ones
  paint(draftedTheme() ?? brand)
  useCurrency.getState().set(brand.locale.currency)
  usePhoneRule.getState().set(brand.locale.phonePattern, brand.locale.phonePlaceholder)
}

/** The seeds as tokens and the style as the page's layout, together, so a draft moves both. */
function paint(input: BrandThemeInput | null | undefined) {
  applyBrandTheme(input)
  applyBrandLayout(input)
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
  useEffect(() => onDraftedTheme((input) => paint(input ?? brand)), [brand])
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

/**
 * The wide lockup for a language and colour scheme, falling back the way
 * the slots are meant to: the dark one to the light one, Arabic to English,
 * and null when the tenant has none (the mark and the name stand in).
 */
export function wordmarkFor(
  brand: Brand | undefined,
  language: Language,
  scheme: ResolvedTheme
): TenantWordmark | null {
  if (!brand) return null
  const w = brand.wordmarks
  const order =
    language === 'ar'
      ? scheme === 'dark'
        ? [w.arDark, w.ar, w.enDark, w.en]
        : [w.ar, w.en]
      : scheme === 'dark'
        ? [w.enDark, w.en]
        : [w.en]
  return order.find((x) => x != null) ?? null
}

/** The square mark for a colour scheme; the dark one falls back to the light one. */
export function logoFor(brand: Brand | undefined, scheme: ResolvedTheme): string | null {
  if (!brand) return null
  return (scheme === 'dark' ? brand.logoDarkUrl : null) ?? brand.logoUrl ?? null
}

export function useBrandWordmark(): TenantWordmark | null {
  const brand = useBrand()
  const language = useLanguage((s) => s.language)
  const { resolvedTheme } = useTheme()
  return wordmarkFor(brand, language, resolvedTheme)
}

export function useBrandLogo(): string | null {
  const { resolvedTheme } = useTheme()
  return logoFor(useBrand(), resolvedTheme)
}

/** Every switch on until the brand is known, so nothing flashes off and back. */
export function useFeatures(): TenantFeatures {
  return useBrand()?.features ?? ALL_FEATURES
}

/**
 * A cloud kitchen has no tables: nothing to scan, every order is
 * collected. Said by the kind of place the café was created as.
 */
export function useIsCloudKitchen(): boolean {
  return useBrand()?.businessType === 'cloud_kitchen'
}

/** Where customers open the menu; this origin when provisioning has not said. */
export function useCustomerOrigin(): string {
  return useBrand()?.customerUrl ?? window.location.origin
}
