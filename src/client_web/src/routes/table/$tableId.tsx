import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { getTableOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { cartHasItems } from '@/lib/cart'
import { useBranchStore } from '@/stores/branch-store'
import { useTableStore } from '@/stores/table-store'
import { useT, useLocalized } from '@/lib/i18n'

export const Route = createFileRoute('/table/$tableId')({
  component: TableLinkPage,
})

/**
 * The printed table QR encodes https://chillax.site/table/{id}.
 *
 * Scanning is a detour, not a destination, so this route is a pass through
 * rather than a landing page: it remembers where they are sitting and puts
 * them back where they were, with a toast. A full cart means they were partway
 * through checkout — often having been sent here by the cart itself, since a
 * guest cannot order without a table — so that is where they return; everyone
 * else came for the menu. Nothing here is gated on sign-in.
 */
function TableLinkPage() {
  const { tableId } = Route.useParams()
  const t = useT()
  const localized = useLocalized()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { branchId, setBranchId } = useBranchStore()
  const setTable = useTableStore((s) => s.setTable)
  const clearTable = useTableStore((s) => s.clearTable)

  const tableQuery = useQuery({
    ...getTableOptions({ path: { id: Number(tableId) } }),
    retry: false,
  })

  // The effect re-runs as the query settles; only act on the first outcome
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current || tableQuery.isLoading) return

    const table = tableQuery.data

    // Read once rather than subscribing: this route acts on its first settled
    // outcome, and cart edits should not re-run it
    const resume = () =>
      navigate({ to: cartHasItems() ? '/cart' : '/', replace: true })

    if (tableQuery.isError || !table) {
      handled.current = true
      toast.error(t('invalidQrCode'))
      resume()
      return
    }

    if (!table.isActive) {
      handled.current = true
      clearTable()
      toast.error(t('tableUnavailable'))
      resume()
      return
    }

    handled.current = true

    // The QR belongs to a specific branch — switch to it
    if (table.branchId != null && Number(table.branchId) !== branchId) {
      setBranchId(Number(table.branchId))
      queryClient.invalidateQueries()
    }

    setTable({
      id: Number(table.id),
      name: { en: table.name?.en ?? '', ar: table.name?.ar },
      branchId: Number(table.branchId),
    })

    // Not a "Success" - the table name is the headline, and the description
    // says what it means for the order they are about to place.
    toast.info(t('youAreAtTable', { tableName: localized(table.name) }), {
      description: t('orderDeliveredToTable'),
    })
    resume()
  }, [
    tableQuery.isLoading,
    tableQuery.isError,
    tableQuery.data,
    branchId,
    setBranchId,
    setTable,
    clearTable,
    queryClient,
    navigate,
    t,
    localized,
  ])

  // Only ever on screen for the moment the lookup takes
  return (
    <div className='flex h-[60svh] items-center justify-center'>
      <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
    </div>
  )
}
