import type {
  PaymentSettingsRequest,
  PaymentSettingsView,
} from '@/api/sales/types.gen'

/**
 * A secret as the owner edits it. The server never sends one back, only
 * whether it is set: so the field is kept as it is, replaced with what is
 * typed, or removed.
 */
export type SecretEdit =
  | { mode: 'keep' }
  | { mode: 'replace'; value: string }
  | { mode: 'remove' }

/** Fee mode as Sales.Domain numbers it: the café absorbs it, or the guest pays it on top. */
export const FEE_CAFE = 0
export const FEE_GUEST = 1

export const MAX_TIPS = 4
export const TIP_MIN = 1
export const TIP_MAX = 50

export type PaymentsForm = {
  currency: string
  secretKey: SecretEdit
  publicKey: string
  hmacSecret: SecretEdit
  cardIntegrationId: string
  walletIntegrationId: string
  applePayIntegrationId: string
  feeMode: number
  feePercent: string
  feeFixed: string
  tipsEnabled: boolean
  tipPercents: number[]
  allowItems: boolean
  allowEqual: boolean
  allowCustom: boolean
}

const text = (v: number | string | null | undefined) =>
  v == null ? '' : String(v)

export function toForm(view: PaymentSettingsView): PaymentsForm {
  return {
    currency: view.currency,
    secretKey: { mode: 'keep' },
    publicKey: view.publicKey ?? '',
    hmacSecret: { mode: 'keep' },
    cardIntegrationId: text(view.cardIntegrationId),
    walletIntegrationId: text(view.walletIntegrationId),
    applePayIntegrationId: text(view.applePayIntegrationId),
    // A number on the wire today; the name too, should enums ever be spelled
    feeMode: ['1', 'Guest'].includes(String(view.feeMode))
      ? FEE_GUEST
      : FEE_CAFE,
    feePercent: text(view.feePercent),
    feeFixed: text(view.feeFixed),
    tipsEnabled: view.tipsEnabled,
    tipPercents: view.tipPercents.map(Number),
    allowItems: view.allowItems,
    allowEqual: view.allowEqual,
    allowCustom: view.allowCustom,
  }
}

/** Null keeps the stored secret, an empty string removes it, anything else replaces it. */
export function secretValue(edit: SecretEdit): string | null {
  if (edit.mode === 'remove') return ''
  if (edit.mode === 'replace' && edit.value.trim()) return edit.value.trim()
  return null
}

/** A tip chip the owner may add: a whole percent in range, not already there, and room for it. */
export function canAddTip(tips: readonly number[], value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= TIP_MIN &&
    value <= TIP_MAX &&
    !tips.includes(value) &&
    tips.length < MAX_TIPS
  )
}

export type FormProblem = 'currency' | 'integrationId' | 'fee' | 'tips'

const optionalId = (v: string): number | null | undefined => {
  const trimmed = v.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

const amount = (v: string): number | undefined => {
  const trimmed = v.trim()
  if (!trimmed) return 0
  const n = Number(trimmed)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/** The request the form saves as, or the first thing wrong with it. */
export function toRequest(
  form: PaymentsForm
): { request: PaymentSettingsRequest } | { problem: FormProblem } {
  const currency = form.currency.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) return { problem: 'currency' }

  const card = optionalId(form.cardIntegrationId)
  const wallet = optionalId(form.walletIntegrationId)
  const applePay = optionalId(form.applePayIntegrationId)
  if (card === undefined || wallet === undefined || applePay === undefined)
    return { problem: 'integrationId' }

  const feePercent = amount(form.feePercent)
  const feeFixed = amount(form.feeFixed)
  if (feePercent === undefined || feeFixed === undefined || feePercent > 100)
    return { problem: 'fee' }

  if (
    form.tipPercents.length > MAX_TIPS ||
    form.tipPercents.some(
      (p) => !Number.isInteger(p) || p < TIP_MIN || p > TIP_MAX
    )
  )
    return { problem: 'tips' }

  return {
    request: {
      currency,
      secretKey: secretValue(form.secretKey),
      publicKey: form.publicKey.trim() || null,
      hmacSecret: secretValue(form.hmacSecret),
      cardIntegrationId: card,
      walletIntegrationId: wallet,
      applePayIntegrationId: applePay,
      feeMode: form.feeMode,
      feePercent,
      feeFixed,
      tipsEnabled: form.tipsEnabled,
      tipPercents: [...form.tipPercents].sort((a, b) => a - b),
      allowItems: form.allowItems,
      allowEqual: form.allowEqual,
      allowCustom: form.allowCustom,
    },
  }
}
