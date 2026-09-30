import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  assistErrorMessage,
  assistRetryAfter,
  NOT_CONFIGURED_DETAIL,
  useAssistStore,
} from './errors'

function failed(
  status: number,
  data?: unknown,
  headers: Record<string, string> = {}
): AxiosError {
  const error = new AxiosError('failed')
  error.response = {
    status,
    statusText: '',
    data,
    headers,
    config: { headers: new AxiosHeaders() },
  }
  return error
}

describe('assistErrorMessage', () => {
  beforeEach(() => useAssistStore.setState({ unavailable: false }))

  it('hides the assistant only when the server says it has no model', () => {
    assistErrorMessage(failed(503, { detail: 'Service Unavailable' }))
    expect(useAssistStore.getState().unavailable).toBe(false)

    assistErrorMessage(failed(503, { detail: NOT_CONFIGURED_DETAIL }))
    expect(useAssistStore.getState().unavailable).toBe(true)
  })

  it('tells a timeout, a too-long answer and a rejected key apart', () => {
    const timeout = assistErrorMessage(failed(504))
    const tooLong = assistErrorMessage(
      failed(502, { title: 'AI answer too long' })
    )
    const key = assistErrorMessage(
      failed(502, {
        title: 'AI provider error',
        detail: "The AI provider rejected this server's API key.",
      })
    )
    const other = assistErrorMessage(
      failed(502, { title: 'AI provider error' })
    )
    expect(new Set([timeout, tooLong, key, other]).size).toBe(4)
  })

  it("passes a 400's reason through", () => {
    expect(assistErrorMessage(failed(400, { detail: 'Not a photo' }))).toBe(
      'Not a photo'
    )
  })
})

describe('assistRetryAfter', () => {
  it("reads a 429's Retry-After", () => {
    expect(assistRetryAfter(failed(429, {}, { 'retry-after': '12' }))).toBe(12)
    expect(assistRetryAfter(failed(429))).toBeNull()
    expect(
      assistRetryAfter(failed(502, {}, { 'retry-after': '12' }))
    ).toBeNull()
  })
})
