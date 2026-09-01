import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Armchair } from 'lucide-react'
import { getTableOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { useBranchStore } from '@/stores/branch-store'
import { useTableStore } from '@/stores/table-store'
import { useT, useLocalized } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/table/$tableId')({
  component: TableLinkPage,
})

/**
 * The printed table QR encodes https://chillax.site/table/{id}. Unlike a room,
 * there is no session to join - scanning just remembers where the customer is
 * sitting so the order they place carries the table.
 *
 * Deliberately not gated on sign-in: the menu is browsable anonymously and the
 * customer should land on it straight from the camera.
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
  const table = tableQuery.data

  // The QR belongs to a specific branch — switch to it
  useEffect(() => {
    if (table?.branchId != null && Number(table.branchId) !== branchId) {
      setBranchId(Number(table.branchId))
      queryClient.invalidateQueries()
    }
  }, [table?.branchId, branchId, setBranchId, queryClient])

  // Remember where they are sitting (or forget a table that has been retired)
  useEffect(() => {
    if (!table) return
    if (table.isActive) {
      setTable({
        id: Number(table.id),
        name: { en: table.name?.en ?? '', ar: table.name?.ar },
        branchId: Number(table.branchId),
      })
    } else {
      clearTable()
    }
  }, [table, setTable, clearTable])

  if (tableQuery.isLoading) {
    return (
      <div className='p-4'>
        <Skeleton className='h-48 rounded-xl' />
      </div>
    )
  }

  if (tableQuery.isError || !table) {
    return (
      <div className='text-muted-foreground flex h-[60svh] items-center justify-center px-6 text-center'>
        {t('invalidQrCode')}
      </div>
    )
  }

  if (!table.isActive) {
    return (
      <div className='text-muted-foreground flex h-[60svh] items-center justify-center px-6 text-center'>
        {t('tableUnavailable')}
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4 p-4'>
      <Card className='items-center gap-3 p-6 text-center'>
        <div className='bg-primary/10 flex size-14 items-center justify-center rounded-full'>
          <Armchair className='text-primary h-7 w-7' />
        </div>
        <h1 className='text-xl font-bold'>
          {t('youAreAtTable', { tableName: localized(table.name) })}
        </h1>
        <p className='text-muted-foreground text-sm'>
          {t('orderDeliveredToTable')}
        </p>

        <Button
          size='lg'
          className='w-full rounded-full'
          onClick={() => navigate({ to: '/' })}
        >
          {t('browseMenu')}
        </Button>
      </Card>
    </div>
  )
}
