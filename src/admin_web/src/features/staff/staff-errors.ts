import { AxiosError } from 'axios'
import { type TranslationKey } from '@/lib/i18n'

/**
 * Why a staff account was not made or changed, as the owner can act on it:
 * the email already taken, the password refused by the sign-in's rules, or
 * the server's own words. Identity answers `{ message }` for what it checks
 * itself and a ProblemDetails carrying Keycloak's answer for the rest.
 */
export function staffError(
  error: unknown
): { key: TranslationKey } | { text: string } | null {
  if (!(error instanceof AxiosError) || !error.response) return null
  const { status, data } = error.response
  if (status === 409) return { key: 'staffEmailTaken' }

  const body = (data ?? {}) as {
    message?: string
    detail?: string
    title?: string
  }
  const said = body.message || body.detail || body.title || ''
  // Keycloak's password policy: "Registration failed: {"errorMessage":"invalidPassword…"}"
  if (/invalidPassword/i.test(said)) return { key: 'staffPasswordRejected' }
  if (/same email|email.*exists|exists.*email/i.test(said))
    return { key: 'staffEmailTaken' }
  return said ? { text: said } : null
}
