import { describe, expect, it } from 'vitest'
import { platformLink } from './platform-link'

describe('where Powered by ninja leads', () => {
  it('names the business by its label on the platform domain', () => {
    expect(platformLink('https://ninjapp.net/apps', 'mellow.ninjapp.net')).toBe('https://ninjapp.net/?ref=mellow&utm_medium=guest-app')
  })
  it('names a business on its own domain by that domain', () => {
    expect(platformLink('https://ninjapp.net/apps', 'order.mellow.cafe')).toBe('https://ninjapp.net/?ref=order.mellow.cafe&utm_medium=guest-app')
  })
})
