import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTable } from '@tanstack/react-table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { type PromoCodeDto } from '@/api/catalog'
import {
  deletePromoMutation,
  listPromosOptions,
  setPromoActiveMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { formatDay } from '@/lib/business-day'
import { useLocale, useT } from '@/lib/i18n'
import { formatEgp } from '@/lib/money'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  createAppColumnHelper,
  DataTable,
  dataTableFeatures,
} from '@/components/data-table'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { PromoDialog } from './components/promo-dialog'
import { PROMO_KIND } from './promo-kind'

const columnHelper = createAppColumnHelper<PromoCodeDto>()

/**
 * Promo codes customers type at checkout in the app. Catalog quotes and
 * redeems them; the till never sees one (a cashier discounts by hand).
 */
export function PromoCodesManagement() {
  const t = useT()
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PromoCodeDto | null>(null)
  const [deleting, setDeleting] = useState<PromoCodeDto | null>(null)

  const promosQuery = useQuery(
    listPromosOptions({ query: { 'api-version': API_VERSION } })
  )
  const promos = useMemo(() => promosQuery.data ?? [], [promosQuery.data])

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listPromos' }] })

  const setActive = useMutation({
    ...setPromoActiveMutation(),
    onSuccess: invalidate,
    onError: () => toast.error(t('failedToSavePromo')),
  })

  const remove = useMutation({
    ...deletePromoMutation(),
    onSuccess: () => {
      invalidate()
      toast.success(t('promoDeleted'))
      setDeleting(null)
    },
    onError: () => toast.error(t('failedToSavePromo')),
  })

  const day = (iso: string) => new Date(iso).toLocaleDateString(locale)
  // The window ends when the day after its last day begins; show the last day
  const lastDay = (endsAt: string) => {
    const end = new Date(endsAt)
    end.setDate(end.getDate() - 1)
    return day(formatDay(end))
  }

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('code', {
          header: t('promoCode'),
          cell: ({ row }) => (
            <span className='font-mono font-semibold'>{row.original.code}</span>
          ),
        }),
        columnHelper.display({
          id: 'discount',
          header: t('discount'),
          cell: ({ row }) => {
            const p = row.original
            return (
              <div className='flex flex-col'>
                <span className='tabular-nums'>
                  {Number(p.kind) === PROMO_KIND.percent
                    ? `${Number(p.value)}%`
                    : formatEgp(p.value)}
                </span>
                {p.minSubtotal != null && (
                  <span className='text-muted-foreground text-xs tabular-nums'>
                    {t('minimumOrder')} {formatEgp(p.minSubtotal)}
                  </span>
                )}
              </div>
            )
          },
        }),
        columnHelper.display({
          id: 'window',
          header: t('validFrom'),
          cell: ({ row }) => {
            const p = row.original
            if (!p.startsAt && !p.endsAt) return t('always')
            return (
              <span className='tabular-nums'>
                {p.startsAt ? day(p.startsAt) : ''}
                {p.startsAt && p.endsAt ? ' – ' : ''}
                {p.endsAt ? lastDay(p.endsAt) : ''}
              </span>
            )
          },
        }),
        columnHelper.display({
          id: 'uses',
          header: t('uses'),
          cell: ({ row }) => {
            const p = row.original
            return (
              <div className='flex flex-col'>
                <span className='tabular-nums'>
                  {Number(p.uses)}
                  {p.maxUses != null ? ` / ${Number(p.maxUses)}` : ''}
                </span>
                {p.oncePerCustomer && (
                  <span className='text-muted-foreground text-xs'>
                    {t('oncePerCustomer')}
                  </span>
                )}
              </div>
            )
          },
        }),
        columnHelper.display({
          id: 'active',
          header: t('active'),
          cell: ({ row }) => (
            <Switch
              checked={row.original.isActive}
              disabled={setActive.isPending}
              aria-label={row.original.code}
              onCheckedChange={(isActive) =>
                setActive.mutate({
                  path: { id: Number(row.original.id) },
                  body: { isActive },
                  query: { 'api-version': API_VERSION },
                })
              }
            />
          ),
          meta: { className: 'w-[80px]' },
        }),
        columnHelper.display({
          id: 'actions',
          header: '',
          cell: ({ row }) => (
            <div className='flex justify-end'>
              <Button
                variant='ghost'
                size='icon'
                className='size-8'
                aria-label={t('edit')}
                onClick={() => {
                  setEditing(row.original)
                  setDialogOpen(true)
                }}
              >
                <Pencil className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='size-8'
                aria-label={t('delete')}
                onClick={() => setDeleting(row.original)}
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </div>
          ),
          meta: { className: 'w-[90px]' },
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, setActive.isPending]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: promos,
    columns,
    getRowId: (row) => String(row.id),
    enableSorting: false,
    initialState: {
      pagination: { pageIndex: 0, pageSize: Number.MAX_SAFE_INTEGER },
    },
  })

  return (
    <>
      <Main>
        <PageHeader
          title={t('promoCodes')}
          actions={
            <Button
              size='sm'
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              <Plus className='me-2 h-4 w-4' />
              {t('newPromoCode')}
            </Button>
          }
        />

        <DataTable
          table={table}
          isLoading={promosQuery.isLoading}
          emptyMessage={t('noPromoCodes')}
        />
      </Main>

      <PromoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        promo={editing}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        destructive
        title={t('deletePromoCodeQuestion')}
        confirmText={t('delete')}
        isLoading={remove.isPending}
        handleConfirm={() =>
          deleting &&
          remove.mutate({
            path: { id: Number(deleting.id) },
            query: { 'api-version': API_VERSION },
          })
        }
      />
    </>
  )
}
