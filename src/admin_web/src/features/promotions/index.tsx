import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Plus, Trash2 } from 'lucide-react'
import { type PromotionDto, type PromotionRequest } from '@/api/catalog'
import {
  deletePromotionMutation,
  listPromotionsOptions,
  updatePromotionMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { formatWhen } from '@/lib/when'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { RowActions } from '@/components/row-actions'
import { StatusChip } from '@/components/status-chip'
import { MenuTabs } from '@/features/menu/menu-tabs'
import { promotionPictureUrl } from '@/features/menu/pictures'
import { PromotionSheet } from './components/promotion-sheet'

/** The request that saves a promotion as it is, with only its switch changed */
const asRequest = (p: PromotionDto, isActive: boolean): PromotionRequest => ({
  headline: p.headline,
  link: p.link,
  linkId: p.linkId,
  branchIds: p.branchIds,
  startsAt: p.startsAt,
  endsAt: p.endsAt,
  weekdays: p.weekdays,
  showFrom: p.showFrom,
  showTo: p.showTo,
  isActive,
})

/**
 * Promotions: the popup the customer app opens with while one runs, a
 * picture the owner designed (or Ninja designed from their real photo) with
 * a button to a dish, a category or booking. Shown as the pictures
 * themselves, the way the customer will see them, each saying whether it is
 * on now.
 */
export function PromotionsManagement() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  // Read once as the page opens: whether one has ended or not started yet does not change while it is looked at
  const [now] = useState(() => Date.now())
  const [editing, setEditing] = useState<PromotionDto | null>(null)
  const [deleting, setDeleting] = useState<PromotionDto | null>(null)

  const query = useQuery(
    listPromotionsOptions({ query: { 'api-version': API_VERSION } })
  )
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listPromotions' }] })

  const toggle = useMutation({
    ...updatePromotionMutation(),
    onSuccess: invalidate,
    onError: () => toast.error(t('failedToSavePromotion')),
  })
  const remove = useMutation({
    ...deletePromotionMutation(),
    onSuccess: () => {
      invalidate()
      toast.success(t('promotionDeleted'))
      setDeleting(null)
    },
    onError: () => toast.error(t('failedToSavePromotion')),
  })

  const stateOf = (p: PromotionDto) => {
    if (!p.isActive)
      return <StatusChip tone='muted'>{t('promotionOff')}</StatusChip>
    if (p.endsAt && new Date(p.endsAt).getTime() <= now)
      return <StatusChip tone='muted'>{t('promoEnded')}</StatusChip>
    if (p.startsAt && new Date(p.startsAt).getTime() > now)
      return <StatusChip tone='info'>{t('promoScheduled')}</StatusChip>
    if (p.isLive)
      return <StatusChip tone='success'>{t('promotionLive')}</StatusChip>
    return <StatusChip tone='muted'>{t('promotionResting')}</StatusChip>
  }

  const promotions = query.data ?? []

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
                setOpen(true)
              }}
            >
              <Plus />
              {t('newPromotion')}
            </Button>
          }
        >
          <MenuTabs value='promotions' />
        </PageHeader>

        {query.isError ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : query.isLoading ? (
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className='aspect-[4/5] rounded-2xl' />
            ))}
          </div>
        ) : promotions.length === 0 ? (
          <div className='flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-14 text-center'>
            <Megaphone className='text-muted-foreground size-8' />
            <p className='font-medium'>{t('noPromotions')}</p>
            <p className='text-muted-foreground max-w-sm text-sm'>
              {t('noPromotionsHint')}
            </p>
            <Button
              size='sm'
              onClick={() => {
                setEditing(null)
                setOpen(true)
              }}
            >
              <Plus />
              {t('newPromotion')}
            </Button>
          </div>
        ) : (
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'>
            {promotions.map((p) => (
              <article key={String(p.id)} className='flex flex-col gap-2'>
                <button
                  type='button'
                  onClick={() => {
                    setEditing(p)
                    setOpen(true)
                  }}
                  className='bg-muted relative aspect-[4/5] overflow-hidden rounded-2xl border text-start transition-transform active:scale-[0.98]'
                >
                  {p.pictureUri ? (
                    <img
                      src={promotionPictureUrl(p.id, p.pictureUri, 640)}
                      alt={localized(p.headline)}
                      className={`size-full object-cover ${p.isActive ? '' : 'opacity-50 grayscale'}`}
                    />
                  ) : (
                    <span className='text-muted-foreground grid size-full place-items-center p-4 text-center text-xs'>
                      {t('promotionNoPicture')}
                    </span>
                  )}
                </button>
                <div className='flex items-center gap-2'>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium'>
                      {localized(p.headline)}
                    </p>
                    {/* Its state under the picture, not on it: the design's own headline is where a chip would sit */}
                    <div className='mt-1 flex min-w-0 items-center gap-1.5'>
                      {stateOf(p)}
                      <p className='text-muted-foreground truncate text-xs'>
                        {p.startsAt || p.endsAt
                          ? [p.startsAt, p.endsAt]
                              .map((d) =>
                                d ? formatWhen(d, 'date', locale, t) : ''
                              )
                              .join(' – ')
                          : t('always')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={p.isActive}
                    aria-label={localized(p.headline)}
                    disabled={toggle.isPending}
                    onCheckedChange={(isActive) =>
                      toggle.mutate({
                        path: { id: Number(p.id) },
                        body: asRequest(p, isActive),
                        query: { 'api-version': API_VERSION },
                      })
                    }
                  />
                  <RowActions
                    actions={[
                      {
                        label: t('delete'),
                        icon: Trash2,
                        destructive: true,
                        onSelect: () => setDeleting(p),
                      },
                    ]}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </Main>

      <PromotionSheet open={open} onOpenChange={setOpen} promotion={editing} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        destructive
        title={t('deletePromotionQuestion')}
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
