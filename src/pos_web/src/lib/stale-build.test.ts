import { describe, expect, it } from 'vitest'
import { isStaleBuildError, mayReload } from './stale-build'

describe('isStaleBuildError', () => {
  it('knows each browser’s wording of a screen that could not be fetched', () => {
    expect(
      isStaleBuildError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/sale-abc.js'))
    ).toBe(true)
    expect(isStaleBuildError(new TypeError('error loading dynamically imported module'))).toBe(true)
    expect(isStaleBuildError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isStaleBuildError(new Error('Unable to preload CSS for /assets/sale-abc.css'))).toBe(true)
  })

  it('leaves every other error alone', () => {
    expect(isStaleBuildError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false)
    expect(isStaleBuildError(null)).toBe(false)
  })
})

describe('mayReload', () => {
  it('reloads the first time, and again only after a while', () => {
    expect(mayReload(null, 1_000_000)).toBe(true)
    expect(mayReload(1_000_000, 1_005_000)).toBe(false)
    expect(mayReload(1_000_000, 1_040_000)).toBe(true)
  })
})
