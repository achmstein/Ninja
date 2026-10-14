import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONNECTOR_URL, connectorStatus, openDrawer, printImage } from './connector'

const answer = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response

afterEach(() => vi.unstubAllGlobals())

describe('connectorStatus', () => {
  it('is what the connector on this PC says about itself', async () => {
    const fetch = vi.fn(async () => answer(200, { name: 'COUNTER', version: '1.0.9', printers: ['EPSON'] }))
    vi.stubGlobal('fetch', fetch)

    expect(await connectorStatus()).toEqual({ name: 'COUNTER', version: '1.0.9', printers: ['EPSON'] })
    expect(fetch).toHaveBeenCalledWith(`${CONNECTOR_URL}/v1/status`, expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('is nothing when none answers: not installed, timed out, or blocked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await connectorStatus()).toBeNull()

    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError') }))
    expect(await connectorStatus()).toBeNull()

    vi.stubGlobal('fetch', vi.fn(async () => answer(403, {})))
    expect(await connectorStatus()).toBeNull()
  })
})

describe('printImage and openDrawer', () => {
  it('post the contract the connector reads', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => answer(200, { ok: true }))
    vi.stubGlobal('fetch', fetch)

    await printImage('EPSON', 'iVBOR', true)
    await openDrawer('EPSON')

    expect(fetch.mock.calls[0][0]).toBe(`${CONNECTOR_URL}/v1/print`)
    expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({ printer: { name: 'EPSON' }, image: 'iVBOR', kickDrawer: true })
    expect(fetch.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' })
    expect(fetch.mock.calls[1][0]).toBe(`${CONNECTOR_URL}/v1/drawer`)
    expect(JSON.parse(fetch.mock.calls[1][1].body as string)).toEqual({ printer: { name: 'EPSON' } })
  })

  it("fail with the connector's own reason", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(404, { error: 'No printer named EPSON' })))
    await expect(printImage('EPSON', 'x', false)).rejects.toThrow('No printer named EPSON')

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => { throw new SyntaxError() } }) as unknown as Response))
    await expect(openDrawer('EPSON')).rejects.toThrow('500')
  })
})
