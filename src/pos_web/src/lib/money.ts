import { useT } from './i18n'

// Same money shape the admin dashboard uses: `12.50 EGP` / `12.50 ج.م`.
// Generated API number fields are typed `number | string` (the backend
// serializes decimals loosely), so this accepts both.
export function useMoney() {
  const t = useT()
  return (value: number | string | null | undefined): string =>
    `${Number(value ?? 0).toFixed(2)} ${t('currency')}`
}

export function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}
