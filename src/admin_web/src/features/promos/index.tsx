import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTable } from '@tanstack/react-table'
import { Plus, Trash2 } from 'lucide-react'
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
import { Dot, ListRow } from '@/components/list-row'
import { PageHeader } from '@/components/page-header'
import { RowActions } from '@/components/row-actions'
import { StatusChip } from '@/components/status-chip'
import { MenuTabs } from '@/features/menu/menu-tabs'
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

  const discountOf = (p: PromoCodeDto) =>
    [
      Number(p.kind) === PROMO_KIND.percent
        ? `${Number(p.value)}%`
        : formatEgp(p.value),
      p.minSubtotal != null &&
        `${t('minimumOrder')} ${formatEgp(p.minSubtotal)}`,
    ]
      .filter(Boolean)
      .join(' · ')

  const windowOf = (p: PromoCodeDto) =>
    !p.startsAt && !p.endsAt
      ? t('always')
      : `${p.startsAt ? day(p.startsAt) : ''}${p.startsAt && p.endsAt ? ' – ' : ''}${p.endsAt ? lastDay(p.endsAt) : ''}`

  /** Outside its days, a code is switched on and still takes nothing: say so */
  const stateOf = (p: PromoCodeDto) => {
    const now = Date.now()
    if (p.endsAt && new Date(p.endsAt).getTime() <= now)
      return <StatusChip tone='muted'>{t('promoEnded')}</StatusChip>
    if (p.startsAt && new Date(p.startsAt).getTime() > now)
      return <StatusChip tone='info'>{t('promoScheduled')}</StatusChip>
    if (p.maxUses != null && Number(p.uses) >= Number(p.maxUses))
      return <StatusChip tone='muted'>{t('promoUsedUp')}</StatusChip>
    return null
  }

  const activeSwitch = (p: PromoCodeDto) => (
    <Switch
      checked={p.isActive}
      disabled={setActive.isPending}
      aria-label={p.code}
      onClick={(e) => e.stopPropagation()}
      onCheckedChange={(isActive) =>
        setActive.mutate({
          path: { id: Number(p.id) },
          body: { isActive },
          query: { 'api-version': API_VERSION },
        })
      }
    />
  )

  const usesOf = (p: PromoCodeDto) => {
    const uses = Number(p.uses)
    const max = p.maxUses != null ? Number(p.maxUses) : null
    return (
      <div className='flex min-w-24 flex-col gap-1'>
        <span className='text-sm tabular-nums'>
          {uses}
          {max != null && (
            <span className='text-muted-foreground'> / {max}</span>
          )}
        </span>
        {max != null && max > 0 && (
          <span className='bg-muted h-1 w-full overflow-hidden rounded-full'>
            <span
              className='bg-primary block h-full rounded-full'
              style={{ width: `${Math.min(100, (uses / max) * 100)}%` }}
            />
          </span>
        )}
        {p.oncePerCustomer && (
          <span className='text-muted-foreground text-xs'>
            {t('oncePerCustomer')}
          </span>
        )}
      </div>
    )
  }

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('code', {
          header: t('promoCode'),
          cell: ({ row }) => (
            <div className='flex flex-col leading-tight'>
              <span className='flex items-center gap-2'>
                <span className='font-mono font-semibold'>
                  {row.original.code}
                </span>
                {stateOf(row.original)}
              </span>
              <span className='text-muted-foreground text-xs tabular-nums'>
                {discountOf(row.original)}
              </span>
            </div>
          ),
        }),
        columnHelper.display({
          id: 'window',
          header: t('validFrom'),
          meta: { emphasis: 'muted' },
          cell: ({ row }) => (
            <span className='tabular-nums'>{windowOf(row.original)}</span>
          ),
        }),
        columnHelper.display({
          id: 'uses',
          header: t('uses'),
          cell: ({ row }) => usesOf(row.original),
        }),
        columnHelper.display({
          id: 'active',
          header: t('active'),
          cell: ({ row }) => activeSwitch(row.original),
          meta: { className: 'w-[80px]' },
        }),
        columnHelper.display({
          id: 'actions',
          header: '',
          cell: ({ row }) => (
            <RowActions
              actions={[
                {
                  label: t('delete'),
                  icon: Trash2,
                  destructive: true,
                  onSelect: () => setDeleting(row.original),
                },
              ]}
            />
          ),
          meta: { className: 'w-[48px]' },
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
          title={t('menu')}
          actions={
            <Button
              size='sm'
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              <Plus />
              {t('newPromoCode')}
            </Button>
          }
        >
          <MenuTabs value='offers' />
        </PageHeader>

        <DataTable
          table={table}
          isLoading={promosQuery.isLoading}
          emptyMessage={t('noPromoCodes')}
          onRowClick={(row) => {
            setEditing(row.original)
            setDialogOpen(true)
          }}
          mobileRow={({ original: p }) => (
            <div className='flex items-center gap-3'>
              <ListRow
                className='flex-1'
                title={
                  <span className='flex items-center gap-2'>
                    <span className='font-mono font-semibold'>{p.code}</span>
                    {stateOf(p)}
                  </span>
                }
                meta={
                  <>
                    <span className='tabular-nums'>{discountOf(p)}</span>
                    <Dot />
                    <span className='tabular-nums'>{windowOf(p)}</span>
                  </>
                }
                trailing={
                  <span className='tabular-nums'>
                    {Number(p.uses)}
                    {p.maxUses != null && (
                      <span className='text-muted-foreground font-normal'>
                        {' '}
                        / {Number(p.maxUses)}
                      </span>
                    )}
                  </span>
                }
              />
              {activeSwitch(p)}
            </div>
          )}
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
