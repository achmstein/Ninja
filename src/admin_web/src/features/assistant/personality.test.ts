import { describe, expect, it } from 'vitest'
import { samePersonality, toPersonalityForm, toPersonalityRequest } from './personality'

describe('toPersonalityForm', () => {
  it('fills the defaults when nothing is set', () => {
    expect(toPersonalityForm(null)).toEqual({
      tone: 'brief',
      manner: 'friendly',
      language: 'match',
      notes: '',
    })
  })

  it('keeps what the owner chose, and treats an unknown value as the default', () => {
    expect(
      toPersonalityForm({ tone: 'detailed', manner: 'formal', language: 'ar-eg', notes: 'x' })
    ).toEqual({ tone: 'detailed', manner: 'formal', language: 'ar-eg', notes: 'x' })
    expect(
      toPersonalityForm({ tone: 'chatty', manner: null, language: 'fr', notes: null }).language
    ).toBe('match')
  })
})

describe('toPersonalityRequest', () => {
  it('sends a default as null and trims the text', () => {
    expect(
      toPersonalityRequest({ tone: 'brief', manner: 'friendly', language: 'match', notes: ' ' })
    ).toEqual({ tone: null, manner: null, language: null, notes: null })
    expect(
      toPersonalityRequest({ tone: 'detailed', manner: 'formal', language: 'en', notes: ' T1 ' })
    ).toEqual({ tone: 'detailed', manner: 'formal', language: 'en', notes: 'T1' })
  })

  it('counts only a real change as one', () => {
    const saved = toPersonalityForm(null)
    expect(samePersonality(saved, { ...saved, notes: ' ' })).toBe(true)
    expect(samePersonality(saved, { ...saved, tone: 'detailed' })).toBe(false)
  })
})
