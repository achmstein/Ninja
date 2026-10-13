import { useQuery } from '@tanstack/react-query'
import { getBranchesOptions } from '@/api/tenant/@tanstack/react-query.gen'
import { useLocalized, useT } from '@/lib/i18n'

/**
 * Any of the business's branches by name, in the till's language, off the
 * public branch list (every active branch, not only the ones this account
 * works at): the branch a delivery is sent to, or came from. A branch the
 * list does not have reads as its number.
 */
export function useBranchName() {
  const localized = useLocalized()
  const { data: branches = [] } = useQuery(getBranchesOptions())
  return (branchId: number | string | null | undefined): string => {
    if (branchId == null) return ''
    const branch = branches.find((b) => Number(b.id) === Number(branchId))
    return localized(branch?.name) || `#${branchId}`
  }
}

/** "Taken by Sara" or, for a delivery another branch's till sent here, "Taken by Sara at Downtown"; null when nobody is named */
export function useTakenByText() {
  const t = useT()
  const branchName = useBranchName()
  return (takenBy: string | null | undefined, takenAtBranchId?: number | string | null): string | null => {
    if (!takenBy) return null
    return takenAtBranchId != null ? t('takenByAt', { name: takenBy, branch: branchName(takenAtBranchId) }) : t('takenBy', { name: takenBy })
  }
}
