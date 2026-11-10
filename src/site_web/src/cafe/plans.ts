/**
 * What each plan includes, as the control plane has it
 * (src/Control.API/Platform/Plans.cs). No prices: those are not in the code.
 * plans.test.ts reads that file and fails when this table falls behind it.
 */
export const MODULES = [
  'Reservations',
  'TimeBilling',
  'Loyalty',
  'Tabs',
  'Inventory',
  'Finance',
  'Payroll',
  'Kds',
  'OnlinePayments',
  'Delivery',
  'Ai',
  'CallCentre',
] as const

export type Module = (typeof MODULES)[number]
export type Plan = 'Free' | 'Starter' | 'Pro'

export const PLANS: Plan[] = ['Free', 'Starter', 'Pro']

/** Bought on their own on every plan */
const ALWAYS_ADDON: Module[] = ['OnlinePayments', 'Delivery', 'CallCentre']

export const INCLUDED: Record<Plan, Module[]> = {
  Free: ['Kds'],
  Starter: ['Reservations', 'TimeBilling', 'Loyalty', 'Tabs', 'Kds'],
  Pro: MODULES.filter((m) => !ALWAYS_ADDON.includes(m)),
}

export const includes = (plan: Plan, module: Module) => INCLUDED[plan].includes(module)
