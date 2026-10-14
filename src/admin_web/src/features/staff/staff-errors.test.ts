import { AxiosError, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { staffError } from './staff-errors'

const failed = (status: number, data: unknown) =>
  new AxiosError('failed', String(status), undefined, undefined, {
    status,
    data,
  } as AxiosResponse)

describe('staffError', () => {
  it('says the email is taken on a conflict', () => {
    expect(
      staffError(failed(409, { message: 'Username or email already exists' }))
    ).toEqual({
      key: 'staffEmailTaken',
    })
  })

  it("says the password was refused when Keycloak's policy turns it down", () => {
    const detail =
      'Registration failed: {"errorMessage":"invalidPasswordMinDigitsMessage","params":["1"]}'
    expect(staffError(failed(400, { detail }))).toEqual({
      key: 'staffPasswordRejected',
    })
  })

  it("passes on the server's own words otherwise", () => {
    expect(
      staffError(failed(400, { message: 'only an Admin can be made Owner' }))
    ).toEqual({
      text: 'only an Admin can be made Owner',
    })
  })

  it('has nothing to say without an answer from the server', () => {
    expect(staffError(new Error('offline'))).toBeNull()
  })
})
