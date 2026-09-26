import { describe, expect, it } from 'vitest'
import { samePersonality, toPersonalityForm, toPersonalityRequest } from './personality'

describe('toPersonalityForm', () => {
  it('fills the defaults when nothing is set', () => {
    expect(toPersonalityForm(null)).toEqual({
      name: '',
      tone: 'brief',
      manner: 'friendly',
      language: 'match',
      notes: '',
    })
  })

  it('keeps what the owner chose, and treats an unknown value as the default', () => {
    expect(
      toPersonalityForm({ name: 'Zein', tone: 'detailed', manner: 'formal', language: 'ar-eg', notes: 'x' })
    ).toEqual({ name: 'Zein', tone: 'detailed', manner: 'formal', language: 'ar-eg', notes: 'x' })
    expect(
      toPersonalityForm({ name: null, tone: 'chatty', manner: null, language: 'fr', notes: null }).language
    ).toBe('match')
  })
})

describe('toPersonalityRequest', () => {
  it('sends a default as null and trims the text', () => {
    expect(
      toPersonalityRequest({ name: '  ', tone: 'brief', manner: 'friendly', language: 'match', notes: ' ' })
    ).toEqual({ name: null, tone: null, manner: null, language: null, notes: null })
    expect(
      toPersonalityRequest({ name: ' Zein ', tone: 'detailed', manner: 'formal', language: 'en', notes: ' T1 ' })
    ).toEqual({ name: 'Zein', tone: 'detailed', manner: 'formal', language: 'en', notes: 'T1' })
  })

  it('counts only a real change as one', () => {
    const saved = toPersonalityForm(null)
    expect(samePersonality(saved, { ...saved, name: ' ' })).toBe(true)
    expect(samePersonality(saved, { ...saved, tone: 'detailed' })).toBe(false)
  })
})
