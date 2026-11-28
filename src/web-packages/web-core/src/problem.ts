/**
 * Reading a failed call (docs/frontend-architecture-plan.md, "one way to fail").
 * The services answer every refusal as ProblemDetails with a stable `code` (also
 * its `type`); each app turns the code into its own words, in the user's language.
 */

/** What the server said went wrong, as the code it means it by */
export function problemCode(error: unknown): string | null {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data
  if (!data || typeof data !== 'object') return null
  const { code, type } = data as { code?: unknown; type?: unknown }
  if (typeof code === 'string' && code) return code
  return typeof type === 'string' && /^[a-z]+\.[a-z_]+$/.test(type) ? type : null
}

/** The HTTP status of a failed call, when there was an answer at all */
export function problemStatus(error: unknown): number | null {
  const status = (error as { response?: { status?: unknown } } | null)?.response?.status
  return typeof status === 'number' ? status : null
}

/** The business no longer has the module this call belonged to (the plan or the owner switched it off) */
export function isModuleOff(error: unknown): boolean {
  return problemStatus(error) === 402 || problemCode(error) === 'module.off'
}

/** The server's own words: a ProblemDetails `detail`, else its `title`; undefined when there are none */
export function problemReason(error: unknown): string | undefined {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data
  if (!data || typeof data !== 'object') return undefined
  const { detail, title } = data as { detail?: unknown; title?: unknown }
  return (typeof detail === 'string' && detail) || (typeof title === 'string' && title) || undefined
}
