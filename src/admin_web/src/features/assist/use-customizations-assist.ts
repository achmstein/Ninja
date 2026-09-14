import { useMutation } from '@tanstack/react-query'
import {
  type LocalizedText,
  type SuggestCustomizationsRequest,
  type SuggestCustomizationsResponse,
} from '@/api/catalog'
import { suggestCustomizationsMutation } from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { toast } from '@/lib/toast'
import { type LocalizedValue } from '@/components/localized-input'
import { assistErrorMessage, useAssistStore } from './errors'
import { hasText, toSide } from './helpers'

/** The item as the form has it; saved or not yet */
type SuggestArgs = {
  name: LocalizedValue
  description?: LocalizedValue
  catalogTypeId?: number | null
  /** As typed; 0 when the price field is still empty */
  price?: number
  /** Groups the item already has, so none is proposed twice */
  existingGroups?: (LocalizedText | null | undefined)[]
}

/**
 * Asks the catalog's assistant for the option groups a menu item is ordered
 * with, from the item as the form has it — so it works before the first
 * save too. Nothing is saved: the caller shows the proposals and creates
 * the ones the user keeps. Hidden (`available === false`) once the server
 * says the assistant is not set up.
 */
export function useCustomizationsAssist() {
  const available = useAssistStore((s) => !s.unavailable)
  const mutation = useMutation({
    ...suggestCustomizationsMutation(),
    onError: (error) => toast.error(assistErrorMessage(error)),
  })

  const suggest = (
    args: SuggestArgs
  ): Promise<SuggestCustomizationsResponse> => {
    const body: SuggestCustomizationsRequest = {
      name: toSide(args.name),
      description:
        args.description && hasText(args.description.en + args.description.ar)
          ? toSide(args.description)
          : null,
      catalogTypeId: args.catalogTypeId ?? null,
      price: args.price ?? 0,
      existingGroups: (args.existingGroups ?? []).flatMap((name) =>
        name ? [name] : []
      ),
    }
    return mutation.mutateAsync({ body, query: { 'api-version': API_VERSION } })
  }

  return { suggest, isPending: mutation.isPending, available }
}
