import { toNumber } from '@/lib/money'

/** The branch's money rules (Sales `PricingView`): VAT, whether menu prices already hold it, and the service charge on served orders. */
export type PricingRules = {
  vatRate: number
  pricesIncludeVat: boolean
  serviceChargeRate: number
}

/** No rules known: what a branch with no VAT and no service charge bills */
export const NO_PRICING: PricingRules = {
  vatRate: 0,
  pricesIncludeVat: false,
  serviceChargeRate: 0,
}

export function toPricingRules(
  view:
    | {
        vatRate?: number | string | null
        pricesIncludeVat?: boolean | null
        serviceChargeRate?: number | string | null
      }
    | null
    | undefined,
): PricingRules {
  if (!view) return NO_PRICING
  return {
    vatRate: toNumber(view.vatRate ?? 0),
    pricesIncludeVat: view.pricesIncludeVat ?? false,
    serviceChargeRate: toNumber(view.serviceChargeRate ?? 0),
  }
}

export type CounterBill = {
  subtotal: number
  serviceCharge: number
  vat: number
  total: number
}

const money = (value: number) => Math.round(value * 100) / 100

/**
 * The bill of a counter sale under these rules: the same arithmetic as
 * `Ticket.ComputeBill` in Sales, and as the Flutter till's `counterBill`
 * (pos_app/lib/features/tickets/models/pricing.dart). A counter sale is not
 * served, so no service charge; VAT is shown out of a price that already
 * holds it, or added on top.
 */
export function counterBill(subtotal: number, rules: PricingRules): CounterBill {
  const taxable = subtotal
  const vat = rules.pricesIncludeVat
    ? money(taxable - taxable / (1 + rules.vatRate))
    : money(taxable * rules.vatRate)
  const total = rules.pricesIncludeVat ? taxable : taxable + vat
  return { subtotal, serviceCharge: 0, vat, total }
}
