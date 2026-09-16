import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { getTableOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { cartHasItems } from '@/lib/cart'
import { useT } from '@/lib/i18n'

// LEGACY(places): the /table/{id} sticker route — remove when the printed
// room/table stickers are reprinted with /p/{id}.
export const Route = createFileRoute('/table/$tableId')({
  component: TableLinkPage,
})

/**
 * LEGACY(places): the /table/{id} sticker landing (resolves the old table id
 * through /api/tables) — remove when the printed room/table stickers are
 * reprinted with /p/{id}.
 *
 * The older printed table QR encodes https://chillax.site/table/{id}, with
 * the id the table had before the Places remodel. It resolves to the place
 * behind it and continues on the place page.
 */
function TableLinkPage() {
  const { tableId } = Route.useParams()
  const t = useT()
  const navigate = useNavigate()

  const tableQuery = useQuery({
    ...getTableOptions({ path: { id: Number(tableId) } }),
    retry: false,
  })

  useEffect(() => {
    if (tableQuery.isLoading) return
    const placeId = tableQuery.data?.placeId
    if (tableQuery.isError || placeId == null) {
      toast.error(t('invalidQrCode'))
      navigate({ to: cartHasItems() ? '/cart' : '/', replace: true })
      return
    }
    navigate({
      to: '/p/$placeId',
      params: { placeId: String(placeId) },
      replace: true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableQuery.isLoading, tableQuery.isError, tableQuery.data])

  return (
    <div className='flex h-[60svh] items-center justify-center'>
      <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
    </div>
  )
}
