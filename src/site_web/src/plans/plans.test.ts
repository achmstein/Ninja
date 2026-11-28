import { ar } from '@/content/ar'
import { en } from '@/content/en'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { INCLUDED, MODULES } from './plans'

const source = readFileSync(path.resolve(__dirname, '../../../Control.API/Platform/Plans.cs'), 'utf8')

/** The names inside `{ ... }` or `[ ... ]` after `marker`, as Module.X */
function modulesAfter(marker: string, close: string): string[] {
  const from = source.indexOf(marker)
  expect(from, marker).toBeGreaterThan(-1)
  const body = source.slice(from, source.indexOf(close, from))
  return [...body.matchAll(/Module\.(\w+)/g)].map((m) => m[1])
}

describe('the plans on the page', () => {
  it('list the modules the control plane has', () => {
    const body = source.slice(source.indexOf('public enum Module'), source.indexOf('public static class PlanCatalog'))
    const names = [...body.matchAll(/^\s{4}(\w+),/gm)].map((m) => m[1])
    expect(names).toEqual([...MODULES])
  })

  it('include what the control plane includes', () => {
    expect(modulesAfter('[TenantPlan.Free] =', '}').sort()).toEqual([...INCLUDED.Free].sort())
    expect(modulesAfter('[TenantPlan.Starter] =', '}').sort()).toEqual([...INCLUDED.Starter].sort())
    const leftOut = modulesAfter('[TenantPlan.Pro] = All.Except(', ')')
    expect(MODULES.filter((m) => !leftOut.includes(m)).sort()).toEqual([...INCLUDED.Pro].sort())
  })
})

/** Every path through a value, with what kind of thing sits at its end */
function shape(value: unknown, at = ''): string[] {
  if (Array.isArray(value)) return [`${at}[${value.length}]`, ...value.flatMap((v, i) => shape(v, `${at}.${i}`))]
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => shape(v, `${at}.${k}`))
  return [`${at}:${typeof value}`]
}

describe('the two languages', () => {
  it('say the same things: every English line has its Arabic, and lists are as long', () => {
    expect(shape(ar)).toEqual(shape(en))
  })

  it('name every module', () => {
    for (const m of MODULES) expect(en.plans.modules[m]).toBeTruthy()
  })
})
