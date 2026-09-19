import { AxiosError } from 'axios'

/** The `detail` of a ProblemDetails response, when the error carries one. */
export function problemDetail(error: unknown): string | undefined {
  if (!(error instanceof AxiosError)) return undefined
  const data = error.response?.data as
    | { detail?: string; title?: string }
    | undefined
  return data?.detail || data?.title || undefined
}
