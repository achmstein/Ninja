import { describe, expect, it } from 'vitest'
import type { PaymentSettingsView } from '@/api/sales/types.gen'
import {
  FEE_GUEST,
  secretValue,
  toForm,
  toRequest,
  type PaymentsForm,
} from './form'

const view: PaymentSettingsView = {
  provider: 'Paymob',
  currency: 'EGP',
  secretKeySet: true,
  secretKeyHint: '1234',
  publicKey: 'egy_pk_test',
  hmacSecretSet: true,
  cardIntegrationId: 111,
  walletIntegrationId: null,
  applePayIntegrationId: null,
  feeMode: 1,
  feePercent: '2.75',
  feeFixed: 3,
  allowItems: true,
  allowEqual: true,
  allowCustom: false,
  ready: true,
  canKeepSecrets: true,
  callbackUrl: 'https://cafe.example/api/sales/payments/paymob/callback',
}

const form = (patch: Partial<PaymentsForm> = {}): PaymentsForm => ({
  ...toForm(view),
  ...patch,
})

const request = (patch: Partial<PaymentsForm> = {}) => {
  const result = toRequest(form(patch))
  if (!('request' in result)) throw new Error(result.problem)
  return result.request
}

describe('secrets', () => {
  it('keeps what is stored unless replaced or removed', () => {
    expect(secretValue({ mode: 'keep' })).toBeNull()
    expect(secretValue({ mode: 'replace', value: '  ' })).toBeNull()
    expect(secretValue({ mode: 'replace', value: ' sk_live ' })).toBe('sk_live')
    expect(secretValue({ mode: 'remove' })).toBe('')
  })

  it('never prefills a secret from the view', () => {
    const f = toForm(view)
    expect(f.secretKey).toEqual({ mode: 'keep' })
    expect(f.hmacSecret).toEqual({ mode: 'keep' })
    expect(request().secretKey).toBeNull()
    expect(request().hmacSecret).toBeNull()
  })
})

describe('toRequest', () => {
  it('round-trips the view', () => {
    expect(request()).toMatchObject({
      currency: 'EGP',
      publicKey: 'egy_pk_test',
      cardIntegrationId: 111,
      walletIntegrationId: null,
      feeMode: FEE_GUEST,
      feePercent: 2.75,
      feeFixed: 3,
      allowCustom: false,
    })
  })

  it('reads the fee mode by name too', () => {
    expect(
      toForm({ ...view, feeMode: 'Guest' as unknown as number }).feeMode
    ).toBe(FEE_GUEST)
    expect(toForm({ ...view, feeMode: 0 }).feeMode).toBe(0)
  })

  it('upper-cases the currency and rejects a bad one', () => {
    expect(request({ currency: 'egp' }).currency).toBe('EGP')
    expect(toRequest(form({ currency: 'EG' }))).toEqual({ problem: 'currency' })
  })

  it('rejects an integration id that is not a whole number', () => {
    expect(toRequest(form({ walletIntegrationId: '12a' }))).toEqual({
      problem: 'integrationId',
    })
    expect(request({ walletIntegrationId: ' 42 ' }).walletIntegrationId).toBe(
      42
    )
  })

  it('rejects a negative or over-100% fee', () => {
    expect(toRequest(form({ feeFixed: '-1' }))).toEqual({ problem: 'fee' })
    expect(toRequest(form({ feePercent: '101' }))).toEqual({ problem: 'fee' })
    expect(request({ feePercent: '' }).feePercent).toBe(0)
  })
})
