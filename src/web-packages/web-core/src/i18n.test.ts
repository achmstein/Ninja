import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n, createLanguageStore, formatMessage, type Message } from './i18n'

describe('formatMessage', () => {
  it('fills params and falls back to English when the Arabic is empty', () => {
    expect(formatMessage({ en: 'Hi {name}', ar: 'أهلاً {name}' }, 'ar', { name: 'Mona' })).toBe('أهلاً Mona')
    expect(formatMessage({ en: 'Only English', ar: '' }, 'ar')).toBe('Only English')
    expect(formatMessage({ en: 'Keeps {missing}', ar: '' }, 'en', { other: 1 })).toBe('Keeps {missing}')
  })

  it('picks the exact form, then the CLDR category, then other', () => {
    const minutes: Message = {
      plural: 'n',
      en: { '=1': 'a minute', other: '{n} minutes' },
      ar: { '=1': 'دقيقة', '=2': 'دقيقتين', few: '{n} دقائق', other: '{n} دقيقة' },
    }
    expect(formatMessage(minutes, 'en', { n: 1 })).toBe('a minute')
    expect(formatMessage(minutes, 'en', { n: 5 })).toBe('5 minutes')
    expect(formatMessage(minutes, 'ar', { n: 2 })).toBe('دقيقتين')
    expect(formatMessage(minutes, 'ar', { n: 5 })).toBe('5 دقائق')
    expect(formatMessage(minutes, 'ar', { n: 11 })).toBe('11 دقيقة')
  })
})

describe('createLanguageStore', () => {
  const root = { lang: '', dir: '' }
  beforeEach(() => {
    root.lang = ''
    root.dir = ''
    vi.stubGlobal('document', { documentElement: root })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sets the page language, and its direction where the app asks', () => {
    const till = createLanguageStore({ storageKey: 'test-till', followDirection: true })
    till.getState().setLanguage('ar')
    expect(root).toEqual({ lang: 'ar', dir: 'rtl' })

    root.dir = 'ltr'
    const office = createLanguageStore({ storageKey: 'test-office' })
    office.getState().setLanguage('ar')
    expect(root).toEqual({ lang: 'ar', dir: 'ltr' })
  })

  it('translates in the language the store holds', () => {
    const store = createLanguageStore({ storageKey: 'test-t' })
    const { translate, bilingual } = createI18n({ hello: { en: 'Hello', ar: 'مرحبًا' } }, store)
    expect(translate('hello')).toBe('Hello')
    store.getState().setLanguage('ar')
    expect(translate('hello')).toBe('مرحبًا')
    expect(bilingual('hello')).toEqual({ en: 'Hello', ar: 'مرحبًا' })
  })
})
