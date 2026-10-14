import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it } from 'vitest'
import { isConnectionError, networkStatus, useNetworkStatus } from './network-status'

const answered = (status: number) =>
  new AxiosError('refused', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data: {},
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse)

describe('isConnectionError', () => {
  it('is a call that got no answer: no network, or a timeout', () => {
    expect(isConnectionError(new AxiosError('Network Error', AxiosError.ERR_NETWORK))).toBe(true)
    expect(isConnectionError(new AxiosError('timeout', AxiosError.ECONNABORTED))).toBe(true)
  })

  it('is never an answer from the server, whatever it says', () => {
    expect(isConnectionError(answered(400))).toBe(false)
    expect(isConnectionError(answered(401))).toBe(false)
    expect(isConnectionError(answered(503))).toBe(false)
  })

  it('is never a call the till cancelled, or something that is not a call', () => {
    expect(isConnectionError(new AxiosError('canceled', AxiosError.ERR_CANCELED))).toBe(false)
    expect(isConnectionError(new Error('boom'))).toBe(false)
  })
})

describe('networkStatus', () => {
  beforeEach(() => useNetworkStatus.setState({ online: true }))

  it('goes offline on a failure and back on the next success', () => {
    networkStatus.reportFailure()
    expect(networkStatus.isOnline()).toBe(false)
    networkStatus.reportFailure()
    expect(networkStatus.isOnline()).toBe(false)
    networkStatus.reportSuccess()
    expect(networkStatus.isOnline()).toBe(true)
  })

  it('tells listeners only when it changes', () => {
    let changes = 0
    const stop = useNetworkStatus.subscribe(() => changes++)
    networkStatus.reportSuccess()
    networkStatus.reportFailure()
    networkStatus.reportFailure()
    networkStatus.reportSuccess()
    stop()
    expect(changes).toBe(2)
  })
})
