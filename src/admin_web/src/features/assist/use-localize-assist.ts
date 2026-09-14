import { useMutation } from '@tanstack/react-query'
import { type LocalizeRequest, type LocalizeResponse } from '@/api/catalog'
import { localizeMenuTextMutation } from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { toast } from '@/lib/toast'
import { type LocalizedValue } from '@/components/localized-input'
import { assistErrorMessage, useAssistStore } from './errors'
import { halfFilled, hasText, toSide } from './helpers'

// Wire values of Catalog's LocalizeKind (the enum has no string converter)
export const LOCALIZE_MENU_ITEM = 0
export const LOCALIZE_CATEGORY = 1
export const LOCALIZE_STOCK_ITEM = 2

type LocalizeArgs = {
  kind: number
  name: LocalizedValue
  description?: LocalizedValue
  catalogTypeId?: number | null
  suggestCategory?: boolean
  /** Write the description in both languages when there is none yet */
  suggestDescription?: boolean
}

/**
 * One call to the catalog's assistant. The caller decides what to do with
 * `filled`; the hook only talks to the server and toasts on failure. The
 * assistant is hidden (`available === false`) once the server says it is
 * not configured.
 */
export function useLocalizeAssist() {
  const available = useAssistStore((s) => !s.unavailable)
  const mutation = useMutation({
    ...localizeMenuTextMutation(),
    onError: (error) => toast.error(assistErrorMessage(error)),
  })

  const localize = (args: LocalizeArgs): Promise<LocalizeResponse> => {
    const description =
      args.description && hasText(args.description.en + args.description.ar)
        ? toSide(args.description)
        : null
    const body: LocalizeRequest = {
      kind: args.kind,
      name: toSide(args.name),
      description,
      catalogTypeId: args.catalogTypeId ?? null,
      suggestCategory: args.suggestCategory ?? false,
      suggestDescription: args.suggestDescription ?? false,
    }
    return mutation.mutateAsync({ body, query: { 'api-version': API_VERSION } })
  }

  return { localize, isPending: mutation.isPending, available }
}

/** Why the button is disabled, or null when the name is ready to send */
export function localizeBlocker(
  name: LocalizedValue
): 'assistNeedsOneSide' | 'assistBothFilled' | null {
  if (halfFilled(name)) return null
  return hasText(name.en) || hasText(name.ar)
    ? 'assistBothFilled'
    : 'assistNeedsOneSide'
}
