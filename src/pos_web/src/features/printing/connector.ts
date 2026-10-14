/**
 * The print connector on this PC (src/Ninja.PrintConnector): a Windows
 * service that, besides the kitchen's tickets from the server, takes print
 * jobs from the till on this machine — no internet needed. It answers only
 * this business's till (CORS), and only on the loopback address.
 *
 * Plain fetch, not the API client: no bearer or branch header belongs here,
 * and a connector that is not installed says nothing about the internet.
 */
export const CONNECTOR_URL = 'http://127.0.0.1:17777'

const STATUS_TIMEOUT_MS = 1500
const PRINT_TIMEOUT_MS = 15_000

export type ConnectorStatus = {
  name: string
  version: string
  printers: string[]
}

/** The connector on this PC, or null when none answers (not installed, stopped, or blocked) */
export async function connectorStatus(): Promise<ConnectorStatus | null> {
  try {
    const response = await fetch(`${CONNECTOR_URL}/v1/status`, {
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    })
    if (!response.ok) return null
    const status = (await response.json()) as Partial<ConnectorStatus>
    return {
      name: status.name ?? '',
      version: status.version ?? '',
      printers: Array.isArray(status.printers) ? status.printers : [],
    }
  } catch {
    return null
  }
}

async function post(path: string, body: unknown): Promise<void> {
  const response = await fetch(`${CONNECTOR_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(PRINT_TIMEOUT_MS),
  })
  if (response.ok) return
  let reason = `${response.status}`
  try {
    const answer = (await response.json()) as { error?: string }
    if (answer.error) reason = answer.error
  } catch {
    // no JSON: the status is all there is
  }
  throw new Error(reason)
}

/** Prints a picture of a sheet (base64 PNG, no data: prefix) on a Windows printer */
export function printImage(printer: string, image: string, kickDrawer: boolean) {
  return post('/v1/print', { printer: { name: printer }, image, kickDrawer })
}

/** Opens the cash drawer wired to that printer */
export function openDrawer(printer: string) {
  return post('/v1/drawer', { printer: { name: printer } })
}
