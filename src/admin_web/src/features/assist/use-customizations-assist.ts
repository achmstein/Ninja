import { useMutation } from '@tanstack/react-query'
import { type SuggestCustomizationsResponse } from '@/api/catalog'
import { suggestCustomizationsMutation } from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { toast } from '@/lib/toast'
import { assistErrorMessage, useAssistStore } from './errors'

/**
 * Asks the catalog's assistant for the option groups a saved menu item is
 * ordered with. Nothing is saved: the caller shows the proposals and adds
 * the ones the user keeps through the customization endpoints. Hidden
 * (`available === false`) once the server says the assistant is not set up.
 */
export function useCustomizationsAssist() {
  const available = useAssistStore((s) => !s.unavailable)
  const mutation = useMutation({
    ...suggestCustomizationsMutation(),
    onError: (error) => toast.error(assistErrorMessage(error)),
  })

  const suggest = (itemId: number): Promise<SuggestCustomizationsResponse> =>
    mutation.mutateAsync({
      body: { itemId },
      query: { 'api-version': API_VERSION },
    })

  return { suggest, isPending: mutation.isPending, available }
}
