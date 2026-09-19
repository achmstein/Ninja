import { formatMoney, useCurrency } from './currency'
import { useLanguage } from './i18n'

// Same money shape the admin dashboard uses, in the café's currency:
// `12.50 EGP` / `12.50 ج.م`. Generated API number fields are typed
// `number | string` (the backend serializes decimals loosely), so this
// accepts both.
export function useMoney() {
  const language = useLanguage((s) => s.language)
  const currency = useCurrency((s) => s.code)
  return (value: number | string | null | undefined): string => formatMoney(value, currency, language)
}

export function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}
