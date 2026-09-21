import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { problemDetail } from './problem'

function failed(data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('Request failed', '409', config, undefined, {
    data,
    status: 409,
    statusText: 'Conflict',
    headers: {},
    config,
  })
}

describe('problemDetail', () => {
  it('reads the detail of a ProblemDetails answer, then its title', () => {
    expect(problemDetail(failed({ detail: 'blue is taken.' }))).toBe('blue is taken.')
    expect(problemDetail(failed({ title: 'Conflict' }))).toBe('Conflict')
    expect(problemDetail(failed({ detail: '', title: 'Conflict' }))).toBe('Conflict')
  })

  it('has nothing to say about an error that is not from the API', () => {
    expect(problemDetail(new Error('boom'))).toBeUndefined()
    expect(problemDetail(failed('a plain string'))).toBeUndefined()
    expect(problemDetail(undefined)).toBeUndefined()
  })
})
