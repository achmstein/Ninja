import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type BundleDealDto } from '@/api/catalog'
import {
  deleteBundleMutation,
  getBundlesOptions,
  listItemsOptions,
  toggleBundleActiveMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { ImageWithFallback } from '@/components/image-fallback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { useLocalized, useT } from '@/lib/i18n'
import { formatEgp } from '@/features/orders/status'
import { bundlePictureUrl } from './columns'
import { BundleDialog } from './components/bundle-dialog'

export function BundleDeals() {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedBundle, setSelectedBundle] = useState<BundleDealDto | null>(
    null
  )
  const [deletingBundle, setDeletingBundle] = useState<BundleDealDto | null>(
    null
  )
  const [filter, setFilter] = useState('')

  const { data: bundles = [], isLoading } = useQuery(
    getBundlesOptions({
      query: { includeInactive: true, 'api-version': API_VERSION },
    })
  )
  const { data: items = [] } = useQuery(
    listItemsOptions({ query: { 'api-version': API_VERSION } })
  )

  const invalidateBundles = () =>
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getBundles' }] })

  const toggleActive = useMutation({
    ...toggleBundleActiveMutation(),
    onSuccess: () => invalidateBundles(),
    onError: () => {
      invalidateBundles()
      toast.error(t('failedToUpdateBundle'))
    },
  })

  const deleteBundle = useMutation({
    ...deleteBundleMutation(),
    onSuccess: () => {
      invalidateBundles()
      toast.success(t('bundleDeleted'))
      setDeletingBundle(null)
    },
    onError: () => toast.error(t('failedToDeleteBundle')),
  })

  const visibleBundles = useMemo(() => {
    const term = filter.trim().toLowerCase()
    return [...bundles]
      .filter(
        (bundle) =>
          !term ||
          bundle.name?.en?.toLowerCase().includes(term) ||
          bundle.name?.ar?.includes(filter.trim())
      )
      .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
  }, [bundles, filter])

  return (
    <>
      <Header />

      <Main fixed>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <div>
              <h1 className='text-2xl font-bold tracking-tight'>
                {t('bundleDeals')}
              </h1>
              <p className='text-muted-foreground'>{t('bundlesSubtitle')}</p>
            </div>
          </div>
          <Button
            onClick={() => {
              setSelectedBundle(null)
              setDialogOpen(true)
            }}
          >
            <Plus className='me-2 h-4 w-4' />
            {t('createBundle')}
          </Button>
        </div>

        <div className='my-4 flex items-center sm:my-0'>
          <Input
            placeholder={t('filterBundlesPlaceholder')}
            className='h-9 w-40 sm:my-4 lg:w-[250px]'
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <Separator className='shadow-sm' />

        {isLoading ? (
          <div className='grid gap-4 pt-4 md:grid-cols-2 lg:grid-cols-3'>
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className='h-40' />
            ))}
          </div>
        ) : visibleBundles.length === 0 ? (
          <div className='text-muted-foreground flex flex-col items-center gap-2 py-16 text-center'>
            <Package className='h-10 w-10 opacity-40' />
            {t('noBundleDeals')}
          </div>
        ) : (
          <ul className='no-scrollbar grid gap-4 overflow-auto pt-4 pb-8 md:grid-cols-2 lg:grid-cols-3'>
            {visibleBundles.map((bundle) => {
              const original = Number(bundle.originalPrice ?? 0)
              const price = Number(bundle.bundlePrice ?? 0)
              const savings =
                original > price && original > 0
                  ? Math.round((1 - price / original) * 100)
                  : 0
              return (
                <li
                  key={String(bundle.id)}
                  className='flex flex-col overflow-hidden rounded-lg border hover:shadow-md'
                >
                  <ImageWithFallback
                    src={
                      bundle.pictureUri
                        ? bundlePictureUrl(bundle.id, bundle.pictureUri)
                        : null
                    }
                    className='aspect-video w-full'
                    fallbackIcon={
                      <Package className='text-muted-foreground/40 h-8 w-8' />
                    }
                  />
                  <div className='flex flex-1 flex-col gap-2 p-4'>
                    <div className='flex items-start justify-between gap-2'>
                      <h2 className='flex min-w-0 items-baseline gap-2 font-semibold'>
                        <span className='truncate'>
                          {localized(bundle.name)}
                        </span>
                      </h2>
                      <div className='flex shrink-0 items-center gap-1'>
                        <Switch
                          checked={bundle.isActive ?? false}
                          aria-label={`Toggle ${bundle.name?.en}`}
                          onCheckedChange={(checked) =>
                            toggleActive.mutate({
                              path: { id: Number(bundle.id) },
                              body: { isActive: checked },
                              query: { 'api-version': API_VERSION },
                            })
                          }
                        />
                        <Button
                          variant='ghost'
                          size='icon'
                          className='size-8'
                          aria-label={`Edit ${bundle.name?.en}`}
                          onClick={() => {
                            setSelectedBundle(bundle)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='size-8'
                          aria-label={`Delete ${bundle.name?.en}`}
                          onClick={() => setDeletingBundle(bundle)}
                        >
                          <Trash2 className='text-destructive h-4 w-4' />
                        </Button>
                      </div>
                    </div>
                    <p className='text-muted-foreground text-sm'>
                      {(bundle.items ?? [])
                        .map(
                          (item) =>
                            `${Number(item.quantity ?? 1)}× ${localized(item.itemName)}`
                        )
                        .join(' · ')}
                    </p>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium'>{formatEgp(price)}</span>
                      {original > price && (
                        <span className='text-muted-foreground text-sm line-through'>
                          {formatEgp(original)}
                        </span>
                      )}
                      {savings > 0 && (
                        <Badge variant='secondary' className='text-xs'>
                          {t('savePercent', { percent: savings })}
                        </Badge>
                      )}
                      {!bundle.isActive && (
                        <Badge variant='outline' className='text-xs'>
                          {t('inactive')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Main>

      <BundleDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setSelectedBundle(null)
        }}
        bundle={selectedBundle}
        items={items}
        existingCount={bundles.length}
      />

      <AlertDialog
        open={!!deletingBundle}
        onOpenChange={() => setDeletingBundle(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteBundleConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteItemConfirmation', {
                name: localized(deletingBundle?.name),
              })}{' '}
              {t('cannotBeUndone')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBundle.isPending}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deletingBundle &&
                deleteBundle.mutate({
                  path: { id: Number(deletingBundle.id) },
                  query: { 'api-version': API_VERSION },
                })
              }
              disabled={deleteBundle.isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteBundle.isPending && (
                <Loader2 className='me-2 h-4 w-4 animate-spin' />
              )}
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
