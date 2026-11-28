import type { AxiosInstance } from 'axios'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerApiClient } from '@ninja/api/runtime'
import { brandQueryKey, createStaffBrand, type Brand } from './brand'
import { createLanguageStore } from './i18n'

const brand = (name: string) =>
  ({
    name: { en: name, ar: '' },
    icons: { favicon: '/f.png', appleTouch: '/a.png' },
    theme: { mode: 'dark' },
    locale: { currency: 'EGP', country: 'EG' },
    auth: { authority: 'https://auth.test/realms/cove' },
  }) as unknown as Brand

const store = new Map<string, string>()
const links: Record<string, string> = {}

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  const element = () => {
    const attrs: Record<string, string> = {}
    return {
      rel: '',
      type: '',
      getAttribute: (k: string) => attrs[k] ?? null,
      setAttribute(k: string, v: string) {
        attrs[k] = v
        links[this.rel] = v
      },
    }
  }
  vi.stubGlobal('document', {
    documentElement: { lang: '', dir: '', classList: { contains: () => false } },
    head: { querySelector: () => null, appendChild: () => {} },
    createElement: element,
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('createStaffBrand', () => {
  it('paints the cached brand at once and caches the fresh one when it lands', async () => {
    store.set('ninja-brand', JSON.stringify(brand('Cached')))
    registerApiClient((async () => ({ data: brand('Fresh'), status: 200 })) as unknown as AxiosInstance)
    const applied: string[] = []
    const { bootBrand } = createStaffBrand({
      app: 'pos',
      useLanguage: createLanguageStore({ storageKey: 'test-brand' }),
      onApply: (b) => applied.push(b.name.en ?? ''),
    })
    const client = new QueryClient()

    await bootBrand(client)
    expect(applied).toEqual(['Cached'])
    expect(links.manifest).toBe('/api/tenant/manifest?app=pos&lang=en')

    await vi.waitFor(() => expect(JSON.parse(store.get('ninja-brand')!).name.en).toBe('Fresh'))
    expect(client.getQueryData<Brand>(brandQueryKey())?.name.en).toBe('Fresh')
  })
})
