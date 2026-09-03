// Generated API number fields are typed `number | string` (the backend
// serializes decimals loosely), so the money helpers accept both.
export { formatEgp } from '@/features/orders/status'

export function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}
