import { describe, expect, it } from 'vitest'
import {
  billingStanding,
  canConvert,
  isBusy,
  moduleName,
  needsPayment,
  stepStatus,
  subscriptionStatus,
  tenantKind,
  tenantStatus,
} from './tenant'

// The API's enums arrive as names today and arrived as numbers once; the
// readers must take both, and an unknown value must land somewhere safe.
describe('tenant enums', () => {
  it('a status reads from its name, its index, or its index as text', () => {
    expect(tenantStatus('Running')).toBe('Running')
    expect(tenantStatus(2)).toBe('Running')
    expect(tenantStatus('2')).toBe('Running')
    expect(tenantStatus(8)).toBe('Suspended')
    expect(tenantStatus('Nonsense')).toBe('Requested')
    expect(tenantStatus(99)).toBe('Requested')
    expect(tenantStatus(null)).toBe('Requested')
  })

  it('kinds, steps, subscriptions and modules read the same way', () => {
    expect(tenantKind(1)).toBe('Customer')
    expect(tenantKind('Demo')).toBe('Demo')
    expect(stepStatus('Failed')).toBe('Failed')
    expect(stepStatus(2)).toBe('Done')
    expect(subscriptionStatus('PastDue')).toBe('PastDue')
    expect(subscriptionStatus(undefined)).toBe('Active')
    expect(moduleName('Kds')).toBe('Kds')
    expect(moduleName(0)).toBe('Reservations')
  })

  it('a stack mid-change is busy, and only a live demo converts', () => {
    expect(isBusy('Provisioning')).toBe(true)
    expect(isBusy('Upgrading')).toBe(true)
    expect(isBusy('Running')).toBe(false)
    expect(canConvert('Demo', 'Running')).toBe(true)
    expect(canConvert('Demo', 'Destroyed')).toBe(false)
    expect(canConvert('Customer', 'Running')).toBe(false)
  })
})

// The list's money column: which date a row is judged by, how far off it is,
// and how loudly the column says so.
describe('billing standing', () => {
  // The standing is read in the viewer's zone, the same way format.date()
  // renders it, so the count under a date always agrees with the date. These
  // build their instants from local parts to stay true wherever they run.
  const on = (year: number, month: number, day: number, hour = 12) =>
    new Date(year, month - 1, day, hour).toISOString()

  const now = new Date(2026, 8, 23, 10)
  const customer = { kind: 'Customer', subscription: 'Active' }
  const demo = { kind: 'Demo', subscription: 'Trialing' }

  it('a customer is judged by paid-through, a demo by its expiry', () => {
    expect(
      billingStanding({ ...customer, paidThrough: on(2026, 10, 31), expiresAt: on(2026, 9, 1) }, now).days
    ).toBe(38)
    expect(
      billingStanding({ ...demo, paidThrough: on(2026, 10, 31), expiresAt: on(2026, 9, 30) }, now).days
    ).toBe(7)
  })

  it('days are whole days, and the time of day does not move them', () => {
    expect(billingStanding({ ...customer, paidThrough: on(2026, 9, 30, 23) }, now).days).toBe(7)
    expect(billingStanding({ ...customer, paidThrough: on(2026, 9, 23, 0) }, now).days).toBe(0)
    expect(billingStanding({ ...customer, paidThrough: on(2026, 9, 11) }, now).days).toBe(-12)
  })

  it('a period about to lapse is amber, one that has is loud, the rest is quiet', () => {
    expect(billingStanding({ ...customer, paidThrough: on(2026, 12, 31) }, now).tone).toBe('ok')
    expect(billingStanding({ ...customer, paidThrough: on(2026, 9, 30) }, now).tone).toBe('soon')
    expect(billingStanding({ ...customer, paidThrough: on(2026, 9, 23) }, now).tone).toBe('soon')
    expect(billingStanding({ ...customer, paidThrough: on(2026, 9, 22) }, now).tone).toBe('overdue')
  })

  it('the status the API computed outranks the date, because it knows the grace', () => {
    // Past due while the date still reads fine: the API wins
    expect(
      billingStanding({ kind: 'Customer', subscription: 'PastDue', paidThrough: on(2026, 12, 31) }, now).tone
    ).toBe('overdue')
    expect(
      billingStanding({ kind: 'Customer', subscription: 'Suspended', paidThrough: on(2026, 12, 31) }, now).tone
    ).toBe('stopped')
    // A date that has passed is loud on its own, before the API has called it past due
    expect(
      billingStanding({ kind: 'Customer', subscription: 'Active', paidThrough: on(2026, 9, 20) }, now).tone
    ).toBe('overdue')
  })

  it('a tenant that has gone, or never had a date, says nothing', () => {
    expect(
      billingStanding({ kind: 'Customer', subscription: 'Cancelled', paidThrough: on(2026, 1, 1) }, now).tone
    ).toBe('none')
    expect(billingStanding({ ...customer, paidThrough: null }, now).tone).toBe('none')
    expect(billingStanding({ ...customer, paidThrough: null }, now).days).toBeNull()
  })

  it('only the overdue and the stopped are worth chasing today', () => {
    expect(needsPayment('overdue')).toBe(true)
    expect(needsPayment('stopped')).toBe(true)
    expect(needsPayment('soon')).toBe(false)
    expect(needsPayment('ok')).toBe(false)
    expect(needsPayment('none')).toBe(false)
  })
})
