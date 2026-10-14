/**
 * The owner's assistant is the business's own MCP server, behind the API host
 * at /mcp (docs/owner-assistant.md). The address must be exactly what the
 * server's Assistant:PublicUrl says, byte for byte: no trailing slash.
 */
export function mcpUrl(apiOrigin: string): string {
  return `${apiOrigin.replace(/\/+$/, '')}/mcp`
}

/**
 * The realm's public client for the assistant's sign-in (docs/owner-assistant.md):
 * Claude's connector takes it under Advanced settings, Claude Code on its command line.
 */
export const MCP_CLIENT_ID = 'ninja-mcp'

/**
 * Claude Code's one-time registration, as the doc gives it: the realm's
 * public ninja-mcp client and the fixed callback port its redirect URIs allow.
 */
export function claudeCodeCommand(url: string): string {
  return `claude mcp add --transport http --client-id ${MCP_CLIENT_ID} --callback-port 8765 ninja ${url}`
}
