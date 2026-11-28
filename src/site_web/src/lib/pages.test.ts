import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fromPath, PAGES, pathOf, SLUG } from './pages'

describe('the pages and their addresses', () => {
  it('give every page an address in both languages that reads back as itself', () => {
    for (const lang of ['en', 'ar'] as const)
      for (const page of PAGES) expect(fromPath(pathOf(lang, page))).toEqual({ lang, page })
  })

  it('put the home pages at / and /ar', () => {
    expect(pathOf('en', 'home')).toBe('/')
    expect(pathOf('ar', 'home')).toBe('/ar')
    expect(pathOf('ar', 'gaming')).toBe('/ar/game-lounges')
  })

  it('take an unknown address, or one with a slash at its end, as the nearest page', () => {
    expect(fromPath('/nothing')).toEqual({ lang: 'en', page: 'home' })
    expect(fromPath('/ar/')).toEqual({ lang: 'ar', page: 'home' })
    expect(fromPath('/cafes/')).toEqual({ lang: 'en', page: 'cafes' })
  })
})

describe('what is built from the pages', () => {
  const read = (file: string) => readFileSync(path.resolve(__dirname, '../..', file), 'utf8')

  it('prerenders the same pages at the same addresses', () => {
    const listed = read('scripts/prerender.mjs').match(/const PAGES = (\{[^}]+\})/)?.[1]
    expect(new Function(`return ${listed}`)()).toEqual(SLUG)
  })

  it('lists every page in the sitemap, in both languages', () => {
    const sitemap = read('public/sitemap.xml')
    for (const lang of ['en', 'ar'] as const)
      for (const page of PAGES) expect(sitemap).toContain(`<loc>https://ninjapp.net${pathOf(lang, page)}</loc>`)
  })
})
