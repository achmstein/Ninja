import type { TranslationKey } from '@/lib/i18n'

// Control.API's enums travel as integers (no string converter on the
// service), but the names are what the UI reasons about. Each reader below
// takes either form, so a future switch to string enums costs nothing here.

export const TENANT_KINDS = ['Demo', 'Customer'] as const
export type TenantKindName = (typeof TENANT_KINDS)[number]

export const TENANT_STATUSES = [
  'Requested',
  'Provisioning',
  'Running',
  'Stopped',
  'Failed',
  'Destroying',
  'Destroyed',
  // Appended in the order the API's enum grows: the index is the wire value
  'Upgrading',
  'Suspended',
] as const
export type TenantStatusName = (typeof TENANT_STATUSES)[number]

export const STEP_STATUSES = [
  'Pending',
  'Running',
  'Done',
  'Failed',
  'Skipped',
] as const
export type StepStatusName = (typeof STEP_STATUSES)[number]

function nameOf<T extends string>(
  names: readonly T[],
  value: number | string | null | undefined,
  fallback: T
): T {
  if (typeof value === 'number') return names[value] ?? fallback
  if (typeof value === 'string') {
    const asNumber = Number(value)
    if (Number.isInteger(asNumber) && value.trim() !== '')
      return names[asNumber] ?? fallback
    return (names as readonly string[]).includes(value) ? (value as T) : fallback
  }
  return fallback
}

export const tenantKind = (value: number | string | null | undefined) =>
  nameOf(TENANT_KINDS, value, 'Demo')

export const tenantStatus = (value: number | string | null | undefined) =>
  nameOf(TENANT_STATUSES, value, 'Requested')

export const stepStatus = (value: number | string | null | undefined) =>
  nameOf(STEP_STATUSES, value, 'Pending')

/** The wire value for a kind the form picked. */

export const kindLabelKey: Record<TenantKindName, TranslationKey> = {
  Demo: 'kindDemo',
  Customer: 'kindCustomer',
}

export const statusLabelKey: Record<TenantStatusName, TranslationKey> = {
  Requested: 'statusRequested',
  Provisioning: 'statusProvisioning',
  Running: 'statusRunning',
  Stopped: 'statusStopped',
  Failed: 'statusFailed',
  Destroying: 'statusDestroying',
  Destroyed: 'statusDestroyed',
  Upgrading: 'statusUpgrading',
  Suspended: 'statusSuspended',
}

export const SUBSCRIPTION_STATUSES = ['Trialing', 'Active', 'PastDue', 'Suspended', 'Cancelled'] as const
export type SubscriptionStatusName = (typeof SUBSCRIPTION_STATUSES)[number]

export const subscriptionStatus = (value: number | string | null | undefined) =>
  nameOf(SUBSCRIPTION_STATUSES, value, 'Active')

export const subscriptionLabelKey: Record<SubscriptionStatusName, TranslationKey> = {
  Trialing: 'subTrialing',
  Active: 'subActive',
  PastDue: 'subPastDue',
  Suspended: 'subSuspended',
  Cancelled: 'subCancelled',
}

/** A period ending within this many days is worth seeing before it lapses. */
export const DUE_SOON_DAYS = 7

/** How loudly a list should say something about where a tenant stands on money. */
export type BillingTone = 'none' | 'ok' | 'soon' | 'overdue' | 'stopped'

export type BillingStanding = {
  /** The day that matters for this kind: a demo runs out, a customer is paid through. */
  due: string | null | undefined
  /** Whole calendar days until `due`; negative once it has passed, null without one. */
  days: number | null
  tone: BillingTone
}

/**
 * Whole days between two dates, the time of day on either ignored, read in
 * the viewer's own zone -- the same way format.date() renders them, so the
 * count a row shows always agrees with the date it shows next to it.
 */
const calendarDaysBetween = (from: Date, to: Date) =>
  Math.round(
    (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
      86_400_000
  )

/**
 * Where a tenant stands on money, as a row of the list needs it: which date
 * matters, how far off it is, and how loudly to say so. The status the API
 * computed wins over the date, because it knows the grace days that a list
 * row does not carry: a stack is suspended only once the grace runs out too.
 */
export function billingStanding(
  tenant: {
    kind: number | string
    subscription: number | string
    expiresAt?: string | null
    paidThrough?: string | null
  },
  now: Date = new Date()
): BillingStanding {
  const due =
    tenantKind(tenant.kind) === 'Demo' ? tenant.expiresAt : tenant.paidThrough
  const days = due ? calendarDaysBetween(now, new Date(due)) : null

  switch (subscriptionStatus(tenant.subscription)) {
    case 'Suspended':
      return { due, days, tone: 'stopped' }
    case 'PastDue':
      return { due, days, tone: 'overdue' }
    // Nothing left to chase on a tenant that has gone
    case 'Cancelled':
      return { due, days, tone: 'none' }
  }

  if (days === null) return { due, days, tone: 'none' }
  if (days < 0) return { due, days, tone: 'overdue' }
  return { due, days, tone: days <= DUE_SOON_DAYS ? 'soon' : 'ok' }
}

/** The tenants an operator should chase today, as opposed to keep an eye on. */
export const needsPayment = (tone: BillingTone) =>
  tone === 'overdue' || tone === 'stopped'

/** The nine switches as modules a plan includes or sells; the order the API's enum has. */
export const MODULES = ['Reservations', 'TimeBilling', 'Loyalty', 'Tabs', 'Inventory', 'Finance', 'Payroll', 'Kds', 'OnlinePayments'] as const
export type ModuleName = (typeof MODULES)[number]

export const moduleLabelKey: Record<ModuleName, TranslationKey> = {
  Reservations: 'featureReservations',
  TimeBilling: 'featureTimeBilling',
  Loyalty: 'featureLoyalty',
  Tabs: 'featureTabs',
  Inventory: 'featureInventory',
  Finance: 'featureFinance',
  Payroll: 'featurePayroll',
  Kds: 'featureKds',
  OnlinePayments: 'featureOnlinePayments',
}

/** The API sends modules as names; a number would be the enum index. */
export const moduleName = (value: number | string) => nameOf(MODULES, value, 'Reservations')

export const stepLabelKey: Record<StepStatusName, TranslationKey> = {
  Pending: 'stepPending',
  Running: 'stepRunning',
  Done: 'stepDone',
  Failed: 'stepFailed',
  Skipped: 'stepSkipped',
}

/** A tenant whose stack is mid-change: the screens poll while any is. */
export const isBusy = (status: TenantStatusName) =>
  status === 'Provisioning' || status === 'Destroying' || status === 'Upgrading'

export const canProvision = (status: TenantStatusName) =>
  status === 'Requested' || status === 'Failed'
export const canStop = (status: TenantStatusName) => status === 'Running'
export const canStart = (status: TenantStatusName) => status === 'Stopped'
export const canUpgrade = (status: TenantStatusName) =>
  status === 'Running' || status === 'Stopped'
export const canDestroy = (status: TenantStatusName) =>
  status !== 'Destroying' && status !== 'Destroyed'
/** A destroyed tenant is a row nobody needs on the list any more. */
export const canForget = (status: TenantStatusName) => status === 'Destroyed'
/** Stopped for non-payment; back with a payment or a resume. */
export const canSuspend = (status: TenantStatusName) =>
  status === 'Running' || status === 'Stopped'
export const canResume = (status: TenantStatusName) => status === 'Suspended'
/** A demo becomes a customer; a customer already is one. */
export const canConvert = (kind: TenantKindName, status: TenantStatusName) =>
  kind === 'Demo' && status !== 'Destroying' && status !== 'Destroyed'
export const canImpersonate = (status: TenantStatusName) => status === 'Running'
export const canBackup = (status: TenantStatusName) =>
  status === 'Running' || status === 'Stopped' || status === 'Suspended'
/** Its own database role and broker user, or new passwords for them: the stack restarts. */
export const canSecure = (status: TenantStatusName) =>
  status === 'Running' || status === 'Stopped' || status === 'Failed'
/** A stack exists on the box: containers and logs can be read. */
export const isStamped = (status: TenantStatusName) =>
  status === 'Running' || status === 'Stopped' || status === 'Failed' || status === 'Provisioning' || status === 'Upgrading' || status === 'Suspended'

export const TENANT_SEEDS = ['None', 'Sample'] as const
export type TenantSeedName = (typeof TENANT_SEEDS)[number]

/** What a fresh stack is planted with, by kind: a demo looks alive, a customer starts empty. */
export const SEED_DEFAULT: Record<TenantKindName, TenantSeedName> = {
  Demo: 'Sample',
  Customer: 'None',
}

export const seedLabelKey: Record<TenantSeedName, TranslationKey> = {
  None: 'seedNone',
  Sample: 'seedSample',
}

export const TENANT_PLANS = ['Free', 'Starter', 'Pro'] as const
export type TenantPlanName = (typeof TENANT_PLANS)[number]

export const planLabelKey: Record<TenantPlanName, TranslationKey> = {
  Free: 'planFree',
  Starter: 'planStarter',
  Pro: 'planPro',
}

/** Lower-case letters, digits and single dashes, at most 24 characters. */
export function slugFrom(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 24)
    .replace(/-+$/g, '')
}

export const isValidSlug = (slug: string) =>
  /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])?$/.test(slug) && !slug.includes('--')

export const isHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value)
