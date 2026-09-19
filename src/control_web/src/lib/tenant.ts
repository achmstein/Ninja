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
}

export const stepLabelKey: Record<StepStatusName, TranslationKey> = {
  Pending: 'stepPending',
  Running: 'stepRunning',
  Done: 'stepDone',
  Failed: 'stepFailed',
  Skipped: 'stepSkipped',
}

/** A tenant whose stack is mid-change: the screens poll while any is. */
export const isBusy = (status: TenantStatusName) =>
  status === 'Provisioning' || status === 'Destroying'

export const canProvision = (status: TenantStatusName) =>
  status === 'Requested' || status === 'Failed'
export const canStop = (status: TenantStatusName) => status === 'Running'
export const canStart = (status: TenantStatusName) => status === 'Stopped'
export const canUpgrade = (status: TenantStatusName) =>
  status === 'Running' || status === 'Stopped'
export const canDestroy = (status: TenantStatusName) =>
  status !== 'Destroying' && status !== 'Destroyed'
/** A demo becomes a customer; a customer already is one. */
export const canConvert = (kind: TenantKindName, status: TenantStatusName) =>
  kind === 'Demo' && status !== 'Destroying' && status !== 'Destroyed'
export const canImpersonate = (status: TenantStatusName) => status === 'Running'
export const canBackup = (status: TenantStatusName) =>
  status === 'Running' || status === 'Stopped'
/** A stack exists on the box: containers and logs can be read. */
export const isStamped = (status: TenantStatusName) =>
  status === 'Running' || status === 'Stopped' || status === 'Failed' || status === 'Provisioning'

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
