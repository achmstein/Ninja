import { describe, expect, it } from 'vitest'
import { claudeCodeCommand, mcpUrl } from './connect'

describe('mcpUrl', () => {
  it('is the API host with /mcp', () => {
    expect(mcpUrl('https://api.chillax.site')).toBe('https://api.chillax.site/mcp')
  })

  it('never doubles the slash', () => {
    expect(mcpUrl('https://api.slug.example.com/')).toBe('https://api.slug.example.com/mcp')
  })
})

describe('claudeCodeCommand', () => {
  it('registers the ninja-mcp client on the fixed callback port', () => {
    expect(claudeCodeCommand('https://api.chillax.site/mcp')).toBe(
      'claude mcp add --transport http --client-id ninja-mcp --callback-port 8765 ninja https://api.chillax.site/mcp'
    )
  })
})
