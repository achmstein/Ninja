import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  type SuggestPairingsRequest,
  type SuggestPairingsResponse,
} from '@/api/catalog'
import { suggestPairingsMutation } from '@/api/catalog/@tanstack/react-query.gen'
import { getItemPairsReportOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useContentLanguages } from '@/lib/content-languages'
import { toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { assistErrorMessage } from './errors'
import { useAiAvailable } from './use-ai-available'

/** Long enough for a slow item to show a habit, short enough to be this menu */
export const PAIRS_WINDOW_DAYS = 90

/**
 * Asks the catalog's assistant what to suggest alongside a saved item. What
 * the item was bought with over the last 90 days (the till's tickets) goes
 * along, so real habits outweigh guesses; a business without the till, or a
 * report that fails, still gets proposals from the menu alone. Nothing is
 * saved: the caller adds the proposals to the list for the owner to keep.
 */
export function usePairingsAssist(itemId: number) {
  const available = useAiAvailable()
  const languages = useContentLanguages()
  const queryClient = useQueryClient()
  // From the click, through the sales report, to the assistant's answer
  const [asking, setAsking] = useState(false)
  const mutation = useMutation({
    ...suggestPairingsMutation(),
    onError: (error) => toast.error(assistErrorMessage(error)),
  })

  const boughtWith = async () => {
    const to = new Date()
    const from = new Date(to.getTime() - PAIRS_WINDOW_DAYS * 86_400_000)
    try {
      return await queryClient.fetchQuery({
        ...getItemPairsReportOptions({
          query: {
            'api-version': API_VERSION,
            itemId,
            from: from.toISOString(),
            to: to.toISOString(),
          },
        }),
      })
    } catch {
      return null
    }
  }

  const suggest = async (args: {
    /** The list as it stands, saved or not */
    current: number[]
    /** The owner's own instructions */
    note?: string
  }): Promise<SuggestPairingsResponse> => {
    setAsking(true)
    try {
      const report = await boughtWith()
      const body: SuggestPairingsRequest = {
        itemId,
        current: args.current,
        together: (report?.pairs ?? []).map((p) => ({
          catalogItemId: toNumber(p.catalogItemId),
          together: toNumber(p.together),
        })),
        ticketsWithItem: toNumber(report?.ticketsWithItem ?? 0),
        languages,
        note: args.note?.trim() || null,
      }
      return await mutation.mutateAsync({
        body,
        query: { 'api-version': API_VERSION },
      })
    } finally {
      setAsking(false)
    }
  }

  return { suggest, isPending: asking, available }
}
