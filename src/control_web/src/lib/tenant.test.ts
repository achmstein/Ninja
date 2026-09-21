import { describe, expect, it } from 'vitest'
import {
  canConvert,
  isBusy,
  moduleName,
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
    expect(moduleName(0)).toBe('Spaces')
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
