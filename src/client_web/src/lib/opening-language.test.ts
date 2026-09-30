import { describe, expect, it } from 'vitest'
import { contentLanguagesOf, openingLanguage } from './opening-language'

describe('openingLanguage', () => {
  it('a one-language business speaks only that language, whatever the customer chose', () => {
    expect(openingLanguage({ contentLanguages: 'en', businessDefault: 'ar', chosen: 'ar' })).toBe('en')
    expect(openingLanguage({ contentLanguages: 'ar', businessDefault: 'en', chosen: 'en' })).toBe('ar')
  })

  it('a business in both languages opens in its default until the customer picks', () => {
    expect(openingLanguage({ contentLanguages: 'both', businessDefault: 'en', chosen: null })).toBe('en')
    expect(openingLanguage({ contentLanguages: 'both', businessDefault: 'en', chosen: 'ar' })).toBe('ar')
  })

  it('an older stack with no setting reads as both, and no default as Arabic', () => {
    expect(openingLanguage({ contentLanguages: undefined, businessDefault: undefined, chosen: null })).toBe('ar')
    expect(contentLanguagesOf('fr')).toBe('both')
  })

  it("the control panel's preview shows the language it asks for", () => {
    expect(
      openingLanguage({ contentLanguages: 'ar', businessDefault: 'ar', chosen: null, previewLanguage: 'en' })
    ).toBe('en')
  })
})
